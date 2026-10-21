// WHICH VOICE, AND IN WHAT ORDER — the pure half of the player, extracted so it can be proven.
// `voice.js` owns the browser; this file owns the judgement, and it has no window in it.
//
// IT USED TO RANK BY PARSING NAMES, AND THAT IS THE HISTORY WORTH KEEPING. With `speechSynthesis`
// there was nothing else to go on: quality was read out of the name ("Ava (Premium)"), and a
// hard-coded set of two dozen novelty voices — Zarvox, Bad News, Albert — had to be demoted by
// hand because no flag the API exposed could tell a toy from a reader. Every bit of that was a
// guess about a platform's naming convention, and one of the guesses was wrong in the expensive
// direction: the hand-written preference list put "Daniel" at the top, and the model that
// replaced it rates Daniel a **D**.
//
// SO THE RANKING IS NO LONGER OURS. Kokoro publishes a grade per voice — its own A-to-F rating —
// and `kokoroVoices.js` carries it straight out of the model. Reading a number the engine
// supplies cannot be wrong about the engine's own voices, and there is no name-parsing left to
// drift.
import { gradeRank } from "./kokoroVoices";

const baseLang = (l) => String(l || "").split("-")[0].split("_")[0].toLowerCase();

/**
 * BEST FIRST — grade, then name. Pure sort, used by the picker so the list he reads is the same
 * order the automatic choice walks: the top row and the default are the same voice, always.
 */
export function sortVoices(list = []) {
  return [...list].sort((a, b) => {
    const ga = gradeRank(a.grade);
    const gb = gradeRank(b.grade);
    if (ga !== gb) return gb - ga;
    return String(a.name || "").localeCompare(String(b.name || ""));
  });
}

/**
 * THE CHOICE. A saved preference wins outright — he picked it, and second-guessing a human choice
 * because the language tag disagrees is how a setting stops being a setting. Otherwise: voices in
 * the wanted language, best graded first; and only if the language has nothing at all does it
 * widen to the whole list rather than return silence.
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
  return sortVoices(pool)[0] || null;
}

const voiceChoice = { sortVoices, chooseVoice };
export default voiceChoice;
