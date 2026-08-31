import React from "react";

// A LAZY CHUNK THAT SURVIVES A REBUILD. Every build deletes the previous chunk files, so a tab still
// on the old bundle that opens a ::test or ::logs embed asks for a chunk that no longer exists —
// and React.lazy leaves it on "loading…" for good (his report: embeds "say loading and just stay,
// or couldn't load — refresh and it loads"). When the import fails, ask the hub which bundle is
// current: if it moved, this tab is stale and the self-update's reload is the fix, taken now
// instead of at the next poll; if it did not, it was a blip — try once more.
const reloadFresh = async () => {
  try {
    await fetch(window.location.href, { cache: "reload", credentials: "same-origin" });
  } catch {}
  window.location.reload();
};

export default function lazyLoad(importer) {
  return React.lazy(() =>
    importer().catch(async (err) => {
      try {
        const res = await fetch("/sv-bundle");
        const { bundle } = await res.json();
        const mine = (document.querySelector('script[src*="static/js/main."]') || {}).src || "";
        if (bundle && !mine.includes(bundle)) {
          await reloadFresh();
          return new Promise(() => {}); // the reload takes it from here
        }
      } catch {}
      await new Promise((r) => setTimeout(r, 1200));
      return importer().catch(() => {
        throw err;
      });
    }),
  );
}
