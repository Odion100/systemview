import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import VoicePicker from "./VoicePicker";
import { readVoicePref } from "../../utils/voicePref";

// A FAKE SYNTH, because jsdom has none. It records what was spoken and in whose voice, which is
// the only thing worth asserting — the picker's job is to route a press to the right voice and
// not to close while doing it.
const mkVoice = (name, lang = "en-US", local = true) => ({
  name,
  lang,
  voiceURI: `urn:${name}`,
  localService: local,
  default: false,
});

let spoken;

beforeEach(() => {
  spoken = [];
  window.localStorage.clear();
  window.SpeechSynthesisUtterance = function Utterance(text) {
    this.text = text;
  };
  window.speechSynthesis = {
    speak: (u) => {
      spoken.push({ text: u.text, voice: u.voice && u.voice.name });
      // Nothing calls onend — a real voice takes seconds, and the menu must survive that.
    },
    cancel: () => {},
    getVoices: () => [
      mkVoice("Albert"),
      mkVoice("Samantha"),
      mkVoice("Ava (Premium)"),
      mkVoice("Daniel", "en-GB"),
      mkVoice("Google UK English", "en-GB", false),
    ],
    addEventListener: () => {},
    removeEventListener: () => {},
  };
});

const open = () => fireEvent.click(screen.getByLabelText("Choose the voice"));

it("lists the local voices best-first, and never the network one", () => {
  render(<VoicePicker />);
  open();
  const names = screen.getAllByText(/Albert|Samantha|Ava \(Premium\)|Daniel|Google/).map((n) => n.textContent);
  expect(names).toEqual(["Ava (Premium)", "Daniel", "Samantha", "Albert"]);
});

it("marks the tier, which is the whole reason for the ordering", () => {
  render(<VoicePicker />);
  open();
  expect(screen.getByText("premium")).toBeInTheDocument();
  expect(screen.getByText("novelty")).toBeInTheDocument();
});

// The failure that caused this control to exist: a serial audition with no way to jump between
// voices. Pressing play must NOT be the same act as choosing.
it("plays a sample in that voice and leaves the menu open", () => {
  render(<VoicePicker />);
  open();
  fireEvent.click(screen.getByLabelText("Hear Daniel"));
  expect(spoken).toHaveLength(1);
  expect(spoken[0].voice).toBe("Daniel");
  expect(screen.getByLabelText("Stop Daniel")).toBeInTheDocument();
  expect(readVoicePref()).toBe("");
});

it("keeps a voice only on Keep, and says so on the row afterwards", () => {
  render(<VoicePicker />);
  open();
  const row = screen.getByText("Daniel").closest(".voice-picker__row");
  fireEvent.click(row.querySelector(".voice-picker__keep"));
  expect(readVoicePref()).toBe("urn:Daniel");
  open();
  expect(screen.getByText("kept")).toBeInTheDocument();
});

it("hands the choice back — Choose for me clears it", () => {
  render(<VoicePicker />);
  open();
  const row = screen.getByText("Samantha").closest(".voice-picker__row");
  fireEvent.click(row.querySelector(".voice-picker__keep"));
  expect(readVoicePref()).toBe("urn:Samantha");
  open();
  fireEvent.click(screen.getByText("Choose for me"));
  expect(readVoicePref()).toBe("");
});

it("is absent on a machine with no voices rather than opening onto nothing", () => {
  window.speechSynthesis.getVoices = () => [];
  const { container } = render(<VoicePicker />);
  expect(container.querySelector(".voice-picker")).toBe(null);
});
