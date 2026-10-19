import { blockNodeFor, revealBlock, FLASH_CLASS } from "./revealBlock";

// RFC-071 — his, 2026-10-19: *"if you click the label, or everything but the chip for the agent, it
// navigates you to that thread."* The corner tells you a conversation moved; this is the half that
// puts you in it.
const docWith = (line) => {
  const root = document.createElement("div");
  root.innerHTML = `<p>before</p><div class="md-block" data-md-name="thread" data-md-start="${line}">t</div>`;
  return root;
};

describe("going to the block a pinned row is about", () => {
  it("finds the block by the line the row would stamp — the address it already has", () => {
    const root = docWith(12);
    expect(blockNodeFor(root, 12)).toBeTruthy();
    expect(blockNodeFor(root, 13)).toBeNull();
  });

  it("scrolls it into view and flashes it", () => {
    const root = docWith(12);
    const el = root.querySelector("[data-md-start]");
    el.scrollIntoView = jest.fn();
    const hit = revealBlock(root, 12, { now: () => {} });
    expect(hit).toBe(el);
    expect(el.scrollIntoView).toHaveBeenCalled();
    expect(el.classList.contains(FLASH_CLASS)).toBe(true);
  });

  // The flash is a flash: a mark left behind would make every visited block look freshly changed.
  it("takes the mark off again", () => {
    jest.useFakeTimers();
    const root = docWith(12);
    const el = root.querySelector("[data-md-start]");
    el.scrollIntoView = jest.fn();
    revealBlock(root, 12);
    jest.runAllTimers();
    expect(el.classList.contains(FLASH_CLASS)).toBe(false);
    jest.useRealTimers();
  });

  // The pin renders per document and a surface can re-render underneath it, so "the block is not
  // there" is a real state — and it must be a null, never a throw in the corner of his screen.
  it("returns null rather than throwing when the document on screen has no such block", () => {
    expect(revealBlock(docWith(12), 99)).toBeNull();
    expect(revealBlock(null, 12)).toBeNull();
    expect(revealBlock(docWith(12), 0)).toBeNull();
  });

  // jsdom has no scrollIntoView, and neither does a detached node — the reveal still has to work.
  it("still flashes where scrollIntoView does not exist", () => {
    const root = docWith(7);
    const el = root.querySelector("[data-md-start]");
    expect(revealBlock(root, 7, { now: () => {} })).toBe(el);
    expect(el.classList.contains(FLASH_CLASS)).toBe(true);
  });
});
