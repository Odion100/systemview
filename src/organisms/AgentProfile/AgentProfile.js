import React, { useCallback, useEffect, useRef, useState } from "react";
import "./styles.scss";
import {
  hasAgents,
  listDefs,
  saveDef,
  removeDef,
  listDocs,
  listSkills,
  liveSessions,
  agentRuns,
} from "../../utils/hostAgents";
import { collections as loadCollections, records as loadRecords } from "../../utils/hostContext";
import SvSelect from "../../atoms/SvSelect/SvSelect";

// RFC-055 — THE AGENT PROFILE. One window where he sees and changes EVERYTHING feeding an agent.
// The rules this page runs on (all his):
//   - Docs open in the RIGHT panel (onOpenDoc lifts them) — code view + markdown, not textareas.
//   - A skill IS a doc that loads ON DEMAND; the always-loaded docs and the skills are one family,
//     split only by when they load. Both open in the same panel.
//   - Everything says WHAT it is and HOW it can be managed — and what can't be managed says how it
//     COULD be. Nothing sits unexplained.
//   - Unselecting the agent IS minimizing; no fold button.
//   - The knowledge counts filter the context section directly below.
const asList = (v) => (Array.isArray(v) ? v : []);

const INTERNAL_MCP = new Set(["worklist", "discovery", "systemlynx", "context"]);

const ago = (ts) => {
  if (!ts) return "";
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
};

const AgentProfile = ({ onSelect, onOpenDoc, onFilterScope, urlAgent = null, urlDoc = null } = {}) => {
  const available = hasAgents();
  const [defs, setDefs] = useState([]);
  const [live, setLive] = useState([]);
  const [runs, setRuns] = useState({});
  const [sel, setSel] = useState(null); // selected agent record
  const [draft, setDraft] = useState(null); // editable copy
  const [cols, setCols] = useState([]);
  const [docs, setDocs] = useState(null); // null = harness can't answer yet
  const [skills, setSkills] = useState(null);
  const [saving, setSaving] = useState(false);
  const [armedDel, setArmedDel] = useState(false);
  const [newSrv, setNewSrv] = useState({ name: "", url: "" }); // the whitelist add form
  // THE AUDIT VIEW (his ask: "I can see the list but I can't see enough"): what each MCP method
  // actually SAYS to the agent — description + parameters — pulled from the discovery index
  // (the same text findTool searches). Click a method name to read it.
  const [toolIndex, setToolIndex] = useState({});
  const [openTool, setOpenTool] = useState(null);
  const [wiped, setWiped] = useState(null); // delete feedback line

  const refresh = useCallback(async () => {
    const [list, ls, rs, cs, tix] = await Promise.all([listDefs(), liveSessions(), agentRuns(), loadCollections(), loadRecords("mcp-tools")]);
    setDefs(list);
    setLive(ls);
    setRuns(rs);
    setCols(cs);
    const idx = {};
    ((tix && tix.records) || []).forEach((r) => {
      if (r.meta && r.meta.kind === "mcp" && r.meta.callable) idx[r.meta.callable] = r.text;
    });
    setToolIndex(idx);
    return list;
  }, []);

  useEffect(() => {
    if (!available) return;
    refresh();
    const on = () => refresh();
    window.addEventListener("sv:botHub", on);
    return () => window.removeEventListener("sv:botHub", on);
  }, [available, refresh]);

  const close = () => {
    setSel(null);
    setDraft(null);
    setArmedDel(false);
    if (typeof onSelect === "function") onSelect(null);
  };

  const open = async (rec) => {
    // Clicking the active agent again UNSELECTS it — that is the minimize (his call).
    if (draft && draft.id === rec.id) return close();
    setSel(rec);
    setDraft(JSON.parse(JSON.stringify(rec)));
    setArmedDel(false);
    setWiped(null);
    if (typeof onSelect === "function") onSelect(rec.id);
    const ds = await listDocs(rec.id);
    const sk = await listSkills(rec.id);
    setDocs(ds);
    setSkills(sk);
    // URL RESTORE, second half: the doc named in the query string reopens once its content is
    // here. Consumed once — after that, clicks own the panel.
    const want = restoreRef.current.doc;
    if (want && typeof onOpenDoc === "function") {
      restoreRef.current.doc = null;
      if (want.kind === "def") {
        onOpenDoc(defDoc(rec));
      } else if (want.kind === "doc") {
        const hit = (ds || []).find((x) => x.key === want.key);
        if (hit) onOpenDoc({ kind: "doc", agentId: rec.id, key: hit.key, label: hit.label, where: hit.where, text: hit.text, orig: hit.text });
      } else {
        const hit = (sk || []).find((x) => x.name === want.name && x.where === want.where);
        if (hit) onOpenDoc({ kind: "skill", agentId: rec.id, name: hit.name, where: hit.where, label: hit.name, text: hit.text, orig: hit.text });
      }
    }
  };

  // URL RESTORE, first half: the agent named in the query string opens itself once the defs are
  // here — a refresh lands where he was (his call). Consumed once.
  const restoreRef = useRef({ agent: urlAgent, doc: urlDoc });
  useEffect(() => {
    const want = restoreRef.current.agent;
    if (!want || sel || !defs.length) return;
    restoreRef.current.agent = null;
    const rec = defs.find((r) => r.id === want);
    if (rec) open(rec);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [defs]);

  const setDef = (patch) => setDraft((d) => ({ ...d, def: { ...d.def, ...patch } }));

  // THE PHYSICAL FILE (his ask: "where's the physical document?"). Every def-backed section —
  // tools, mcp wiring, gating — is really ~/.autobot/agents/<id>.json. The ▤ opens that file
  // itself in the doc panel, raw and editable — the alternative view, always available.
  const defDoc = (rec) => ({
    kind: "def",
    agentId: rec.id,
    label: `${rec.id}.json`,
    where: `~/.autobot/agents/${rec.id}.json`,
    language: "json",
    text: JSON.stringify(rec, null, 2),
    orig: JSON.stringify(rec, null, 2),
  });
  const openDefFile = () => typeof onOpenDoc === "function" && sel && onOpenDoc(defDoc(sel));

  const save = async () => {
    setSaving(true);
    try {
      // Hand the whole record back so every field round-trips; the harness normalizes.
      await saveDef({ id: draft.id, name: draft.name, ...draft.def, projectCode: draft.projectCode, cwd: draft.cwd, permissionMode: draft.permissionMode, def: undefined });
      const list = await refresh();
      const fresh = list.find((r) => r.id === draft.id);
      if (fresh) {
        setSel(fresh);
        setDraft(JSON.parse(JSON.stringify(fresh)));
      }
    } finally {
      setSaving(false);
    }
  };

  if (!available)
    return (
      <div className="agent-profile agent-profile--empty">
        <p>Agent management is a harness capability — open this inside the SystemView browser.</p>
      </div>
    );

  const d = draft && draft.def ? draft.def : {};
  const agentNotes = draft ? cols.find((c) => c.collection === `ctx-agent-${draft.id}`) : null;
  const projectNotes = draft && draft.projectCode ? cols.find((c) => c.collection === `ctx-project-${draft.projectCode}`) : null;
  const systemNotes = cols.find((c) => c.collection === "ctx-system");
  const dirty = sel && draft && JSON.stringify(sel) !== JSON.stringify(draft);

  const liveOf = (id) => live.filter((s) => s.agentId === id);
  const selLive = draft ? liveOf(draft.id) : [];
  const selRuns = draft ? runs[draft.id] : null;
  // THE REAL LISTS — a running session's init message first, else the last recorded run's.
  const caps = (selLive.find((s) => s.capabilities) || {}).capabilities || (selRuns && selRuns.capabilities) || null;

  // TOOLS, BY KIND — his taxonomy: built into Claude Code (allow/deny is the only lever), or a
  // reflection of an MCP server's functions (manage the server; ours are harness source). The
  // toggle writes the definition's disallowedTools — per-agent deny, saved with Save.
  const disallowed = new Set(asList(d.disallowedTools));
  const toggleTool = (t) => {
    const next = new Set(disallowed);
    if (next.has(t)) next.delete(t);
    else next.add(t);
    setDef({ disallowedTools: [...next] });
  };
  const toolGroups = caps
    ? (() => {
        const groups = [];
        const byServer = new Map();
        const builtin = [];
        for (const t of asList(caps.tools)) {
          if (t.startsWith("mcp__")) {
            const parts = t.split("__");
            const server = parts[1] || "?";
            if (!byServer.has(server)) byServer.set(server, []);
            byServer.get(server).push(t);
          } else builtin.push(t);
        }
        groups.push({
          key: "builtin",
          label: "built into Claude Code",
          hint: "The harness's own tools — their behavior ships with Claude Code. Your lever is allow/deny per agent: uncheck to deny.",
          tools: builtin,
        });
        for (const [server, tools] of byServer) {
          groups.push({
            key: server,
            server, // an MCP SERVER whose METHODS are offered as tools — not a sibling tool list
            label: server,
            hint: INTERNAL_MCP.has(server)
              ? "Its methods, offered to the model as tools. Harness server — behavior lives in harness source, editable in code. Deny per agent here."
              : "Its methods, offered to the model as tools. Wired below — manage the server there; deny per method here.",
            tools,
          });
        }
        return groups;
      })()
    : null;

  const skillEnabled = caps ? new Set(asList(caps.skills).map((s) => s.name || String(s))) : null;

  return (
    <div className="agent-profile">
      {/* The roster — every defined agent. Click opens; clicking the active one closes (that IS
          minimize). Green dot = running right now. */}
      <div className="agent-profile__roster">
        {defs.map((r) => (
          <button
            key={r.id}
            className={`agent-profile__chip${draft && draft.id === r.id ? " agent-profile__chip--on" : ""}`}
            onClick={() => open(r)}
          >
            <span className={`agent-profile__dot${liveOf(r.id).length ? " agent-profile__dot--live" : ""}`} />
            {r.name}
          </button>
        ))}
        {!defs.length && <span className="agent-profile__none">No agents defined yet.</span>}
      </div>

      {wiped && <div className="agent-profile__wiped">{wiped}</div>}

      {draft && (
        <div className="agent-profile__body">
          <div className="agent-profile__head">
            <div>
              <div className="agent-profile__name">
                {draft.name}
                {selLive.length > 0 && <span className="agent-profile__live-tag">running now</span>}
              </div>
              <div className="agent-profile__sub">
                {draft.projectCode || "no project"}
                {draft.cwd ? ` · ${draft.cwd}` : ""}
              </div>
              {/* GATING, PROMINENT (his call) — whether this agent must ASK before acting. It read
                  as a mystery word buried in the sub line; now it's a control that says what it
                  means. Rides the definition; applies at the agent's next session. */}
              <div className="agent-profile__gating">
                <span className="agent-profile__gating-label">gating</span>
                {/* Same closed look as before (his call: "the look is very good already") — only
                    the click changed: it opens OUR menu, not the browser's. */}
                <SvSelect
                  value={draft.permissionMode || ""}
                  onChange={(v) => setDraft((dr) => ({ ...dr, permissionMode: v || null }))}
                  options={[
                    { value: "", label: "shell default" },
                    { value: "default", label: "asks first" },
                    { value: "acceptEdits", label: "auto-accepts edits" },
                    { value: "plan", label: "plan only — no changes" },
                    { value: "bypassPermissions", label: "open — never asks", hot: true },
                  ]}
                />
                <span className="agent-profile__gating-note">must it ask before acting? · applies at next session</span>
              </div>
              <div className="agent-profile__sub">
                {selRuns ? `${selRuns.runs} recorded session${selRuns.runs === 1 ? "" : "s"} · last active ${ago(selRuns.lastActive)}` : "no recorded sessions"}
                {selLive.length > 0 && ` · live in ${selLive.map((s) => s.projectCode).join(", ")}`}
              </div>
            </div>
            <div className="agent-profile__head-actions">
              <button
                className="agent-profile__filelink agent-profile__filelink--head"
                title={`The whole definition on disk — ~/.autobot/agents/${draft.id}.json`}
                onClick={openDefFile}
              >
                ▤ file
              </button>
              {dirty && (
                <button className="agent-profile__save" onClick={save} disabled={saving}>
                  {saving ? "Saving…" : "Save"}
                </button>
              )}
              {armedDel ? (
                <>
                  <button
                    className="agent-profile__del agent-profile__del--confirm"
                    onClick={async () => {
                      const name = draft.name;
                      const n = selRuns ? selRuns.runs : 0;
                      const notes = agentNotes ? agentNotes.count : 0;
                      await removeDef(draft.id);
                      close();
                      setWiped(`Deleted ${name} — definition, ${notes} agent note${notes === 1 ? "" : "s"}, and ${n} recorded session${n === 1 ? "" : "s"} wiped.`);
                      refresh();
                    }}
                  >
                    {selLive.length ? "Confirm delete (running!)" : "Confirm delete"}
                  </button>
                  <button className="agent-profile__cancel" onClick={() => setArmedDel(false)}>
                    Cancel
                  </button>
                </>
              ) : (
                <button className="agent-profile__del" onClick={() => setArmedDel(true)}>
                  Delete
                </button>
              )}
            </div>
          </div>

          {/* THE DOCS — one family, split by WHEN they load. Always-loaded first, then the skills
              (on demand). Click any of them: it opens in the right panel for reading and editing. */}
          <div className="agent-profile__section">
            <div className="agent-profile__section-head">Docs — loaded every session</div>
            <div className="agent-profile__hint">
              Injected at session start, every session. <b>agent doc</b> = this agent's standing
              instructions, stored in its definition, follows it anywhere. <b>CLAUDE.md</b> = the
              project's standing instructions, in the repo, applies to any agent working there.
            </div>
            {docs === null ? (
              <div className="agent-profile__none">The harness can't answer yet — relaunch the browser to arm the docs API.</div>
            ) : (
              <div className="agent-profile__docs">
                {docs.map((doc) => (
                  <button
                    key={doc.key}
                    className="agent-profile__doc-chip"
                    onClick={() =>
                      typeof onOpenDoc === "function" &&
                      onOpenDoc({ kind: "doc", agentId: draft.id, key: doc.key, label: doc.label, where: doc.where, text: doc.text, orig: doc.text })
                    }
                  >
                    <span className="agent-profile__doc-ico">▤</span>
                    {doc.label}
                    {!doc.text && <span className="agent-profile__doc-empty">nothing written yet</span>}
                  </button>
                ))}
                {!docs.length && <span className="agent-profile__none">Nothing written yet.</span>}
              </div>
            )}
          </div>

          <div className="agent-profile__section">
            <div className="agent-profile__section-head">Skills — docs loaded on demand</div>
            <div className="agent-profile__hint">
              Shared files (user level or the project's <code>.claude/skills</code>) — editing one
              edits it for every agent that uses it. The agent carries only each skill's name and
              description all session; the <b>description is the trigger</b>, the body loads when it
              fires. Click to read and edit.
            </div>
            {skills === null ? (
              <div className="agent-profile__none">The harness can't answer yet — relaunch the browser to arm the skills API.</div>
            ) : (
              <div className="agent-profile__docs">
                {skills.map((s) => (
                  <button
                    key={`${s.where}:${s.name}`}
                    className={`agent-profile__doc-chip${skillEnabled && !skillEnabled.has(s.name) ? " agent-profile__doc-chip--off" : ""}`}
                    title={s.description}
                    onClick={() =>
                      typeof onOpenDoc === "function" &&
                      onOpenDoc({ kind: "skill", agentId: draft.id, name: s.name, where: s.where, label: s.name, text: s.text, orig: s.text })
                    }
                  >
                    <span className="agent-profile__doc-ico">◈</span>
                    {s.name}
                    <span className="agent-profile__doc-where">{s.where}</span>
                  </button>
                ))}
                {!skills.length && <span className="agent-profile__none">No skill files found for this agent's homes.</span>}
              </div>
            )}
          </div>

          {/* TOOLS vs MCP TOOLS — two SECTIONS, same title format (his call): tools are Claude
              Code's own; MCP tools are servers offering their methods. Checkbox = allowed;
              unchecking writes the definition's per-agent deny list either way. */}
          <div className="agent-profile__section">
            <div className="agent-profile__section-head">
              Tools
              <button className="agent-profile__filelink" title={`The file behind this — ~/.autobot/agents/${draft.id}.json`} onClick={openDefFile}>▤</button>
            </div>
            {toolGroups ? (
              toolGroups.filter((g) => !g.server).map((g) => (
                <div key={g.key} className="agent-profile__toolgroup">
                  <div className="agent-profile__toolgroup-head">{g.label} ({g.tools.length})</div>
                  <div className="agent-profile__hint">{g.hint}</div>
                  <div className="agent-profile__caps">
                    {g.tools.map((t) => (
                      <label key={t} className={`agent-profile__tooltoggle${disallowed.has(t) ? " agent-profile__tooltoggle--off" : ""}`}>
                        <input type="checkbox" checked={!disallowed.has(t)} onChange={() => toggleTool(t)} />
                        {t}
                      </label>
                    ))}
                  </div>
                </div>
              ))
            ) : (
              <div className="agent-profile__none">The real list arrives with the agent's first session (the SDK init handshake carries it).</div>
            )}
          </div>

          {/* INTERNAL vs EXTERNAL MCP TOOLS — two sections (his call): the harness's own servers
              and the wired-in ones are different animals and read separately. */}
          {[
            {
              title: "Internal MCP tools",
              hint: "The harness's own servers — always present. Behavior lives in harness source, editable in code; deny per method here.",
              match: (g) => INTERNAL_MCP.has(g.server),
            },
            {
              title: "External MCP tools",
              hint: "Servers wired into this agent's whitelist below. Manage the server there; deny per method here.",
              match: (g) => !INTERNAL_MCP.has(g.server),
            },
          ].map(({ title, hint, match }) => {
            const groups = toolGroups ? toolGroups.filter((g) => g.server && match(g)) : null;
            return (
              <div key={title} className="agent-profile__section">
                <div className="agent-profile__section-head">
                  {title}
                  <button className="agent-profile__filelink" title={`The file behind this — ~/.autobot/agents/${draft.id}.json`} onClick={openDefFile}>▤</button>
                </div>
                <div className="agent-profile__hint">{hint}</div>
                {groups ? (
                  groups.map((g) => (
                    <div key={g.key} className="agent-profile__toolgroup">
                      <div className="agent-profile__toolgroup-head">
                        <span className={`agent-profile__srv agent-profile__srv--${g.server}`}>{g.server}</span>
                        <span className="agent-profile__srv-kind">{g.tools.length} method{g.tools.length === 1 ? "" : "s"}</span>
                      </div>
                      <div className="agent-profile__caps">
                        {g.tools.map((t) => (
                          <span key={t} className={`agent-profile__tooltoggle${disallowed.has(t) ? " agent-profile__tooltoggle--off" : ""}${openTool === t ? " agent-profile__tooltoggle--open" : ""}`}>
                            <input type="checkbox" checked={!disallowed.has(t)} onChange={() => toggleTool(t)} />
                            {/* the NAME opens the audit view; the checkbox stays the allow/deny */}
                            <button
                              className="agent-profile__tool-name"
                              title="What this method says to the agent — description and parameters"
                              onClick={() => setOpenTool(openTool === t ? null : t)}
                            >
                              {t.split("__").slice(2).join("__")}
                            </button>
                          </span>
                        ))}
                      </div>
                      {openTool && g.tools.includes(openTool) && (
                        <div className="agent-profile__tooldetail">
                          {toolIndex[openTool] ||
                            "Not in the discovery index yet — it fills when discovery reindexes (a session touching findTool refreshes it)."}
                        </div>
                      )}
                    </div>
                  ))
                ) : (
                  <div className="agent-profile__none">The real list arrives with the agent's first session.</div>
                )}
                {groups && !groups.length && <div className="agent-profile__none">None.</div>}
              </div>
            );
          })}
          {asList(d.disallowedTools).length > 0 && (
            <div className="agent-profile__hint">Denied for this agent: {asList(d.disallowedTools).join(", ")} — Save writes it to the definition.</div>
          )}

          {/* MCP SERVERS — the wiring the mcp tools above come from. This is also exactly the
              index discovery's findTool searches. */}
          <div className="agent-profile__section">
            <div className="agent-profile__section-head">
              MCP servers {caps ? `(${asList(caps.mcpServers).length})` : `(${asList(d.mcpServers).length})`}
              <button className="agent-profile__filelink" title={`The file behind this — ~/.autobot/agents/${draft.id}.json`} onClick={openDefFile}>▤</button>
            </div>
            <div className="agent-profile__hint">
              These serve the <code>mcp</code> tool groups above — and this list is the index the
              discovery server's findTool searches. Internal servers (worklist, discovery,
              systemlynx, context) are harness source: always present here, editable in code.
              External ones are wired by the definition and can be removed.
            </div>
            <table className="agent-profile__mcp">
              <tbody>
                {(caps ? asList(caps.mcpServers) : asList(d.mcpServers)).map((m, i) => {
                  const name = m.name || `#${i}`;
                  const internal = INTERNAL_MCP.has(name);
                  const inDef = asList(d.mcpServers).findIndex((x) => (x.name || "") === name);
                  return (
                    <tr key={name + i}>
                      <td className="agent-profile__mcp-name">{name}</td>
                      <td className="agent-profile__mcp-url">
                        {m.status ? <span className={`agent-profile__mcp-status agent-profile__mcp-status--${m.status === "connected" ? "on" : "off"}`}>{m.status}</span> : (m.url || m.command || "")}
                      </td>
                      <td>
                        {internal ? (
                          <span className="agent-profile__mcp-lock" title="Harness server — always present; its tools are harness source">built-in</span>
                        ) : inDef >= 0 ? (
                          <button
                            className="agent-profile__mcp-del"
                            title="Remove from definition"
                            onClick={() => setDef({ mcpServers: asList(d.mcpServers).filter((_, j) => j !== inDef) })}
                          >
                            ×
                          </button>
                        ) : null}
                      </td>
                    </tr>
                  );
                })}
                {!(caps ? asList(caps.mcpServers).length : asList(d.mcpServers).length) && (
                  <tr>
                    <td className="agent-profile__none" colSpan={3}>
                      The real list arrives with the agent's first session.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
            {/* EDIT THE WHITELIST (his ask): add a server here — it lands in the definition's
                mcpServers on Save and loads at the agent's next session. */}
            <div className="agent-profile__mcp-add">
              <input
                className="agent-profile__mcp-input"
                placeholder="name"
                value={newSrv.name}
                onChange={(e) => setNewSrv((s) => ({ ...s, name: e.target.value }))}
              />
              <input
                className="agent-profile__mcp-input agent-profile__mcp-input--url"
                placeholder="url (http…) or command"
                value={newSrv.url}
                onChange={(e) => setNewSrv((s) => ({ ...s, url: e.target.value }))}
              />
              <button
                className="agent-profile__mcp-addbtn"
                disabled={!newSrv.name.trim() || !newSrv.url.trim()}
                onClick={() => {
                  const name = newSrv.name.trim();
                  const v = newSrv.url.trim();
                  const entry = /^https?:\/\//.test(v) ? { name, url: v } : { name, command: v };
                  setDef({ mcpServers: [...asList(d.mcpServers), entry] });
                  setNewSrv({ name: "", url: "" });
                }}
              >
                add server
              </button>
            </div>
          </div>

          {/* KNOWLEDGE — the retrieved layer (context() pulls these while working). The counts
              FILTER the context section directly below — this section leads into it. */}
          <div className="agent-profile__section agent-profile__section--last">
            <div className="agent-profile__section-head">Knowledge feeding this agent</div>
            <div className="agent-profile__hint">
              The context store — notes retrieved on demand while working, never injected wholesale.
              Click a count to filter the section below to that scope.
            </div>
            <div className="agent-profile__knows">
              <button className="agent-profile__know" onClick={() => typeof onFilterScope === "function" && onFilterScope("agent")}>
                <span className="agent-profile__know-n">{agentNotes ? agentNotes.count : 0}</span> agent notes
              </button>
              <button className="agent-profile__know" onClick={() => typeof onFilterScope === "function" && onFilterScope("project")}>
                <span className="agent-profile__know-n">{projectNotes ? projectNotes.count : 0}</span> project notes
              </button>
              <button className="agent-profile__know" onClick={() => typeof onFilterScope === "function" && onFilterScope("system")}>
                <span className="agent-profile__know-n">{systemNotes ? systemNotes.count : 0}</span> system notes
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AgentProfile;
