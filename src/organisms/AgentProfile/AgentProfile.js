import React, { useCallback, useEffect, useRef, useState } from "react";
import "./styles.scss";
import {
  hasAgents,
  listDefs,
  saveDef,
  removeDef,
  listDocs,
  listSkills,
  createSkill,
  listHelp,
  liveSessions,
  refreshSession,
  agentRuns,
  listHooks,
  saveHook,
  removeHook,
  contextStats,
} from "../../utils/hostAgents";
import { collections as loadCollections, records as loadRecords } from "../../utils/hostContext";
import SvSelect from "../../atoms/SvSelect/SvSelect";
import { raiseKeyed, clearKeyed } from "../../atoms/Banner/bannerStore";

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

const INTERNAL_MCP = new Set(["worklist", "discovery", "systemlynx", "context", "systemview"]);

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
  // which session is mid-re-init — the press disables itself rather than firing twice into a
  // session that is already being torn down and reopened
  const [reinitting, setReinitting] = useState(null);
  // the banner's action closes over this ref, so a card raised on one render still calls the
  // current handler rather than a stale copy of it
  const doReinitRef = useRef(() => {});
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
  // CONTEXT HOOKS. `hookEvents` is the vocabulary the harness actually emits — the picker is built
  // from it rather than typed, so a hook can only ever attach to a moment that really happens.
  // `hookDraft` is the one being edited (null = the list is just being read).
  const [hooks, setHooks] = useState([]);
  const [hookEvents, setHookEvents] = useState([]);
  // ambient fields ride EVERY event (stamped at the fire choke point) — offered beside the
  // event's own fields in every when-condition
  const [hookAmbient, setHookAmbient] = useState([]);
  const [hookDraft, setHookDraft] = useState(null);
  const [hookErr, setHookErr] = useState("");
  // WHAT THIS AGENT PAYS EVERY TURN, before it is asked anything. The store's numbers answer
  // "is this note earning its place"; these layers are never retrieved, so frequency means
  // nothing and SIZE is the whole story.
  const [weight, setWeight] = useState(null);
  const [pageDocs, setPageDocs] = useState([]); // page-level docs — scoped to no agent, tagged by side
  // agent-side = Presence + System context: they load into EVERY agent, so they get their OWN
  // section ABOVE this agent's docs (his call — same presentation, but shown at the level they
  // actually live at). human-side = the defining-agents help, which belongs by the roster.
  const everyAgentDocs = pageDocs.filter((d) => d.side === "agent");
  const humanHelp = pageDocs.filter((d) => d.side !== "agent");

  const refresh = useCallback(async () => {
    const [list, ls, rs, cs, tix, hk] = await Promise.all([
      listDefs(), liveSessions(), agentRuns(), loadCollections(), loadRecords("mcp-tools"), listHooks(),
    ]);
    setDefs(list);
    setHooks(hk.hooks);
    setHookEvents(hk.events);
    setHookAmbient(hk.ambient || []);
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

  // Page-level help — loaded once, scoped to no agent. Empty stays empty (old harness → the chip
  // just won't appear). URL restore rides here too: a `help:<key>` in the query reopens without
  // needing an agent selected, since help belongs to no agent.
  useEffect(() => {
    if (!available) return;
    listHelp().then((h) => {
      const list = h || [];
      setPageDocs(list);
      const want = restoreRef.current.doc;
      if (want && want.kind === "help" && typeof onOpenDoc === "function") {
        const hit = list.find((x) => x.key === want.key);
        if (hit) {
          restoreRef.current.doc = null;
          onOpenDoc({ kind: "help", key: hit.key, label: hit.label, where: hit.where, text: hit.text, orig: hit.text });
        }
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [available]);

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

  // OPEN MEANS READ (his catch: "why wouldn't it load it on open?"). The page docs were fetched
  // once at mount, so a file changed by anyone else — a shell, another window, an agent — opened
  // stale. No poller: the click itself is the trigger, which is the moment that actually matters.
  const openPageDoc = async (d) => {
    if (typeof onOpenDoc !== "function") return;
    const fresh = (await listHelp()) || [];
    if (fresh.length) setPageDocs(fresh);
    const hit = fresh.find((x) => x.key === d.key) || d;
    onOpenDoc({ kind: "help", key: hit.key, label: hit.label, where: hit.where, text: hit.text, orig: hit.text });
  };

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

  // THE OFFER FOLLOWS YOU OUT OF THE PAGE. A stale agent matters while you are reading its chat,
  // not only while you happen to be standing on its profile — so it rides the app's one message
  // channel (Banner) instead of being a second floating card designed from scratch. Keyed, so it
  // updates in place rather than stacking one per re-render; sticky, because an offer that times
  // out is an offer missed.
  //
  // ABOVE THE EARLY RETURN ON PURPOSE: every hook in this component has to run on every render or
  // the hook order changes the first time `available` flips.
  const staleSig = live
    .filter((x) => x.stale)
    .map((x) => `${x.key}:${asList(x.staleParts).join(",")}`)
    .join("|");
  // Re-measured whenever the selected agent changes — and after a save, since editing a doc is
  // the one act that moves these numbers.
  useEffect(() => {
    let gone = false;
    (async () => {
      const st = draft ? await contextStats(draft.id) : null;
      if (!gone) setWeight(st && st.weight ? st.weight : null);
    })();
    return () => { gone = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft && draft.id, saving]);

  useEffect(() => {
    const stale = live.filter((x) => x.stale);
    if (!stale.length) {
      clearKeyed("agent-stale");
      return;
    }
    const x = stale[0];
    const parts = asList(x.staleParts);
    raiseKeyed(
      "agent-stale",
      "warn",
      `${x.agentName || x.projectCode} is running the definition it opened with`,
      parts.length ? `changed since it started — ${parts.join(", ")}` : "",
      { sticky: true, action: { label: "re-init", run: () => doReinitRef.current(x.key) } },
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [staleSig]);

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

  const doReinit = async (key) => {
    setReinitting(key);
    try {
      await refreshSession(key);
      // read the roster back rather than assuming it worked — the new session reports its own
      // composition, so `stale` clearing is the proof, not an optimistic local flip
      setLive((await liveSessions()) || []);
    } finally {
      setReinitting(null);
    }
  };

  doReinitRef.current = doReinit;

  // ---- CONTEXT HOOKS -------------------------------------------------------------------------
  // EVERY HOOK IS SHOWN TO EVERY AGENT. Writing one makes it exist for everybody; the switch is
  // per agent, exactly like a skill — so you never re-create the same hook on four profiles and
  // then own four copies that drift. Carrying is the agent's own list.
  const carried = new Set(asList(d.hooks));
  const carriesHook = (name) => carried.has(name);
  // A SWITCH TAKES EFFECT WHEN YOU PRESS IT. Everything else on this page is a form field that
  // Save commits — but a button reading "enabled" is not a field, it is a claim about the world,
  // and leaving it sitting in an unsaved draft meant he enabled three hooks, re-initialized, and
  // watched them come back disabled. Correctly: nothing had been written.
  //
  // It saves against the LAST SAVED record, not the draft, so flipping one switch never quietly
  // commits unrelated edits someone is still making above it. Only the hooks field moves.
  const toggleHook = async (name) => {
    if (!sel || !draft) return;
    const next = new Set(carried);
    if (next.has(name)) next.delete(name);
    else next.add(name);
    const hooksNext = [...next];
    setDef({ hooks: hooksNext }); // optimistic — the switch must move under the finger
    try {
      const base = sel.def || {};
      await saveDef({
        id: sel.id,
        name: sel.name,
        ...base,
        hooks: hooksNext,
        projectCode: sel.projectCode,
        cwd: sel.cwd,
        permissionMode: sel.permissionMode,
        def: undefined,
      });
      const list = await refresh();
      const fresh = list.find((r) => r.id === sel.id);
      // Re-seat the saved record so `dirty` does not now claim an edit that is already on disk.
      if (fresh) setSel(fresh);
    } catch {
      setDef({ hooks: [...carried] }); // put it back — a switch that lies is worse than one that fails
    }
  };
  const eventNamed = (n) => hookEvents.find((e) => e.name === n) || null;
  // every field a `when` may use on this event: its own, then the ambient set — and the preset
  // values a field declares, so the surface OFFERS them instead of asking anyone to type from memory
  const condFields = (on) => [
    ...(((eventNamed(on) || {}).fields) || []).map((f) => ({ value: f, label: f })),
    ...hookAmbient.map((a) => ({ value: a.name, label: `${a.name} · ambient` })),
  ];
  const valuesFor = (on, field) => {
    const ev = eventNamed(on);
    const v = ev && ev.values && ev.values[field];
    return Array.isArray(v) ? v : null;
  };
  // `when` is stored as an object; the editor works in ROWS because that is what a human edits.
  // The two shapes convert here and nowhere else.
  const whenRows = (when) =>
    Object.entries(when || {}).map(([field, cond]) => {
      if (cond && typeof cond === "object" && !Array.isArray(cond)) {
        const [op, val] = Object.entries(cond)[0] || ["contains", ""];
        return { field, op, val: String(val) };
      }
      return { field, op: "equals", val: String(cond) };
    });
  const rowsToWhen = (rows) => {
    const out = {};
    for (const r of rows || []) {
      if (!r.field) continue;
      out[r.field] = r.op === "equals" ? r.val : { [r.op]: r.op === "exists" ? true : r.val };
    }
    return out;
  };
  const blankHook = () => ({
    name: "",
    wasName: "",
    on: (hookEvents[0] && hookEvents[0].name) || "session.started",
    rows: [],
    scope: "every-agent",
    do: "",
    kind: "context",
    guard: "once-per-session",
    note: "",
    isNew: true,
  });
  const editHook = (h) =>
    setHookDraft({
      name: h.name,
      wasName: h.name,
      on: h.on,
      rows: whenRows(h.when),
      scope: h.scope,
      do: h.do,
      kind: h.kind,
      guard: h.guard || "",
      note: h.note || "",
      isNew: false,
    });
  const commitHook = async () => {
    setHookErr("");
    const d = hookDraft;
    if (!d) return;
    const r = await saveHook({
      name: d.name,
      wasName: d.wasName,
      on: d.on,
      when: rowsToWhen(d.rows),
      scope: d.scope,
      do: d.do,
      kind: d.kind,
      guard: d.guard,
      note: d.note,
    });
    if (r && r.error) return setHookErr(r.error);
    const hk = await listHooks();
    setHooks(hk.hooks);
    setHookDraft(null);
  };
  const dropHook = async (name) => {
    await removeHook(name);
    const hk = await listHooks();
    setHooks(hk.hooks);
    if (hookDraft && hookDraft.wasName === name) setHookDraft(null);
  };
  const setHd = (patch) => setHookDraft((d) => ({ ...d, ...patch }));

  const liveOf = (id) => live.filter((s) => s.agentId === id);
  const selLive = draft ? liveOf(draft.id) : [];
  // STALE = still wearing the composition it opened under. An agent's system prompt is built
  // once, at open, from presence + the system context + this doc, and the SDK takes it at query
  // time — so saving any of them changes NOTHING for a session already running, and a compaction
  // does not help either (it rewrites the conversation, not the prompt). Re-init is the only
  // route in, which is why it belongs on this page: right under the docs you just edited.
  const staleLive = selLive.filter((x) => x.stale);
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

  // THE FORM OPENS WHERE THE ROW IS. One shared editor rendered under the whole list meant that
  // clicking edit on the first of ten hooks opened a box ten rows below it — you edit up here and
  // read the result off-screen. Built once, MOUNTED at the row being edited, so a hook expands in
  // place. A new hook is the one case with no row to expand: that one stays under the list, beside
  // the + button that made it.
  const hookForm = !hookDraft ? null : (
                <div className="agent-profile__hookform">
                  <div className="agent-profile__hookform-row">
                    <label className="agent-profile__hookform-label">name</label>
                    <input
                      className="agent-profile__hookform-input"
                      value={hookDraft.name}
                      placeholder="compaction-prep"
                      onChange={(e) => setHd({ name: e.target.value })}
                    />
                  </div>

                  <div className="agent-profile__hookform-row">
                    <label className="agent-profile__hookform-label">on</label>
                    <SvSelect
                      value={hookDraft.on}
                      onChange={(v) => setHd({ on: v, rows: [] })}
                      options={hookEvents.map((e) => ({ value: e.name, label: e.name }))}
                    />
                    <span className="agent-profile__hookform-note">
                      {(eventNamed(hookDraft.on) || {}).what || ""}
                    </span>
                  </div>

                  {/* THE CONDITION. Declarative field matching only — it runs on every event, and a
                      predicate in that position is exactly the shape that put the main process at
                      154% CPU. Fields are offered from the chosen event, never typed from memory. */}
                  <div className="agent-profile__hookform-row agent-profile__hookform-row--top">
                    <label className="agent-profile__hookform-label">when</label>
                    <div className="agent-profile__hookform-when">
                      {hookDraft.rows.length === 0 && (
                        <span className="agent-profile__hookform-note">every time this event fires</span>
                      )}
                      {hookDraft.rows.map((r, i) => (
                        <div className="agent-profile__hookform-cond" key={i}>
                          <SvSelect
                            value={r.field}
                            onChange={(v) => setHd({ rows: hookDraft.rows.map((x, n) => (n === i ? { ...x, field: v } : x)) })}
                            options={condFields(hookDraft.on)}
                          />
                          <SvSelect
                            value={r.op}
                            onChange={(v) => setHd({ rows: hookDraft.rows.map((x, n) => (n === i ? { ...x, op: v } : x)) })}
                            options={[
                              { value: "equals", label: "is" },
                              { value: "contains", label: "contains" },
                              { value: "startsWith", label: "starts with" },
                              { value: "endsWith", label: "ends with" },
                              { value: "matches", label: "matches /re/" },
                              { value: "gte", label: "≥" },
                              { value: "lte", label: "≤" },
                              { value: "exists", label: "exists" },
                            ]}
                          />
                          {r.op !== "exists" &&
                            (valuesFor(hookDraft.on, r.field) && r.op === "equals" ? (
                              <SvSelect
                                value={r.val}
                                onChange={(v) => setHd({ rows: hookDraft.rows.map((x, n) => (n === i ? { ...x, val: v } : x)) })}
                                options={valuesFor(hookDraft.on, r.field).map((v) => ({ value: String(v), label: String(v) }))}
                              />
                            ) : (
                              <input
                                className="agent-profile__hookform-input"
                                value={r.val}
                                placeholder="value"
                                onChange={(e) => setHd({ rows: hookDraft.rows.map((x, n) => (n === i ? { ...x, val: e.target.value } : x)) })}
                              />
                            ))}
                          <button
                            type="button"
                            className="agent-profile__hook-btn agent-profile__hook-btn--del"
                            onClick={() => setHd({ rows: hookDraft.rows.filter((_, n) => n !== i) })}
                          >
                            ×
                          </button>
                        </div>
                      ))}
                      <button
                        type="button"
                        className="agent-profile__hook-btn"
                        disabled={!condFields(hookDraft.on).length}
                        title="Narrow this hook to events that match"
                        onClick={() =>
                          setHd({
                            rows: [
                              ...hookDraft.rows,
                              { field: (condFields(hookDraft.on)[0] || {}).value || "", op: "contains", val: "" },
                            ],
                          })
                        }
                      >
                        + condition
                      </button>
                    </div>
                  </div>

                  <div className="agent-profile__hookform-row">
                    <label className="agent-profile__hookform-label">do</label>
                    <SvSelect
                      value={hookDraft.do}
                      onChange={(v) => setHd({ do: v })}
                      options={[
                        { value: "", label: "— pick a skill —" },
                        ...(skills || []).map((sk) => ({ value: `skill:${sk.name}`, label: sk.name })),
                      ]}
                    />
                    <span className="agent-profile__hookform-note">the skill this moment points at</span>
                  </div>

                  <div className="agent-profile__hookform-row">
                    <label className="agent-profile__hookform-label">scope</label>
                    <SvSelect
                      value={hookDraft.scope}
                      onChange={(v) => setHd({ scope: v })}
                      options={[
                        ...(draft ? [{ value: `agent:${draft.id}`, label: `this agent (${draft.name})` }] : []),
                        ...(draft && draft.projectCode ? [{ value: `project:${draft.projectCode}`, label: `this project (${draft.projectCode})` }] : []),
                        { value: "every-agent", label: "every agent" },
                      ]}
                    />
                  </div>

                  <div className="agent-profile__hookform-row">
                    <label className="agent-profile__hookform-label">guard</label>
                    <SvSelect
                      value={hookDraft.guard}
                      onChange={(v) => setHd({ guard: v })}
                      options={[
                        { value: "once-per-session", label: "once per session" },
                        { value: "cooldown:300", label: "at most every 5 min" },
                        { value: "cooldown:3600", label: "at most every hour" },
                        { value: "", label: "no guard — every match" },
                      ]}
                    />
                    <span className="agent-profile__hookform-note">
                      an unguarded hook is a context leak that fires forever
                    </span>
                  </div>

                  <div className="agent-profile__hookform-row">
                    <label className="agent-profile__hookform-label">kind</label>
                    <SvSelect
                      value={hookDraft.kind}
                      onChange={(v) => setHd({ kind: v })}
                      options={[
                        { value: "context", label: "context — points, the agent decides" },
                        { value: "work", label: "work — something runs", hot: true },
                      ]}
                    />
                  </div>

                  <div className="agent-profile__hookform-row agent-profile__hookform-row--top">
                    <label className="agent-profile__hookform-label">note</label>
                    <textarea
                      className="agent-profile__hookform-area"
                      rows={2}
                      value={hookDraft.note}
                      placeholder="optional — a line the agent reads along with the pointer"
                      onChange={(e) => setHd({ note: e.target.value })}
                    />
                  </div>

                  <div className="agent-profile__hookform-actions">
                    <button type="button" className="agent-profile__hook-save" onClick={commitHook}>
                      {hookDraft.isNew ? "create hook" : "save hook"}
                    </button>
                    <button type="button" className="agent-profile__hook-btn" onClick={() => { setHookDraft(null); setHookErr(""); }}>
                      cancel
                    </button>
                  </div>
                </div>
  );

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
        {/* HELP — for the humans designing agents, scoped to no agent. The one thing here that is
            genuinely help (not agent context); it sits by the roster because it is ABOUT the
            roster. The agent-side page doc (System context) is NOT here — it's context that loads
            into agents, so it lives WITH the docs below, where it belongs. */}
        {humanHelp.length > 0 && (
          <span className="agent-profile__help-slot">
            {humanHelp.map((h) => (
              <button
                key={h.key}
                className="agent-profile__help-chip"
                title={`Help for defining agents — ${h.where}`}
                onClick={() => openPageDoc(h)}
              >
                ? {h.label}
              </button>
            ))}
          </span>
        )}
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
              {/* OFFERED, NEVER AUTOMATIC — same etiquette as a commit. Saving presence.md makes
                  every live session stale at once, and restarting one mid-turn to deliver a
                  paragraph is a worse bug than the paragraph arriving late. So it is stated, and
                  it is a press. The conversation is kept: re-init resumes the same sdk session. */}
              {staleLive.map((x) => (
                <div className="agent-profile__stale" key={x.key}>
                  <span className="agent-profile__stale-icon">!</span>
                  <div className="agent-profile__stale-body">
                    <div className="agent-profile__stale-title">Running an older definition</div>
                    <div className="agent-profile__stale-note">
                      This session opened before these changed. Re-init restarts it on the current
                      docs — same conversation, nothing lost.
                    </div>
                    {asList(x.staleParts).length > 0 && (
                      <div className="agent-profile__stale-parts">
                        {asList(x.staleParts).map((n) => (
                          <span className="agent-profile__stale-chip" key={n}>{n}</span>
                        ))}
                      </div>
                    )}
                  </div>
                  <button
                    type="button"
                    className="agent-profile__stale-btn"
                    disabled={reinitting === x.key}
                    onClick={() => doReinit(x.key)}
                  >
                    {reinitting === x.key ? "re-initing…" : "re-init"}
                  </button>
                </div>
              ))}
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
          {/* EVERY-AGENT LEVEL — above this agent's own docs, because that's the level they live
              at (his call). Presence says WHERE an agent is; System context says HOW to act. One
              file each, harness-injected into every session: editing here edits for all of them. */}
          {everyAgentDocs.length > 0 && (
            <div className="agent-profile__section">
              <div className="agent-profile__section-head">Every agent</div>
              <div className="agent-profile__hint">
                <b>Presence</b> = where an agent is (the harness, the browser, the app it's
                attached to). <b>System context</b> = how to act here. One file each, injected at
                session start — edit either and it changes for every agent's next session.
              </div>
              <div className="agent-profile__docs">
                {everyAgentDocs.map((d) => (
                  <button
                    key={d.key}
                    className="agent-profile__doc-chip agent-profile__doc-chip--shared"
                    title={`Loads into every agent — ${d.where}`}
                    onClick={() => openPageDoc(d)}
                  >
                    <span className="agent-profile__doc-ico">▤</span>
                    {d.label}
                    {!d.text && <span className="agent-profile__doc-empty">nothing written yet</span>}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="agent-profile__section">
            <div className="agent-profile__section-head">This agent</div>
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

          {/* THE BILL. Everything above this point is a document that loads on EVERY TURN for the
              life of a session — so a paragraph nobody needed is the most expensive writing in the
              system. Shown here, next to the docs themselves, because that is where someone can
              act on it. Tokens are estimated (~4 chars each); the decision this informs is "is
              this too long", which does not turn on the third digit. */}
          {weight && weight.rows && weight.rows.length > 0 && (
            <div className="agent-profile__section">
              <div className="agent-profile__section-head">Always loaded — what every turn costs</div>
              <div className="agent-profile__weights">
                {weight.rows
                  .filter((r) => !r.missing)
                  .sort((a, b) => b.tokens - a.tokens)
                  .map((r) => (
                    <div className="agent-profile__weight" key={r.key}>
                      <span className="agent-profile__weight-name">{r.label}</span>
                      <span className="agent-profile__weight-scope">{r.scope}</span>
                      <span className="agent-profile__weight-bar">
                        <span
                          className="agent-profile__weight-fill"
                          style={{ width: `${Math.max(2, Math.round((r.tokens / Math.max(1, weight.rows[0].tokens || 1)) * 100))}%` }}
                        />
                      </span>
                      <span className="agent-profile__weight-tok">{r.tokens.toLocaleString()}</span>
                    </div>
                  ))}
                <div className="agent-profile__weight agent-profile__weight--total">
                  <span className="agent-profile__weight-name">every turn</span>
                  <span className="agent-profile__weight-scope" />
                  <span className="agent-profile__weight-bar" />
                  <span className="agent-profile__weight-tok">≈{weight.totalTokens.toLocaleString()}</span>
                </div>
              </div>
            </div>
          )}

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
                {/* CREATING ONE IS A VERB NOW. The system could list and edit skills and never make
                    one, so every skill in here arrived by an agent hand-writing a file into a
                    dotfolder — which is exactly how six copies of a retired CLI skill happened and
                    nobody noticed. It opens seeded with front matter rather than blank: the
                    description IS the trigger, and a blank page is how one ships without one. */}
                <button
                  className="agent-profile__doc-chip agent-profile__doc-chip--new"
                  title="Create a new skill at user level"
                  onClick={async () => {
                    const name = window.prompt("New skill — lowercase name, dashes for spaces");
                    if (!name) return;
                    const r = await createSkill(draft.id, name.trim(), "user");
                    if (r && r.error) return window.alert(r.error);
                    const list = await listSkills(draft.id);
                    setSkills(list);
                    if (r && r.skill && typeof onOpenDoc === "function")
                      onOpenDoc({ kind: "skill", agentId: draft.id, name: r.skill.name, where: r.skill.where, label: r.skill.name, text: r.skill.text, orig: r.skill.text });
                  }}
                >
                  <span className="agent-profile__doc-ico">＋</span>
                  new skill
                </button>
              </div>
            )}
          </div>

          {/* HOOKS — the third way context reaches an agent. Loaded context is paid every turn;
              retrieved context is paid when the agent thinks to ask; a hook is paid only when a
              MOMENT happens. It sits directly under Skills because it is the same family: a hook
              carries no procedure, it points at a skill. Same body, two doors — a skill fires when
              the model judges it relevant, a hook fires when an event does. */}
          <div className="agent-profile__section">
            <div className="agent-profile__section-head">Hooks — context pushed by an event</div>
            <div className="agent-profile__hint">
              A hook is three parts: <b>on</b> (which moment), <b>when</b> (does this one count),
              and <b>do</b> (which skill applies). It delivers a <b>pointer, never the procedure</b>
              — the agent still decides whether to pull the skill, so a hook can't drift from it.
              The event list is generated from what the harness actually emits: you can only hook a
              moment that really happens. <b>A hook exists for every agent the moment you write
              it</b> — the checkbox is where <i>this</i> agent opts in, the same way it carries a
              skill. Applies at its next session.
            </div>

            {hookErr && <div className="agent-profile__hook-err">{hookErr}</div>}

            <div className="agent-profile__hooks">
              {hooks.map((h) => {
                const on = carriesHook(h.name);
                return (
                  <div className={`agent-profile__hook${on ? "" : " agent-profile__hook--off"}`} key={h.name}>
                    <div className="agent-profile__hook-main">
                      <span className="agent-profile__hook-name">{h.name}</span>
                      <span className="agent-profile__hook-on">on {h.on}</span>
                      {Object.keys(h.when || {}).length > 0 && (
                        <span className="agent-profile__hook-when">when {Object.keys(h.when).join(", ")}</span>
                      )}
                      {h.do && <span className="agent-profile__hook-do">→ {h.do}</span>}
                    </div>
                    <div className="agent-profile__hook-tags">
                      {h.guard && <span className="agent-profile__hook-guard">{h.guard}</span>}
                      {/* A WORK HOOK ACTS; A CONTEXT HOOK WHISPERS. Same wiring up to the branch,
                          different trust past it — so the loud one is labelled loudly. */}
                      {h.kind === "work" && <span className="agent-profile__hook-work">work</span>}
                      {/* WHO WROTE IT — shown only when it was not you. An agent can propose a hook
                          now (RFC-005 §7), and a proposal that looks identical to something you
                          wrote yourself is a proposal you approve by forgetting you did not. The
                          write is inert either way; this is the row telling you whose idea it was. */}
                      {/^agent:/.test(h.author || "") && (
                        <span className="agent-profile__hook-by" title={`proposed by ${h.author}`}>
                          {h.author.slice(6)}
                        </span>
                      )}
                      {!h.enabled && <span className="agent-profile__hook-guard">off for everyone</span>}
                      {/* THE SWITCH SITS WITH THE OTHER TWO VERBS — his call. A hook exists for
                          everybody the moment it is written; this is where THIS agent opts in, and
                          it belongs beside edit and delete because they are the same kind of act:
                          things you do TO a hook from the row you are reading. Rides the
                          definition, so it saves with everything else. */}
                      <button
                        type="button"
                        className={`agent-profile__hook-btn agent-profile__hook-btn--toggle${on ? " agent-profile__hook-btn--on" : ""}`}
                        title={on ? "Carried — this agent gets it. Click to disable." : "Not carried — exists, but never fires for this agent. Click to enable."}
                        onClick={() => toggleHook(h.name)}
                      >
                        {on ? "enabled" : "disabled"}
                      </button>
                      <button type="button" className="agent-profile__hook-btn" onClick={() => editHook(h)}>edit</button>
                      <button type="button" className="agent-profile__hook-btn agent-profile__hook-btn--del" onClick={() => dropHook(h.name)}>delete</button>
                    </div>
                    {/* expands right here, under the row you clicked */}
                    {hookDraft && !hookDraft.isNew && hookDraft.wasName === h.name && hookForm}
                  </div>
                );
              })}
              {!hooks.length && (
                <span className="agent-profile__none">No hooks written yet.</span>
              )}
            </div>

            {!hookDraft && (
              <button type="button" className="agent-profile__hook-add" onClick={() => setHookDraft(blankHook())}>
                + new hook
              </button>
            )}

            {hookDraft && hookDraft.isNew && hookForm}
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
