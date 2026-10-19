import { rehydrateDoc } from "./rehydrateDoc";

// The resolver is address → document, and the claims are about the two answers that matter: it
// finds the right one, and it says NULL rather than inventing something when it cannot.
const skillDoc = (agentId, s) => ({ kind: "skill", agentId, name: s.name, where: s.where, text: s.text });

describe("a standing tab's address can be resolved back to its document", () => {
  it("re-reads an agent's own doc by key", async () => {
    const listDocs = jest.fn().mockResolvedValue([
      { key: "intro", label: "Intro", where: "agent", text: "hello" },
      { key: "other", label: "Other", where: "agent", text: "nope" },
    ]);
    const d = await rehydrateDoc({ kind: "doc", agentId: "a1", key: "intro" }, { listDocs });
    expect(listDocs).toHaveBeenCalledWith("a1");
    expect(d).toMatchObject({ kind: "doc", key: "intro", text: "hello", orig: "hello" });
  });

  it("re-reads a skill by name AND source — the same name can exist in two places", async () => {
    const listSkills = jest.fn().mockResolvedValue([
      { name: "deploy", where: "project", text: "project copy" },
      { name: "deploy", where: "user", text: "user copy" },
    ]);
    const d = await rehydrateDoc({ kind: "skill", agentId: "a1", name: "deploy", where: "user" }, { listSkills, skillDoc });
    expect(d).toMatchObject({ kind: "skill", where: "user", text: "user copy" });
  });

  it("re-reads a job's document, and keeps the label rule the profile uses", async () => {
    const getJob = jest.fn().mockResolvedValue({ id: "nightly", name: "Nightly sweep", doc: "# job" });
    const d = await rehydrateDoc({ kind: "job", jobId: "nightly" }, { getJob });
    expect(getJob).toHaveBeenCalledWith("nightly");
    expect(d).toMatchObject({ kind: "job", jobId: "nightly", label: "Nightly sweep (nightly)", text: "# job" });
  });

  it("re-reads a definition's PROMPT as the document", async () => {
    const getDef = jest.fn().mockResolvedValue({ id: "a1", prompt: "you are..." });
    const d = await rehydrateDoc({ kind: "def", agentId: "a1" }, { getDef });
    expect(d).toMatchObject({ kind: "def", text: "you are...", orig: "you are..." });
  });

  it("re-reads a help page by key", async () => {
    const listHelp = jest.fn().mockResolvedValue([{ key: "hooks", label: "Hooks", where: "page", text: "help text" }]);
    const d = await rehydrateDoc({ kind: "help", key: "hooks" }, { listHelp });
    expect(d).toMatchObject({ kind: "help", key: "hooks", text: "help text" });
  });

  it("answers null when the door is absent, when it throws, and when the document is gone", async () => {
    expect(await rehydrateDoc({ kind: "doc", key: "x" }, {})).toBeNull();
    expect(await rehydrateDoc({ kind: "doc", key: "x" }, { listDocs: () => { throw new Error("old harness"); } })).toBeNull();
    expect(await rehydrateDoc({ kind: "doc", key: "x" }, { listDocs: async () => [] })).toBeNull();
  });

  it("answers null for an address it cannot use — a tab stored before addresses carried enough", async () => {
    const listSkills = jest.fn().mockResolvedValue([{ name: "deploy", where: "user", text: "x" }]);
    expect(await rehydrateDoc({ kind: "skill", agentId: "a1" }, { listSkills, skillDoc })).toBeNull();
    expect(await rehydrateDoc({}, { listDocs: async () => [] })).toBeNull();
    expect(await rehydrateDoc({ kind: "mystery" }, {})).toBeNull();
  });
});
