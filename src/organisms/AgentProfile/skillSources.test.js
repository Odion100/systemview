import { groupSkillsBySource, sourceCountLabel, skillDoc } from "./skillSources";

const skill = (name, source, rest = {}) => ({ name, source, where: `~/${source}/${name}`, text: `# ${name}`, ...rest });

describe("groupSkillsBySource", () => {
  it("puts each skill under the source that claims it, in the host's order", () => {
    const rows = groupSkillsBySource(
      [skill("a", "ours"), skill("b", "shipped"), skill("c", "ours")],
      [
        { name: "ours", pattern: "/u/.claude/skills", writable: true, discoverable: true, count: 2, dirs: ["/u/.claude/skills"] },
        { name: "shipped", pattern: "/cli/*/skills", writable: false, discoverable: true, count: 1, dirs: ["/cli/1/skills"] },
      ]
    );
    expect(rows.map((r) => r.name)).toEqual(["ours", "shipped"]);
    expect(rows[0].skills.map((s) => s.name)).toEqual(["a", "c"]);
    expect(rows[0].count).toBe(2);
    expect(rows[1].writable).toBe(false);
  });

  it("keeps an unresolved source as a row and reports ABSENCE, never a count of zero", () => {
    const rows = groupSkillsBySource([], [{ name: "shipped", pattern: "/cli/*/skills", unresolved: true, count: 0, dirs: [] }]);
    expect(rows).toHaveLength(1);
    expect(rows[0].unresolved).toBe(true);
    expect(rows[0].status).toBe("absent");
    expect(sourceCountLabel(rows[0])).toBe("not on disk right now");
    expect(sourceCountLabel(rows[0])).not.toMatch(/0/);
  });

  it("marks a source whose skills cannot fire, even though the files are right there", () => {
    const rows = groupSkillsBySource([skill("x", "synced")], [{ name: "synced", pattern: "/s", discoverable: false, writable: true, count: 1 }]);
    expect(rows[0].discoverable).toBe(false);
    expect(rows[0].status).toBe("inert");
    expect(rows[0].count).toBe(1); // present and readable — the inertness is the separate fact
  });

  it("calls absence the worse state when a source is both absent and undiscoverable", () => {
    const rows = groupSkillsBySource([], [{ name: "shipped", unresolved: true, discoverable: false }]);
    expect(rows[0].status).toBe("absent");
    expect(rows[0].discoverable).toBe(false); // the header still gets to say both
  });

  it("treats a missing writable/discoverable as true — an old harness must not read as read-only", () => {
    const rows = groupSkillsBySource([skill("x", "project")], [{ name: "project", pattern: "/p" }]);
    expect(rows[0].writable).toBe(true);
    expect(rows[0].discoverable).toBe(true);
    expect(rows[0].status).toBe("ok");
  });

  it("singularizes the count label and pluralizes it otherwise", () => {
    const one = groupSkillsBySource([skill("x", "ours")], [{ name: "ours" }]);
    const two = groupSkillsBySource([skill("x", "ours"), skill("y", "ours")], [{ name: "ours" }]);
    expect(sourceCountLabel(one[0])).toBe("1 skill");
    expect(sourceCountLabel(two[0])).toBe("2 skills");
  });

  it("surfaces a disagreement between the source's own count and what it actually contributed", () => {
    const rows = groupSkillsBySource([skill("x", "ours")], [{ name: "ours", count: 4 }]);
    expect(rows[0].count).toBe(1);
    expect(rows[0].claimed).toBe(4);
  });

  it("drops nothing: a skill naming a source the host never listed gets its own row", () => {
    const rows = groupSkillsBySource(
      [skill("a", "ours"), skill("z", "mystery", { writable: false, sourceNote: "came from somewhere else" })],
      [{ name: "ours" }]
    );
    expect(rows.map((r) => r.name)).toEqual(["ours", "mystery"]);
    expect(rows[1].writable).toBe(false);
    expect(rows[1].note).toBe("came from somewhere else");
  });

  it("falls back to ONE unheaded row when the harness answers skills but no sources", () => {
    const rows = groupSkillsBySource([{ name: "a", where: "~/a" }, { name: "b", where: "~/b" }], null);
    expect(rows).toHaveLength(1);
    expect(rows[0].name).toBe(null);
    expect(rows[0].skills).toHaveLength(2);
  });

  it("answers with a row even when there is nothing at all, so the section never renders blank", () => {
    const rows = groupSkillsBySource(null, null);
    expect(rows).toHaveLength(1);
    expect(rows[0].skills).toEqual([]);
  });
});

describe("skillDoc", () => {
  it("opens a read-only skill as readable and unsavable", () => {
    const d = skillDoc("agent-1", skill("shipped-one", "shipped", { writable: false, text: "# long body" }));
    expect(d).toMatchObject({ kind: "skill", agentId: "agent-1", name: "shipped-one", readOnly: true });
    expect(d.text).toBe("# long body"); // whole body, untruncated — reading is the point
    expect(d.orig).toBe(d.text);
  });

  it("leaves a writable skill savable, and says nothing about writability it wasn't told", () => {
    expect(skillDoc("a", skill("mine", "ours", { writable: true })).readOnly).toBe(false);
    expect(skillDoc("a", { name: "mine", where: "~/x", text: "" }).readOnly).toBe(false);
  });
});
