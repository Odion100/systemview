// WHICH PROJECT IS ACTUALLY IN VIEW.
//
// The route's project segment is NOT the answer on its own: when nothing is selected the tabs route
// writes the literal sentinel `@none` into it (Documentation.js, Context.js), while the project the
// view is filtered to rides in the `fproj` query parameter. A surface that reads
// `useParams().projectCode` therefore asks about a project called "@none" — which exists nowhere, so
// every lookup comes back empty and the surface reports an ABSENCE instead of a mistake.
//
// Measured: the Proofs panel asked the hub for `@none`, got zero specs with no error, and announced
// that the document on screen had no specs while the hub was answering 1 for that very document.
//
// IT READS `window.location`, NOT `useLocation`. The router's hooks throw outside a <Router>, and
// this is used from markdown blocks that are mounted bare in tests and could be rendered anywhere.
// A capability that makes a component un-mountable is worse than the bug it fixes — and the search
// string is state to be read, which `window.location` answers correctly in a history-API SPA.
export const projectOf = (routeCode, search) => {
  const code = String(routeCode || "").trim();
  if (code && code !== "@none") return code;
  try {
    const q = new URLSearchParams(search || "");
    // `fmachine=1` means the view is pinned to the machine rather than a project — there is
    // genuinely no project then, and saying so beats guessing at one.
    if (q.get("fmachine") === "1") return "";
    return String(q.get("fproj") || "").trim();
  } catch {
    return "";
  }
};

/** The project in view, for a caller that would otherwise trust the route segment alone. */
export default function useEffectiveProject(routeCode) {
  return projectOf(routeCode, typeof window !== "undefined" ? window.location.search : "");
}
