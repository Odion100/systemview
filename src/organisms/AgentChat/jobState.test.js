import { chipFor, menuFor, DERIVED } from "./jobState";

// Three facts, one chip — these claims are about WHICH ONE WINS, which is the whole decision the
// module exists to make (and the one a human would otherwise have to read the card to discover).
describe("the word on a job card has an author", () => {
  it("derives running/finished/landed when nobody has said anything", () => {
    expect(DERIVED(false, false, "")).toBe("running");
    expect(DERIVED(true, false, "")).toBe("finished");
    expect(DERIVED(true, true, "")).toBe("finished · landed");
  });

  it("lets the AGENT's status speak for an unfinished run, and never for a finished one", () => {
    expect(DERIVED(false, false, "blocked on his press")).toBe("blocked on his press");
    expect(DERIVED(true, false, "blocked on his press")).toBe("finished");
  });

  it("HIS mark wins the chip, and keeps the derived word behind it", () => {
    const chip = chipFor({ state: "walked it", status: "" }, { complete: true, allLanded: false });
    expect(chip.label).toBe("walked it");
    expect(chip.mine).toBe(true);
    expect(chip.behind).toBe("finished");
    expect(chip.title).toContain("finished");
  });

  it("treats a blank mark as no mark — a cleared one must not win an empty chip", () => {
    const chip = chipFor({ state: "   " }, { complete: true, allLanded: true });
    expect(chip.label).toBe("finished · landed");
    expect(chip.mine).toBe(false);
  });

  it("offers the shell's vocabulary without the word already set, and a clear only when one is", () => {
    const rows = menuFor(["walked it", "approved"], "walked it");
    expect(rows.filter((r) => typeof r === "string")).toEqual(["approved"]);
    expect(rows[rows.length - 1].clear).toBe(true);
    const fresh = menuFor(["walked it", "approved"], "");
    expect(fresh.some((r) => typeof r !== "string" && r.clear)).toBe(false);
  });

  it("falls back to two words when the shell offers none — a menu with no rows is a dead press", () => {
    expect(menuFor([], "").length).toBeGreaterThan(1);
  });
});
