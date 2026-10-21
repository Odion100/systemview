import { readVoicePref, writeVoicePref, KEY } from "./voicePref";

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
