// RFC-046 / RFC-048 — THE AGENT SEAM, and it is the terminal's seam again with different nouns.
//
// SystemView renders an agent session; it never spawns one. The Claude session lives in the
// browser's main process (autobot's Electron shell), riding the user's existing Claude Code login —
// no API key. The only thing that crosses the line is this transport, which is the whole security
// story and is structural rather than disciplinary: there is no spawn path in this codebase, so
// nothing on the SystemLynx module surface — which every agent in every room can call — can start
// an agent.
//
// The contract, as autobot built it (their RFC-002, our RFC-046):
//
//   window.systemview.agent.open({ projectCode, sessionId?, model?, permissionMode? })
//     -> Promise<AgentTransport>
//
//   AgentTransport = {
//     onEvent(cb)                          // cb(event) — see EVENTS below. Returns an unsubscribe.
//     send(text)                           // a user turn
//     answerPermission(id, allow, message) // answers a permission-request
//     interrupt()                          // stop the current turn
//     history()      -> Promise<event[]>   // the whole feed, for a view attaching late
//     initialEvents                        // the same, already resolved, at open time
//     dispose()                            // detach THIS VIEW. Never "kill the session".
//     kill()                               // end the session — deliberate, separate
//   }
//
//   window.systemview.agent.sessions()     // every live session in the shell
//   window.systemview.agent.killSession(projectCode, sessionId)
//
// SESSIONS OUTLIVE VIEWS, keyed (projectCode, sessionId) exactly like terminals — so closing a
// panel does not stop the agent, and re-opening it replays `history()` rather than starting over.
export const agentHost = () => {
  if (typeof window === "undefined") return null;
  const a = window.systemview && window.systemview.agent;
  return a && typeof a.open === "function" ? a : null;
};

export const hasAgentHost = () => !!agentHost();

export const canListAgents = () => {
  const a = agentHost();
  return !!(a && typeof a.sessions === "function");
};

// The conversations already on disk for a project's directory, newest first, so one can be picked up
// rather than started over. Optional: a host without it simply offers no transfer.
// THE SESSIONS THE BROWSER IS ALREADY RUNNING — not files on disk, live processes. His instruction:
//
//   > *"you got to be able to tap into the agents the browser already has… every single agent, no
//   > matter what app they connect to through, is going to be in the browser's panel."*
//
// Attaching to one is `open()` with its existing sessionId and NO resume: the host returns the very
// same session, so the IDE and the browser panel are two views of one conversation rather than two
// conversations. That distinction is the whole point — resuming a transcript starts a session,
// attaching to a live one joins the session already talking to him.
export const listAgents = async () => {
  const a = agentHost();
  if (!a || typeof a.sessions !== "function") return [];
  try {
    const rows = await a.sessions();
    return Array.isArray(rows) ? rows : [];
  } catch {
    return [];
  }
};

// THE LAST THING SAID IN A CONVERSATION. A list of titles is not enough to pick from — his worry,
// and a fair one: *"I need to be able to know that the conversation I'm choosing is the right
// conversation… I'm afraid I won't be able to go back and choose the right one if multiple were
// showing."* A title can be wrong or generic; the last exchange is evidence.
export const transcriptTail = async (projectCode, sessionId, n = 2) => {
  const a = agentHost();
  if (!a || typeof a.transcript !== "function") return [];
  try {
    const rows = await a.transcript(projectCode, sessionId, { limit: n });
    const list = Array.isArray(rows) ? rows : (rows && rows.messages) || [];
    return list.slice(-n);
  } catch {
    return [];
  }
};

export const canListTranscripts = () => {
  const a = agentHost();
  return !!(a && typeof a.transcripts === "function");
};
export const listTranscripts = async (projectCode) => {
  const a = agentHost();
  if (!a || typeof a.transcripts !== "function") return [];
  try {
    const rows = await a.transcripts(projectCode);
    return Array.isArray(rows) ? rows : [];
  } catch {
    return [];
  }
};

// EVENTS, verbatim from the host — the renderer never invents a kind:
//   status         { state, model?, sdkSessionId? }
//   text-delta     { text }            streamed assistant text
//   thinking-delta { text }            streamed reasoning
//   text           { text }            the settled block
//   thinking       { text }
//   tool-start     { id, tool, input }
//   tool-end       { id, ok, output }
//   permission-request { id, ... }     ONLY in default mode — see below
//   result         { ok, turns, costUsd, durationMs }
//   error          { message }
//   exit           { reason }
// Every one carries `ts`.
//
// PERMISSION MODE IS CHOSEN AT OPEN TIME, not per call: a session opened in `bypassPermissions`
// auto-approves before the callback ever fires, so it emits NO permission-request events at all.
// That is the mechanism behind "built, and off by him" — the surface exists and his own sessions
// simply never raise it. Do not render a permission affordance for a bypass session; there is
// nothing that could ever fill it.
// SWITCHING THE MODEL MID-CONVERSATION. ANNOUNCED BY AUTOBOT, NOT YET CROSSING THE BRIDGE — they
// ran the experiment on SDK 0.3.241 against a live session before answering, so the shapes are
// measured rather than assumed, but the cjs change is waiting for a quiet window (saving it
// restarts the shell and would kill his live session mid-conversation).
//
//   tr.models()        -> ModelInfo[]  passthrough of the SDK's supportedModels()
//   tr.setModel(value) -> Promise      truth arrives via the session.started that follows
//
// ModelInfo: { value, resolvedModel, displayName, description, supportsEffort, ... }
//
// THE TRUTH IS THE EVENT, NEVER THE SEND. After `setModel` the next turn opens with a fresh
// `system:init`, which the host emits as another `session.started` carrying the new `model` AND a
// recomputed `contextWindow` — so a switch that changes the window fixes both panels' rulers for
// free. It lands at the START OF THE NEXT TURN, not at setModel time, so a chip that flips
// optimistically would be lying for one whole turn. Show pending; flip on the event.
export const canSwitchModel = () => {
  const a = agentHost();
  return !!(a && typeof a.open === "function");
};

// Every ModelInfo this shell can actually offer. Empty means the primitive isn't there yet, and the
// UI must draw no switcher at all rather than a menu that cannot do anything.
export const listModels = async (transport) => {
  if (!transport || typeof transport.models !== "function") return [];
  try {
    const rows = await transport.models();
    return Array.isArray(rows) ? rows.filter((r) => r && (r.value || r.resolvedModel)) : [];
  } catch {
    return [];
  }
};

export const setModel = async (transport, value) => {
  if (!transport || typeof transport.setModel !== "function") return false;
  try {
    await transport.setModel(value);
    return true;
  } catch {
    return false;
  }
};

export const GATED = "default";
export const OPEN = "bypassPermissions";

// WHICH FILES A TURN TOUCHED. The host emits no `file.changed` (I asked; the tool events carry it),
// so this is the one place that knows the mapping from a tool call to a path — kept here rather
// than in a component so the diff surface, the feed and anything later all read the same rule.
// Unknown tools return nothing rather than a guess: a wrong path lights up the wrong diff.
const PATH_ARG = { Edit: "file_path", Write: "file_path", NotebookEdit: "notebook_path", Read: "file_path" };
// Both spellings of a call: the host ships `tool.call` with `name`; the early draft said
// `tool-start` with `tool`. Accepting one only is what made every tool line vanish.
const isCallEvent = (ev) => !!ev && (ev.kind === "tool.call" || ev.kind === "tool-start");
const toolOf = (ev) => (ev && (ev.tool || ev.name)) || "";

export const pathTouchedBy = (ev) => {
  if (!isCallEvent(ev) || !ev.input) return null;
  const arg = PATH_ARG[toolOf(ev)];
  const p = arg && ev.input[arg];
  return typeof p === "string" && p ? p : null;
};
// A READ is not a change — the feed says "looked at", the diff must not move.
export const isWrite = (ev) => isCallEvent(ev) && toolOf(ev) !== "Read";

// ONE LINE PER TOOL CALL, because an activity feed is not a transcript. The raw `input` stays on
// the event for whoever expands it; this is what the collapsed row says. Anything unrecognised
// falls back to its own name, which is honest and never wrong.
export const summarise = (ev) => {
  if (!isCallEvent(ev)) return "";
  const i = ev.input || {};
  const short = (p) => String(p || "").split("/").slice(-2).join("/");
  switch (toolOf(ev)) {
    case "Read": return `read ${short(i.file_path)}`;
    case "Edit": return `edited ${short(i.file_path)}`;
    case "Write": return `wrote ${short(i.file_path)}`;
    case "Bash": return String(i.command || "").split("\n")[0].slice(0, 80);
    case "Grep": return `searched ${JSON.stringify(i.pattern || "")}`;
    case "Glob": return `listed ${i.pattern || ""}`;
    case "WebFetch": return `fetched ${i.url || ""}`;
    case "Task": return `spawned ${i.subagent_type || "an agent"}`;
    default: return ev.tool || "";
  }
};

// OPEN, with the host's own history already folded in — a view attaching to a session that has been
// running for ten minutes must show those ten minutes, not an empty box (the same rule the terminal
// learned: `history()` before the first live chunk, or the pane lies about what happened).
// RESUME IS THE WHOLE TRANSFER STORY, and it is not copy-paste. A Claude Code conversation is a file
// on disk — `~/.claude/projects/<the cwd, slashes turned to dashes>/<sessionId>.jsonl` — so a session
// started in a terminal is not trapped there. Hand `resume: <sessionId>` to the host and it is THE
// SAME conversation, continuing, now running from the browser. His question, and the answer to it:
//
//   > *"if those have configurations that point to where the sessions live then maybe it's an easy
//   > transfer… and then you can just be the same session but now running from here."*
//
// Exactly that. Which makes the move an operation rather than an onboarding: pick the session, open
// it here, the terminal hold stands down. What SystemView still needs from the host is the LIST —
// which transcripts exist for a project's directory — because ~/.claude is outside every project
// root and the files surface (correctly) refuses to read outside one.
export async function openAgent({ projectCode, sessionId = "agent", model, gated = false, resume = null, cwd = null } = {}) {
  const host = agentHost();
  if (!host) return null;
  const t = await host.open({
    projectCode,
    sessionId,
    ...(model ? { model } : {}),
    // SystemView chose the directory (a worktree is an IDE decision), so SystemView says which one.
    ...(cwd ? { cwd } : {}),
    ...(resume ? { resume } : {}),
    permissionMode: gated ? GATED : OPEN,
  });
  let seed = t.initialEvents;
  if (!Array.isArray(seed) && typeof t.history === "function") {
    try {
      seed = await t.history();
    } catch {
      seed = [];
    }
  }
  return { transport: t, history: Array.isArray(seed) ? seed : [], gated };
}
