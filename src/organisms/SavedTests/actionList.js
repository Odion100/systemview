// LISTING AN ACTION MAP IS NOT THE SAME AS READING ONE, and the difference cost a count.
//
// `getActionMap` is a LOOKUP map, and it deliberately holds every action under two keys — the
// qualified `TestService.seedSum` and the bare `seedSum` — because a `{ use: … }` reference may be
// stored either way and a lookup must never have to know which form it is holding. Both keys point
// at the SAME object.
//
// So `Object.values(map)` answers with every action twice, and anything that then counts the list
// says eight when there are four. Measured 2026-11-11 in the scratch pad's Actions tab: "Saved
// actions 8" over buildGreeting, buildGreeting, seedSum, seedSum.
//
// The dedupe is by REFERENCE rather than by name, which is what makes it exact: the two entries are
// one object, and two genuinely different actions that happen to share a name (one per service —
// the panel already routes edits by owner for exactly that reason) are two objects and both
// survive, as they must.
export const listActions = (map) => [...new Set(Object.values(map || {}))];

// AN ACTION'S IDENTITY IS ITS SERVICE AND ITS NAME, never its name alone.
//
// Two services in one project may each hold a `seedSum`; the panel knows this, which is why editing
// or deleting one has to find the service whose specs folder holds the file. Keying a rendered list
// by name alone puts two siblings under one key, and React then reuses the first one's DOM and
// state for the second — a fold that opens the wrong card, a run result landing on the wrong row.
//
// Nothing says so out loud: React's duplicate-key warning is development-only, so in the built
// window it is silent.
export const actionKey = (a) => `${(a && a.namespace && a.namespace.serviceId) || ""}.${(a && a.name) || ""}`;
