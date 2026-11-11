// WHICH AGENT IS "IN THE ROOM" — the chat he was last in.
//
// His correction, 2026-11-11: *"How do you choose the agent in the room? It has to be the tab that
// I was last in, because right now I have all of you guys open on the dock… everyone is docked and
// the side panel is minimized on the edge. So in a way, everyone is out."*
//
// That is the case the first version got wrong. "Is this chat open" is a true fact that stops
// discriminating the moment every chat is open, which is his normal state — so the answer fell
// through to a tie-break that was stable and arbitrary, and would have read him a document in
// whichever agent's voice sorted first.
//
// SO THE SIGNAL IS ATTENTION, NOT PRESENCE. Two moments write it, and the weaker one matters most:
// sending a message is unambiguous, but he also just READS a chat, and the tab he was last in is
// still that one. Focusing the composer is the cheapest honest proxy for "I am in this room".
const KEY = "sv.chat.last";

/** Stamp the chat he is in. Never throws — attention is not worth taking the chat down for. */
export function markLastChat(projectCode) {
  if (!projectCode) return;
  try {
    if (typeof window !== "undefined" && window.localStorage) window.localStorage.setItem(KEY, String(projectCode));
  } catch {
    /* privacy mode, a full disk — the fallbacks below are all still correct */
  }
}

/** The chat he was last in, or "" if nothing has been stamped on this machine yet. */
export function readLastChat() {
  try {
    if (typeof window === "undefined" || !window.localStorage) return "";
    return window.localStorage.getItem(KEY) || "";
  } catch {
    return "";
  }
}

export const LAST_CHAT_KEY = KEY;
