import { chooseVoice, qualityOf, sortVoices, PREMIUM, ENHANCED, BASELINE, NOVELTY } from "./voiceChoice";

const v = (name, lang = "en-US") => ({ id: `urn:${name}`, name, lang });

describe("qualityOf — the tier is in the name, because nothing else carries it", () => {
  it("reads the macOS download tiers", () => {
    expect(qualityOf("Ava (Premium)")).toBe(PREMIUM);
    expect(qualityOf("Evan (Enhanced)")).toBe(ENHANCED);
    expect(qualityOf("Samantha")).toBe(BASELINE);
  });

  it("demotes the novelty voices that ship with the system", () => {
    expect(qualityOf("Albert")).toBe(NOVELTY);
    expect(qualityOf("Bad News")).toBe(NOVELTY);
    expect(qualityOf("Zarvox")).toBe(NOVELTY);
    expect(qualityOf("Fred")).toBe(NOVELTY);
  });

  // The trap: "Reed (English (UK))" has parentheses and is NOT a joke and NOT a quality tag.
  it("does not mistake a region suffix for a tier or for novelty", () => {
    expect(qualityOf("Reed (English (UK))")).toBe(BASELINE);
    expect(qualityOf("Shelley (English (US))")).toBe(BASELINE);
  });

  it("matches a joke on its whole bare name, never as a prefix", () => {
    expect(qualityOf("Albertine")).toBe(BASELINE);
  });
});

describe("chooseVoice", () => {
  it("prefers quality over our own name hint — a Premium download must be able to win", () => {
    const list = [v("Samantha"), v("Ava (Premium)")];
    expect(chooseVoice(list, { lang: "en-US" }).name).toBe("Ava (Premium)");
  });

  it("never lands on a novelty voice while any real one exists", () => {
    const list = [v("Albert"), v("Zarvox"), v("Shelley (English (US))")];
    expect(chooseVoice(list, { lang: "en-US" }).name).toBe("Shelley (English (US))");
  });

  // Measured on his machine: Electron reported ALBERT as the default voice.
  it("ignores the engine's own default when the default is a toy", () => {
    const list = [{ ...v("Albert"), raw: { default: true } }, v("Samantha")];
    expect(chooseVoice(list, { lang: "en-US" }).name).toBe("Samantha");
  });

  it("honours a saved pick outright, even across languages", () => {
    const list = [v("Samantha", "en-US"), v("Daniel", "en-GB")];
    expect(chooseVoice(list, { lang: "en-US", preferId: "urn:Daniel" }).name).toBe("Daniel");
  });

  // A download removed, a different machine: the id is simply absent. That is not an error state.
  it("falls through to ranking when the saved voice is gone", () => {
    const list = [v("Samantha"), v("Ava (Premium)")];
    expect(chooseVoice(list, { lang: "en-US", preferId: "urn:Deleted" }).name).toBe("Ava (Premium)");
  });

  it("stays inside the wanted language when it can", () => {
    const list = [v("Daniel", "en-GB"), v("Amelie", "fr-FR")];
    expect(chooseVoice(list, { lang: "fr-CA" }).name).toBe("Amelie");
  });

  it("widens rather than returning silence when the language has nothing", () => {
    const list = [v("Daniel", "en-GB")];
    expect(chooseVoice(list, { lang: "ja-JP" }).name).toBe("Daniel");
  });

  it("answers null for an empty machine instead of throwing", () => {
    expect(chooseVoice([], { lang: "en-US" })).toBe(null);
  });
});

describe("sortVoices — the picker reads the same order the automatic choice walks", () => {
  it("puts tiers first and jokes last", () => {
    const list = [v("Albert"), v("Samantha"), v("Ava (Premium)"), v("Evan (Enhanced)")];
    expect(sortVoices(list).map((x) => x.name)).toEqual([
      "Ava (Premium)",
      "Evan (Enhanced)",
      "Samantha",
      "Albert",
    ]);
  });

  it("does not mutate what it was handed", () => {
    const list = [v("Zarvox"), v("Samantha")];
    sortVoices(list);
    expect(list.map((x) => x.name)).toEqual(["Zarvox", "Samantha"]);
  });
});
