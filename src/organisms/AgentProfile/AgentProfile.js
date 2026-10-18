import React, { useCallback, useEffect, useRef, useState } from "react";
import "./styles.scss";
import {
  hasAgents,
  listDefs,
  saveDef,
  removeDef,
  listDocs,
  listSkills,
  listSkillSources,
  createSkill,
  listHelp,
  liveSessions,
  refreshSession,
  agentRuns,
  listHooks,
  agentBoard,
  saveHook,
  removeHook,
  contextStats,
  agentSubs,
  onDefsChanged,
} from "../../utils/hostAgents";
import { collections as loadCollections, records as loadRecords } from "../../utils/hostContext";
import { groupSkillsBySource, sourceCountLabel, skillDoc } from "./skillSources";
import { listJobs, jobRuns, rateJobRun, hasHostJobs, saveJob } from "../../utils/hostJobs";
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

// A JOB'S AIM IS ITS DOCUMENT'S OPENING SENTENCE — the same rule the agent-facing `jobsList` uses,
// so a job wears one label in both places. Front matter is skipped by position (an opening `---`
// fence to its closing one); a heading, a bullet or a fence is scaffolding, not a sentence.
const aimOf = (job = {}) => {
  const raw = String(job.doc || "");
  const body = /^\s*---\s*\n/.test(raw)
    ? (() => {
        const end = raw.indexOf("\n---", raw.indexOf("\n") + 1);
        return end === -1 ? raw : raw.slice(end + 4);
      })()
    : raw;
  const lines = body.split("\n").map((l) => l.trim());
  const scaffolding = (l) => !l || l.startsWith("#") || /^[-*>|]/.test(l) || l.startsWith("```");
  let i = lines.findIndex((l) => !scaffolding(l));
  if (i === -1) return "(no aim stated — its document opens with no sentence)";
  const para = [];
  for (; i < lines.length && !scaffolding(lines[i]); i += 1) para.push(lines[i]);
  const one = para.join(" ").replace(/[*_`]/g, "");
  const cut = one.search(/[.!?](\s|$)/);
  const said = cut > 0 ? one.slice(0, cut + 1) : one;
  return said.length > 200 ? said.slice(0, 199).trimEnd() + "…" : said;
};

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
  // RFC-013 — the subscriptions rows, RESOLVED (title, size, spent, broken) by the host, and
  // refreshed the moment the defs dir moves — a subscribe appears here with no page refresh
  // (his rule: if you subscribe to something, it should just be there).
  const [subsRows, setSubsRows] = useState([]);
  const [cols, setCols] = useState([]);
  const [docs, setDocs] = useState(null); // null = harness can't answer yet
  const [skills, setSkills] = useState(null);
  // WHERE the skills came from — the sources, resolved by the host. Null = the harness can't answer
  // that door yet; the skills section then renders flat, exactly as it did before sources existed.
  const [skillSources, setSkillSources] = useState(null);
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
  // THE JOBS ON THIS MACHINE — so a hook can point at one. The `do` picker offered skills only,
  // which meant the engine could fire `do: job:<name>` and this form could not write it (same hole
  // the MCP door had until 2026-10-07). A job's record carries its own `requires`, which is what
  // builds the `with:` inputs below — the form asks for exactly what that document declares.
  const [jobs, setJobs] = useState([]);
  // The chore board for the agent being read: each line and whether it is done for this period.
  const [board, setBoard] = useState({ rows: [], periods: [] });
  // ADDING A LINE NAMES IT FIRST. `+ new chore` used to write a line immediately, defaulted to
  // whatever skill happened to be first on the machine — so every add was a wrong line you then
  // had to correct, two edits for one intention. This holds ONE unnamed row at the end of the
  // board instead. It is not a draft of a chore and cannot be mistaken for one: it has no status,
  // no period, no remove, and says "choose a skill or job". Picking something writes it; nothing
  // reaches disk before then, so there is no saved/unsaved ambiguity to explain.
  const [addingChore, setAddingChore] = useState(false);
  // NAMING HAPPENS IN THE PAGE, NOT IN A BROWSER DIALOG. `window.prompt` is not implemented in
  // Electron at all — so `+ new job` and `+ new skill` were dead on arrival, which is how he found
  // them. And this codebase had already settled the question: CodebaseNav's RowEdit note says a
  // prompt box "wears the OS's chrome instead of this app's, it blocks the page, and it covers the
  // very row it is asking about." Two reasons to avoid it and one that makes it impossible, and I
  // used it anyway. `null` means not naming; a string is what has been typed so far.
  const [newJobName, setNewJobName] = useState(null);
  const [newSkillIn, setNewSkillIn] = useState(null); // the source being created into, or null
  const [newSkillName, setNewSkillName] = useState("");
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

  // WHICH JOB IS EXPANDED, and the runs read for it. ABOVE EVERY EARLY RETURN for the same reason
  // as the board below: this component returns JSX before its body ends, and a hook under that
  // point is skipped on that path — a crash, not a glitch.
  //
  // RUNS ARE READ WHEN A JOB IS OPENED, not for every job on mount: the record for a job that has
  // run a hundred times is a hundred files, and nobody is looking at them until they ask.
  const [jobOpen, setJobOpen] = useState(null);
  const [jobRunRows, setJobRunRows] = useState({});
  useEffect(() => {
    let alive = true;
    (async () => {
      if (!jobOpen) return;
      const rows = await jobRuns(jobOpen);
      if (alive) setJobRunRows((m) => ({ ...m, [jobOpen]: Array.isArray(rows) ? rows : [] }));
    })();
    return () => { alive = false; };
  }, [jobOpen]);

  // THE CHORE BOARD FOR THE AGENT BEING READ. ABOVE EVERY EARLY RETURN, which is not a style
  // preference: this component returns JSX before its body ends (no harness → a one-line
  // explanation), and a hook below that point is skipped on that path — "rendered fewer hooks than
  // expected", a crash rather than a glitch.
  //
  // RE-READ WHEN THE LINES CHANGE, because a line's state is a QUERY over closed runs — it can go
  // from not-done to done with nobody touching this page, and the one thing this section must never
  // do is show a tick it invented.
  const boardKey = JSON.stringify(
    (draft && draft.def && Array.isArray(draft.def.chores) ? draft.def.chores : []).map((c) =>
      typeof c === "string" ? c : `${c.what}|${c.period}`,
    ),
  );
  useEffect(() => {
    let alive = true;
    (async () => {
      if (!draft || !draft.id) return setBoard({ rows: [], periods: [] });
      const b = await agentBoard(draft.id);
      if (alive) setBoard(b);
    })();
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft && draft.id, boardKey]);

  const refresh = useCallback(async () => {
    const [list, ls, rs, cs, tix, hk, jb] = await Promise.all([
      listDefs(), liveSessions(), agentRuns(), loadCollections(), loadRecords("mcp-tools"), listHooks(), listJobs(),
    ]);
    setDefs(list);
    setHooks(hk.hooks);
    setJobs(Array.isArray(jb) ? jb : []);
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
    const [sk, ss] = await Promise.all([listSkills(rec.id), listSkillSources(rec.id)]);
    setDocs(ds);
    setSkills(sk);
    setSkillSources(ss);
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
        if (hit) onOpenDoc(skillDoc(rec.id, hit));
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
  useEffect(() => {
    if (!draft || !draft.id) return undefined;
    let dead = false;
    const load = () => agentSubs(draft.id).then((r) => { if (!dead) setSubsRows(r); });
    load();
    const off = onDefsChanged(load);
    return () => { dead = true; off(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft && draft.id]);
  const dropSub = async (what) => {
    const keep = subsRows.filter((r) => r.what !== what).map(({ what: w, when, until, addedAt }) => ({ what: w, when, until, addedAt }));
    setSubsRows((cur) => cur.filter((r) => r.what !== what)); // the screen moves NOW; the watcher confirms
    await saveDef({ id: draft.id, name: draft.name, subscriptions: keep });
  };

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
    with: {},
    rate: "once-per-session",
    note: "",
    isNew: true,
  });
  // DUPLICATE — a new draft wearing an existing hook's everything. His card: per-agent fire rates
  // are the whole answer to "don't let the agents I ignore work as often as the ones I use daily",
  // and that means one hook copied per agent — which until now meant authoring from scratch.
  // `wasName: ""` makes the save a CREATE, and the name is pre-filled to the first free
  // `<name>-copy[-n]` so a lazy save can never land on the original and overwrite it. Everything
  // still goes through the same writing door with all its refusals.
  const duplicateHook = (h) => {
    const taken = new Set((hooks || []).map((x) => x.name));
    let name = `${h.name}-copy`;
    for (let n = 2; taken.has(name); n++) name = `${h.name}-copy-${n}`;
    setHookDraft({
      name,
      wasName: "",
      on: h.on,
      rows: whenRows(h.when),
      scope: h.scope,
      do: h.do,
      with: { ...(h.with || {}) },
      rate: h.rate || h.guard || "",
      note: h.note || "",
      isNew: true,
    });
  };
  const editHook = (h) =>
    setHookDraft({
      name: h.name,
      wasName: h.name,
      on: h.on,
      rows: whenRows(h.when),
      scope: h.scope,
      do: h.do,
      with: h.with || {},
      rate: h.rate || h.guard || "",
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
      // ONE INPUT PER DECLARED NAME, and blanks are dropped rather than sent as empty strings — an
      // empty value is a MISSING value to the gate, so sending "" would turn a refusal that names
      // the input into one that claims it was supplied.
      with: Object.fromEntries(
        Object.entries(d.with || {}).filter(([, v]) => String(v == null ? "" : v).trim() !== ""),
      ),
      // DERIVED, never asked — see the note on the kind row.
      kind: String(d.do || "").startsWith("job:") ? "work" : "context",
      rate: d.rate,
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

  // WHICH SKILLS THE AGENT CARRIES — def.skills, a list of names. Two truths live on each chip:
  // this one is the CHOICE (edited here, saved through the definition door, lands at the next
  // re-init); the gray --off above is the REPORT (what the running session actually loaded).
  // Absent or empty list = carries ALL — today's behavior, so every existing def keeps working.
  const defSkills = asList(d.skills);
  const carriesSkill = (name) => !defSkills.length || defSkills.includes(name);
  const toggleSkill = (name) => {
    let next;
    if (!defSkills.length) {
      // carries-all has no list to edit — the first exclusion materializes the full list minus
      // this one, so what stays carried is exactly what was carried before.
      next = (skills || []).map((s) => s.name).filter((n) => n !== name);
    } else if (defSkills.includes(name)) {
      next = defSkills.filter((n) => n !== name);
    } else {
      next = [...defSkills, name];
    }
    // Re-carrying the last exclusion collapses back to "carries all" — the field disappears, so
    // the def round-trips to exactly what it was (and future skills arrive automatically again).
    // The same collapse guards the other end: an EMPTY list also reads as "all" (the schema has
    // no "none"), so excluding the last carried skill lands on all — and the chips show it.
    const everyName = new Set((skills || []).map((s) => s.name));
    if (!next.length || [...everyName].every((n) => next.includes(n))) next = undefined;
    setDef({ skills: next });
  };

  // ONE ROW PER SOURCE. Which skill belongs to which source, what an unresolved source means, and
  // when a source can't fire are all decided in ./skillSources as a pure function — the markup
  // below only draws what it is handed, and the rules are testable without a DOM.
  const skillRows = skills === null ? [] : groupSkillsBySource(skills, skillSources);

  // THE FORM OPENS WHERE THE ROW IS. One shared editor rendered under the whole list meant that
  // clicking edit on the first of ten hooks opened a box ten rows below it — you edit up here and
  // read the result off-screen. Built once, MOUNTED at the row being edited, so a hook expands in
  // place. A new hook is the one case with no row to expand: that one stays under the list, beside
  // the + button that made it.
  // THE JOB THE DRAFT POINTS AT, if it points at one. Everything the form needs to ask about a job
  // comes off its own record: the `requires:` its document declares, and the fact that it IS a job.
  // THE BOARD'S ROWS, ONE PER LINE ON THE DEFINITION — joined to what the disk said about each.
  // The LINES come from the draft (editable, saved with everything else); `done` and `at` come from
  // `agentBoard`, which read them off closed run records. A line just added has no state yet and
  // says so rather than rendering as not-done, which would read as a verdict about work nobody has
  // asked for yet.
  const choreRows = asList(d.chores).map((c) => {
    const line = typeof c === "string" ? { what: c, period: "daily" } : c;
    const what = String(line.what || "");
    const hit = (board.rows || []).find((r) => r.what === what);
    return {
      what,
      period: String(line.period || "daily"),
      done: !!(hit && hit.done),
      at: (hit && hit.at) || 0,
      resetAt: (hit && hit.resetAt) || Number(line.resetAt) || 0,
      known: !!hit,
    };
  });
  // THE CHORE BOARD HAS NO DRAFT. His report, 2026-10-12, and he is right that the whole shape was
  // wrong rather than one string being wrong: *"the button popping up underneath and everything is
  // just awkward… a remove button being there before you even — is it saved? so why can I remove it
  // if it's not saved?"*
  //
  // Nothing about a chore line needs staging. It is two enum values; there is no draft worth
  // holding, no partial state to protect, and nothing it can break. Staging bought one thing — a
  // Save press — and cost four: a line that looked identical saved and unsaved, a remove button on
  // something that did not exist yet, a Save appearing from nowhere underneath, and a row that
  // reported "saved" about a draft.
  //
  // SCOPED TO `chores` ON PURPOSE. definitions.save() MERGES (it spreads the previous record and
  // its def before the input), so writing this one field cannot carry along unsaved edits to the
  // doc, the tools or the skills — which is exactly the bug a whole-draft save would introduce
  // here. And chores are not composed into any system prompt, so this write leaves every live
  // session fresh rather than stale (see composedStamp in sessions.cjs).
  const writeChores = async (rows) => {
    // `resetAt` RIDES ALONG. Dropping it here would mean changing a line's period silently
    // un-resets it — the field is on the line, so every write has to carry the whole line.
    const chores = rows.map((r) => ({ what: r.what, period: r.period, ...(r.resetAt ? { resetAt: r.resetAt } : {}) }));
    // THE ROW IS NEVER THE AUTHORITY — only disk is. An optimistic `setDef` here would paint the
    // line the moment he picked it and keep painting it after a failed write, which is exactly the
    // silence he hit: he added a chore, the board showed it, and `def.chores` was undefined.
    // So nothing is drawn until the definition is read back.
    try {
      await saveDef({ id: draft.id, name: draft.name, chores });
    } catch (e) {
      raiseKeyed("chore-write", `The chore line did not save: ${String((e && e.message) || e)}`);
      return;
    }
    const list = await refresh();
    const fresh = list.find((r) => r.id === draft.id);
    if (!fresh) {
      raiseKeyed("chore-write", "Saved, but this agent could not be read back — the board may be behind.");
      return;
    }
    setSel(fresh);
    setDraft(JSON.parse(JSON.stringify(fresh)));
    // AND THE WRITE IS CHECKED, not assumed. `cleanChores` drops a line it cannot read (an empty
    // or unprefixed `what`), and it drops it SILENTLY — a save that reports success while writing
    // nothing is the shape of this whole bug, so the one thing worth asserting is that what came
    // back matches what went out.
    const landed = ((fresh.def || {}).chores || []).length;
    if (landed !== chores.length)
      raiseKeyed("chore-write", `Wrote ${chores.length} chore line${chores.length === 1 ? "" : "s"} and ${landed} came back — one was not accepted.`);
    else clearKeyed("chore-write");
  };
  const setChore = (i, patch) => writeChores(choreRows.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  // RESET — his ask, 2026-10-13: *"if you did it already then I say fuck yeah, I want to reset it.
  // For example, we could be using that to test job path check over and over."*
  //
  // It writes a FLOOR, it does not delete anything. `done` is derived from closed runs, so the two
  // obvious implementations both lie: clearing the stamp resets nothing (the closed run record still
  // reports its time), and deleting the run record would destroy the evidence that the work happened
  // in order to change a tick. The run stays; it simply stops counting from now on.
  const resetChore = (i) => setChore(i, { resetAt: Date.now() });
  const dropChore = (i) => writeChores(choreRows.filter((_, j) => j !== i));
  // A NEW LINE DEFAULTS TO THE FIRST SKILL ON THE MACHINE rather than to empty: an empty `what` is
  // a line that can never check off, and `cleanChores` would drop it on save without saying so.
  // A NEW LINE IS WRITTEN IMMEDIATELY, so it must name something real: `choreLine` drops a line
  // with an empty `what`, which with no staging would mean the press appears to do nothing. With
  // nothing on the machine to name there is no line to add, and saying so beats a silent no-op.
  const addChore = () => {
    if (!(skills || []).length && !(jobs || []).length) {
      raiseKeyed("chore-none", "No skills or jobs on this machine to expect — nothing to put on the board.");
      return;
    }
    setAddingChore(true);
  };
  const namePending = async (what) => {
    setAddingChore(false);
    if (!what) return;
    await writeChores([...choreRows, { what, period: "weekly" }]);
  };
  // WHAT THE BOARD IS FOR, in one line, and it was the one thing missing: a board exists to say
  // how much is outstanding. The `chores` verb has always reported exactly this to an agent; the
  // surface made a human count the rows.
  const choresOwed = choreRows.filter((r) => r.known && !r.done).length;

  // A JOB OPENS IN THE RIGHT PANEL, exactly like an agent doc or a skill — `onOpenDoc` lifts it and
  // `DocPanel` renders it as markdown. READ-ONLY on purpose: a job is authored through
  // `job-authoring` and `jobsWrite`, which is what puts the six parts in it; an editable textarea
  // here is an invitation to a job that is un-assignable or whose result nobody can check. The flag
  // is honoured in two places — the panel shows no save control, and `saveOpenDoc` refuses — so
  // there is no path from this page to a write the engine would have to reject.
  // THE SHAPE OF A JOB, not a job. Every heading here is one a reader has to be able to find at
  // 3am — what it is for, what it must be given, how to do it, what it hands over, what it must
  // never do, what to do when unsure. `requires:` is front matter because that is the only place
  // the harness reads it from; leaving it out of the seed is how a job ships un-assignable.
  const seedJobDoc = (id) =>
    [
      "---",
      'requires: []',
      "---",
      "",
      `# ${id}`,
      "",
      "One sentence: what this produces, and for whom. A job hands over a DELIVERABLE — if it only",
      "changes something and leaves no artifact, it is a skill, not a job.",
      "",
      "## Running this job",
      "",
      "**The worklist is how this job starts, advances and finishes.** A job may run with nobody",
      "watching, so the list is the only thing that says it was executed rather than merely named —",
      "and the item left active is the only thing that says where it died.",
      "",
      `1. **Before step 1**, put your plan on the worklist with \`source: "job:${id}"\`.`,
      "2. **Mark one active** as you reach it and **done** as you finish it.",
      "3. **Every item is work you do.** Human confirmation is not on it.",
      "4. **If you stop early, leave the list where it stopped.** Do not tidy it.",
      "",
      "## 1 · The aim",
      "",
      "## 2 · What it must be given",
      "",
      "List each input in `requires:` above, and say here what it is for. A missing input is a",
      "refusal, not a guess — the harness compares `requires:` against the hook's `with:` and opens",
      "no run if one is absent. An input a chore line could never supply makes this job unassignable",
      "from a board, so keep the list to what a hook can hand over.",
      "",
      "## 3 · The procedure",
      "",
      "## 4 · The handover",
      "",
      "What a third party can check without asking the agent anything.",
      "",
      "## 5 · The bounds",
      "",
      "**Never:**",
      "",
      "**When unsure** — say what to do instead of stopping. This may run at 3am with nobody in the",
      "room, and a run waiting on an answer nobody is there to give is a run that died silently.",
      "",
      "## 6 · The report",
      "",
    ].join("\n");

  const createSkillHere = async (row) => {
    const name = String(newSkillName || "").trim();
    if (!name) {
      raiseKeyed("skill-new", "A skill name is lowercase letters, digits and dashes.");
      return;
    }
    const r = await createSkill(draft.id, name, row.where || "user");
    if (r && r.error) {
      raiseKeyed("skill-new", `The skill was not created: ${r.error}`);
      return;
    }
    clearKeyed("skill-new");
    setNewSkillIn(null);
    // The sources re-read with the list: a brand-new skill lands in one of them, and the source
    // that was unresolved a second ago now resolves.
    const [list, srcs] = await Promise.all([listSkills(draft.id), listSkillSources(draft.id)]);
    setSkills(list);
    setSkillSources(srcs);
    if (r && r.skill && typeof onOpenDoc === "function") onOpenDoc(skillDoc(draft.id, r.skill));
  };

  const createJob = async () => {
    const slug = String(newJobName || "").trim().toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/^-+|-+$/g, "");
    if (!slug) {
      raiseKeyed("job-new", "A job id is lowercase letters, digits and dashes.");
      return;
    }
    const r = await saveJob({ id: slug, doc: seedJobDoc(slug) });
    // THE HOST'S OWN WORDS, not a guess at them. `jobs.save` refuses an empty document by name,
    // and that sentence is more useful than anything this surface could invent.
    if (r && r.error) {
      raiseKeyed("job-new", `The job was not written: ${r.error}`);
      return;
    }
    clearKeyed("job-new");
    setNewJobName(null);
    const list = await listJobs();
    setJobs(list);
    const made = (list || []).find((j) => j.id === slug);
    if (made) openJobDoc(made);
  };

  const openJobDoc = (j) => {
    if (typeof onOpenDoc !== "function") return;
    onOpenDoc({
      kind: "job",
      jobId: j.id,
      label: j.name && j.name !== j.id ? `${j.name} (${j.id})` : j.id,
      text: j.doc || "",
      orig: j.doc || "",
      // WRITABLE NOW (2026-10-13). It was read-only on the argument that a job is authored through
      // `job-authoring`, which confused authoring with typing — he went to paste one in and found
      // no way. The host still refuses a save with no document at all, and `requires:` is still
      // read from the front matter, so nothing that was actually guaranteed has been given up.
    });
  };

  const hookJob = (() => {
    const d = hookDraft && String(hookDraft.do || "");
    if (!d || !d.startsWith("job:")) return null;
    const id = d.slice(4);
    return (jobs || []).find((j) => j.id === id) || { id, name: id, requires: [] };
  })();
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
                      onChange={(v) => setHd({ do: v, with: {} })}
                      options={[
                        { value: "", label: "— pick a skill or a job —" },
                        ...(skills || []).map((sk) => ({ value: `skill:${sk.name}`, label: `skill — ${sk.name}` })),
                        ...(jobs || []).map((j) => ({ value: `job:${j.id}`, label: `job — ${j.name || j.id}`, hot: true })),
                      ]}
                    />
                    {/* THIS IS THE REAL CHOICE, and it is the one the form was not asking. A skill is
                        OFFERED — the pointer says "ignore it if it does not apply" and the agent
                        decides. A job is GIVEN: it carries a contract, it refuses by name when it is
                        not supplied, and it opens a run. Same field, enforced difference. */}
                    <span className="agent-profile__hookform-note">
                      {hookJob
                        ? "a JOB — given, not offered. It opens a run and hands something over, so it must be supplied with what its document declares."
                        : "a SKILL — offered. The pointer arrives and the agent decides whether it applies."}
                    </span>
                  </div>

                  {/* WHAT IT IS GIVEN — one input per name in the job's own `requires:`. Nothing is
                      typed from memory and nothing is invented here: the document declares the keys
                      and this form asks for exactly those. A hook that cannot supply them is refused
                      at the save, by name, rather than refusing silently on every match. */}
                  {hookJob && (
                    <div className="agent-profile__hookform-row agent-profile__hookform-row--top">
                      <label className="agent-profile__hookform-label">with</label>
                      <div className="agent-profile__hookform-with">
                        {(hookJob.requires || []).length ? (
                          (hookJob.requires || []).map((k) => (
                            <label className="agent-profile__hookform-withrow" key={k}>
                              <span className="agent-profile__hookform-withkey">{k}</span>
                              <input
                                className="agent-profile__hookform-input"
                                value={(hookDraft.with || {})[k] || ""}
                                placeholder={`the ${k} this hook runs it with`}
                                onChange={(e) => setHd({ with: { ...(hookDraft.with || {}), [k]: e.target.value } })}
                              />
                            </label>
                          ))
                        ) : (
                          <span className="agent-profile__hookform-note">
                            this job declares no inputs, so there is nothing to supply
                          </span>
                        )}
                      </div>
                    </div>
                  )}

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
                    <label className="agent-profile__hookform-label">fire rate</label>
                    <SvSelect
                      value={hookDraft.rate}
                      onChange={(v) => setHd({ rate: v })}
                      options={[
                        { value: "once-per-session", label: "once per session" },
                        // ONCE PER CROSSING (2026-10-12). Beside once-per-session because they are
                        // the two session-scoped rates, and because this is the one you almost
                        // always want instead of it on a THRESHOLD hook. His report:
                        // *"two times in a row context maintenance did not fire."* It had not: a
                        // usage hook at once-per-session fires at the first crossing of 60% and
                        // then never again for that session's life, even though a compaction drops
                        // the window and it climbs straight back. The fall is what re-arms this one.
                        { value: "once-per-rise", label: "once per crossing (re-arms when it drops)" },
                        { value: "cooldown:5m", label: "at most every 5 min" },
                        { value: "cooldown:1h", label: "at most every hour" },
                        { value: "cooldown:2h", label: "at most every 2 hours" },
                        { value: "cooldown:4h", label: "at most every 4 hours" },
                        { value: "cooldown:8h", label: "at most every 8 hours" },
                        { value: "cooldown:12h", label: "at most every 12 hours" },
                        { value: "once-per-day", label: "once a day" },
                        { value: "cooldown:3d", label: "at most every 3 days" },
                        { value: "once-per-week", label: "once a week" },
                        { value: "cooldown:2w", label: "at most every 2 weeks" },
                        { value: "once-per-month", label: "once a month" },
                        { value: "", label: "no rate — every match" },
                      ]}
                    />
                    <span className="agent-profile__hookform-note">
                      {hookDraft.rate === "once-per-rise" ? (
                        Object.keys(rowsToWhen(hookDraft.rows || [])).length ? (
                          <>
                            fires when the condition above becomes true, stays quiet while it holds,
                            and re-arms the moment it goes false — so a threshold fires once per
                            crossing instead of once per session.
                          </>
                        ) : (
                          <b>
                            once per crossing needs a condition to cross — add a “when” row above,
                            or this will be refused, because with nothing to go false it would just
                            mean once per session.
                          </b>
                        )
                      ) : (
                        <>
                          a hook with no rate is a context leak that fires forever. "once a
                          day/week/month" is calendar-anchored — it resets at the boundary; a
                          cooldown slides from the last fire. For a hook on a THRESHOLD — past 60%,
                          over N minutes idle — "once per crossing" is almost always the one you
                          want: once per session fires on the first crossing and never again.
                        </>
                      )}
                    </span>
                  </div>

                  {/* KIND IS NOT A QUESTION ANY MORE (2026-10-08). It used to be a third dropdown —
                      "context — points, the agent decides" vs "work — something runs" — which read
                      like the skill/job switch and was not one: it had no behaviour anywhere, just a
                      CSS class, while `do` carried the real distinction with enforcement behind it.
                      Two fields reaching for one idea, and the decorative one was the one being
                      asked. So it is DERIVED from the pointer, which makes the loud label finally
                      true: the loud rows are the jobs. */}
                  <div className="agent-profile__hookform-row">
                    <label className="agent-profile__hookform-label">kind</label>
                    <span className="agent-profile__hookform-note">
                      <b>{hookJob ? "work" : "context"}</b> — {hookJob
                        ? "derived: a job runs and hands something over"
                        : "derived: a skill is pointed at, and the agent decides"}
                    </span>
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
              fires. Click to read and edit — or just to read, where the source is read-only. Grouped
              by <b>source</b>: each header says whether a skill there is yours to edit, whether the
              folder is even on disk, and whether the Skill tool can discover it at all. The little
              box picks which skills <b>this agent</b> carries — that one works on every skill,
              read-only included; no exclusions means all of them, and a change lands at the next
              re-init.
            </div>
            {/* GROUPED BY SOURCE, under one roof. The skills are not one pile: some you authored and
                own, some ship with the CLI and are yours to read only, some sit in a folder the Skill
                tool never looks at. Each source states its own terms in a header above its chips —
                not in a second section elsewhere on the page, because the question "can I edit this,
                and will it fire" is about the skill you are looking at. */}
            {skills === null ? (
              <div className="agent-profile__none">The harness can't answer yet — relaunch the browser to arm the skills API.</div>
            ) : (
              <>
                {skillRows.map((row) => (
                  <div className="agent-profile__source" key={row.name || "_flat"}>
                    {/* An unheaded row is the old harness answering skills but not sources — it
                        renders as the flat list that was always here. */}
                    {row.name && (
                      <div className={`agent-profile__source-head agent-profile__source-head--${row.status}`}>
                        <span className="agent-profile__source-name">{row.name}</span>
                        <span
                          className={`agent-profile__source-mode${row.writable ? "" : " agent-profile__source-mode--ro"}`}
                          title={
                            row.writable
                              ? "yours to edit — a skill here saves from the doc panel"
                              : "read-only — open any of these to read it in full; the write is refused"
                          }
                        >
                          {row.writable ? "writable" : "read-only"}
                        </span>
                        {/* ABSENT, not empty. The folder is not on disk right now — "0 skills" would
                            describe a folder that exists and holds nothing, which is a different
                            fact. The shipped source is keyed to the CLI version and a content hash,
                            so it really does vanish across an upgrade; the row stays to say so. */}
                        <span className={`agent-profile__source-count${row.unresolved ? " agent-profile__source-count--absent" : ""}`}>
                          {sourceCountLabel(row)}
                        </span>
                        {row.claimed !== null && (
                          <span className="agent-profile__source-count" title="the source reported a different count than the skills listed here">
                            source says {row.claimed}
                          </span>
                        )}
                        {/* VISIBLE BUT INERT is the failure this says out loud: the files are here
                            and readable, and the Skill tool will never discover them, so nothing in
                            this group can fire. A row that looked armed while being inert was the bug. */}
                        {!row.discoverable && (
                          <span
                            className="agent-profile__source-inert"
                            title="the Skill tool does not discover this folder — these are readable, but none of them can fire"
                          >
                            can't fire — not discovered
                          </span>
                        )}
                        {row.note && <span className="agent-profile__source-note">{row.note}</span>}
                        {row.pattern && (
                          <span
                            className="agent-profile__source-pattern"
                            title={row.dirs.length ? `resolved to:\n${row.dirs.join("\n")}` : "nothing on disk matches this right now"}
                          >
                            {row.pattern}
                          </span>
                        )}
                      </div>
                    )}
                    <div className="agent-profile__docs">
                      {row.skills.map((s) => {
                        // Three truths on one chip, kept apart: `excluded` is the CHOICE (def.skills
                        // says this agent doesn't carry it — strikethrough, hollow toggle),
                        // `liveMissing` is the REPORT (the running session didn't load it — the
                        // existing gray), and `ro` is the source's TERMS (read it, don't edit it).
                        const excluded = !carriesSkill(s.name);
                        const liveMissing = skillEnabled && !skillEnabled.has(s.name);
                        const ro = s.writable === false;
                        return (
                          <button
                            key={`${s.where}:${s.name}`}
                            className={`agent-profile__doc-chip${liveMissing ? " agent-profile__doc-chip--off" : ""}${excluded ? " agent-profile__doc-chip--excluded" : ""}${ro ? " agent-profile__doc-chip--ro" : ""}`}
                            title={`${s.description || ""}${ro ? " — read-only: open to read it in full, editing is refused" : ""}${liveMissing ? " — the running session did not load this; re-init to pick up changes" : ""}`}
                            onClick={() => typeof onOpenDoc === "function" && onOpenDoc(skillDoc(draft.id, s))}
                          >
                            {/* THE CONTROL — its own click target; the rest of the chip opens the
                                doc. It stays live on a read-only skill on purpose: carrying is the
                                only lever you have over a skill you cannot edit. */}
                            <span
                              className={`agent-profile__skill-toggle${excluded ? " agent-profile__skill-toggle--off" : ""}`}
                              role="checkbox"
                              aria-checked={!excluded}
                              title={
                                excluded
                                  ? "not carried — click to carry it; applies at the agent's next re-init"
                                  : "carried — click to stop carrying it; applies at the agent's next re-init"
                              }
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleSkill(s.name);
                              }}
                            >
                              {excluded ? "" : "✓"}
                            </span>
                            <span className="agent-profile__doc-ico">◈</span>
                            <span className="agent-profile__skill-name">{s.name}</span>
                            {ro && <span className="agent-profile__skill-ro" title="read-only — the write is refused">read-only</span>}
                            <span className="agent-profile__doc-where">{s.where}</span>
                          </button>
                        );
                      })}
                      {/* THE CREATE BUTTON BELONGS TO THE WRITABLE SOURCE — his catch, 2026-10-13:
                          *"I don't know why this button to create a new skill is all the way on the
                          bottom, not by the skills that you actually create. It's by the skills that
                          are synced read only."* Exactly: it sat after the whole `skillRows` map, so
                          it rendered beneath the last group — which is a read-only synced folder a
                          create button can never write to. A verb next to the thing it cannot act on
                          is a worse lie than a missing button. It now sits in the group it writes
                          into, and renders nowhere else. */}
                      {row.writable && newSkillIn !== (row.where || "user") && (
                        <button
                          className="agent-profile__doc-chip agent-profile__doc-chip--new"
                          title={`Create a new skill in "${row.name}" — ${row.note || "yours to edit"}`}
                          onClick={() => { setNewSkillIn(row.where || "user"); setNewSkillName(""); }}
                        >
                          <span className="agent-profile__doc-ico">＋</span>
                          new skill
                        </button>
                      )}
                      {row.writable && newSkillIn === (row.where || "user") && (
                        <span className="agent-profile__newrow">
                          <input
                            className="agent-profile__hookform-input"
                            autoFocus
                            placeholder="skill name — lowercase, dashes"
                            value={newSkillName}
                            onChange={(e) => setNewSkillName(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Escape") setNewSkillIn(null);
                              if (e.key === "Enter") createSkillHere(row);
                            }}
                          />
                          <button type="button" className="agent-profile__hook-btn" onClick={() => createSkillHere(row)}>create</button>
                          <button type="button" className="agent-profile__hook-btn" onClick={() => setNewSkillIn(null)}>cancel</button>
                        </span>
                      )}
                    </div>
                  </div>
                ))}
                <div className="agent-profile__docs">
                  {!skills.length && <span className="agent-profile__none">No skill files found for this agent's homes.</span>}
                </div>
              </>
            )}
          </div>

          {/* JOBS — RFC-067 §8.8, and the gap his own question found: *"where can I see the job
              defined by agents?"* Nowhere, until this. A job had no section on any surface, while
              `window.systemview.jobs` had been exposed since RFC-005 §10 with nothing calling it.

              IT SITS UNDER SKILLS AND ABOVE CHORES because a job IS a skill with the job parts —
              same family, read in the same breath — and a chore line is what expects either of them
              to stay current. Hooks moved below all three: a hook runs nothing, it points. And like
              the hooks list, this is a list of what exists on the MACHINE rather
              than of what this agent carries — a job belongs to no agent, which is the point of it
              (*a job that lives inside an application is a job that dies with it*).

              READ-ONLY, DELIBERATELY. Authoring a job is `job-authoring`'s procedure through
              `jobsWrite` — six parts, named inputs, bounds — and a textarea here would be an
              invitation to write a job without them, which is how one ends up un-assignable or its
              result un-checkable. What this surface owes you is the opposite: see what a job IS,
              who can fire it, and what it has actually done. */}
          <div className="agent-profile__section">
            <div className="agent-profile__section-head">Jobs — work that is given, never chosen</div>
            <div className="agent-profile__hint">
              A job is a <b>skill with the job parts</b>, and it is <b>not injected</b> — no
              description rides in any system prompt, so it can only run when something names it.
              It lives at <code>~/.autobot/jobs/&lt;id&gt;/</code>, belongs to no agent, and declares
              what it <b>must be given</b>: a hook that cannot supply those is refused when you write
              it, not at 3am. Written by an agent following <code>job-authoring</code>; read here.
            </div>

            <div className="agent-profile__jobs">
              {(jobs || []).map((j) => {
                const open = jobOpen === j.id;
                const givers = (hooks || []).filter((h) => String(h.do || "") === `job:${j.id}`);
                return (
                  <div className={`agent-profile__job${j.enabled === false ? " agent-profile__job--off" : ""}`} key={j.id}>
                    {/* THE WHOLE ROW OPENS IT, and it opens where every other document on this
                        page opens — the right panel, as markdown, resizable and unclipped (his
                        catch: the only click target was the name, and the expanded `<pre>` was a
                        preview nobody could read). The chevron below still expands the row in place
                        for the runs; reading the document is the panel's job, because that is where
                        agent docs and skills already go and a job is the same family. */}
                    <div
                      className="agent-profile__job-main"
                      role="button"
                      tabIndex={0}
                      onClick={() => openJobDoc(j)}
                      onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && openJobDoc(j)}
                      title="Read the whole job document"
                    >
                      <span className="agent-profile__job-name">{j.name || j.id}</span>
                      <span className="agent-profile__job-id">{j.id}</span>
                      {/* WHAT IT DEMANDS, from the document's own front matter — the thing a hook
                          has to supply, so it is the first fact worth seeing next to the name. */}
                      {(j.requires || []).length ? (
                        <span className="agent-profile__job-needs">
                          needs {(j.requires || []).join(", ")}
                        </span>
                      ) : (
                        <span className="agent-profile__job-needs agent-profile__job-needs--none">
                          declares no inputs
                        </span>
                      )}
                      {j.enabled === false && <span className="agent-profile__hook-guard">parked</span>}
                      <button
                        type="button"
                        className="agent-profile__job-chev"
                        title={open ? "Hide its runs" : "Show what it has actually done"}
                        onClick={(e) => {
                          e.stopPropagation(); // or the row's open-the-document click rides along
                          setJobOpen(open ? null : j.id);
                        }}
                      >
                        {open ? "▾ runs" : "▸ runs"}
                      </button>
                    </div>

                    {/* THE AIM is the document's opening sentence, which is also what a jobs listing
                        shows an agent. One place, one label. */}
                    <div className="agent-profile__job-aim">{aimOf(j)}</div>

                    {/* WHO CAN FIRE IT — and whether anybody actually carries that hook. A job with
                        no carried hook can never run, and that is invisible from the job alone:
                        writing a hook is the proposal, the tick on the profile is the approval. */}
                    <div className="agent-profile__job-givers">
                      {givers.length ? (
                        givers.map((h) => (
                          <span
                            className={`agent-profile__job-giver${carriesHook(h.name) ? " agent-profile__job-giver--on" : ""}`}
                            key={h.name}
                            title={
                              carriesHook(h.name)
                                ? `${h.name} is carried by this agent — it can fire`
                                : `${h.name} exists but nobody here carries it, so it fires for nobody`
                            }
                          >
                            {h.name} on {h.on}
                            {carriesHook(h.name) ? "" : " — not carried"}
                          </span>
                        ))
                      ) : (
                        <span className="agent-profile__job-giver agent-profile__job-giver--none">
                          no hook names it — nothing can fire this job
                        </span>
                      )}
                    </div>

                    {open && (
                      <div className="agent-profile__job-open">
                        {/* THE RUNS, off the run records — what the job has actually done, which is
                            the only evidence that does not come from an agent's own account. */}
                        <div className="agent-profile__job-runs">
                          {(jobRunRows[j.id] || []).length ? (
                            (jobRunRows[j.id] || []).map((r) => (
                              <div className="agent-profile__job-run" key={r.id}>
                                <span className={`agent-profile__job-run-state agent-profile__job-run-state--${r.status || "running"}`}>
                                  {r.status || "running"}
                                </span>
                                <span className="agent-profile__job-run-when">
                                  {r.startedAt ? new Date(r.startedAt).toISOString().slice(0, 16).replace("T", " ") : ""}
                                </span>
                                <span className="agent-profile__job-run-why">{r.why || ""}</span>
                                {r.report && r.report.path ? (
                                  <button
                                    type="button"
                                    className="agent-profile__job-run-report"
                                    title={`Open ${r.report.path}`}
                                    onClick={() =>
                                      window.dispatchEvent(
                                        new CustomEvent("sv:openFileInNav", {
                                          detail: {
                                            projectCode: draft && draft.projectCode,
                                            path: r.report.path,
                                            language: "markdown",
                                            lines: null,
                                          },
                                        }),
                                      )
                                    }
                                  >
                                    {r.report.label || "report"}
                                  </button>
                                ) : (
                                  <span className="agent-profile__job-run-noreport">filed no report</span>
                                )}
                                {/* THE RATING, where the report is read — the engine has carried
                                    `rateRun` from the start with no door to it. */}
                                <span className="agent-profile__job-run-rate">
                                  {[1, 2, 3, 4, 5].map((n) => (
                                    <button
                                      key={n}
                                      type="button"
                                      className={`agent-profile__job-star${n <= Number(r.rating || 0) ? " agent-profile__job-star--on" : ""}`}
                                      title={`rate this run ${n}/5`}
                                      onClick={async () => {
                                        await rateJobRun(j.id, r.id, n);
                                        setJobRunRows((m) => ({
                                          ...m,
                                          [j.id]: (m[j.id] || []).map((x) => (x.id === r.id ? { ...x, rating: n } : x)),
                                        }));
                                      }}
                                    >
                                      ★
                                    </button>
                                  ))}
                                </span>
                              </div>
                            ))
                          ) : (
                            <span className="agent-profile__none">It has never run.</span>
                          )}
                        </div>

                        {/* NO INLINE PREVIEW. It was a `<pre>` of a six-part document in a column
                            this narrow — unreadable, and it taught that the document lives here
                            when it opens in the panel like every other doc on this page. */}
                        <button type="button" className="agent-profile__job-read" onClick={() => openJobDoc(j)}>
                          Read the whole document
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
              {/* ABSENCE AND BLINDNESS ARE DIFFERENT SENTENCES, and this said the first while two
                  jobs sat on disk. The shell hands `window.systemview.jobs` over only with a
                  `jobs:read` grant, which SystemView did not have until 2026-10-08 — so the list
                  came back empty for a reason that had nothing to do with how many jobs exist, and
                  the surface stated the wrong one confidently. A row that cannot look says so. */}
              {!(jobs || []).length &&
                (hasHostJobs() ? (
                  <span className="agent-profile__none">
                    No jobs exist yet. One is written with you by <code>job-authoring</code>.
                  </span>
                ) : (
                  <span className="agent-profile__none agent-profile__none--blind">
                    This surface was not granted <code>jobs:read</code>, so it cannot see whether any
                    jobs exist — this is not an empty list. Grant it in the app registry and restart
                    the shell.
                  </span>
                ))}
            </div>

            {/* CREATING ONE IS A VERB HERE TOO — his catch, 2026-10-13: *"there's no new job button
                when a job is very simple."* Right, and the asymmetry was indefensible: skills had
                a create button, jobs had none, and `jobs:save` had been answering the whole time
                with no door from this app to it.

                SEEDED, NEVER BLANK, for the same reason the new-skill button seeds front matter:
                `requires:` is read out of the document and nowhere else, and the six parts are what
                make a job assignable at all — a blank page is how one ships un-assignable. What is
                seeded is the SHAPE; `job-authoring` is still what fills it in well.

                AND IT CANNOT MAKE A SESSION STALE. A job lives at ~/.autobot/jobs/<id>/, not on any
                agent's definition, and the staleness fingerprint covers only what is composed into a
                system prompt (see composedStamp). So writing one never asks anybody to re-init —
                which is what he said it had better not do. */}
            {hasHostJobs() && newJobName === null && (
              <button type="button" className="agent-profile__hook-add" onClick={() => setNewJobName("")}>
                ＋ new job
              </button>
            )}
            {hasHostJobs() && newJobName !== null && (
              <div className="agent-profile__newrow">
                <input
                  className="agent-profile__hookform-input"
                  autoFocus
                  placeholder="job id — lowercase, dashes for spaces"
                  value={newJobName}
                  onChange={(e) => setNewJobName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Escape") setNewJobName(null);
                    if (e.key === "Enter") createJob();
                  }}
                />
                <button type="button" className="agent-profile__hook-btn" onClick={createJob}>create</button>
                <button type="button" className="agent-profile__hook-btn" onClick={() => setNewJobName(null)}>cancel</button>
              </div>
            )}
          </div>

          {/* THE CHORE BOARD — RFC-067 §4, and §7 named it the first surface to build: *"the board
              on the agent profile, where hooks and skills are already carried and the control
              already exists."* It sits under Hooks because it is the same family read from the
              other end: a hook says WHEN something runs, a chore line says it must be CURRENT and
              lets the system work out whether it is.

              TWO HALVES, AND ONLY ONE IS EDITABLE. The LINES are yours — what this agent is
              expected to keep current, and how often. The STATE is not: done/not-done is a query
              over closed run records plus the chore stamps, so there is no tick here to press and
              nothing on this page can disagree with what actually happened. A line checks itself
              off when a run of the thing it names closes, and it comes due again next period. */}
          <div className="agent-profile__section">
            <div className="agent-profile__section-head">Chores — what this agent keeps current</div>
            <div className="agent-profile__hint">
              Each line names a <b>skill or a job</b> and a <b>period</b>. Nothing is ticked by
              hand: a line reads done when a run of the thing it names <b>closed inside this
              period</b> — so a procedure abandoned halfway leaves it undone, which is correct. It
              does not stay checked; next period it is due again. The agent reads this with the
              <code> chores</code> verb, and it is never injected.
            </div>

            {/* THE GLANCE, FIRST. A board exists to answer "how much is outstanding" and this
                surface made him count rows to find out — while the `chores` verb has always told
                an agent in one sentence. */}
            {!!choreRows.length && (
              <div className={`agent-profile__chores-tally${choresOwed ? " agent-profile__chores-tally--owed" : ""}`}>
                {choresOwed
                  ? `${choresOwed} of ${choreRows.length} outstanding this period`
                  : `all ${choreRows.length} current`}
              </div>
            )}
            <div className="agent-profile__chores">
              {choreRows.map((row, i) => (
                <div
                  className={`agent-profile__chore${row.known ? (row.done ? " agent-profile__chore--done" : " agent-profile__chore--owed") : ""}`}
                  key={`${row.what}-${i}`}
                >
                  {/* THE STATUS IS A PILL WITH ITS OWN FILL — the same lesson the job badge just
                      taught: inherited text at low opacity is dim in BOTH themes, while a pill
                      carries its own figure and ground and reads identically in each. It was a
                      12px "·" before, which is not a status, it is a bullet. */}
                  <span
                    className={`agent-profile__chore-pill${
                      row.known ? (row.done ? " agent-profile__chore-pill--done" : " agent-profile__chore-pill--owed") : " agent-profile__chore-pill--new"
                    }`}
                  >
                    {row.known ? (row.done ? "done" : "due") : "new"}
                  </span>
                  {/* WHY it is due, when the answer is "because you said so". Without this a line
                      you reset two minutes after running it looks like the tick machinery failed. */}
                  {row.known && !row.done && row.resetAt > row.at && (
                    <span className="agent-profile__chore-wasreset" title={`reset ${new Date(row.resetAt).toLocaleString()} — the run that did it is still on record`}>
                      reset
                    </span>
                  )}
                  <SvSelect
                    value={row.what}
                    onChange={(v) => setChore(i, { what: v })}
                    options={[
                      ...(skills || []).map((sk) => ({ value: `skill:${sk.name}`, label: `skill — ${sk.name}` })),
                      ...(jobs || []).map((j) => ({ value: `job:${j.id}`, label: `job — ${j.name || j.id}`, hot: true })),
                      ...(choreRows.some((r) => r.what === row.what) &&
                      !(skills || []).some((sk) => `skill:${sk.name}` === row.what) &&
                      !(jobs || []).some((j) => `job:${j.id}` === row.what)
                        ? [{ value: row.what, label: `${row.what} — not on this machine` }]
                        : []),
                    ]}
                  />
                  <span className="agent-profile__chore-every">every</span>
                  <SvSelect
                    value={row.period}
                    onChange={(v) => setChore(i, { period: v })}
                    options={(board.periods && board.periods.length ? board.periods : ["daily", "weekly", "monthly"]).map(
                      // FULL WORDS. `pd.replace(/ly$/, "")` turned "weekly" into "week" and
                      // "monthly" into "month" — and "daily" into "dai", which is how he found it.
                      (pd) => ({ value: pd, label: pd }),
                    )}
                  />
                  {/* WHAT THE DISK SAYS, and it is the only thing allowed to say it. Short now:
                      the pill carries the verdict, so this only has to carry the DATE. A sentence
                      here wrapped every row and buried the one thing it added. */}
                  <span className="agent-profile__chore-state">
                    {/* LOCAL, because the DUE/DONE verdict beside it is local. `periodStart` uses
                        his midnight on purpose ("a day is his day and not UTC's"), so an ISO slice
                        here prints a run that closed 20:38 last night as today's date — a row
                        reading DUE and "ran today" at the same time. Found 2026-10-13 in the
                        agent-facing `chores` verb and fixed in both, because they are two
                        renderings of one answer and only one of them was wrong out loud. */}
                    {row.at
                      ? `ran ${new Date(row.at).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" })}`
                      : row.known
                        ? "never run"
                        : "no run yet"}
                  </span>
                  {/* RESET IS ALWAYS VISIBLE, and disabled when there is nothing to reset.
                      I first rendered it only on a done line — "a button that does nothing is worse
                      than no button" — and he went looking for it on a line that was already due and
                      found nothing: *"where's reset? I don't see reset."* A control that appears and
                      disappears by state is undiscoverable, and the first time you need it is
                      exactly when you cannot see it. Disabled-with-a-reason is the honest form:
                      present, explained, and unable to lie. */}
                  <button
                    type="button"
                    className="agent-profile__hook-btn agent-profile__chore-reset"
                    disabled={!row.done}
                    title={
                      row.done
                        ? "Mark this due again — the run that did it is kept on record, it just stops counting from now"
                        : row.known
                          ? "already due — nothing to reset"
                          : "no run on record yet, so there is nothing to reset"
                    }
                    onClick={() => resetChore(i)}
                  >
                    reset
                  </button>
                  <button
                    type="button"
                    className="agent-profile__hook-btn agent-profile__hook-btn--del"
                    title="Take this line off the board"
                    onClick={() => dropChore(i)}
                  >
                    remove
                  </button>
                </div>
              ))}
              {/* NAMED BEFORE IT EXISTS. No status, no period, no remove — there is nothing to
                  remove, and that is the point. */}
              {addingChore && (
                <div className="agent-profile__chore agent-profile__chore--new">
                  <span className="agent-profile__chore-pill agent-profile__chore-pill--new">new</span>
                  <SvSelect
                    value=""
                    onChange={namePending}
                    options={[
                      { value: "", label: "choose a skill or job…" },
                      ...(skills || []).map((sk) => ({ value: `skill:${sk.name}`, label: `skill — ${sk.name}` })),
                      ...(jobs || []).map((j) => ({ value: `job:${j.id}`, label: `job — ${j.name || j.id}`, hot: true })),
                    ]}
                  />
                  <button
                    type="button"
                    className="agent-profile__hook-btn agent-profile__chore-del"
                    onClick={() => setAddingChore(false)}
                  >
                    cancel
                  </button>
                </div>
              )}
              {!choreRows.length && !addingChore && (
                <span className="agent-profile__none">
                  Nothing is expected of this agent on a schedule.
                </span>
              )}
            </div>

            {!addingChore && (
              <button type="button" className="agent-profile__hook-add" onClick={addChore}>
                + new chore
              </button>
            )}
          </div>

          {/* HOOKS — the third way context reaches an agent. Loaded context is paid every turn;
              retrieved context is paid when the agent thinks to ask; a hook is paid only when a
              MOMENT happens.

              IT SITS LAST OF THE FOUR, below Skills/Jobs/Chores — his call, 2026-10-12, and he had
              to ask twice because I agreed in writing and then built something else: *"jobs are
              defined separately from skills, but they're basically the same. Jobs should probably
              be right next to skills, under skills in the UI, no? jobs and chores."*

              The reason the order reads better this way: those three are all PROCEDURES THIS AGENT
              MAY RUN — a job is a skill with the job parts, and a chore line names one of either.
              A hook runs nothing; it points, and it is the only one of the four that is about WHEN
              rather than WHAT. Putting it between the procedures and the expectations split a
              family down the middle. */}
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
                      {(h.rate || h.guard) && <span className="agent-profile__hook-guard">{h.rate || h.guard}</span>}
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
                      {/* a copy opens as a NEW draft under the list, name pre-filled free —
                          per-agent cadences are one duplicate + one rate change now */}
                      <button type="button" className="agent-profile__hook-btn" title="Start a new hook as a copy of this one" onClick={() => duplicateHook(h)}>duplicate</button>
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

            {/* SUBSCRIPTIONS — context this agent chose to have DELIVERED UNASKED (RFC-013).
                These rows are LENSES, exactly like the counts above them (his point, made twice):
                clicking one filters the context table below to that note's scope and reveals the
                note itself — you read the real context where context lives, not a preview card.
                Delete ends the preference; the content survives. */}
            <div className="agent-profile__subs">
              <div className="agent-profile__subs-head">Subscriptions — delivered unasked · click one to see it below</div>
              {subsRows.length === 0 && (
                <div className="agent-profile__empty">none — the agent subscribes itself (subscribe in its context tools)</div>
              )}
              {subsRows.map((r) => {
                const nm = /^note:(.+)@([a-zA-Z0-9._:-]+)$/.exec(r.what || "");
                const scopeKey = nm ? (nm[2] === "system" ? "system" : nm[2].startsWith("project:") ? "project" : "agent") : null;
                return (
                  <div
                    className={`agent-profile__sub${r.broken ? " agent-profile__sub--broken" : ""}${nm ? " agent-profile__sub--click" : ""}`}
                    key={r.what}
                    role={nm ? "button" : undefined}
                    title={nm ? "Show this note in the context table below" : r.what}
                    onClick={() => nm && typeof onFilterScope === "function" && onFilterScope(scopeKey, nm[1])}
                  >
                    <span className="agent-profile__sub-title">⚡ {r.title || r.what}</span>
                    <span className="agent-profile__sub-when">{(r.when || []).join(" + ")}</span>
                    <span className="agent-profile__sub-gate">
                      {r.until && r.until.turns
                        ? `${r.spent}/${r.until.turns} spent`
                        : r.until && r.until.run
                        ? `until ${r.until.run} closes`
                        : r.until && r.until.untilTs
                        ? `until ${new Date(r.until.untilTs).toISOString().slice(0, 10)}`
                        : "7d"}
                    </span>
                    {r.broken && <span className="agent-profile__sub-dead">target gone</span>}
                    <button
                      type="button"
                      className="agent-profile__hook-btn agent-profile__hook-btn--del"
                      title="End this subscription — the content survives in the store"
                      onClick={(e) => { e.stopPropagation(); dropSub(r.what); }}
                    >
                      delete
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AgentProfile;
