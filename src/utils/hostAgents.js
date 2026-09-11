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

export async function killSession(projectCode, sessionId) {
  const a = sv() && sv().agent;
  if (!a || typeof a.killSession !== "function") return false;
  try {
    return await a.killSession(projectCode, sessionId);
  } catch {
    return false;
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
