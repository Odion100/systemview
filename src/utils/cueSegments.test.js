import { findCues, recitalSegments } from "./readAloud";

// `::cue` IN A REPLY — the segmenter is what makes a tour a reply: prose and cues interleave in
// document order on the one line, and a quoted example in a fence must never walk the bot.
describe("findCues", () => {
  it("parses every verb's attrs and the body", () => {
    const md = [
      "::cue[welcome to the tour]",
      '::cue{at=".hww-intro" say="the path"}',
      '::cue{highlight=".hww-leaf--arc"}',
      '::cue{press=".hww-chaps button"}',
      '::cue{call="Window.readState"}',
    ].join("\n");
    const cues = findCues(md);
    expect(cues).toHaveLength(5);
    expect(cues[0].body).toBe("welcome to the tour");
    expect(cues[1].at).toBe(".hww-intro");
    expect(cues[1].say).toBe("the path");
    expect(cues[2].highlight).toBe(".hww-leaf--arc");
    expect(cues[3].press).toBe(".hww-chaps button");
    expect(cues[4].call).toBe("Window.readState");
  });

  it("a cue inside a fence is an example, never an action", () => {
    const md = "```\n::cue{at=\".x\"}\n```\n::cue[real]";
    const cues = findCues(md);
    expect(cues).toHaveLength(1);
    expect(cues[0].body).toBe("real");
  });
});

describe("recitalSegments with cues", () => {
  it("interleaves say-segments and cues in document order, and the cue line is never spoken", () => {
    const md = 'Before the cue.\n\n::cue{at=".hww-intro" say="the path"}\n\nAfter the cue.';
    const segs = recitalSegments(md);
    expect(segs.map((s) => s.kind)).toEqual(["say", "cue", "say"]);
    expect(segs[0].text).toMatch(/Before the cue/);
    expect(segs[0].text).not.toMatch(/hww-intro/);
    expect(segs[1].at).toBe(".hww-intro");
    expect(segs[2].text).toMatch(/After the cue/);
  });

  it("a cues-only reply is all cues, no empty say segments", () => {
    const segs = recitalSegments('::cue[one]\n::cue{at=".two"}');
    expect(segs.map((s) => s.kind)).toEqual(["cue", "cue"]);
  });
});
