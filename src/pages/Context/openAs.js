// WHICH DOOR A DOCUMENT OPENS THROUGH — the decision, out of the render so it can be tested. This
// page cannot be mounted in jest (it reaches the markdown renderer, which is ESM), so a rule left
// inline in the JSX is a rule nothing can check.
//
// IF IT IS A FILE, POINT AT THE FILE. *"You can pull up that file and that will work everywhere."*
// The alternative is what this replaced: the text rode in the page's memory while the tab store
// persisted only the open set, so a refresh or a back/forward restored the TAB with nothing in it
// and the pane said the content lived behind a save door. A path is re-read; there is nothing to
// restore and nothing to lose.
//
// WHAT STAYS BEHIND THE DOOR is only what cannot be a file tab: a document with no file (the
// definition prompt, the def record), and one that must not be edited — a machine file tab has no
// read-only mode, and a skill the scan marked `writable: false` sits in a folder the CLI replaces
// on its next upgrade, so offering the edit would be offering a write that gets thrown away.
export const fileForDoc = (d) => {
  if (!d || d.readOnly) return "";
  // `path` is the explicit one: a skill carries it from the scan, a job is built from its dir.
  // `where` is the older spelling — presence, the system context and the CLAUDE.md stack put their
  // absolute path there, and a help row may too.
  const p = String(d.path || ((d.kind === "doc" || d.kind === "help") && d.where) || "");
  return p.startsWith("/") || p.startsWith("~/") ? p : "";
};
