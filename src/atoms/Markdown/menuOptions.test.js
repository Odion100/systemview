import { menuOffers } from "./menuOptions";

// WHAT THE DOCUMENT'S RIGHT-CLICK MENU OFFERS, asserted without mounting the renderer — which is
// the whole reason these conditions are not in the JSX any more. `Markdown.js` cannot be mounted in
// a test (react-markdown is ESM and transformIgnorePatterns excludes node_modules), so every
// affordance gated inside it was unspec'able; this menu is where a document's own verbs are decided.
const block = (name, kind) => ({ start: 10, end: 12, block: { name, kind, start: 10, end: 12 } });

describe("the menu offers what you actually hit", () => {
  // RFC-075 c4 — the half that could not be asserted before: offered on a leaf claim, withheld on a
  // container one, because a container claim already holds its fold.
  it("a LEAF claim grows a proof; a CONTAINER claim does not", () => {
    expect(menuOffers(block("claim", "leaf")).addProof).toBe(true);
    expect(menuOffers(block("claim", "container")).addProof).toBe(false);
  });

  it("and no other block grows one, whatever its shape", () => {
    expect(menuOffers(block("chart", "leaf")).addProof).toBe(false);
    expect(menuOffers(block("run", "container")).addProof).toBe(false);
    expect(menuOffers({ start: 4, end: 4 }).addProof).toBe(false);
  });

  // A wrapper comes off without taking anything with it; a leaf IS its content.
  it("a container is unwrapped, a leaf is removed — never both", () => {
    const c = menuOffers(block("callout", "container"));
    expect([c.unwrapBlock, c.removeBlock]).toEqual([true, false]);
    const l = menuOffers(block("chart", "leaf"));
    expect([l.unwrapBlock, l.removeBlock]).toEqual([false, true]);
    const none = menuOffers({ start: 3, end: 3 });
    expect([none.unwrapBlock, none.removeBlock]).toEqual([false, false]);
  });

  it("inside a thread the thread's verbs replace starting one", () => {
    const at = { start: 10, end: 20, thread: { start: 10, end: 20 } };
    const o = menuOffers(at, { canThread: true });
    expect(o.threadVerbs).toBe(true);
    expect(o.startThread).toBe(false);
    expect(o.note).toBe(null);
  });

  it("a thread can be started only on a host that can save replies", () => {
    expect(menuOffers({ start: 10, end: 12 }, { canThread: true }).startThread).toBe(true);
    expect(menuOffers({ start: 10, end: 12 }, { canThread: false }).startThread).toBe(false);
    expect(menuOffers({ start: 0, end: 0 }, { canThread: true }).startThread).toBe(false);
  });

  // The note is the menu SAYING WHY it offers nothing, and the two reasons are different: off every
  // block there is nothing to wrap; on a block whose document cannot save replies there is nowhere
  // for them to live.
  it("names which reason it has for offering no thread", () => {
    expect(menuOffers({ start: 10, end: 12 }, { canThread: false }).note).toBe("no-save");
    expect(menuOffers({ start: 0, end: 0 }, { canThread: true }).note).toBe("nothing-to-wrap");
    expect(menuOffers({ start: 10, end: 12 }, { canThread: true }).note).toBe(null);
  });

  it("wrapping needs something to wrap; inserting always lands somewhere", () => {
    expect(menuOffers({ start: 10, end: 12 }).wraps).toBe(true);
    expect(menuOffers({ start: 10, end: 12 }).insertAt).toBe("below");
    expect(menuOffers({ start: 0, end: 0 }).wraps).toBe(false);
    expect(menuOffers({ start: 0, end: 0 }).insertAt).toBe("end");
  });

  it("the document-wide verbs are the caller's to decide, and are passed through unbent", () => {
    const o = menuOffers(block("claim", "leaf"), { canAddMember: true, canRegister: true, threadCount: 3 });
    expect([o.addMember, o.register, o.clearThreads]).toEqual([true, true, true]);
    const q = menuOffers(block("claim", "leaf"), { threadCount: 0 });
    expect([q.addMember, q.register, q.clearThreads]).toEqual([false, false, false]);
  });

  it("an empty call answers without throwing — the menu renders before anything is hit", () => {
    const o = menuOffers();
    expect(o.addProof).toBe(false);
    expect(o.insertAt).toBe("end");
    expect(o.note).toBe("nothing-to-wrap");
  });
});

// LISTENING IS NOT AN EDIT, so it is not gated like one. Every other verb in this menu writes to
// the markdown and is withheld where the host cannot save; this one reads what is already there.
// His ask, 2026-11-11: *"I want voice on the document right-click menu… I want to be able to just
// listen."* Withholding it on a read-only document would withhold it from exactly the documents
// most worth hearing — another project's RFC, a report he is reviewing.
describe("listening is offered wherever there is something to read", () => {
  const onBlock = { start: 12, end: 14, label: "a paragraph" };

  it("is offered on a block even when nothing can be saved or threaded", () => {
    const offers = menuOffers(onBlock, { canThread: false, canAddMember: false, canRegister: false });
    expect(offers.listen).toBe(true);
    // and the menu still says WHY its editing verbs are absent — listening does not paper over that
    expect(offers.startThread).toBe(false);
    expect(offers.note).toBe("no-save");
  });

  it("is offered inside a thread too", () => {
    expect(menuOffers({ ...onBlock, thread: { start: 1, end: 20 } }, { canThread: true }).listen).toBe(true);
  });

  it("is NOT offered off every block — there is nothing to read", () => {
    expect(menuOffers({}, { canThread: true }).listen).toBe(false);
  });
});
