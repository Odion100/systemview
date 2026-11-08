import { useEffect } from "react";
import { list as listProofs } from "../../../utils/proofsBus";
import useEffectiveProject from "../../../utils/effectiveProject";
import { useInEmbed } from "../context";

// OPENING A DOCUMENT LOADS ITS SPECS INTO THE PANEL.
//
// HIS DESIGN: "when you open a spec document, the tests load right away… you click on the document
// and it should be loading the test." A run button on the leaf was the first attempt and is gone —
// "there's no reason to run the spec from the document anymore, now that all it has to do is load in
// the test panel." So this renders nothing; it is a trigger riding the leaf, which is the one
// control every registered document already has and which already knows the id, project and
// inventory.
//
// MOUNT IS THE SIGNAL, and that is a fact about this window rather than an assumption: only the
// ACTIVE document is in the DOM (counted live — one leaf, with eight tabs open), so switching tabs
// unmounts one leaf and mounts another, and this effect fires exactly when a document comes into
// view. An earlier version compared the URL's `?file=` against the document's path to decide whether
// it was "the one on screen"; that gate was written to stop a thrash which turned out to be an
// unrelated retry loop, and all it actually did was stop the panel loading when you switched tabs.
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
  const has = !!(id && projectCode && !quoted);
  useEffect(() => {
    if (has) listProofs(projectCode, { document: id });
  }, [has, id, projectCode]);
  return null;
};

export default DocProofs;
