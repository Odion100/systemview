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
// `sv.chat.open.<pc>` is the record of an open chat, written by `AgentChat`.
export const OPEN_KEY = (pc) => `sv.chat.open.${pc}`;

/**
 * The scope to read under.
 *
 * @param open  project codes whose chat is open, in no particular order
 * @param route the project the window is on
 * @param doc   the project the document belongs to
 *
 * ONE OPEN CHAT IS THE WHOLE INTENDED CASE and it needs no tie-break. The other two branches exist
 * because the window genuinely permits them, and each is stated rather than left to fall out:
 *
 *  - SEVERAL OPEN — the one he is on wins if it is among them; otherwise the FIRST BY NAME, which
 *    is arbitrary but STABLE. An arbitrary-and-stable answer can be noticed and corrected; an
 *    arbitrary-and-varying one sounds like a different bug every time.
 *  - NONE OPEN — fall back to the route, then to the document. With no agent in the room there is
 *    no "agent's voice" to use, and the window's own project is the nearest honest answer.
 */
export function listeningScope(open = [], { route = "", doc = "" } = {}) {
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
