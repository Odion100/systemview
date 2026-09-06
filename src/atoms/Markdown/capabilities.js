import React, { createContext, useContext, useMemo } from "react";

// RFC-053 — THE SEAM. A block is a capability, and the HOST says which capabilities exist.
//
// Every data-reaching block used to import SystemView's service layer directly — `hostFiles`,
// `loadService`, `ServiceContext` — which is the one thing that makes this vocabulary un-portable.
// The audit that opened RFC-053: the renderer core imports nothing from the app, 8 of 19 blocks
// import nothing either, and ALL of the coupling is six files reaching around the registry into the
// application they happen to be sitting in.
//
// So blocks ask HERE instead:
//
//   const files = useCapability("files");        // (projectCode) => a file reader, or null
//   if (!files) …                                // this host doesn't grant it — say so, don't break
//
// Three things fall out of the one seam, which is why it's this and not an adapter per block:
//
//   PORTABILITY — nothing in the registry knows what app it is in. SystemView resolves through the
//   hub; the browser resolves through Electron; the block is identical in both.
//
//   PERMISSION — his requirement, in his words: *"the browser should be able to define certain
//   things that users can access."* The capability bag IS the access model. A host that grants no
//   `git` does not get a commit button it then has to disable; the block renders inert because the
//   capability was never there. No second mechanism, no list of feature flags to keep in step.
//
//   HONEST FAILURE — a missing capability is a stated absence. "This surface can't read files" is a
//   true sentence; a spinner that never resolves is not.
//
// THE BAG IS NOT A GRAB-BAG. Each key is a narrow verb-set the blocks already speak:
//
//   files(projectCode)      readFile / listFiles / getDiff / stageHunk / stageFiles / discardFiles
//   git(projectCode)        state / commit / push
//   services()              the connected services a `:ns[…]` resolves against
//   stats(projectCode)      the snapshot charts draw from
//   tests(projectCode)      saved tests a `::test` runs
//
// Absent keys are ABSENT, not empty objects — `useCapability` returns null and the block decides
// what to say. An empty stub would make "not granted" indistinguishable from "granted but broken".
//
// ABSENT IS NOT DENIED (autobot's addition, and they're right — it's the difference between two
// opposite sentences that render identically otherwise):
//
//   absent  — this host never wired it. "The browser can't do this yet."
//   denied  — this host wired it and is withholding it from YOU. "You can't do this here."
//
// A host marks the second by passing `DENIED` for the key. Blocks that only need to know whether
// they can act keep using `useCapability`; blocks that SAY something to the reader ask
// `useCapabilityState` and word it honestly.
export const DENIED = { __denied: true };

const Capabilities = createContext(null);

export function MarkdownCapabilitiesProvider({ value, children }) {
  // One identity per bag, or every consumer re-runs on each paint — the same stable-identity rule
  // that cost us a render loop in FileEmbed (6,500 reads in five seconds, measured).
  const stable = useMemo(
    () => value || null,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [value && value.files, value && value.git, value && value.services, value && value.stats, value && value.tests],
  );
  return <Capabilities.Provider value={stable}>{children}</Capabilities.Provider>;
}

// The one accessor. `null` means the block cannot act — for whatever reason. A block that merely
// needs to know whether it can work stops here.
export function useCapability(name) {
  const bag = useContext(Capabilities);
  const found = bag && bag[name];
  return !found || found === DENIED ? null : found;
}

// …and a block that has to TELL the reader why asks for the reason. Three states, three sentences.
export function useCapabilityState(name) {
  const bag = useContext(Capabilities);
  const found = bag && bag[name];
  if (found === DENIED) return "denied";
  return found ? "granted" : "absent";
}

export function useCapabilities() {
  return useContext(Capabilities) || {};
}
