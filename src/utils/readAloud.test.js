import { findVoicedFiles, recitalSegments, passageKey, claimRead, isClaimed } from "./readAloud";

// THE RULE THESE GUARD: a reply carrying a voiced ::file reads IN THE ORDER ON SCREEN — text before
// the chip, the passage, text after — and a passage is claimed exactly once per window session, so
// the chat's reader and the chip itself can both know about it without ever both reading it.

const REPLY = [
  "Here is the problem section.",
  "",
  "::file[RFCs/RFC-075-a-claim-carries-its-proof.md#L8-26]{voice}",
  "",
  "And that is why proofs exist.",
].join("\n");

describe("findVoicedFiles", () => {
  it("finds a voiced chip with its path, range and line", () => {
    expect(findVoicedFiles(REPLY)).toEqual([
      { line: 3, path: "RFCs/RFC-075-a-claim-carries-its-proof.md", lines: [8, 26] },
    ]);
  });
  it("voice and read both arm it; a plain chip does not; a fenced example never does", () => {
    expect(findVoicedFiles("::file[a.md]{read}")).toHaveLength(1);
    expect(findVoicedFiles("::file[a.md]")).toHaveLength(0);
    expect(findVoicedFiles("```markdown\n::file[a.md]{voice}\n```")).toHaveLength(0);
  });
  it("no range means the whole file", () => {
    expect(findVoicedFiles("::file[docs/notes.md]{voice}")[0]).toMatchObject({ path: "docs/notes.md", lines: null });
  });
});

describe("recitalSegments — the order you see is the order you hear", () => {
  it("say → file → say, in document order", () => {
    const segs = recitalSegments(REPLY);
    expect(segs.map((s) => s.kind)).toEqual(["say", "file", "say"]);
    expect(segs[0].text).toMatch(/problem section/);
    expect(segs[1]).toMatchObject({ path: "RFCs/RFC-075-a-claim-carries-its-proof.md", lines: [8, 26] });
    expect(segs[2].text).toMatch(/why proofs exist/);
  });
  it("each say-segment carries its own chunk positions — karaoke per segment", () => {
    const segs = recitalSegments(REPLY);
    expect(segs[0].chunks.length).toBeGreaterThan(0);
    expect(segs[0].chunks[0].lines[0]).toBe(1);
    expect(segs[2].chunks[0].lines[0]).toBe(5);
  });
  it("a reply with no voiced chips is ONE segment — the reader unchanged", () => {
    const segs = recitalSegments("Just words here.\n\nMore words.");
    expect(segs).toHaveLength(1);
    expect(segs[0].kind).toBe("say");
  });
  it("a reply that is only a chip has no empty say-segments around it", () => {
    const segs = recitalSegments("::file[a.md]{voice}");
    expect(segs.filter((s) => s.kind === "file")).toHaveLength(1);
    expect(segs.filter((s) => s.kind === "say" && !s.text.trim())).toHaveLength(0);
  });
});

describe("the claim — once per window session, shared by reader and chip", () => {
  it("first claim wins, the second knows it lost", () => {
    const k = passageKey("systemview-test", "x/y.md", [1, 5]);
    expect(isClaimed(k)).toBe(false);
    expect(claimRead(k)).toBe(true);
    expect(claimRead(k)).toBe(false);
    expect(isClaimed(k)).toBe(true);
  });
  it("the key tells passages apart by project, path and range", () => {
    expect(passageKey("a", "f.md", [1, 2])).not.toBe(passageKey("a", "f.md", [3, 4]));
    expect(passageKey("a", "f.md", null)).not.toBe(passageKey("b", "f.md", null));
  });
});
