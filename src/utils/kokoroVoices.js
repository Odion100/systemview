// THE VOICE LIST, AND IT IS KNOWN BEFORE THE MODEL IS. The picker has to draw 28 rows the instant
// it opens, and the model that knows those rows is an 86MB download — so the list is static and the
// engine is lazy. `kokoroEngine.voices()` answers from here with no model loaded at all, which is
// the whole reason the menu is not a spinner.
//
// EVERY FIELD CAME OUT OF THE MODEL, NOT OUT OF A JUDGEMENT. `KokoroTTS.voices` carries a
// `overallGrade` per voice — the project's own A-to-F rating of how well that voice turned out —
// and this file was GENERATED from it rather than typed (the generator loads the model, filters
// `language` to `en`, sorts by grade and THEN BY NAME, and prints — the second key matters: the
// picker sorts the same way, and a file ordered on grade alone disagrees with it inside every
// band, which `voiceChoice.test.js` catches). That matters because the previous
// version of this feature ranked voices by a list I wrote by hand, and the hand-written list put
// a voice graded D at the top. Nobody's taste is in this file.
//
// WHY ONLY ENGLISH. The model also ships Japanese, Chinese, Spanish, French, Hindi, Italian and
// Portuguese voices, and they work — but each non-English language needs its own phonemizer data
// and a `lang` the caller has to ask for. The chat speaks English, so the list stops here and the
// filter is one line to widen when something needs the rest.
export const KOKORO_VOICES = [
  { id: "af_heart", name: "Heart", lang: "en-us", gender: "Female", grade: "A" },
  { id: "af_bella", name: "Bella", lang: "en-us", gender: "Female", grade: "A-" },
  { id: "bf_emma", name: "Emma", lang: "en-gb", gender: "Female", grade: "B-" },
  { id: "af_nicole", name: "Nicole", lang: "en-us", gender: "Female", grade: "B-" },
  { id: "af_aoede", name: "Aoede", lang: "en-us", gender: "Female", grade: "C+" },
  { id: "am_fenrir", name: "Fenrir", lang: "en-us", gender: "Male", grade: "C+" },
  { id: "af_kore", name: "Kore", lang: "en-us", gender: "Female", grade: "C+" },
  { id: "am_michael", name: "Michael", lang: "en-us", gender: "Male", grade: "C+" },
  { id: "am_puck", name: "Puck", lang: "en-us", gender: "Male", grade: "C+" },
  { id: "af_sarah", name: "Sarah", lang: "en-us", gender: "Female", grade: "C+" },
  { id: "af_alloy", name: "Alloy", lang: "en-us", gender: "Female", grade: "C" },
  { id: "bm_fable", name: "Fable", lang: "en-gb", gender: "Male", grade: "C" },
  { id: "bm_george", name: "George", lang: "en-gb", gender: "Male", grade: "C" },
  { id: "bf_isabella", name: "Isabella", lang: "en-gb", gender: "Female", grade: "C" },
  { id: "af_nova", name: "Nova", lang: "en-us", gender: "Female", grade: "C" },
  { id: "af_sky", name: "Sky", lang: "en-us", gender: "Female", grade: "C-" },
  { id: "bm_lewis", name: "Lewis", lang: "en-gb", gender: "Male", grade: "D+" },
  { id: "bf_alice", name: "Alice", lang: "en-gb", gender: "Female", grade: "D" },
  { id: "bm_daniel", name: "Daniel", lang: "en-gb", gender: "Male", grade: "D" },
  { id: "am_echo", name: "Echo", lang: "en-us", gender: "Male", grade: "D" },
  { id: "am_eric", name: "Eric", lang: "en-us", gender: "Male", grade: "D" },
  { id: "af_jessica", name: "Jessica", lang: "en-us", gender: "Female", grade: "D" },
  { id: "am_liam", name: "Liam", lang: "en-us", gender: "Male", grade: "D" },
  { id: "bf_lily", name: "Lily", lang: "en-gb", gender: "Female", grade: "D" },
  { id: "am_onyx", name: "Onyx", lang: "en-us", gender: "Male", grade: "D" },
  { id: "af_river", name: "River", lang: "en-us", gender: "Female", grade: "D" },
  { id: "am_santa", name: "Santa", lang: "en-us", gender: "Male", grade: "D-" },
  { id: "am_adam", name: "Adam", lang: "en-us", gender: "Male", grade: "F+" },
];

// THE MODEL THE IDS BELONG TO. An id is only meaningful against one repo — `af_heart` in a
// different Kokoro build is a different voice — so the name sits beside the list it describes
// rather than in the engine, and a saved preference can be checked against it.
export const KOKORO_MODEL = "onnx-community/Kokoro-82M-v1.0-ONNX";

// GRADE AS A NUMBER, HIGH IS BETTER — so sorting and comparing never parse a letter twice. An
// unknown grade sorts LAST rather than first: a voice the table does not rate is not a voice to
// hand somebody by default.
const ORDER = ["F", "F+", "D-", "D", "D+", "C-", "C", "C+", "B-", "B", "B+", "A-", "A"];
export const gradeRank = (grade) => {
  const i = ORDER.indexOf(String(grade || "").trim());
  return i === -1 ? -1 : i;
};

export const byId = (id) => KOKORO_VOICES.find((v) => v.id === id) || null;

// THE DEFAULT, DERIVED RATHER THAN DECLARED. Writing `af_heart` here would be a second opinion
// that drifts the day the table is regenerated; taking the best-graded row cannot.
export const bestVoice = () =>
  KOKORO_VOICES.reduce((best, v) => (gradeRank(v.grade) > gradeRank(best.grade) ? v : best), KOKORO_VOICES[0]);

export default KOKORO_VOICES;
