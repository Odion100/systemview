import { takeIfNew, armedAt, _reset } from "./autoSpeak";

beforeEach(() => _reset());

// THE FAILURE THIS MODULE EXISTS TO PREVENT: on a cold load every settled reply in the backlog
// mounts at once. Without this guard, turning auto-speech on would read the entire history out
// loud the next time the window opened.
describe("which reply is new", () => {
  it("refuses the backlog — anything that settled before this page did", () => {
    expect(takeIfNew("old", armedAt() - 60000)).toBe(false);
  });

  it("takes a reply that settled after the page armed", () => {
    expect(takeIfNew("fresh", armedAt() + 1000)).toBe(true);
  });

  // React remounts rows for reasons that have nothing to do with new messages — a tab change, a
  // filter, a parent re-render.
  it("takes a row exactly once, however many times it comes back", () => {
    expect(takeIfNew("r1", armedAt() + 1000)).toBe(true);
    expect(takeIfNew("r1", armedAt() + 1000)).toBe(false);
    expect(takeIfNew("r1", armedAt() + 9999)).toBe(false);
  });

  // Marking is NOT conditional on speaking: a backlog row must be recorded as seen even though it
  // stayed silent, or a later remount would let it speak.
  it("remembers a backlog row it refused, so it can never speak later", () => {
    expect(takeIfNew("hist", armedAt() - 5)).toBe(false);
    expect(takeIfNew("hist", armedAt() + 5000)).toBe(false);
  });

  it("refuses a row with no key rather than treating every keyless row as the same one", () => {
    expect(takeIfNew("", armedAt() + 1000)).toBe(false);
    expect(takeIfNew(null, armedAt() + 1000)).toBe(false);
  });

  it("refuses a row with no usable timestamp instead of guessing", () => {
    expect(takeIfNew("a", undefined)).toBe(false);
    expect(takeIfNew("b", "not a time")).toBe(false);
  });
});
