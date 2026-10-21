// WHICH VOICE, AND IN WHAT ORDER — the pure half of the player, extracted so it can be proven.
// `voice.js` owns the browser; this file owns the judgement, and it has no window in it.
//
// WHY IT EXISTS AT ALL. The first version carried a flat list of preferred NAMES and took the
// first local voice for the language when none matched. Two things were wrong with that, and both
// were measured on his machine:
//
//   1. IT WOULD IGNORE A BETTER VOICE. "Samantha" sat at the head of the list, so downloading a
//      Premium voice — the one real step up macOS offers — would have changed nothing. A ranking
//      that cannot be beaten by something better is not a ranking.
//   2. NOTHING STOPPED IT LANDING ON A JOKE. Of the 184 voices installed on that machine, a good
//      third are novelty toys: Bad News, Bubbles, Zarvox, Albert. `default: true` is no defence —
//      the same machine reported Samantha as default in Chrome and ALBERT in Electron.
//
// So quality is read off the name, novelty is demoted explicitly, and a human choice beats both.

// macOS tags the downloadable tiers in the voice's own name — "Ava (Premium)", "Evan (Enhanced)".
// Nothing else does, so an untagged voice is the baseline rather than a failure to parse.
export const PREMIUM = 3;
export const ENHANCED = 2;
export const BASELINE = 1;
export const NOVELTY = 0;

// THE TOYS. Shipped with macOS, indistinguishable from real voices by any flag the API exposes,
// and uniformly terrible for reading prose. Matched on the bare name so "Albert" is caught and
// "Albertine" would not be.
const JOKES = new Set(
  [
    "Albert", "Bad News", "Bahh", "Bells", "Boing", "Bubbles", "Cellos", "Deranged", "Fred",
    "Good News", "Hysterical", "Jester", "Junior", "Kathy", "Organ", "Pipe Organ", "Princess",
    "Ralph", "Superstar", "Trinoids", "Whisper", "Wobble", "Zarvox",
  ].map((n) => n.toLowerCase())
);

// A HINT, NOT A LAW — every entry optional, and quality outranks all of it. These are the voices
// that read a paragraph without embarrassing themselves on each platform's baseline tier.
const PREFERRED = [
  "Daniel", "Samantha", "Karen", "Moira", "Tessa", "Rishi", "Serena", "Alex", // macOS
  "Microsoft Aria", "Microsoft Jenny", "Microsoft Guy", "Microsoft Zira", // Windows
  "English (America)", "English (Great Britain)", // common espeak/Linux naming
];

const bare = (name) => String(name || "").replace(/\s*\([^)]*\)\s*$/, "").trim();

/** PREMIUM | ENHANCED | BASELINE | NOVELTY, read off the name. */
export function qualityOf(name) {
  const s = String(name || "");
  if (/\(\s*premium\s*\)/i.test(s)) return PREMIUM;
  if (/\(\s*enhanced\s*\)/i.test(s)) return ENHANCED;
  // A region suffix is not a quality tag: "Reed (English (UK))" is a baseline voice, not a joke,
  // so the novelty check runs on the bare name with every parenthesis stripped.
  if (JOKES.has(bare(s).toLowerCase())) return NOVELTY;
  return BASELINE;
}

const preferredIndex = (name) => {
  const n = String(name || "");
  const i = PREFERRED.findIndex((p) => n === p || n.startsWith(p));
  return i === -1 ? PREFERRED.length : i;
};

const baseLang = (l) => String(l || "").split("-")[0].split("_")[0].toLowerCase();

/**
 * BEST FIRST — quality, then our hint, then alphabetical. Pure sort, used by the picker so the
 * list he reads is the same order the automatic choice walks.
 */
export function sortVoices(list = []) {
  return [...list].sort((a, b) => {
    const qa = qualityOf(a.name);
    const qb = qualityOf(b.name);
    if (qa !== qb) return qb - qa;
    const pa = preferredIndex(a.name);
    const pb = preferredIndex(b.name);
    if (pa !== pb) return pa - pb;
    return String(a.name || "").localeCompare(String(b.name || ""));
  });
}

/**
 * THE CHOICE. A saved preference wins outright — he picked it, and second-guessing a human choice
 * because the language tag disagrees is how a setting stops being a setting. Otherwise: voices in
 * the wanted language, best first; and only if the language has nothing at all does it widen to
 * the whole list rather than return silence.
 */
export function chooseVoice(list = [], { lang = "", preferId = "" } = {}) {
  if (!list.length) return null;
  if (preferId) {
    const saved = list.find((v) => v.id === preferId);
    if (saved) return saved;
  }
  const want = baseLang(lang || "en-US");
  const sameLang = list.filter((v) => baseLang(v.lang) === want);
  const pool = sameLang.length ? sameLang : list;
  const ranked = sortVoices(pool);
  // Everything in the pool is a toy? Then a toy is the honest answer — silence would be worse.
  return ranked[0] || null;
}

const voiceChoice = { qualityOf, sortVoices, chooseVoice, PREMIUM, ENHANCED, BASELINE, NOVELTY };
export default voiceChoice;
