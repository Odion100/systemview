import { formatReceipt, receiptTone } from "./cmdReceipt";

// The roundtrip IS the contract: whatever formatReceipt says, receiptTone must read correctly —
// these two live in one module precisely so this suite can hold them together.
describe("the cmd receipt vocabulary roundtrips", () => {
  it("exit 0 reads ok", () => {
    expect(receiptTone(formatReceipt({ title: "Build", exit: 0, ms: 19000, started: true }))).toBe("ok");
  });
  it("a non-zero exit reads fail", () => {
    expect(receiptTone(formatReceipt({ title: "Build", exit: 7, ms: 2000, started: true }))).toBe("fail");
  });
  it("an unknown exit reads fail, never ok", () => {
    expect(receiptTone(formatReceipt({ title: "Build", exit: null, ms: 2000, started: true }))).toBe("fail");
  });
  it("stopped and didn't-run read mute", () => {
    expect(receiptTone(formatReceipt({ title: "Build", ms: 9000, started: true, cancelled: true }))).toBe("mute");
    expect(receiptTone(formatReceipt({ title: "Build", ms: 0, started: false, error: "no shell" }))).toBe("mute");
  });
  it("the words themselves", () => {
    expect(formatReceipt({ title: "Build", exit: 0, ms: 19000, started: true })).toBe('ran "Build" — exit 0 · 19s');
    expect(formatReceipt({ exit: 7, ms: 125000, started: true })).toBe("ran the command — exit 7 · 2m 05s");
  });
});
