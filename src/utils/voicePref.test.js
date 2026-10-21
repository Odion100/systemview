import {
  readVoicePref,
  writeVoicePref,
  readVoiceSettings,
  writeVoiceSettings,
  nextMode,
  KEY,
  SETTINGS_KEY,
} from "./voicePref";

describe("the saved voice", () => {
  beforeEach(() => window.localStorage.clear());

  it("is empty until he picks one — absence means choose for me", () => {
    expect(readVoicePref()).toBe("");
  });

  it("round-trips the voice's own id", () => {
    writeVoicePref("urn:moz-tts:osx:com.apple.voice.compact.en-GB.Daniel");
    expect(readVoicePref()).toBe("urn:moz-tts:osx:com.apple.voice.compact.en-GB.Daniel");
  });

  it("clears on an empty id, which is how choose-for-me is expressed", () => {
    writeVoicePref("urn:Daniel");
    writeVoicePref("");
    expect(readVoicePref()).toBe("");
    expect(window.localStorage.getItem(KEY)).toBe(null);
  });

  // A privacy mode that THROWS on access, not one that returns null. A voice setting is never
  // worth taking the chat down for.
  it("survives a storage that throws, in both directions", () => {
    const real = Object.getOwnPropertyDescriptor(window, "localStorage");
    Object.defineProperty(window, "localStorage", {
      configurable: true,
      get() {
        throw new Error("blocked");
      },
    });
    expect(() => writeVoicePref("urn:Daniel")).not.toThrow();
    expect(readVoicePref()).toBe("");
    if (real) Object.defineProperty(window, "localStorage", real);
  });
});

describe("the rest of the voice settings", () => {
  beforeEach(() => window.localStorage.clear());

  it("starts at speed 1, mode off, and NO block choice made", () => {
    expect(readVoiceSettings()).toEqual({ speed: 1, mode: "off", blocks: null });
  });

  // `null` is "never chosen" and an empty array is "read me nothing". Conflating them would turn
  // an undecided first run into silence, and the feature would look broken out of the box.
  it("tells an unmade choice apart from a choice of nothing", () => {
    expect(readVoiceSettings().blocks).toBe(null);
    writeVoiceSettings({ blocks: [] });
    expect(readVoiceSettings().blocks).toEqual([]);
  });

  it("merges, so a caller can change one field without resending the others", () => {
    writeVoiceSettings({ blocks: ["ask"], speed: 1.2 });
    writeVoiceSettings({ mode: "set" });
    expect(readVoiceSettings()).toEqual({ speed: 1.2, mode: "set", blocks: ["ask"] });
  });

  // The engine multiplies by this. A zero is silence and a negative is a crash somewhere nobody
  // would think to look, so a number arriving from storage is never trusted.
  it("clamps a speed that arrived from anywhere", () => {
    expect(writeVoiceSettings({ speed: 0 }).speed).toBe(0.75);
    expect(writeVoiceSettings({ speed: 99 }).speed).toBe(1.5);
    expect(writeVoiceSettings({ speed: "fast" }).speed).toBe(1);
  });

  it("reads a corrupted settings key as the defaults rather than throwing", () => {
    window.localStorage.setItem(SETTINGS_KEY, "{not json");
    expect(readVoiceSettings()).toEqual({ speed: 1, mode: "off", blocks: null });
  });

  it("keeps the voice id in its own key, so a pick made before this existed survives", () => {
    writeVoicePref("af_heart");
    writeVoiceSettings({ mode: "set" });
    expect(readVoicePref()).toBe("af_heart");
  });
});

// PER CHAT — his ruling. The key carries the project code, and the old unscoped address is read
// once as a fallback so a pick made before this existed is not silently lost.
describe("scoped to one chat", () => {
  beforeEach(() => window.localStorage.clear());

  it("keeps two chats' voices apart", () => {
    writeVoicePref("af_heart", "alpha");
    writeVoicePref("bf_emma", "beta");
    expect(readVoicePref("alpha")).toBe("af_heart");
    expect(readVoicePref("beta")).toBe("bf_emma");
  });

  it("keeps two chats' settings apart", () => {
    writeVoiceSettings({ mode: "set", blocks: ["ask"] }, "alpha");
    expect(readVoiceSettings("beta")).toEqual({ speed: 1, mode: "off", blocks: null });
    expect(readVoiceSettings("alpha").blocks).toEqual(["ask"]);
  });

  it("falls back to the unscoped key a previous version wrote", () => {
    window.localStorage.setItem(KEY, "bm_george");
    expect(readVoicePref("brand-new-chat")).toBe("bm_george");
  });

  // Read once, never written back — a scoped write must not keep reviving the old address.
  it("stops inheriting the moment that chat makes its own choice", () => {
    window.localStorage.setItem(KEY, "bm_george");
    writeVoicePref("af_bella", "alpha");
    expect(readVoicePref("alpha")).toBe("af_bella");
    expect(readVoicePref("beta")).toBe("bm_george");
  });

  // A lane feed renders this control with no scope provider above it. A voice setting is never
  // worth a thrown exception.
  it("has a home for a chat with no scope at all", () => {
    writeVoicePref("af_heart");
    expect(readVoicePref()).toBe("af_heart");
    expect(window.localStorage.getItem("sv.voice.default")).toBe("af_heart");
  });
});


// THREE POSITIONS, not a boolean — because off and everything are both places he moves BETWEEN
// several times an hour. A boolean plus a block list can express all three only by editing the
// list to reach "everything", which loses the set he picked.
describe("the mode", () => {
  beforeEach(() => window.localStorage.clear());

  it("cycles off → your set → everything → off, so all three are one press apart", () => {
    expect(nextMode("off")).toBe("set");
    expect(nextMode("set")).toBe("all");
    expect(nextMode("all")).toBe("off");
  });

  // An unrecognised mode cycles to OFF rather than into speech. Whatever went wrong upstream, the
  // safe landing for a value nobody understands is silence.
  it("lands on off for a mode it does not recognise", () => {
    expect(nextMode("nonsense")).toBe("off");
    expect(writeVoiceSettings({ mode: "sideways" }).mode).toBe("off");
  });

  // Silently switching somebody's voice off is indistinguishable from the feature breaking.
  it("migrates the boolean it replaced — auto ON meant read my chosen blocks", () => {
    window.localStorage.setItem(SETTINGS_KEY + ".alpha", JSON.stringify({ auto: true, speed: 1.1 }));
    expect(readVoiceSettings("alpha").mode).toBe("set");
    expect(readVoiceSettings("alpha").speed).toBe(1.1);
  });

  it("migrates auto OFF to off", () => {
    window.localStorage.setItem(SETTINGS_KEY + ".beta", JSON.stringify({ auto: false }));
    expect(readVoiceSettings("beta").mode).toBe("off");
  });

  it("does not keep writing the old field back", () => {
    writeVoiceSettings({ mode: "all" }, "gamma");
    const raw = JSON.parse(window.localStorage.getItem(SETTINGS_KEY + ".gamma"));
    expect(raw.auto).toBe(undefined);
    expect(raw.mode).toBe("all");
  });
});
