// ONE RULE FOR EVERY REFERENCE CHIP — where a click LANDS.
//
// His ruling: *"reports and namespaces should not — and this is not just the links panel, in
// general — they should be using the side panel, they shouldn't be navigating me back to the code
// tab."* `:file[…]` already worked that way: it dispatches, and whatever side panel the page owns
// answers (`useOpenedFile` → `DocPanel` on Stats and Agents). `:report[…]` and `:ns[…]` pushed
// history instead — from Stats or Agents that threw the whole window over to Code and took the page
// he was reading with it.
//
// The rule below is not new. It is the one AgentChat's TV already wrote for its "open this report"
// button; it lived in one button, so every other surface kept re-deciding. Lifted here, the chips
// share it and it is defined once:
//
//   ON the Code page  (/specs/…) — navigate. That page's job IS showing these, and a file opened
//                     there navigates too (`SystemView.openFile` flips the centre to `tab=docs`).
//                     Matching what files do on the page you are standing on beats symmetry with
//                     the other pages.
//   OFF the Code page — offer it to the side panel this page owns. Navigate ONLY if nothing
//                     answered, so a page with no panel (Agents, RFC-055) still works.
//
// "Nothing answered" is not a guess. A listener that TAKES a reference marks the detail `handled`
// — `useOpenedFile` has done that since the TV button needed to know — and `dispatchEvent` is
// synchronous, so every listener has run by the time it returns.
//
// NOTHING HERE TOUCHES THE URL. Panel state is the page's, exactly as it already is for files;
// `?rdoc=` keeps meaning "the report open in the Code page's centre" and `?file=` keeps being the
// only writer of the Code page's file. A chip that opens a panel pushes no history entry, because
// nothing moved — back still walks the places you actually went.

export const onCodePage = (pathname = window.location.pathname) =>
  pathname.startsWith("/specs/");

// Dispatch, then ask whether a panel took it. The copy is deliberate: the listener writes `handled`
// onto the detail it is given, and we need a reference to that same object to read the answer.
const offer = (name, detail) => {
  const d = { ...detail };
  window.dispatchEvent(new CustomEvent(name, { detail: d }));
  return d.handled === true;
};

// A REPORT IS A FILE — `.systemview/report.<projectCode>.<slug>.md`, and the index is bookkeeping.
// So it rides the door files already ride and lands in the panel files already land in, instead of
// needing a second one built beside it.
export const openReportInPanel = (detail) =>
  offer("sv:openFileInNav", { language: "markdown", ...detail });

// A NAMESPACE IS NOT A DOCUMENT, so there is no doc panel for it and inventing one to be symmetric
// would be a fourth surface nobody asked for. The only thing that draws a namespace is the codebase
// tree — on the Code page that is the navigator, and off it, the one the bot carries. A reveal is
// what that tree understands (expand to it, mark it), and it only counts as answered if a tree that
// is actually on screen took it.
export const revealNamespaceInPanel = (detail) =>
  offer("sv:revealInNav", { kind: "namespace", ...detail });
