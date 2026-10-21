import React from "react";
import { fireEvent, render as rtlRender, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { MarkdownScopeProvider } from "../../atoms/Markdown/context";
import VoiceSettings from "./VoiceSettings";
import { readVoicePref, readVoiceSettings, writeVoiceSettings } from "../../utils/voicePref";
import { KOKORO_VOICES } from "../../utils/kokoroVoices";
import { AIMED_AT_YOU, EVERYTHING } from "../../utils/spokenForm";

// THE ENGINE IS MOCKED, and not out of convenience: `utils/voice` reaches Kokoro, which reaches
// `@huggingface/transformers` through a dynamic import — ESM in node_modules, which react-scripts
// does not transform, so a jest run that touches it dies on the import rather than failing an
// assertion. It is also the right unit boundary: this panel's job is routing presses to settings.
let mockSpoken;
let mockReady;
let mockFailure;
let mockPending;

jest.mock("../../utils/voice", () => ({
  voices: () => require("../../utils/kokoroVoices").KOKORO_VOICES,
  speak: (text, opts) => {
    mockSpoken.push({ text, voice: opts && opts.voice && opts.voice.id, rate: opts && opts.rate });
    return { stop: () => {} };
  },
  stop: () => {},
  ready: () => mockReady,
  lastError: () => mockFailure,
  prewarm: (onprogress) => {
    if (onprogress) onprogress({ status: "progress", loaded: 43, total: 100 });
    return mockPending ? new Promise(() => {}) : Promise.resolve(null);
  },
}));

beforeEach(() => {
  mockSpoken = [];
  mockReady = true;
  mockFailure = null;
  mockPending = false;
  window.localStorage.clear();
});

// THE SCOPE COMES FROM THE CHAT, so the panel needs one above it — and a Router, because
// `useMarkdownScope` falls back to the URL when no surface provides a scope.
const render = (ui, projectCode) =>
  rtlRender(
    <MemoryRouter>
      <MarkdownScopeProvider value={projectCode ? { projectCode } : null}>{ui}</MarkdownScopeProvider>
    </MemoryRouter>,
  );

const open = () => fireEvent.click(screen.getByLabelText("Voice settings"));
const reads = () => fireEvent.click(screen.getByText("What it reads"));
// The panel now OPENS on "what it reads", so the voice list needs a deliberate press to reach.
const sound = () => fireEvent.click(screen.getByText("Voice & speed"));

describe("voice and speed", () => {
  it("lists every voice the model ships, best-graded first", () => {
    render(<VoiceSettings />);
    open();
    sound();
    const chips = document.querySelectorAll(".voice-settings__grade");
    expect(chips).toHaveLength(KOKORO_VOICES.length);
    expect(chips[0].textContent).toBe("A");
    expect(chips[chips.length - 1].textContent).toBe("F+");
  });

  it("plays a sample in that voice and leaves the panel open", () => {
    render(<VoiceSettings />);
    open();
    sound();
    fireEvent.click(screen.getByLabelText("Hear Emma"));
    expect(mockSpoken[0].voice).toBe("bf_emma");
    expect(screen.getByLabelText("Stop Emma")).toBeInTheDocument();
    expect(readVoicePref()).toBe("");
  });

  it("keeps a voice only on Keep", () => {
    render(<VoiceSettings />);
    open();
    sound();
    const row = screen.getByText("Heart").closest(".voice-settings__row");
    fireEvent.click(row.querySelector(".voice-settings__keep"));
    expect(readVoicePref()).toBe("af_heart");
  });

  // "kept" was the past tense of an action and read as a receipt. The row is saying which voice
  // is CURRENTLY in use, so it says that.
  it("says which voice is in use, not what you once did", () => {
    render(<VoiceSettings />);
    open();
    sound();
    const row = screen.getByText("Heart").closest(".voice-settings__row");
    expect(row.querySelector(".voice-settings__keep").textContent).toBe("Use");
    fireEvent.click(row.querySelector(".voice-settings__keep"));
    expect(screen.getByText("in use")).toBeInTheDocument();
    expect(screen.queryByText("kept")).toBe(null);
  });

  // HIS BUG, 2026-10-21: *"I press another one and multiple are playing at the same time."*
  // Auditioning is exactly the case where you press one voice while another is talking.
  it("hands the control to the newer voice when one interrupts another", () => {
    render(<VoiceSettings />);
    open();
    sound();
    fireEvent.click(screen.getByLabelText("Hear Heart"));
    expect(screen.getByLabelText("Stop Heart")).toBeInTheDocument();
    fireEvent.click(screen.getByLabelText("Hear Emma"));
    expect(screen.getByLabelText("Stop Emma")).toBeInTheDocument();
    expect(screen.queryByLabelText("Stop Heart")).toBe(null);
    expect(screen.getByLabelText("Hear Heart")).toBeInTheDocument();
  });

  it("stops on a second press of the same row", () => {
    render(<VoiceSettings />);
    open();
    sound();
    fireEvent.click(screen.getByLabelText("Hear Heart"));
    fireEvent.click(screen.getByLabelText("Stop Heart"));
    expect(screen.getByLabelText("Hear Heart")).toBeInTheDocument();
  });

  it("saves the speed, and shows it", () => {
    render(<VoiceSettings />);
    open();
    sound();
    fireEvent.change(screen.getByLabelText("Speaking speed"), { target: { value: "1.25" } });
    expect(readVoiceSettings().speed).toBe(1.25);
    expect(screen.getByText("1.25×")).toBeInTheDocument();
  });

  // A voice auditioned at 1.0 and then heard at 1.3 is a different voice to the ear, so the
  // preview has to use the speed he just set.
  it("auditions at the speed he chose, not at 1", () => {
    render(<VoiceSettings />);
    open();
    sound();
    fireEvent.change(screen.getByLabelText("Speaking speed"), { target: { value: "1.35" } });
    fireEvent.click(screen.getByLabelText("Hear Heart"));
    expect(mockSpoken[0].rate).toBe(1.35);
  });
});

describe("the mode, shown here but switched at the composer", () => {
  it("offers all three positions and saves the one pressed", () => {
    render(<VoiceSettings />);
    open();
    expect(readVoiceSettings().mode).toBe("off");
    fireEvent.click(document.querySelector(".voice-settings__modes").querySelectorAll("button")[2]);
    expect(readVoiceSettings().mode).toBe("all");
    fireEvent.click(document.querySelector(".voice-settings__modes").querySelectorAll("button")[1]);
    expect(readVoiceSettings().mode).toBe("set"); // Targeted
  });

  // The set is his taste and the mode is his situation. Folding them together would mean
  // re-picking his blocks every time he wanted the whole reply read.
  it("does not disturb the block set", () => {
    writeVoiceSettings({ blocks: ["ask", "callout"] });
    render(<VoiceSettings />);
    open();
    fireEvent.click(document.querySelector(".voice-settings__modes").querySelectorAll("button")[2]);
    expect(readVoiceSettings().blocks).toEqual(["ask", "callout"]);
  });
});

describe("what it reads", () => {
  it("offers the blocks by what they SAY, not by their names", () => {
    render(<VoiceSettings />);
    open();
    reads();
    expect(screen.getByText("the one thing I need from you")).toBeInTheDocument();
    expect(screen.getByText("a caveat that changes what you would do")).toBeInTheDocument();
    // Nobody ticks a box labelled `approval`.
    expect(screen.getByText("something waiting on your decision")).toBeInTheDocument();
  });

  it("ticks and unticks one block at a time", () => {
    render(<VoiceSettings />);
    open();
    reads();
    expect(readVoiceSettings().blocks).toBe(null); // nothing chosen yet
    fireEvent.click(screen.getByText("Thread"));
    expect(readVoiceSettings().blocks).toEqual([...AIMED_AT_YOU, "thread"]);
    fireEvent.click(screen.getByText("Ask"));
    expect(readVoiceSettings().blocks).not.toContain("ask");
    expect(readVoiceSettings().blocks).toContain("thread");
  });

  it("takes a preset as a starting point he can then edit", () => {
    render(<VoiceSettings />);
    open();
    reads();
    // "Everything" is also a MODE in the header, so the preset is reached through its own group —
    // two controls can legitimately share a word when they sit in different places.
    fireEvent.click(document.querySelector(".voice-settings__presets").querySelectorAll("button")[2]);
    expect(readVoiceSettings().blocks).toEqual(EVERYTHING);
    fireEvent.click(screen.getByText("Just the ask"));
    expect(readVoiceSettings().blocks).toEqual(["ask"]);
  });

  // "Read me nothing" has to be expressible, or the only way to stop it is to turn auto off.
  it("lets him choose nothing, and that is not the same as choosing everything", () => {
    render(<VoiceSettings />);
    open();
    reads();
    fireEvent.click(screen.getByText("Nothing"));
    expect(readVoiceSettings().blocks).toEqual([]);
  });

  it("offers the prose outside every block as its own choice", () => {
    render(<VoiceSettings />);
    open();
    reads();
    fireEvent.click(screen.getByText("Everything else"));
    expect(readVoiceSettings().blocks).toContain("prose");
  });
});

describe("the one unavoidable wait", () => {
  it("starts the download when it opens and reports the percentage", async () => {
    mockReady = false;
    mockPending = true;
    render(<VoiceSettings />);
    open();
    await waitFor(() => expect(document.querySelector(".voice-settings__loading")).toBeTruthy());
    expect(document.querySelector(".voice-settings__loading").textContent).toContain("43%");
  });

  it("says why the voice could not load instead of offering rows that do nothing", async () => {
    mockReady = false;
    mockFailure = new Error("offline");
    render(<VoiceSettings />);
    open();
    await waitFor(() => expect(screen.getByText(/could not load/)).toBeInTheDocument());
  });
});

// HIS RULING, 2026-10-21: *"make sure the voice settings are per chat."* The voice reading an
// agent's replies is part of how that agent sounds, and which blocks are worth hearing differs by
// what the agent is for.
describe("per chat", () => {
  it("keeps one chat's voice out of another's", () => {
    const a = render(<VoiceSettings />, "alpha");
    open();
    sound();
    fireEvent.click(screen.getByText("Heart").closest(".voice-settings__row").querySelector(".voice-settings__keep"));
    expect(readVoicePref("alpha")).toBe("af_heart");
    expect(readVoicePref("beta")).toBe("");
    a.unmount();

    render(<VoiceSettings />, "beta");
    open();
    sound();
    fireEvent.click(screen.getByText("Emma").closest(".voice-settings__row").querySelector(".voice-settings__keep"));
    expect(readVoicePref("beta")).toBe("bf_emma");
    expect(readVoicePref("alpha")).toBe("af_heart");
  });

  it("keeps the mode and the block set per chat too", () => {
    const a = render(<VoiceSettings />, "alpha");
    open();
    fireEvent.click(document.querySelector(".voice-settings__modes").querySelectorAll("button")[2]);
    expect(readVoiceSettings("alpha").mode).toBe("all");
    expect(readVoiceSettings("beta").mode).toBe("off");
    a.unmount();
  });

  // Settings existed before they were per-chat. Dropping the old address would silently reset him
  // and look like the feature had broken.
  it("inherits a pick made before settings were per-chat", () => {
    window.localStorage.setItem("sv.voice", "bm_george");
    expect(readVoicePref("anything")).toBe("bm_george");
    render(<VoiceSettings />, "anything");
    open();
    sound();
    expect(screen.getByText("in use")).toBeInTheDocument();
  });
});


// HIS CALL: the voice is chosen once and forgotten; the block set is the thing he returns to.
it("opens on what it reads, not on the voice list", () => {
  render(<VoiceSettings />);
  open();
  expect(screen.getByText("the one thing I need from you")).toBeInTheDocument();
  expect(screen.queryByLabelText("Speaking speed")).toBe(null);
});


// HIS BUG, measured in the window: the speaker toggle is a SIBLING of this panel, so pressing it
// while the panel was open read as an away-click and closed the panel instead of switching the
// mode — killing the one gesture that teaches what the three positions mean.
it("stays open when the pill beside it is pressed", () => {
  rtlRender(
    <MemoryRouter>
      <span className="voice-mode">
        <button type="button" className="voice-mode__cycle">
          toggle
        </button>
        <VoiceSettings />
      </span>
    </MemoryRouter>,
  );
  fireEvent.click(screen.getByLabelText("Voice settings"));
  expect(document.querySelector(".voice-settings__panel")).toBeTruthy();
  fireEvent.mouseDown(screen.getByText("toggle"));
  expect(document.querySelector(".voice-settings__panel")).toBeTruthy();
});

it("still closes on a press that is genuinely away", () => {
  render(<VoiceSettings />);
  fireEvent.click(screen.getByLabelText("Voice settings"));
  expect(document.querySelector(".voice-settings__panel")).toBeTruthy();
  fireEvent.mouseDown(document.body);
  expect(document.querySelector(".voice-settings__panel")).toBe(null);
});
