import React, { createContext, useContext, useMemo, useState } from "react";
import dashboard from "../../../DashboardA/dashboardA.data";
import { openDoc } from "../../dashboardData";

// ─── A'S FOLD — THE DERIVATION, SHARED WHEN THE TILES STAND TOGETHER ───────────────────────────
//
// `dashboardData.js` owns the READ. This owns A's reading OF it, which is a different thing and
// still A's: `dashboard()` folds the rows into phases, marks, lanes and the owed halves, and it is
// A's answer rather than the surface's. The contract says a tile may bring its own derivation —
// what it may not bring is its own hub read, and there is none here.
//
// BUT THE TOGGLE IS SHARED OR THE PAGE IS A LIAR. `show the 11 proof fixtures` lives in the head
// tile and changes what the owed list and the project lanes are allowed to count. Three tiles each
// holding their own copy of that switch would give him a header that says eleven fixtures are
// showing over lanes that are still hiding them — the same class of disagreement the one-read rule
// exists to stop, one layer up.
//
// So: a fold the page provides once, and the identical fold computed locally by any tile that
// finds no provider. A tile dropped on the configurable surface on its own still works and still
// has its own switch; three tiles inside `<DashboardAFold>` share one switch and one derivation.
//
// TWO FOLDS WHEN A HEAD SEGMENT IS HELD, AND ONLY THEN. The surface narrows `docs` when he presses
// a gauge segment, and every ordinary tile wants the narrowed set — but the head does not: a head
// counting its own filtered answer turns "4 approvals waiting" into "4 of 4" and takes away the
// only thing that said there were ever more. So `d` is the narrowed reading and `all` is the whole
// one, and while nothing is held they are the SAME OBJECT — the second fold is paid for only when
// it says something different.

const FoldContext = createContext(null);

// Stable identities, so a tile handed no data at all does not re-fold on every render.
const EMPTY_ROWS = [];
const EMPTY_ROOTS = {};
const NO_FILTER = () => {};

/**
 * A's derivation over the surface's rows — NO READ, NO TIMER, NOTHING BUT A FOLD OVER WHAT IT WAS
 * HANDED.
 *
 * `skip` is not an optimisation flourish — a tile inside the provider still has to call this
 * (hooks run unconditionally or they run wrong), and folding forty documents four times per
 * render to throw three of the answers away is a real cost on a page that redraws on a clock.
 */
function useOwnFold(data, { skip = false } = {}) {
  const docs = (data && data.docs) || EMPTY_ROWS;
  // An older provider hands no `allDocs`. Then there is no filter either, and the whole set IS
  // what it handed over — never an empty head over a full page.
  const allDocs = (data && data.allDocs) || docs;
  const roots = (data && data.roots) || EMPTY_ROOTS;
  const [fixtures, setFixtures] = useState(false);

  // THE CLOCKS COUNT, AND THE SURFACE IS WHAT COUNTS THEM. A stack saying "retires in 4 hours"
  // tomorrow would be worse than a stack with no clock on it, so the fold has to re-run as the
  // words go stale — but it re-runs on `data.beat`, the surface's own minute, rather than on a
  // timer of A's. This page used to own that timer; three tiles each owning one is exactly the
  // drift the single read was moved upstairs to stop, and one render a minute for the whole
  // surface is cheaper than any of them.
  const beat = (data && data.beat) || 0;
  const d = useMemo(
    () => (skip ? null : dashboard({ docs, roots, now: Date.now(), fixtures })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [docs, roots, fixtures, beat, skip],
  );
  // THE SAME FOLD OVER THE WHOLE SET — the head's, and the head's only. Identity-compared rather
  // than reading `data.filtering`, so an unnarrowed surface pays for exactly one fold whether or
  // not it has ever heard of a filter.
  const all = useMemo(
    () => (allDocs === docs || skip ? d : dashboard({ docs: allDocs, roots, now: Date.now(), fixtures })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [d, allDocs, docs, roots, fixtures, beat, skip],
  );

  return useMemo(
    () => ({
      d,
      all,
      fixtures,
      setFixtures,
      open: (data && data.open) || openDoc,
      // THE FILTER IS THE SURFACE'S, NEVER A TILE'S. A head on a provider that does not offer one
      // simply has nothing to press, and `setOnly` is a no-op rather than a crash.
      only: (data && data.only) || null,
      setOnly: (data && data.setOnly) || NO_FILTER,
      filtering: !!(data && data.filtering),
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [d, all, fixtures, data],
  );
}

/** Wrap A's tiles in this to give them one derivation and one fixtures switch between them. */
export const DashboardAFold = ({ data, children }) => {
  const fold = useOwnFold(data);
  return <FoldContext.Provider value={fold}>{children}</FoldContext.Provider>;
};

/**
 * What every A tile starts with: `{ d, all, fixtures, setFixtures, open, only, setOnly,
 * filtering }`. Shared when the page put a fold above it, its own when nothing did.
 *
 * `d` is the reading a section draws. `all` is the same reading over everything, and it is the
 * head's — nothing else should touch it.
 */
export function useFold(data) {
  const shared = useContext(FoldContext);
  const own = useOwnFold(data, { skip: !!shared });
  return shared || own;
}

export default useFold;
