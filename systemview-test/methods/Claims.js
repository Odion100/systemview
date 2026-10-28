// THE CLAIMS MODULE AS A DOOR — the real functions, their real return values, and NO assertions.
//
// This exists because of a defect he found by reading the specs rather than the code: every one of
// the 31 saved specs was a SINGLE call to a `Proofs.*` method that performed the test INSIDE itself
// and handed back a bag of booleans. `growProof` returned
// `{leafBecomesContainer: true, statementSurvivesVerbatim: true, …}` — eight judgements made in
// JavaScript I wrote, with the spec file asserting eight `true`s. His words: *"some method for
// implementation or just a method for test? Wouldn't you just call whatever methods are being
// used?"* — and the honest answer is that the wrapper was grading its own homework, so the evidence
// could not be read from the document at all.
//
// MEASURED, the same night: ours 31 specs, 0 with a `Before` step. buAPI Basketball 53 specs, 12
// multi-step, up to 4 steps; Profiles 86 specs, 11 multi-step, up to 6. Identical format. The
// chapter names buAPI as the model BY NAME for "the implementation walk — the steps a user actually
// takes", and we implemented the half that needs no reader.
//
// So: every method here is a pass-through. It takes a real input, calls the real exported function
// from `src/atoms/Markdown/claims.js`, and returns what that function returned. A caller cannot tell
// this module anything and cannot be told anything by it except the truth of the module under test.
// The assertions move OUT, into the spec file, where they are visible to whoever reads the document.
//
// THE RULE THIS ENFORCES: no comparison that answers the SPEC's question. Guarding a bad input
// (`typeof source !== "string"`) is this module's own business and stays; deciding whether the
// statement survived, whether the count is right, whether the no-op happened — that is the
// question being asked, and the moment it is answered in here it stops being readable out there.
const fs = require("fs");
const path = require("path");

const REPO = path.resolve(__dirname, "..", "..");

// The real module, compiled off disk on every call — ESM, so a hosted CommonJS service cannot
// `require` it, and a copy would be a second implementation that agrees with nothing.
function claimsModule() {
  const abs = path.join(REPO, "src/atoms/Markdown/claims.js");
  const { transformSync } = require("@babel/core");
  const { code } = transformSync(fs.readFileSync(abs, "utf8"), {
    babelrc: false,
    configFile: false,
    filename: abs,
    plugins: [require.resolve("@babel/plugin-transform-modules-commonjs")],
  });
  const m = { exports: {} };
  new Function("exports", "require", "module", "__filename", "__dirname", code)(
    m.exports,
    require,
    m,
    abs,
    path.dirname(abs),
  );
  return m.exports;
}

module.exports = {
  // START A WALK FROM A REAL FILE. Any claim about a document on disk begins here, so the spec's
  // first step is "read the actual file" rather than a fixture I typed into the method.
  async readDoc({ path: rel } = {}) {
    if (!rel) return { ok: false, error: "path is required (repo-relative)" };
    const abs = path.join(REPO, String(rel));
    try {
      const source = fs.readFileSync(abs, "utf8");
      return { ok: true, path: rel, lines: source.split("\n").length, source };
    } catch (err) {
      return { ok: false, path: rel, error: String((err && err.message) || err) };
    }
  },

  // parseClaims, verbatim. Every claim in the source with its line, ordinal, statement, mark and
  // whether it carries a proof — the array the window itself renders from.
  async parse({ source } = {}) {
    if (typeof source !== "string") return { ok: false, error: "source is required (a string)" };
    return { ok: true, claims: claimsModule().parseClaims(source) };
  },

  // claimsOf, verbatim — the counter behind the bar: total, met, unmet, unchecked, reviewed,
  // behavioral, experiential, specd, owed. Takes a `path` so a spec's first step can be "parse the
  // real document" without a 40KB source string travelling through a reference to get here.
  async bar({ source, path: rel } = {}) {
    let src = source;
    if (typeof src !== "string" && rel) {
      try {
        src = fs.readFileSync(path.join(REPO, String(rel)), "utf8");
      } catch (err) {
        return { ok: false, path: rel, error: String((err && err.message) || err) };
      }
    }
    if (typeof src !== "string") return { ok: false, error: "source or path is required" };
    return { ok: true, path: rel || null, ...claimsModule().claimsOf(src) };
  },

  // growProof, verbatim. `source` comes back as the REWRITTEN document, or null when the line was
  // not a leaf claim — null IS the answer for a no-op, not an error, and the spec asserts the type.
  async grow({ source, line } = {}) {
    if (typeof source !== "string") return { ok: false, error: "source is required (a string)" };
    const grown = claimsModule().growProof(source, Number(line));
    return { ok: true, line: Number(line), source: grown };
  },

  // claimAt and ordinalOf, verbatim.
  async at({ source, line } = {}) {
    if (typeof source !== "string") return { ok: false, error: "source is required (a string)" };
    const c = claimsModule().claimAt(source, Number(line));
    return { ok: true, line: Number(line), claim: c };
  },
  async ordinal({ source, line } = {}) {
    if (typeof source !== "string") return { ok: false, error: "source is required (a string)" };
    return { ok: true, line: Number(line), n: claimsModule().ordinalOf(source, Number(line)) };
  },

  // normalizeKind and normalizeState, verbatim — the two readers behind "silence means behavioural"
  // and "only these spellings are states".
  async kindOf({ raw } = {}) {
    return { ok: true, raw: raw === undefined ? null : raw, kind: claimsModule().normalizeKind(raw) };
  },
  async stateOf({ raw } = {}) {
    return { ok: true, raw: raw === undefined ? null : raw, state: claimsModule().normalizeState(raw) };
  },
};
