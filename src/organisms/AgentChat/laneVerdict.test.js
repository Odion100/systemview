import { laneVerdict, laneChip, laneConfirm } from "./laneVerdict";

const bs = (applied, extra = {}) => ({ ok: true, exists: true, merged: false, applied, ...extra });
const receipt = { ts: 1759400000000, base: "6dd6cc9", repo: "autobot", by: "agent:systemview-test" };

describe("laneVerdict — a receipt may only answer `unknown`", () => {
  test("merged reads committed", () => {
    expect(laneVerdict(bs({}, { merged: true })).state).toBe("committed");
  });

  test("in + committed reads committed; in + uncommitted reads tree", () => {
    expect(laneVerdict(bs({ verdict: "in", committed: true })).state).toBe("committed");
    expect(laneVerdict(bs({ verdict: "in", committed: false })).state).toBe("tree");
  });

  test("unknown with no receipt stays unknown", () => {
    expect(laneVerdict(bs({ verdict: "unknown" })).state).toBe("unknown");
  });

  test("unknown WITH a receipt is answered, and carries it", () => {
    const v = laneVerdict(bs({ verdict: "unknown", broughtIn: receipt }));
    expect(v.state).toBe("answered");
    expect(v.receipt.base).toBe("6dd6cc9");
  });

  // THE SAFETY PROPERTY. If this ever passes as "answered", an agent can make a lane look landed
  // when the files prove it is not, and the human deletes work on its word.
  test("a receipt NEVER outranks out — proof wins", () => {
    const v = laneVerdict(bs({ verdict: "out", broughtIn: receipt }));
    expect(v.state).toBe("out");
    expect(v.contradicted).toBe(true);
  });

  test("and the contradiction is surfaced, not dropped", () => {
    const chip = laneChip(laneVerdict(bs({ verdict: "out", broughtIn: receipt })));
    expect(chip.text).toMatch(/disagrees/);
    expect(chip.title).toMatch(/proof wins/i);
  });

  test("plain out wears no chip — absence is the default, not news", () => {
    expect(laneChip(laneVerdict(bs({ verdict: "out" })))).toBeNull();
  });

  test("nothing at all is empty, never a guess", () => {
    expect(laneVerdict(null).state).toBe("");
    expect(laneChip(laneVerdict(null))).toBeNull();
  });
});

describe("laneChip — the answered chip's words come from the receipt", () => {
  test("it says when, and the title says against what", () => {
    const chip = laneChip(laneVerdict(bs({ verdict: "unknown", broughtIn: receipt })), () => "2026-10-02");
    expect(chip.text).toBe("brought in 2026-10-02");
    expect(chip.title).toMatch(/base 6dd6cc9/);
    expect(chip.title).toMatch(/record rather than proof/);
  });

  test("a receipt missing its base still reads", () => {
    const chip = laneChip(laneVerdict(bs({ verdict: "unknown", broughtIn: { ts: 1759400000000 } })), () => "X");
    expect(chip.text).toBe("brought in X");
    expect(chip.title).not.toMatch(/at base/);
  });
});

describe("laneConfirm — the confirm cannot contradict the chip", () => {
  const C = (applied, extra = {}, opts = {}) =>
    laneConfirm({ ok: true, exists: true, merged: false, applied, ...extra }, { fmt: () => "2026-10-02", ...opts });

  test("a missing branch is not a warning", () => {
    expect(laneConfirm({ exists: false }, {}).warn).toBe(false);
  });

  test("committed does not warn", () => {
    expect(C({ verdict: "in", committed: true }).warn).toBe(false);
  });

  test("in the tree uncommitted says the tree is the only copy left", () => {
    expect(C({ verdict: "in", committed: false }).text).toMatch(/only copy left/);
  });

  test("unknown warns and gives the match count", () => {
    const r = C({ verdict: "unknown", matching: 1, total: 5 });
    expect(r.warn).toBe(true);
    expect(r.text).toMatch(/1\/5/);
  });

  test("answered stops warning, and says record rather than proof", () => {
    const r = C({ verdict: "unknown", matching: 1, total: 5, broughtIn: { ts: 1, base: "6dd6cc9" } });
    expect(r.warn).toBe(false);
    expect(r.text).toMatch(/record rather than proof/);
    expect(r.text).toMatch(/base 6dd6cc9/);
  });

  // THE SAME SAFETY PROPERTY, at the delete. A receipt must not talk anyone into deleting work the
  // files prove is absent.
  test("out plus a receipt still warns, and names the contradiction", () => {
    const r = C({ verdict: "out", matching: 0, total: 6, broughtIn: { ts: 1, base: "x" } });
    expect(r.warn).toBe(true);
    expect(r.text).toMatch(/files say it is NOT here/);
  });

  test("plain out warns that real work dies", () => {
    expect(C({ verdict: "out", matching: 0, total: 6 }).text).toMatch(/real work dies/);
  });
});
