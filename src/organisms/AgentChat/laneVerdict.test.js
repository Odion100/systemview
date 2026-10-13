import { laneVerdict, laneChip, laneReceipt, laneConfirm } from "./laneVerdict";

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

  test("a STATEMENT is the headline, and the derived reading moves to the title", () => {
    // His ruling 2026-10-06: the row says what is happening, from whoever is doing it. Derivation
    // called a branch with no commits "in · committed" and an applied-then-reversed lane
    // "can't tell, 4/11" — facts the actor knew exactly and could not state.
    const v = laneVerdict({
      status: { text: "applied then reversed — NOT landed", tone: "warn", by: "systemview-test", ts: 1791285000000 },
      applied: { verdict: "unknown", matching: 4, total: 11 },
    });
    expect(v.state).toBe("said");
    const chip = laneChip(v);
    expect(chip.text).toBe("applied then reversed — NOT landed");
    expect(chip.tone).toBe("warn");
    // the derivation is not discarded — it is shown, so a disagreement is visible
    expect(chip.title).toMatch(/can't tell/);
    expect(chip.title).toMatch(/4\/11/);
    expect(chip.title).toMatch(/systemview-test/);
  });

  test("a statement outranks even a derived `out` — but it never hides it", () => {
    // The old ordering made `out` unbeatable because an agent could otherwise make a lane look
    // landed. A statement cannot do that: it is rendered AS a statement, and `out` is in the title.
    const v = laneVerdict({
      status: { text: "brought in, suites green", tone: "ok", by: "me", ts: 1 },
      applied: { verdict: "out", matching: 0, total: 9 },
    });
    expect(v.state).toBe("said");
    expect(laneChip(v).title).toMatch(/not in this tree/);
  });

  test("nobody has spoken, so the derived reading is all there is — unchanged", () => {
    const v = laneVerdict({ applied: { verdict: "in", committed: true } });
    expect(v.state).toBe("committed");
  });

// His report, 2026-10-10, on the first lane ever registered without delegation: *"the only thing
// I'm waiting to see is a receipt on that empty lane."* Both halves were the row's fault — the
// `said` chip dropped `v.receipt`, and the whole read sat behind `if (!finished) return`.
describe("laneReceipt — the unretractable half, beside the statement rather than under it", () => {
  const said = { text: "waiting on your review", tone: "warn", by: "me", ts: 1759400000000 };

  test("a statement no longer swallows the receipt — THE REPORTED BUG", () => {
    const v = laneVerdict(bs({ verdict: "unknown", matching: 2, total: 9 }, { status: said, applied: { verdict: "unknown", broughtIn: receipt } }));
    expect(v.state).toBe("said");
    // the chip is still the statement...
    expect(laneChip(v).text).toBe("waiting on your review");
    // ...and the receipt now has its own mark instead of vanishing
    const r = laneReceipt(v);
    expect(r).not.toBeNull();
    expect(r.text).toMatch(/brought in/);
    expect(r.text).toMatch(/6dd6cc9/);
  });

  test("it says, in the title, that a receipt cannot be retracted and a statement can", () => {
    const v = laneVerdict(bs({ verdict: "unknown" }, { status: said, applied: { verdict: "unknown", broughtIn: receipt } }));
    expect(laneReceipt(v).title).toMatch(/cannot be retracted/);
  });

  test("a base that is a BRANCH NAME is called out, not printed as if it were checkable", () => {
    // Every receipt written before 2026-10-10 has this: the host read `gitState.branch`, so the
    // base says `main` / `ElementLocator` — a name that moves.
    const v = laneVerdict(bs({ verdict: "unknown" }, { applied: { verdict: "unknown", broughtIn: { ...receipt, base: "main" } }, status: said }));
    const r = laneReceipt(v);
    expect(r.text).not.toMatch(/main/);
    expect(r.title).toMatch(/BRANCH NAME/);
    expect(r.title).toMatch(/cannot be verified/);
  });

  test("no base at all says so — a receipt that is only a date", () => {
    const v = laneVerdict(bs({ verdict: "unknown" }, { applied: { verdict: "unknown", broughtIn: { ts: receipt.ts, by: "me" } }, status: said }));
    expect(laneReceipt(v).title).toMatch(/a date and nothing more/);
  });

  test("`answered` gets no second mark — there the chip already IS the receipt", () => {
    const v = laneVerdict(bs({ verdict: "unknown", broughtIn: receipt }));
    expect(v.state).toBe("answered");
    expect(laneReceipt(v)).toBeNull();
  });

  test("no receipt, no mark", () => {
    expect(laneReceipt(laneVerdict(bs({ verdict: "in", committed: true })))).toBeNull();
    expect(laneReceipt(null)).toBeNull();
  });
});
