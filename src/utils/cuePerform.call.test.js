import { performCue } from "./cuePerform";
import { resolveRef } from "./resolveRef";

jest.mock("./resolveRef", () => ({ resolveRef: jest.fn() }));
jest.mock("./voice", () => ({
  speak: (text, opts) => {
    setTimeout(() => opts && opts.onend && opts.onend(), 0);
    return { stop: () => {} };
  },
}));
jest.mock("./voicePref", () => ({ readVoicePref: () => "", readVoiceSettings: () => ({ speed: 1 }) }));
jest.mock("../spotlight", () => ({ spotlight: () => {}, clearSpotlight: () => {} }));

// THE CUE THAT OPENED A DEAD PAGE.
//
// `::cue{call="nav file=~/.autobot/jobs/arc-development/job.md"}` built its args in the browser and
// dispatched them straight at the router, so the hub never saw the path: the `~` stayed literal and
// `machine` was never set, which made the chat ask THIS project's root for a file named `~/...`.
// The pane found no host and opened nothing — measured in his window, and he closed it himself
// rather than wait for the rest of the walk to narrate a page that was not there.

const driven = [];
const onDrive = (e) => driven.push(e.detail);
beforeEach(() => {
  driven.length = 0;
  resolveRef.mockReset();
  window.addEventListener("sv:driveCommand", onDrive);
});
// NAMED, so it can actually be removed. An arrow passed to both add and remove is two different
// functions, and the listener survives — which showed up here as one dispatch arriving four times.
afterEach(() => window.removeEventListener("sv:driveCommand", onDrive));

const play = (cue) =>
  new Promise((done) => {
    performCue(cue, { projectCode: "systemview-test", onend: () => done() });
  });

it("expands and marks a MACHINE file before driving — the tilde never reaches the router", async () => {
  resolveRef.mockResolvedValue({
    resolved: true,
    machine: true,
    projectCode: "",
    path: "/Users/x/.autobot/jobs/arc-development/job.md",
  });
  await play({ verb: "call", call: "nav file=~/.autobot/jobs/arc-development/job.md" });
  expect(driven).toHaveLength(1);
  expect(driven[0].args.file).toBe("/Users/x/.autobot/jobs/arc-development/job.md");
  expect(driven[0].args.machine).toBe(true);
  expect(driven[0].args.file.startsWith("~")).toBe(false);
});

it("carries the OWNING project for a path that belongs to another repo", async () => {
  resolveRef.mockResolvedValue({ resolved: true, machine: false, projectCode: "autobot", path: "docs/jobs.md" });
  await play({ verb: "call", call: "nav file=/Users/x/autobot/docs/jobs.md" });
  expect(driven[0].args.fileProject).toBe("autobot");
  expect(driven[0].args.machine).toBe(false);
});

// THE FAILURE THE CUE VOCABULARY EXISTS TO PREVENT: a beat that performs nothing while the
// sequence carries on. An unopenable file says why instead of driving at a page that cannot come.
it("drives NOTHING and speaks the reason when the file cannot be resolved", async () => {
  resolveRef.mockResolvedValue({ resolved: false, reason: "no file at that path" });
  await play({ verb: "call", call: "nav file=nope/missing.md" });
  expect(driven).toHaveLength(0);
});

it("leaves a non-file command alone — nothing to resolve, nothing delayed", async () => {
  await play({ verb: "call", call: "nav agents=true" });
  expect(driven).toHaveLength(1);
  expect(resolveRef).not.toHaveBeenCalled();
});
