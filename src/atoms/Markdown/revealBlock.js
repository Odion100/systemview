// GO TO THE THING THIS ROW IS ABOUT.
//
// His, 2026-10-19, of the pinned update pills: *"the hovering update chip has the label for the
// thread — it says t3. I want it, if you click the label, or if you click everything but the chip
// for the agent, it navigates you to that thread."* The corner says a conversation moved; the next
// thing you want is to be IN it, and a pill that only sends is a notice you have to go act on
// somewhere else.
//
// EVERY BLOCK ALREADY CARRIES ITS LINE — `data-md-start`, written by the renderer so the document
// menu can target a block. That is the address, so there is nothing new to thread through: the
// pill knows the line it would write `sent=` to, which is the line the block is on.
export const FLASH_MS = 1600;
export const FLASH_CLASS = "md-block--revealed";

export const blockNodeFor = (root, line) => {
  if (!root || !line) return null;
  try {
    return root.querySelector(`[data-md-start="${Number(line)}"]`) || null;
  } catch {
    return null;
  }
};

// Scrolls it into view and flashes it, then takes the mark off again. Returns the node it found —
// null when the document on screen is not the one the row is about, which is a real case (the pin
// renders per document, but a surface can re-render underneath it) and must never throw.
export const revealBlock = (root, line, { flashMs = FLASH_MS, now = null } = {}) => {
  const el = blockNodeFor(root, line);
  if (!el) return null;
  // jsdom has no scrollIntoView, and neither does a detached node — the flash is the part that
  // matters for a claim, so the scroll is attempted and never required.
  try {
    if (typeof el.scrollIntoView === "function") el.scrollIntoView({ block: "center", behavior: "smooth" });
  } catch {}
  try {
    el.classList.add(FLASH_CLASS);
    const off = () => el.classList.remove(FLASH_CLASS);
    if (typeof now === "function") now(off);
    else setTimeout(off, flashMs);
  } catch {}
  return el;
};
