import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import "./styles.scss";
import { hasHostDictation, startHostRecording } from "../../utils/hostDictation";
import {
  hasContextStore,
  collections as loadCollections,
  records as loadRecords,
  notes as loadNotes,
  search as runSearch,
  save as saveNote,
  remove as removeNote,
} from "../../utils/hostContext";

// RFC-055 — THE CONTEXT SURFACE. His ask: see every store, query it (by voice), and edit what's
// there. The store is a HARNESS capability; this is a reader/editor over it, never its owner.
//
// Three kinds of source, deliberately kept as their own sections because they answer to different
// owners (the exact ownership split the scopes were built on):
//   • context  — system / project / agent NOTES. Editable: notes are truth, the vector re-derives.
//   • tools     — what discovery + the SystemLynx tier indexed. Read-only: derived, not his to edit.
//   • external  — CLAUDE.md and the like. Read-only, its own section because it comes from a source
//                 the store doesn't own ("that can be a separate section" — his words). Deferred to
//                 the next pass; the seam is here (a section list), the reader is not wired yet.
//
// He asked for it to not need to be perfect: this is the working surface, structure upgrades later.
const SCOPES = [
  { key: "system", label: "System", hint: "harness & SystemView conventions — every agent" },
  { key: "project", label: "Project", hint: "this repo's facts" },
  { key: "agent", label: "Agent", hint: "lessons for the agent slot" },
];

const when = (iso) => {
  if (!iso) return "";
  const d = Date.parse(iso);
  if (!d) return "";
  const days = Math.floor((Date.now() - d) / 86400000);
  return days <= 0 ? "today" : days === 1 ? "yesterday" : days < 30 ? `${days}d ago` : `${Math.floor(days / 30)}mo ago`;
};

const ContextManager = ({ projectCode, agentId, focus = null }) => {
  const available = hasContextStore();
  const [cols, setCols] = useState([]);
  const [scope, setScope] = useState("system");
  const [items, setItems] = useState([]); // notes for the active scope
  const [q, setQ] = useState("");
  const [hits, setHits] = useState(null); // null = not searched; [] = searched, empty
  const [searchErr, setSearchErr] = useState("");
  const [recording, setRecording] = useState(false);
  const [editing, setEditing] = useState(null); // {id, title, body, pointer}
  const [openHits, setOpenHits] = useState(() => new Set());
  const [armedDel, setArmedDel] = useState(false); // collapsed by default, each row independent
  const [tools, setTools] = useState([]);
  const recRef = useRef(null);

  const scopeArg = useCallback(
    (key) => (key === "project" ? `project:${projectCode}` : key === "agent" ? `agent:${agentId || projectCode}` : "system"),
    [projectCode, agentId]
  );

  const refresh = useCallback(async () => {
    setCols(await loadCollections());
    setItems(await loadNotes(scopeArg(scope)));
  }, [scope, scopeArg]);

  useEffect(() => {
    if (available) refresh();
  }, [available, refresh]);

  // Picking an agent up top focuses the agent scope below — the merged page's filter.
  useEffect(() => {
    if (agentId) setScope("agent");
  }, [agentId]);

  // The profile's knowledge counts drive this filter too (his call: they lead straight into this
  // section). `focus.n` bumps on every click so clicking the same count again still refocuses.
  useEffect(() => {
    if (focus && focus.scope) setScope(focus.scope);
  }, [focus]);

  useEffect(() => {
    if (available) loadRecords("mcp-tools").then((r) => setTools((r && r.records) || []));
  }, [available]);

  const doSearch = useCallback(
    async (query) => {
      const text = (query != null ? query : q).trim();
      if (!text) {
        setHits(null);
        setSearchErr("");
        return;
      }
      setSearchErr("");
      // Search every ctx-* collection the surface can see, merged and ranked — the same answer an
      // agent's context() call would get. All-fail is "store unavailable", NOT "no matches".
      const targets = cols.filter((c) => c.collection.startsWith("ctx-")).map((c) => c.collection);
      if (!targets.length) {
        setHits([]);
        return;
      }
      const all = await Promise.all(targets.map((c) => runSearch(c, text, { k: 8, min: 0.35 }).catch(() => null)));
      if (all.every((r) => r === null)) {
        setSearchErr("context store unavailable — this is not an empty result");
        setHits([]);
        return;
      }
      setHits(
        all
          .filter(Boolean)
          .flat()
          .sort((a, b) => b.score - a.score)
          .slice(0, 12)
      );
    },
    [q, cols]
  );

  // VOICE — his default input. Reuses the host recorder; segments land in the query box as they
  // commit, and stopping runs the search. Text still works; voice is the fast path.
  const toggleMic = useCallback(async () => {
    if (recording) {
      const r = recRef.current;
      recRef.current = null;
      setRecording(false);
      if (r) await r.stop();
      doSearch();
      return;
    }
    if (!hasHostDictation()) return;
    setRecording(true);
    setQ("");
    recRef.current = await startHostRecording({
      onSegment: (text) => setQ((prev) => [prev, text].filter(Boolean).join(" ").trim()),
    });
  }, [recording, doSearch]);

  const beginEdit = (n) => { setArmedDel(false); setEditing({ id: n.id, title: n.title, body: n.body, pointer: n.pointer || "" }); };
  const commitEdit = async () => {
    if (!editing) return;
    await saveNote(scopeArg(scope), editing.id, {
      title: editing.title,
      body: editing.body,
      pointer: editing.pointer || null,
    });
    setEditing(null);
    refresh();
  };
  const doDelete = async (id) => {
    await removeNote(scopeArg(scope), id);
    setEditing(null);
    refresh();
  };

  if (!available)
    return (
      <div className="ctx-mgr ctx-mgr--empty">
        <p>The context store is a harness capability — open this inside the SystemView browser to manage it.</p>
      </div>
    );

  const activeScope = SCOPES.find((s) => s.key === scope);

  return (
    <div className="ctx-mgr">
      <div className="ctx-mgr__query">
        <input
          className="ctx-mgr__q-input"
          value={q}
          placeholder="Ask the context store — the same answer an agent gets…"
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && doSearch()}
        />
        {hasHostDictation() && (
          <button
            className={`ctx-mgr__mic${recording ? " ctx-mgr__mic--on" : ""}`}
            onClick={toggleMic}
            title={recording ? "Stop and search" : "Ask by voice"}
          >
            {recording ? "◼" : "🎙"}
          </button>
        )}
        <button className="ctx-mgr__go" onClick={() => doSearch()}>
          Search
        </button>
        {hits !== null && (
          <button
            className="ctx-mgr__clear"
            onClick={() => {
              setHits(null);
              setQ("");
              setSearchErr("");
            }}
          >
            Clear
          </button>
        )}
      </div>

      {searchErr && <div className="ctx-mgr__err">{searchErr}</div>}

      {/* RESULTS — a table, the same shape the chat shows: store results are data you scan, not text
          you read (his rule, across the board). Match / note / from, and a row expands its body. */}
      {hits !== null && !searchErr && (
        <div className="ctx-mgr__results">
          <div className="ctx-mgr__section-head">
            {hits.length} match{hits.length === 1 ? "" : "es"}
          </div>
          {!hits.length && (
            <div className="ctx-mgr__none">Nothing recorded matches — that's a true empty, safe to proceed.</div>
          )}
          {!!hits.length && (
            <table className="ctx-mgr__hits">
              <thead>
                <tr>
                  <th>match</th>
                  <th>note</th>
                  <th>from</th>
                  <th className="ctx-mgr__hit-allth">
                    {hits.filter((h) => (h.text || "").split("\n").slice(1).join(" ").trim()).length > 1 && (() => {
                      const withBody = hits.map((h, i) => ((h.text || "").split("\n").slice(1).join(" ").trim() ? i : -1)).filter((i) => i >= 0);
                      const allOpen = withBody.every((i) => openHits.has(i));
                      return (
                        <button
                          type="button"
                          className="ctx-mgr__hit-all"
                          title={allOpen ? "Collapse all" : "Expand all"}
                          onClick={() => setOpenHits(allOpen ? new Set() : new Set(withBody))}
                        >
                          {allOpen ? "−" : "+"}
                        </button>
                      );
                    })()}
                  </th>
                </tr>
              </thead>
              <tbody>
                {hits.map((h, i) => {
                  const body = (h.text || "").split("\n").slice(1).join(" ").trim();
                  const scopeLabel = (h.meta && h.meta.scope) || h.scope || "";
                  return (
                    <React.Fragment key={h.id}>
                      <tr
                        className={`ctx-mgr__hit-tr${openHits.has(i) ? " ctx-mgr__hit-tr--open" : ""}`}
                        onClick={() =>
                          setOpenHits((o) => {
                            const n = new Set(o);
                            n.has(i) ? n.delete(i) : n.add(i);
                            return n;
                          })
                        }
                      >
                        <td className="ctx-mgr__score">{h.score.toFixed(2)}</td>
                        <td className="ctx-mgr__hit-title">{(h.meta && h.meta.title) || h.id}</td>
                        <td className="ctx-mgr__hit-scope">{scopeLabel}</td>
                        <td className="ctx-mgr__hit-caret">{body ? (openHits.has(i) ? "−" : "+") : ""}</td>
                      </tr>
                      {openHits.has(i) && body && (
                        <tr className="ctx-mgr__hit-detail">
                          <td colSpan={4}>
                            {body}
                            {h.meta && h.meta.pointer && <div className="ctx-mgr__note-ptr">→ {h.meta.pointer}</div>}
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* CONTEXT NOTES — editable, per scope: his corrections, made once, kept forever. */}
      <div className="ctx-mgr__scopes">
        {SCOPES.map((s) => {
          const col = cols.find(
            (c) => c.collection === (s.key === "system" ? "ctx-system" : `ctx-${s.key}-${projectCode}`)
          );
          return (
            <button
              key={s.key}
              className={`ctx-mgr__scope${scope === s.key ? " ctx-mgr__scope--on" : ""}`}
              onClick={() => setScope(s.key)}
              title={s.hint}
            >
              {s.label}
              <span className="ctx-mgr__scope-count">{col ? col.count : 0}</span>
            </button>
          );
        })}
      </div>

      <div className="ctx-mgr__notes">
        <div className="ctx-mgr__section-head">
          {activeScope.label} — {activeScope.hint}
        </div>
        {!items.length && <div className="ctx-mgr__none">No notes in this scope yet.</div>}
        {items.map((n) =>
          editing && editing.id === n.id ? (
            <div key={n.id} className="ctx-mgr__note ctx-mgr__note--editing">
              <input
                className="ctx-mgr__edit-title"
                value={editing.title}
                onChange={(e) => setEditing({ ...editing, title: e.target.value })}
              />
              <textarea
                className="ctx-mgr__edit-body"
                value={editing.body}
                rows={Math.min(10, Math.max(3, Math.ceil(editing.body.length / 60)))}
                onChange={(e) => setEditing({ ...editing, body: e.target.value })}
              />
              <input
                className="ctx-mgr__edit-ptr"
                value={editing.pointer}
                placeholder="pointer (optional) — <pc>:path/to/file"
                onChange={(e) => setEditing({ ...editing, pointer: e.target.value })}
              />
              <div className="ctx-mgr__edit-actions">
                <button className="ctx-mgr__save" onClick={commitEdit}>
                  Save
                </button>
                <button className="ctx-mgr__cancel" onClick={() => { setArmedDel(false); setEditing(null); }}>
                  Cancel
                </button>
                {armedDel ? (
                  <>
                    <button className="ctx-mgr__del ctx-mgr__del--confirm" onClick={() => { doDelete(n.id); setArmedDel(false); }}>
                      Confirm delete
                    </button>
                    <button className="ctx-mgr__cancel" onClick={() => setArmedDel(false)}>
                      Keep
                    </button>
                  </>
                ) : (
                  <button className="ctx-mgr__del" onClick={() => setArmedDel(true)}>
                    Delete
                  </button>
                )}
              </div>
            </div>
          ) : (
            <div key={n.id} className="ctx-mgr__note" onClick={() => beginEdit(n)}>
              <div className="ctx-mgr__note-head">
                <span className="ctx-mgr__note-title">{n.title}</span>
                <span className="ctx-mgr__note-meta">
                  {n.by ? `by ${n.by} · ` : ""}
                  {n.hits > 0 ? `${n.hits} hit${n.hits === 1 ? "" : "s"}` : "never retrieved"}
                  {n.created ? ` · ${when(n.created)}` : ""}
                </span>
              </div>
              <div className="ctx-mgr__note-body">{n.body}</div>
              {n.pointer && <div className="ctx-mgr__note-ptr">→ {n.pointer}</div>}
            </div>
          )
        )}
      </div>

      {/* TOOLS — read-only: derived from tools/list and loaded services, not his to edit. */}
      <div className="ctx-mgr__tools">
        <div className="ctx-mgr__section-head">Tools indexed for discovery ({tools.length}) — read-only</div>
        {tools.map((t) => (
          <div key={t.id} className="ctx-mgr__tool">
            <span className="ctx-mgr__tool-kind">{(t.meta && t.meta.kind) || "?"}</span>
            <span className="ctx-mgr__tool-name">{(t.meta && (t.meta.callable || t.meta.namespace)) || t.id}</span>
            <span className="ctx-mgr__tool-desc">{(t.meta && t.meta.description) || t.text}</span>
          </div>
        ))}
        {!tools.length && (
          <div className="ctx-mgr__none">No tools indexed — attach a service or wire an MCP server.</div>
        )}
      </div>
    </div>
  );
};

export default ContextManager;
