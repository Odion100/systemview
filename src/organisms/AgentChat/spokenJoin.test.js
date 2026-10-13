import { joinSpoken, overlapWords } from "./spokenJoin";

// His report, 2026-10-10: "my words are being repeated twice from the recorder." The send composes
// the input box with the live draft line, and a draft that resolves after its own sentence committed
// contains text that is already in the box. These are the shapes that actually come off a recorder.

describe("joinSpoken — the box plus whatever of the draft is not already in it", () => {
  it("drops a draft that is the sentence already committed — the reported bug", () => {
    const said = "let's see if this happens now";
    expect(joinSpoken(said, said)).toBe(said);
  });

  it("...even when the second decode punctuated and capitalised it differently", () => {
    // Whisper never decodes the same audio identically, which is why an exact match would miss this
    expect(joinSpoken("let's see if this happens now", "Let's see if this happens now.")).toBe(
      "let's see if this happens now",
    );
  });

  it("keeps only the NEW tail when the draft overlaps and then continues", () => {
    expect(joinSpoken("I see how I can recreate this", "how I can recreate this, it's not happening now")).toBe(
      "I see how I can recreate this it's not happening now",
    );
  });

  it("leaves two genuinely different sentences alone", () => {
    expect(joinSpoken("the lane is registered", "now fire the path check")).toBe(
      "the lane is registered now fire the path check",
    );
  });

  // THE DIRECTION IT MUST FAIL IN. A doubled phrase is visible and he can complain about it; a
  // deleted clause is silent and he cannot. So an accidental seam keeps both copies.
  it("a single shared word at the seam is ordinary English, not a repeat", () => {
    expect(joinSpoken("put it on the", "the board please")).toBe("put it on the the board please");
  });

  it("a re-worded sentence keeps both rather than guessing which to drop", () => {
    const a = "we need the ability to put work in a lane";
    const b = "we need to be able to put work into a lane";
    expect(joinSpoken(a, b)).toBe(`${a} ${b}`);
  });

  it("either side empty is the other side, trimmed", () => {
    expect(joinSpoken("", "  just the draft ")).toBe("just the draft");
    expect(joinSpoken(" just the box  ", "")).toBe("just the box");
    expect(joinSpoken("", "")).toBe("");
    expect(joinSpoken(null, undefined)).toBe("");
  });
});

describe("overlapWords — measured from the seam, longest run first", () => {
  it("counts the run where the end of one is the start of the other", () => {
    expect(overlapWords("a b c d", "c d e")).toBe(2);
    expect(overlapWords("a b c", "a b c")).toBe(3);
    expect(overlapWords("a b c", "x y z")).toBe(0);
  });

  it("is blind to case and punctuation, because the two decodes disagree about both", () => {
    expect(overlapWords("the Lane is registered.", "The lane IS registered!")).toBe(4);
  });

  it("takes the LONGEST run, so a repeated word inside the overlap cannot shorten it", () => {
    expect(overlapWords("it is what it is", "it is what it is")).toBe(5);
  });
});
