// AGENT DEFINITIONS, FROM THE RENDERER — RFC-055's "an agent is a thing you open and edit."
//
// The definitions are HARNESS state (like the vector store, like files): the browser reads and
// edits them, never owns them. Thin wrapper over `window.systemview.agents`, no cache. An agent's
// config is three axes the SDK keeps separate — tools, skills, mcpServers — plus the always-loaded
// `prompt` (the "where you are / what to do" doc) and placement/gating. This surface manages all of
// it in one place, which is the point: configure the agent right, see everything feeding it.
const sv = () => (typeof window !== "undefined" && window.systemview) || null;

export const hasAgents = () => !!(sv() && sv().agent && typeof sv().agent.defs === "function");

export async function listDefs() {
  const a = sv() && sv().agent;
  if (!a) return [];
  try {
    return (await a.defs()) || [];
  } catch {
    return [];
  }
}

export async function getDef(id) {
  const a = sv() && sv().agent;
  if (!a) return null;
  try {
    return await a.def(id);
  } catch {
    return null;
  }
}

// Save merges: the caller hands the whole record back (id + def + placement), so a partial edit
// still round-trips every field. The harness normalizes; we never guess its shape.
export async function saveDef(rec) {
  return sv().agent.saveDef(rec);
}

export async function removeDef(id) {
  return sv().agent.removeDef(id);
}

// Every doc feeding the agent — the def prompt plus the CLAUDE.md stack at its cwd —
// with content, so the profile shows them as chips that open in the doc panel.
// Returns NULL when the harness can't answer (old harness, no API) — the surface must tell
// "waiting on the harness" apart from "nothing written yet" (his catch).
export async function listDocs(id) {
  const a = sv() && sv().agent;
  if (!a || typeof a.docs !== "function") return null;
  try {
    return (await a.docs(id)) || [];
  } catch {
    return null;
  }
}

export async function saveDoc(id, key, text) {
  return sv().agent.saveDoc(id, key, text);
}

// Skills — docs that load ON DEMAND. Shared files (user + the agent's project), not per-agent
// state; the agent carries the name+description list all session and pulls the body when needed.
export async function listSkills(id) {
  const a = sv() && sv().agent;
  if (!a || typeof a.skills !== "function") return null;
  try {
    return (await a.skills(id)) || [];
  } catch {
    return null;
  }
}

// CREATE and REMOVE are separate verbs from save on purpose: save refuses a name the scan does not
// know, create refuses one it does. Before these existed the system could list and edit skills and
// never make one — so every skill entered by hand, through a dotfolder, where nothing could see it.
export async function createSkill(id, name, where, text) {
  const a = sv().agent;
  if (!a || typeof a.createSkill !== "function") return { ok: false, error: "no harness" };
  return a.createSkill(id, name, where, text);
}

export async function removeSkill(id, name, where) {
  const a = sv().agent;
  if (!a || typeof a.removeSkill !== "function") return { ok: false, error: "no harness" };
  return a.removeSkill(id, name, where);
}

export async function saveSkill(id, name, where, text) {
  return sv().agent.saveSkill(id, name, where, text);
}

// PAGE-LEVEL HELP — for the humans designing agents, scoped to no agent. Same null-vs-empty
// discipline as docs: null = harness can't answer yet.
export async function listHelp() {
  const a = sv() && sv().agent;
  if (!a || typeof a.help !== "function") return null;
  try {
    return (await a.help()) || [];
  } catch {
    return null;
  }
}

export async function saveHelp(key, text) {
  return sv().agent.saveHelp(key, text);
}

// Live sessions (running right now — the "is it alive, where is it working" tell).
export async function liveSessions() {
  const a = sv() && sv().agent;
  if (!a || typeof a.sessions !== "function") return [];
  try {
    return (await a.sessions()) || [];
  } catch {
    return [];
  }
}

// RE-INIT a running session in place. The system prompt — presence, the system context, the
// agent's own doc — is composed once at open and handed to the SDK at query time, so editing
// any of those reaches a RUNNING agent by no other route: not a save, not a compaction (which
// rewrites the conversation, never the prompt). This restarts the query against the same sdk
// session id, so the conversation continues and only the composition is new.
// Returns { key, history } — the caller re-seeds its feed from history — or null if refused.
export async function refreshSession(key) {
  const a = sv() && sv().agent;
  if (!a || typeof a.refresh !== "function") return null;
  try {
    return (await a.refresh(key)) || null;
  } catch {
    return null;
  }
}

export async function killSession(projectCode, sessionId) {
  const a = sv() && sv().agent;
  if (!a || typeof a.killSession !== "function") return false;
  try {
    return await a.killSession(projectCode, sessionId);
  } catch {
    return false;
  }
}

// CONTEXT HOOKS — { hooks: [...], events: [...] }. A hook is `on` (which emitted event) + `when`
// (a cheap declarative predicate over that event's payload) + `do` (a pointer to a skill, never
// the procedure itself). `events` is the vocabulary the harness actually emits, and it is what the
// picker is built from — you can only attach a hook to a moment the system really announces.
export async function listHooks() {
  const a = sv() && sv().agent;
  if (!a || typeof a.hooks !== "function") return { hooks: [], events: [], ambient: [] };
  try {
    const r = await a.hooks();
    return { hooks: (r && r.hooks) || [], events: (r && r.events) || [], ambient: (r && r.ambient) || [] };
  } catch {
    return { hooks: [], events: [], ambient: [] };
  }
}

export async function saveHook(rec) {
  const a = sv() && sv().agent;
  if (!a || typeof a.saveHook !== "function") return { error: "no harness" };
  try {
    return (await a.saveHook(rec)) || { error: "save failed" };
  } catch (e) {
    return { error: String((e && e.message) || e) };
  }
}

export async function removeHook(name) {
  const a = sv() && sv().agent;
  if (!a || typeof a.removeHook !== "function") return false;
  try {
    return await a.removeHook(name);
  } catch {
    return false;
  }
}

// STATISTICS — { store: { since, notes[], readers, totals }, weight: { rows[], totalTokens } }.
// Two measurements that must not be read as one: `store` is RETRIEVAL (what gets pulled, how
// often, by whom — is a note earning its place?), `weight` is the opposite question (the layers
// nobody retrieves because they arrive on every turn, where size is the whole story).
export async function contextStats(agentId) {
  const a = sv() && sv().agent;
  if (!a || typeof a.contextStats !== "function") return null;
  try {
    return (await a.contextStats(agentId)) || null;
  } catch {
    return null;
  }
}

// RFC-057 — THE CALL LEDGER: { since, days, calls[], agents, byKind, totals }. The opposite reading
// of contextStats: that one asks whether a note is worth keeping, this one asks whether a tool is
// worth arming. Global by default; pass { agent } or { project } to narrow, { days } to window.
export async function callStats(opts) {
  const a = sv() && sv().agent;
  if (!a || typeof a.callStats !== "function") return null;
  try {
    return (await a.callStats(opts || {})) || null;
  } catch {
    return null;
  }
}

// PROPOSED AGENT DOCS — the `agent-authoring` skill drafts into a sidecar and stops; approving is
// what writes `def.prompt`. Returns [{ id, name, by, cut, added, text, current, at }].

// Run history per agent: { [agentId]: { runs, lastActive, capabilities } }.
export async function agentRuns() {
  const a = sv() && sv().agent;
  if (!a || typeof a.runs !== "function") return {};
  try {
    return (await a.runs()) || {};
  } catch {
    return {};
  }
}

// RFC-058 §8 — THE CORPORA, FROM THE RENDERER. Same shape as the rest of this file: harness state
// the browser reads and edits, never owns. These reach the SAME functions in docs.cjs that the
// `docsPlan` / `docsIndex` MCP tools call — one implementation, two doors, so the cuts he judges
// are the cuts an agent gets.
export const hasDocs = () => !!(sv() && sv().agent && typeof sv().agent.docsList === "function");

export async function docsList() {
  const a = sv() && sv().agent;
  if (!a || !a.docsList) return null;
  try {
    return await a.docsList();
  } catch (e) {
    return { error: String((e && e.message) || e) };
  }
}

export async function docsPlan(name, opts) {
  const a = sv() && sv().agent;
  if (!a || !a.docsPlan) return null;
  try {
    return await a.docsPlan(name, opts || {});
  } catch (e) {
    return { error: String((e && e.message) || e) };
  }
}

// The same door `docs()` gives an agent: one question, the documentation half of what is
// retrievable here. Kept apart from context search on purpose — a note is true because someone
// learned it, a chunk only while its file has not changed.
export async function docsSearch(opts) {
  const a = sv() && sv().agent;
  if (!a || !a.docsSearch) return null;
  try {
    return await a.docsSearch(opts || {});
  } catch (e) {
    return { error: String((e && e.message) || e) };
  }
}

// A PATH IS PICKED, NOT TYPED — this is a desktop app.
export async function pickPath(kind) {
  const a = sv() && sv().agent;
  if (!a || !a.pickPath) return { canceled: true, unavailable: true };
  try {
    return await a.pickPath(kind || "dir");
  } catch {
    return { canceled: true };
  }
}

// What the pattern MATCHED, before anything is saved. Same `filesOf` the indexer runs.
export async function docsPreview(spec) {
  const a = sv() && sv().agent;
  if (!a || !a.docsPreview) return { files: [] };
  try {
    return (await a.docsPreview(spec)) || { files: [] };
  } catch (e) {
    return { error: String((e && e.message) || e) };
  }
}

export async function docsIndex(name) {
  const a = sv() && sv().agent;
  if (!a || !a.docsIndex) return { error: "not in the harness" };
  try {
    return await a.docsIndex(name);
  } catch (e) {
    return { error: String((e && e.message) || e) };
  }
}

export async function docsDrop(name) {
  const a = sv() && sv().agent;
  if (!a || !a.docsDrop) return { error: "not in the harness" };
  try {
    return await a.docsDrop(name);
  } catch (e) {
    return { error: String((e && e.message) || e) };
  }
}

export async function saveCorpus(rec) {
  const a = sv() && sv().agent;
  if (!a || !a.saveCorpus) return { error: "not in the harness" };
  try {
    return await a.saveCorpus(rec);
  } catch (e) {
    return { error: String((e && e.message) || e) };
  }
}
