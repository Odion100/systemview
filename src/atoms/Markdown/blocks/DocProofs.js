import { useEffect } from "react";
import { list as listProofs } from "../../../utils/proofsBus";
import useEffectiveProject from "../../../utils/effectiveProject";
import { useInEmbed, useShown } from "../context";

// OPENING A DOCUMENT LOADS ITS SPECS INTO THE PANEL.
//
// HIS DESIGN: "when you open a spec document, the tests load right away… you click on the document
// and it should be loading the test." A run button on the leaf was the first attempt and is gone —
// "there's no reason to run the spec from the document anymore, now that all it has to do is load in
// the test panel." So this renders nothing; it is a trigger riding the leaf, which is the one
// control every registered document already has and which already knows the id, project and
// inventory.
//
// BEING SELECTED IS THE SIGNAL — `useShown`, which the centre sets per pane.
//
// Mount used to be the signal, on the grounds that only the active document is ever in the DOM.
// That stopped being true in two ways at once: a hidden tab keeps its pane mounted so its scroll
// position survives, and the centre can now show two documents side by side. His report,
// 2026-11-11: *"the test on the side… it should be whatever document you're selected, because you
// could select the tabs even though you have multiple different panes open."* With nothing
// unmounting, clicking a tab fired no effect at all and the panel kept the last leaf to render.
//
// Comparing the URL's `?file=` here was tried once and reverted — it was aimed at a thrash that
// turned out to be an unrelated retry loop, and it broke tab switching. This is not that: the
// centre already knows which pane is focused and which tab in it is active, so it says so, and
// this block asks instead of inferring.
//
// LIST, NEVER RUN. Opening a document must not execute anything against a service.
//
// IT CLAIMS THE PANEL EVEN WITH NOTHING TO SHOW, and that is the point rather than an oversight:
// "it's supposed to be switching per document, so if you switch to a document and there's no specs,
// it should be empty." Firing only when this document HAS specs left the previous document's specs
// sitting in the panel under the new document's name — the panel saying one thing while the window
// showed another, which is worse than an empty list.
// A QUOTED LEAF IS NOT AN IDENTITY, SO IT DOES NOT CLAIM THE PANEL. "Mount is the signal" holds
// only while every leaf in the DOM belongs to the document on screen, and a `::file` embed breaks
// that: it renders another file's lines, and if those lines include its leaf, a second leaf mounts
// inside the first document. Measured 2026-11-07 — one open tab, two leaves, the host's three specs
// loading and then losing the panel to the embedded id: *"the test show up for a second and then go
// away."* The embed is right to RENDER the leaf; what it may not do is act with it.
const DocProofs = ({ id, projectCode: given }) => {
  const projectCode = useEffectiveProject(given);
  const quoted = useInEmbed();
  // A document in the OTHER pane, or behind another tab, is on screen without being the one he
  // picked. It loads nothing — the panel belongs to the selection, and two documents claiming it
  // is the race this replaces.
  const shown = useShown();
  const has = !!(id && projectCode && !quoted && shown);
  useEffect(() => {
    if (has) listProofs(projectCode, { document: id });
  }, [has, id, projectCode]);
  return null;
};

export default DocProofs;
