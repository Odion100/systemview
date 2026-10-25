import { fileForDoc } from "./openAs";

// THE BUG THIS FILE EXISTS FOR: a skill and a job opened as blobs held in the page's memory, so a
// refresh or a back/forward left the tab standing with nothing in it — "the document is gone".
describe("which door a document opens through", () => {
  it("a skill points at the file the scan gave it", () => {
    expect(fileForDoc({ kind: "skill", name: "arc-planning", path: "/Users/o/.claude/skills/arc-planning/SKILL.md" }))
      .toBe("/Users/o/.claude/skills/arc-planning/SKILL.md");
  });

  it("a job points at its document", () => {
    expect(fileForDoc({ kind: "job", jobId: "arc-development", path: "/Users/o/.autobot/jobs/arc-development/job.md" }))
      .toBe("/Users/o/.autobot/jobs/arc-development/job.md");
  });

  it("the older spelling still works — an agent doc carries its path in `where`", () => {
    expect(fileForDoc({ kind: "doc", where: "~/.autobot/presence.md" })).toBe("~/.autobot/presence.md");
  });

  it("a READ-ONLY skill keeps the save door — a file tab cannot refuse an edit", () => {
    expect(fileForDoc({ kind: "skill", path: "/Users/o/.claude/skills/synced/docx/SKILL.md", readOnly: true })).toBe("");
  });

  it("a document with no file keeps the door too", () => {
    expect(fileForDoc({ kind: "def", agentId: "systemview" })).toBe("");
  });

  it("a relative `where` is not a path — it is a source name like \"user\"", () => {
    expect(fileForDoc({ kind: "skill", where: "user", name: "meeting" })).toBe("");
  });

  it("nothing in, nothing out", () => {
    expect(fileForDoc(null)).toBe("");
  });
});
