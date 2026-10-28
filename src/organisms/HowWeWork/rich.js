// THE SMALLEST POSSIBLE MARKUP for the page's own copy — `code` and **bold** inside a plain data
// string. It exists because the content lives in a data module (reviewable in one file) and prose
// about a system is unreadable without the ability to name a `::leaf` in a monospace face. Mounting
// the whole Markdown atom for two spans would drag a document renderer — with its save doors,
// comment sidecars and block registry — into a page that has no document.
//
// Deliberately NOT a markdown subset: anything beyond these two is a sign the content wants to be a
// real document instead.
const PATTERN = /(`[^`]+`|\*\*[^*]+\*\*)/g;

/**
 * @param {string} text
 * @returns {{t: "text"|"code"|"bold", v: string}[]} the parts, in order, empties dropped
 */
export function richParts(text) {
  if (text == null) return [];
  return String(text)
    .split(PATTERN)
    .filter((s) => s !== "")
    .map((s) => {
      if (s.length > 1 && s.startsWith("`") && s.endsWith("`")) return { t: "code", v: s.slice(1, -1) };
      if (s.length > 4 && s.startsWith("**") && s.endsWith("**")) return { t: "bold", v: s.slice(2, -2) };
      return { t: "text", v: s };
    });
}
