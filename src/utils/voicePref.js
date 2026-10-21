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

// PER CHAT, NOT PER WINDOW. His ruling, 2026-10-21. The voice reading an agent's replies is part
// of how that agent sounds, and the blocks worth hearing differ by what the agent is for — a
// codebase agent's commits matter, a planning agent's asks do. One global setting would make every
// chat sound identical and force a re-pick every time he switched tabs.
//
// THE SCOPE IS THE PROJECT CODE, and it comes from `useMarkdownScope()` — the same answer every
// block in the chat already uses, for the reason recorded at its call site in AgentChat: the URL is
// NOT the chat's identity, because the docked chat outlives the page it is docked beside. A
// `::commit` offered while he was on `/specs` once drew "no live service" for exactly this reason.
//
// An absent scope is "default" rather than an error: the lane feed renders this control with no
// provider above it, and a voice setting is never worth a thrown exception.
const base = (key, scope) => `${key}.${String(scope || "default")}`;
// EXPORTED, and it was not before. It sat on the default object only, so `import { KEY }` gave
// `undefined` — and the test that checked `getItem(KEY) === null` passed VACUOUSLY, because
// `getItem(undefined)` is null for a key nobody ever wrote. A test that cannot fail is worse than
// no test: it reads as coverage.
// A WRITE IS ANNOUNCED, so two surfaces showing the same setting cannot drift apart. The pill and
// the panel are siblings with their own state: without this, cycling the speaker while the panel
// is open left the panel still showing the old mode — and the panel is exactly where he is
// supposed to LEARN what the three positions mean by watching one highlight as he presses.
export const VOICE_PREFS_EVENT = "sv:voicePrefs";
const announceWrite = (scope) => {
  try {
    if (typeof window !== "undefined" && window.dispatchEvent)
      window.dispatchEvent(new CustomEvent(VOICE_PREFS_EVENT, { detail: { scope: scope || "" } }));
  } catch {
    /* a setting is never worth taking the chat down for */
  }
};

export const KEY = "sv.voice";
// THE REST OF THE SETTINGS, UNDER THEIR OWN KEY. The voice id stays where it has always been so a
// pick made yesterday survives this change; speed, the auto switch and the block set are new and
// land beside it rather than inside it. Two keys with one owner each beats one key that has to be
// migrated the first time anybody reads it.
export const SETTINGS_KEY = "sv.voice.settings";

const store = () => {
  try {
    return typeof window !== "undefined" && window.localStorage ? window.localStorage : null;
  } catch {
    return null; // a privacy mode that throws on access rather than returning null
  }
};

/**
 * The saved voice id for this chat, or "" for "choose for me".
 *
 * THE UNSCOPED KEY IS READ AS A FALLBACK, once, and never written again. Voice settings existed
 * before they were per-chat, so a pick he made this morning lives at the old address — dropping it
 * would silently reset him to "choose for me" and look like the feature had broken.
 */
export function readVoicePref(scope) {
  const s = store();
  if (!s) return "";
  try {
    return s.getItem(base(KEY, scope)) || s.getItem(KEY) || "";
  } catch {
    return "";
  }
}

/** Save a voice id; an empty id CLEARS it, which is how "choose for me" is expressed. */
export function writeVoicePref(id, scope) {
  const s = store();
  if (!s) return "";
  try {
    if (id) s.setItem(base(KEY, scope), String(id));
    else s.removeItem(base(KEY, scope));
  } catch {
    /* nothing to do — the picker still works for this session */
  }
  announceWrite(scope);
  return id ? String(id) : "";
}

// ── the rest of the settings ───────────────────────────────────────────────────────────────────
//
// THE SET AND THE SWITCH ARE SEPARATE FIELDS, and that is the whole shape of this control. `blocks`
// is his taste — picked once, stable for weeks. `auto` is his situation — flipped several times an
// hour depending on whether he is at the screen. Fold them into one value ("off" as a member of the
// block set) and every time he turns speech back on he has to re-pick what it reads, which is the
// one thing guaranteed to make him stop using it.
//
// SPEED IS CLAMPED HERE rather than at the slider, because a number arriving from storage is
// whatever was in storage — a hand-edited key, an older build, a half-written write. The engine
// multiplies the model's sample rate by it, so a zero is silence and a negative is a crash in a
// place nobody would think to look.
// THREE POSITIONS, NOT A BOOLEAN — and the third is what he actually asked for: *"now I want it
// on everything… we're not having a conversation, I just probably want callout."* Off and
// everything are both destinations he moves BETWEEN several times an hour, so neither can be
// buried behind the other. A boolean plus a block list can express all three states, but only by
// editing the list to reach "everything", which means losing the set he carefully picked.
//
//   off  — say nothing unless he presses a reply
//   set  — read only the blocks he chose
//   all  — read the whole reply
//
// `set` is the middle because that is the one he lands on from either direction.
export const MODES = ["off", "set", "all"];
export const nextMode = (m) => MODES[(MODES.indexOf(m) + 1) % MODES.length] || "off";

const DEFAULTS = { speed: 1, mode: "off", blocks: null };
const clampSpeed = (v) => {
  const n = Number(v);
  if (!Number.isFinite(n)) return 1;
  return Math.min(1.5, Math.max(0.75, n));
};

/**
 * The saved settings, always a complete object. `blocks` is `null` for "never chosen" — which the
 * caller reads as the default set, NOT as the empty set. An empty ARRAY is a real choice and means
 * silence; conflating the two would turn "I have not decided" into "read me nothing" and the
 * feature would look broken on the first run.
 */
export function readVoiceSettings(scope) {
  const s = store();
  if (!s) return { ...DEFAULTS };
  try {
    const raw =
      JSON.parse(s.getItem(base(SETTINGS_KEY, scope)) || s.getItem(SETTINGS_KEY) || "{}") || {};
    return {
      speed: clampSpeed(raw.speed === undefined ? DEFAULTS.speed : raw.speed),
      // `auto` was the boolean this replaced. A session that had it ON meant "read my chosen
      // blocks", which is exactly `set` — migrated rather than reset, because silently switching
      // somebody's voice off is indistinguishable from the feature breaking.
      mode: MODES.includes(raw.mode) ? raw.mode : raw.auto ? "set" : "off",
      blocks: Array.isArray(raw.blocks) ? raw.blocks.map(String) : null,
    };
  } catch {
    return { ...DEFAULTS };
  }
}

/** Merge and save — callers change one field and must not have to send the other two back. */
export function writeVoiceSettings(patch = {}, scope) {
  const next = { ...readVoiceSettings(scope), ...patch };
  next.speed = clampSpeed(next.speed);
  next.mode = MODES.includes(next.mode) ? next.mode : "off";
  delete next.auto;
  next.blocks = Array.isArray(next.blocks) ? next.blocks.map(String) : null;
  const s = store();
  if (s) {
    try {
      s.setItem(base(SETTINGS_KEY, scope), JSON.stringify(next));
    } catch {
      /* the panel still works for this session */
    }
  }
  announceWrite(scope);
  return next;
}

const voicePref = {
  readVoicePref,
  writeVoicePref,
  readVoiceSettings,
  writeVoiceSettings,
  KEY,
  SETTINGS_KEY,
};
export default voicePref;
