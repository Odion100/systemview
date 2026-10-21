import { chooseVoice, sortVoices } from "./voiceChoice";
import { KOKORO_VOICES, bestVoice, byId, gradeRank } from "./kokoroVoices";

const v = (id, grade, lang = "en-us", name = id) => ({ id, grade, lang, name });

describe("the voice table is the model's, not ours", () => {
  // THE CLAIM THAT MATTERS: this file was generated from `KokoroTTS.voices`, sorted by grade. If
  // anybody hand-edits a row in or re-orders it, the file stops being a transcript of the model
  // and becomes an opinion again — which is the exact failure the table replaced.
  it("is already in rank order on disk, so the file and the sort agree", () => {
    expect(sortVoices(KOKORO_VOICES).map((x) => x.id)).toEqual(KOKORO_VOICES.map((x) => x.id));
  });

  it("rates every voice with a grade the ranking understands", () => {
    const unknown = KOKORO_VOICES.filter((x) => gradeRank(x.grade) === -1);
    expect(unknown).toEqual([]);
  });

  it("has no duplicate ids — a saved preference must resolve to one voice", () => {
    expect(new Set(KOKORO_VOICES.map((x) => x.id)).size).toBe(KOKORO_VOICES.length);
  });

  // The default is DERIVED from the grades rather than declared, so it cannot drift away from the
  // top of the list the way a hard-coded name would.
  it("derives the default from the grades, and it is the head of the list", () => {
    expect(bestVoice().id).toBe(KOKORO_VOICES[0].id);
    expect(bestVoice().grade).toBe("A");
  });

  // The whole reason the hand-written ranking was wrong: it put this voice first.
  it("rates Daniel below the top — the old hand-written list had him at the head of it", () => {
    expect(gradeRank(byId("bm_daniel").grade)).toBeLessThan(gradeRank(bestVoice().grade));
  });
});

describe("sortVoices — the picker reads the same order the automatic choice walks", () => {
  it("orders by grade, best first", () => {
    const list = [v("d", "D"), v("a", "A"), v("c", "C+"), v("b", "B-")];
    expect(sortVoices(list).map((x) => x.id)).toEqual(["a", "b", "c", "d"]);
  });

  it("breaks a tie on the name so the order is stable to read", () => {
    const list = [v("z", "C", "en-us", "Zed"), v("m", "C", "en-us", "Ann")];
    expect(sortVoices(list).map((x) => x.name)).toEqual(["Ann", "Zed"]);
  });

  // An unrated voice sorts LAST, never first: something the table does not grade is not something
  // to hand somebody as the default.
  it("sinks a voice with a grade it does not recognise", () => {
    const list = [v("junk", "Z"), v("c", "C-")];
    expect(sortVoices(list).map((x) => x.id)).toEqual(["c", "junk"]);
  });

  it("does not mutate what it was handed", () => {
    const list = [v("d", "D"), v("a", "A")];
    sortVoices(list);
    expect(list.map((x) => x.id)).toEqual(["d", "a"]);
  });
});

describe("chooseVoice", () => {
  it("takes the best-graded voice when nothing is saved", () => {
    expect(chooseVoice(KOKORO_VOICES, { lang: "en-US" }).grade).toBe("A");
  });

  it("honours a saved pick outright, even across languages and even a bad one", () => {
    const got = chooseVoice(KOKORO_VOICES, { lang: "en-US", preferId: "bm_daniel" });
    expect(got.id).toBe("bm_daniel");
  });

  // A different machine, a table regenerated, an id that no longer exists. Not an error state.
  it("falls through to ranking when the saved voice is gone", () => {
    expect(chooseVoice(KOKORO_VOICES, { lang: "en-US", preferId: "af_nope" }).grade).toBe("A");
  });

  // ACCENT IS NOT A TIE-BREAK, AND THAT IS THE POINT. His words, after I kept treating a British
  // voice as a preference he had expressed: *"stop thinking that I give a fuck that it was
  // British. No, I just picked it, because it wasn't the worst."* `en-gb` and `en-us` are the same
  // language, so they share one pool and the GRADE decides — asking for `en-GB` must not promote a
  // D-rated British voice over an A-rated American one.
  it("does not let a region beat a grade", () => {
    const list = [v("us", "A", "en-us"), v("gb", "D", "en-gb")];
    expect(chooseVoice(list, { lang: "en-GB" }).id).toBe("us");
  });

  it("still separates genuinely different languages", () => {
    const list = [v("en", "A", "en-us"), v("fr", "D", "fr-fr")];
    expect(chooseVoice(list, { lang: "fr-CA" }).id).toBe("fr");
  });

  it("widens rather than returning silence when the language has nothing", () => {
    const list = [v("us", "C", "en-us")];
    expect(chooseVoice(list, { lang: "ja-JP" }).id).toBe("us");
  });

  it("answers null for an empty list instead of throwing", () => {
    expect(chooseVoice([], { lang: "en-US" })).toBe(null);
  });
});
