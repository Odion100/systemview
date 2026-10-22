// WHAT TO QUEUE BEHIND THE ONE HE PRESSED. *"If I go back and I click, the queue should be showing
// multiple things ahead of it."*
//
// IT IS ADDITIVE, AND THE LAST ATTEMPT WAS NOT. That one held a flag — "we are catching up" — and
// muted auto-speech while it was set. Nothing cleared the flag reliably, so one press silenced
// every reply that followed, and the silence said nothing about why. A press is a MOMENT: it reads
// the order once, queues what comes next, and keeps no state at all. There is nothing to get stuck.
//
// A reply arriving later simply joins the back of the line, which is the behaviour he asked for
// anyway: *"sometimes you're five different replies ahead, I'm five back"* — he wants them in
// order, not the newest first.
const makers = new Map();

// ALL OF THEM, NOT A HANDFUL. The first version queued three, and the only argument for three was
// that a long list would climb the conversation it sits over — which is now the list's own problem
// and it scrolls. His question was the right one: is there a technical difficulty? There is not.
//
// AN ITEM IS A CLOSURE, NOT AUDIO. `make()` returns `{key, label, start}` — a small object and a
// 70-character label — and nothing is synthesized until the queue calls `start()` on the item it
// has reached. So thirty queued replies are thirty closures, not thirty voice loads, and `Feed`
// renders every row anyway (no virtualization), so every one of them is registered and reachable.
//
// The limit stays as a PARAMETER because "read me the next few" is a thing a caller might
// legitimately want; it just is not the default.
export const AHEAD = Infinity;

/** A reply says how to speak itself. The speaking stays in `SpeakReply`; this only knows WHICH. */
export const register = (key, make) => {
  if (!key || typeof make !== "function") return () => {};
  makers.set(key, make);
  return () => {
    if (makers.get(key) === make) makers.delete(key);
  };
};

/**
 * The items for the rows after `key`, in rendered order.
 * `order` is passed in rather than read here — the chat owns the list, and a module that reached
 * into the DOM itself would be untestable and wrong about which chat it was looking at.
 */
export const behind = (key, order, ahead = AHEAD) => {
  const keys = Array.isArray(order) ? order : [];
  const at = keys.indexOf(key);
  if (at === -1) return [];
  const out = [];
  for (let i = at + 1; i < keys.length && out.length < ahead; i += 1) {
    const make = makers.get(keys[i]);
    if (!make) continue; // a row with nothing speakable is skipped, never a dead end
    const item = make();
    if (item) out.push(item);
  }
  return out;
};
