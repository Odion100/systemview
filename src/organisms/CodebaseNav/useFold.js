import { useEffect, useState } from "react";

// ONE FOLD, EVERY SECTION. The card's head chevron collapses and expands the whole project; it
// used to reach into each section by hand (services, code — and the terminal was simply missed,
// then the next section would have been too; his catch). Every section of the card holds its open
// state through THIS hook, and the hook obeys the head's bulk fold itself — so a section is in the
// sweep the moment it exists, with nothing to remember.
//
//   const [open, flip] = useFold(`sv.cbNav.code2.${projectCode}`, true, bulk);
//
// `bulk` is the card's { n, mode } — a new `n` is a new sweep; collapse closes, expand opens.
export default function useFold(key, defaultOpen, bulk) {
  const [open, setOpen] = useState(() => {
    try {
      const saved = localStorage.getItem(key);
      if (saved !== null) return saved === "true";
    } catch {}
    return typeof defaultOpen === "function" ? defaultOpen() : !!defaultOpen;
  });
  const set = (v) => {
    setOpen(v);
    try { localStorage.setItem(key, String(v)); } catch {}
  };
  useEffect(() => {
    if (!bulk) return;
    set(bulk.mode === "expand");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bulk && bulk.n]);
  return [open, () => set(!open), set];
}
