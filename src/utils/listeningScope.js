// WHOSE VOICE READS A DOCUMENT ALOUD — and the answer is the agent he is TALKING TO, never the
// document's own project.
//
// His ask, 2026-11-11: *"I want voice on the document right-click menu. Because I want to be able
// to just listen. It's going to use whichever agent's tab is open. So if I'm talking to you,
// that's the voice it's going to use."*
//
// The voice is already per chat — his ruling, 2026-10-21, recorded in `voicePref.js`: *"the voice
// reading an agent's replies is part of how that agent sounds"*, scoped by project code. So this
// does not pick a voice; it picks the SCOPE the existing voice lookup is made under. Reading a
// BUApp document while talking to systemview-test should sound like systemview-test, because the
// reader is the agent in the room, not the repository the file happens to live in.
//
// `sv.chat.last` is the chat he was last in, written by `AgentChat` on send and on focus;
// `sv.chat.open.<pc>` is the weaker fact, kept only for the first read on a fresh machine.
export const OPEN_KEY = (pc) => `sv.chat.open.${pc}`;

/**
 * The scope to read under.
 *
 * @param open  project codes whose chat is open, in no particular order
 * @param last  the chat he was last IN — sent to, or focused
 * @param route the project the window is on
 * @param doc   the project the document belongs to
 *
 * THE CHAT HE WAS LAST IN WINS, AND NOTHING ELSE COMES CLOSE. His correction, 2026-11-11: *"it has
 * to be the tab that I was last in, because right now I have all of you guys open on the dock…
 * everyone is docked and the side panel is minimized on the edge. So in a way, everyone is out."*
 *
 * That sentence kills the first version of this rule. "Is this chat open" is a true fact that stops
 * discriminating the moment every chat is open — which is his normal state — and the tie-break
 * underneath it, stable as it was, would have read him a document in whichever agent sorted first.
 * Openness is presence; what picks an agent is ATTENTION.
 *
 * `last` is not required to be open, and that is deliberate rather than an oversight: a chat he
 * minimised to the dock edge is still the one he was last in, and "everyone is out" is exactly the
 * state where openness tells you nothing. The fallbacks below only run before anything has ever
 * been stamped on this machine.
 */
export function listeningScope(open = [], { last = "", route = "", doc = "" } = {}) {
  if (last) return last;
  const chats = [...new Set((open || []).filter(Boolean).map(String))].sort();
  if (chats.length === 1) return chats[0];
  if (chats.length > 1) return chats.includes(route) ? route : chats[0];
  return route || doc || "";
}

/** The open chats, off his disk. Never throws — a voice setting is not worth taking a page down. */
export function openChats() {
  try {
    if (typeof window === "undefined" || !window.localStorage) return [];
    const ls = window.localStorage;
    return Object.keys(ls)
      .filter((k) => k.startsWith("sv.chat.open.") && ls.getItem(k) === "1")
      .map((k) => k.slice("sv.chat.open.".length))
      .filter(Boolean);
  } catch {
    return [];
  }
}
