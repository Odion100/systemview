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
  if (!a || typeof a.hooks !== "function") return { hooks: [], events: [] };
  try {
    const r = await a.hooks();
    return { hooks: (r && r.hooks) || [], events: (r && r.events) || [] };
  } catch {
    return { hooks: [], events: [] };
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
export async function proposals() {
  const a = sv() && sv().agent;
  if (!a || typeof a.proposals !== "function") return [];
  try {
    return (await a.proposals()) || [];
  } catch {
    return [];
  }
}

export async function applyProposal(id, text) {
  const a = sv() && sv().agent;
  if (!a || typeof a.applyProposal !== "function") return { ok: false, error: "no proposal bridge — relaunch the browser" };
  try {
    return (await a.applyProposal(id, text)) || { ok: false, error: "no answer" };
  } catch (e) {
    return { ok: false, error: String((e && e.message) || e) };
  }
}

export async function rejectProposal(id) {
  const a = sv() && sv().agent;
  if (!a || typeof a.rejectProposal !== "function") return { ok: false };
  try {
    return (await a.rejectProposal(id)) || { ok: false };
  } catch {
    return { ok: false };
  }
}

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
