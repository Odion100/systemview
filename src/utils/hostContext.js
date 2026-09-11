// THE CONTEXT STORE, FROM THE RENDERER — RFC-055's management half.
//
// The store is a HARNESS capability (like files, like dictation): the browser is a reader and
// editor over it, never its owner. So this util is a thin wrapper over `window.systemview` and
// nothing more — no state, no cache. The same rule the whole RFC rests on: the harness holds the
// state, SystemView renders and edits it.
//
// Two surfaces underneath, deliberately: `vectors` (read + query, shared with the agents' own
// discovery/services tiers) and `context` (the human curate verbs — list/save/delete notes).
// Querying is the SAME search the agent runs, so what he sees is exactly what an agent would get.
const sv = () => (typeof window !== "undefined" && window.systemview) || null;

export const hasContextStore = () => !!(sv() && sv().vectors && sv().context);

// Every collection with counts — the store index. `ctx-*` are the editable note stores;
// `mcp-tools` is the derived tool index (read-only). The surface groups by this prefix.
export async function collections() {
  const v = sv() && sv().vectors;
  if (!v) return [];
  try {
    return (await v.collections()) || [];
  } catch {
    return [];
  }
}

// What is IN a store, newest first, vectors stripped — the browse path (vs. search's match path).
export async function records(collection) {
  const v = sv() && sv().vectors;
  if (!v) return { collection, records: [] };
  try {
    return (await v.records(collection)) || { collection, records: [] };
  } catch {
    return { collection, records: [] };
  }
}

// His notes for a scope, with the aging signal (hits / lastHit) the LINT job also reads. This is
// the editable path — every row here can be saved or deleted.
export async function notes(scope) {
  const c = sv() && sv().context;
  if (!c) return [];
  try {
    return (await c.notes(scope)) || [];
  } catch {
    return [];
  }
}

// SEARCH IS THE AGENT'S SEARCH — same call, so "what does the store say about X" answered here is
// byte-for-byte what an agent gets. That is the whole point of the surface: he stops asking agents
// to introspect and asks the store directly. `min` defaults low; scores come back visible so the
// #1–#2 gap reads the way it does for the agent.
export async function search(collection, query, opts = {}) {
  const v = sv() && sv().vectors;
  if (!v) return [];
  try {
    return (await v.search(collection, query, opts)) || [];
  } catch {
    // A THROW HERE IS "STORE UNAVAILABLE", NOT "NO MATCHES" — the surface must show that
    // difference for the same reason the agent tool does: a silent empty is a confident zero.
    throw new Error("context store unavailable");
  }
}

// Edit re-derives the embedding (the note is truth). Delete removes file + record.
export async function save(scope, id, fields) {
  return sv().context.save(scope, id, fields);
}
export async function remove(scope, id) {
  return sv().context.remove(scope, id);
}
