// HIS CHOICE OF VOICE, AND WHERE IT LIVES. One key in localStorage, read at every press rather
// than cached — so a change takes effect on the next thing he plays with no wiring between the
// picker and the button, and a second window picking a voice is honoured by the first.
//
// THE ID IS THE VOICE'S OWN `voiceURI`, not its index and not its name. Voices appear and
// disappear — a Premium download adds one, a language pack removes one — and anything positional
// would silently point at a different voice the next time the list changed.
//
// A MISS IS NOT AN ERROR. If the saved voice is gone (he moved machines, he deleted the download),
// `chooseVoice` falls through to ranking it by quality, which is the right answer and needs no
// repair step. Nothing here ever throws: localStorage is absent in jest, blocked in some
// embeddings, and a voice setting is never worth taking the chat down for.

const KEY = "sv.voice";

const store = () => {
  try {
    return typeof window !== "undefined" && window.localStorage ? window.localStorage : null;
  } catch {
    return null; // a privacy mode that throws on access rather than returning null
  }
};

/** The saved voice id, or "" for "choose for me". */
export function readVoicePref() {
  const s = store();
  if (!s) return "";
  try {
    return s.getItem(KEY) || "";
  } catch {
    return "";
  }
}

/** Save a voice id; an empty id CLEARS it, which is how "choose for me" is expressed. */
export function writeVoicePref(id) {
  const s = store();
  if (!s) return "";
  try {
    if (id) s.setItem(KEY, String(id));
    else s.removeItem(KEY);
  } catch {
    /* nothing to do — the picker still works for this session */
  }
  return id ? String(id) : "";
}

const voicePref = { readVoicePref, writeVoicePref, KEY };
export default voicePref;
