import harness, { available, door } from "./harnessVoice";
import { KOKORO_VOICES } from "./kokoroVoices";

// SPEECH IS A HARNESS CAPABILITY and this window is a consumer of it. These assertions are about
// the seam: that it is absent when the harness is, that it decodes what the shell actually sends,
// and that it never does inference here.

const b64OfSamples = (n) => {
  const f = new Float32Array(n).fill(0.1);
  const bytes = new Uint8Array(f.buffer);
  let s = "";
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
  return window.btoa(s);
};

afterEach(() => {
  delete window.systemview;
  delete window.AudioContext;
});

describe("the door", () => {
  it("is absent in a plain browser tab, and that is not an error", () => {
    expect(door()).toBe(null);
    expect(available()).toBe(false);
  });

  it("opens when the shell grants voice", () => {
    window.AudioContext = function C() {};
    window.systemview = { voice: { speak: () => {}, status: () => {} } };
    expect(door()).toBeTruthy();
    expect(available()).toBe(true);
  });

  // The capability is GRANTED, so a window whose app did not ask for it has no `voice` key at all
  // — absent, not denied. The engine must read that as "not here" rather than crash.
  it("treats an ungranted harness exactly like no harness", () => {
    window.AudioContext = function C() {};
    window.systemview = { files: {}, dictation: {} };
    expect(door()).toBe(null);
    expect(available()).toBe(false);
  });
});

describe("the voice list", () => {
  it("is the same table the model ships, read locally so the panel is not a spinner", () => {
    expect(harness.voices()).toHaveLength(KOKORO_VOICES.length);
    expect(harness.voices()[0].grade).toBe("A");
  });

  it("claims every voice is local — the shell is not a server", () => {
    expect(harness.voices().every((v) => v.local === true)).toBe(true);
  });
});

describe("readiness", () => {
  it("is not ready with no harness, and says so rather than pretending", () => {
    expect(harness.ready()).toBe(false);
  });

  // The shell may already hold the weights from another app or an earlier session — prewarm asks
  // rather than downloads, so a surface says "downloading" only when something really is.
  it("takes readiness from the shell's own status, not from a guess", async () => {
    window.systemview = { voice: { status: async () => ({ ready: true, model: "x" }) } };
    await harness.prewarm();
    expect(harness.ready()).toBe(true);
  });

  it("reports a failed status instead of swallowing it", async () => {
    window.systemview = {
      voice: {
        status: async () => {
          throw new Error("shell is gone");
        },
      },
    };
    await expect(harness.prewarm()).rejects.toThrow("shell is gone");
    expect(String(harness.lastError().message)).toBe("shell is gone");
  });
});

describe("speaking", () => {
  it("asks the harness for samples and never generates here", async () => {
    const asked = [];
    window.AudioContext = function C() {
      this.state = "running";
      this.destination = {};
      this.resume = () => {};
      this.createBuffer = () => ({ copyToChannel: () => {} });
      this.createBufferSource = () => ({ connect() {}, start() {}, stop() {}, onended: null });
    };
    window.systemview = {
      voice: {
        status: async () => ({ ready: true }),
        speak: async (text, opts) => {
          asked.push({ text, ...opts });
          return { sampleRate: 24000, audio: b64OfSamples(8) };
        },
      },
    };
    harness.speak("A single sentence.", { voice: { id: "bf_emma" }, rate: 1.2 });
    await new Promise((r) => setTimeout(r, 0));
    await new Promise((r) => setTimeout(r, 0));
    await new Promise((r) => setTimeout(r, 0));
    expect(asked[0].text).toBe("A single sentence.");
    expect(asked[0].voice).toBe("bf_emma");
    expect(asked[0].speed).toBe(1.2);
  });

  // With no second voice underneath, a failure has to be SAID — silence is the one outcome a
  // listener cannot tell apart from a broken feature.
  it("ends with an error rather than silence when the shell cannot answer", async () => {
    window.AudioContext = function C() {};
    window.systemview = {
      voice: {
        status: async () => ({ ready: true }),
        speak: async () => {
          throw new Error("the voice exited");
        },
      },
    };
    const ends = [];
    harness.speak("Something.", { onend: (e) => ends.push(e) });
    await new Promise((r) => setTimeout(r, 0));
    await new Promise((r) => setTimeout(r, 0));
    await new Promise((r) => setTimeout(r, 0));
    expect(ends).toHaveLength(1);
    expect(String(ends[0] && ends[0].message)).toContain("the voice exited");
  });
});
