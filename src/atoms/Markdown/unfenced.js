// A FENCED BLOCK IS A QUOTATION, NOT A DECLARATION — one definition, because three line scanners
// need it and two of them had their own copy.
//
// It was learned the hard way by `objectives.js`: the first real arc document also EXPLAINED the
// vocabulary, so it carried a ```markdown example of an `::objective` — and the line scan counted
// the example. `::progress` read 8 where `::timeline` read 7. `claims.js` carried the identical
// four lines, and `facilitation.js`'s approval scan carried none at all, which is why a document
// teaching `:::approval` inside a fence would have read as a document holding a decision. This
// repo's RFCs quote their own vocabulary constantly, so that is not a hypothetical.
//
// BLANKED, NEVER REMOVED, and that is the whole reason this is not a filter: a press writes back by
// LINE NUMBER, so every line has to stay exactly where it was. The fenced lines keep their
// newlines and lose their content.
const FENCED = /^(`{3,}|~{3,})[^\n]*\n[\s\S]*?^\1[^\n]*$/gm;

export const unfenced = (src) => String(src || "").replace(FENCED, (m) => m.replace(/[^\n]/g, ""));

export default unfenced;
