import fs from "fs";
import path from "path";

// A THEME TOKEN THAT DOES NOT EXIST FAILS SILENTLY, WHICH IS WHY THIS IS A TEST AND NOT A REVIEW.
//
// `var(--sv-text-muted)` renders perfectly: the token is undefined, so the fallback is
// used, and the fallback was written in light mode. In dark mode that is dark text on a dark
// surface — found 2026-11-01 when an expanded commit's body could not be read without selecting
// it, and the token turned out never to have existed. Sixteen more were in the same state.
//
// Nothing in the toolchain catches this. Sass does not resolve custom properties, the browser has
// no error for an unknown one, and the page looks finished. So the check has to be a source read.

const SRC = path.join(__dirname, "..");
const scss = [];
(function walk(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p);
    else if (e.name.endsWith(".scss")) scss.push(p);
  }
})(SRC);

const defined = new Set();
const used = new Map();
for (const file of scss) {
  const text = fs.readFileSync(file, "utf8");
  for (const m of text.matchAll(/(--sv-[a-z0-9-]+)\s*:/g)) defined.add(m[1]);
  for (const m of text.matchAll(/var\(\s*(--sv-[a-z0-9-]+)/g)) {
    if (!used.has(m[1])) used.set(m[1], new Set());
    used.get(m[1]).add(path.relative(SRC, file));
  }
}

// THE DEBT IS PAID — what remains is not debt. The sixteen phantoms this list once carried were
// swept 2026-11-08: eleven were second names for ramp concepts and were repointed (--sv-dim,
// --sv-text-soft and --sv-text-dim to --sv-text-muted; --sv-line and --sv-border-faint to
// --sv-border-soft; --sv-row-hover and --sv-hover-strong to --sv-hover; --sv-surface-soft to
// --sv-inset; --sv-bg-raised and --sv-panel to --sv-surface; --sv-mono to the literal stack), and
// --sv-amber / --sv-accent were real concepts, defined in BOTH halves at the values their fallbacks
// already rendered.
//
// These two are DYNAMIC ELEMENT VARIABLES, not theme tokens and not debt: a component sets each
// inline per element (SpeakReply writes --sv-buffered as a percent; CodebaseNav writes --sv-tree-max
// as a pixel height) and the stylesheet's var() default is the at-rest state. The theme must NOT
// define them — a :root value would leak one element's state to every sibling.
const DYNAMIC = ["--sv-buffered", "--sv-tree-max"];

// ── THE REDS, WHICH WERE THE WORST OF THE DEBT ─────────────────────────────────────────────────
//
// His card: *"there is no danger colour in the theme, so three places invent one."* By 2026-11-07 it
// was four: `--sv-danger` and `--sv-red` sat on the list above, each reference carrying its own
// hardcoded fallback — which is the only reason nothing broke — and `#a2503f` was written out TEN
// times across three files because there was nothing to reach for.
//
// THREE TOKENS, NOT ONE, because they say three different things: a destructive verb, a failure that
// happened, and a thing that cannot go anywhere. Each landed at the value its fallback already used,
// so naming them moved nothing on screen.
//
// A HEX LITERAL IS A LITERAL, which is what makes a grep a SOUND check here — unlike a cascade
// collision, which needs compiled selectors before anything can be called a fight.
const REDS = { "--sv-danger": "#c0504d", "--sv-red": "#e5534b", "--sv-dead": "#a2503f" };

describe("the theme owns every red", () => {
  const theme = fs.readFileSync(path.join(SRC, "sass", "theme.scss"), "utf8");
  const others = scss.filter((f) => !f.endsWith(path.join("sass", "theme.scss")));

  it("defines all three, so no reference depends on a fallback", () => {
    Object.entries(REDS).forEach(([token, hex]) => expect(theme).toContain(`${token}: ${hex};`));
    expect(defined.has("--sv-danger")).toBe(true);
    expect(defined.has("--sv-red")).toBe(true);
    expect(defined.has("--sv-dead")).toBe(true);
  });

  it("and nothing else writes one of those hexes, or carries a fallback that re-states it", () => {
    const offenders = others
      .map((f) => [path.relative(SRC, f), [...fs.readFileSync(f, "utf8").matchAll(/#(c0504d|e5534b|a2503f)/gi)].length])
      .filter(([, n]) => n > 0);
    expect(offenders).toEqual([]);
  });

  // THE TOKEN TRAP THIS SHARES A FAMILY WITH: the markdown stylesheet redefines theme tokens inside
  // its own scope, so `--sv-text-faint` is grey in the theme and GREEN in the markdown dark block —
  // a name that looks shared and is not. These three may be redefined by nobody.
  it("and nobody redefines one, so the name means one colour everywhere", () => {
    const redefined = others
      .map((f) => [
        path.relative(SRC, f),
        Object.keys(REDS).filter((t) => new RegExp(`${t}\\s*:`).test(fs.readFileSync(f, "utf8"))),
      ])
      .filter(([, hits]) => hits.length > 0);
    expect(redefined).toEqual([]);
  });
});

// THE TWO THAT STOPPED BEING PHANTOMS — pinned the way the reds are, and for a reason this very
// suite measured: the phantom check collects definitions from EVERY stylesheet, so the markdown
// scope's redeclaration of these two SHIELDS the theme's own definition from it — delete them from
// theme.scss and the phantom claim stays green. And nothing pinned the values: both mutations were
// run (a drifted hex, a deleted light-half line) and the suite produced no error at all. These
// claims are what made each go red.
describe("amber and accent are the theme's, in both halves, at the values their fallbacks rendered", () => {
  const theme = fs.readFileSync(path.join(SRC, "sass", "theme.scss"), "utf8");
  const lightHalf = theme.slice(0, theme.indexOf(":root.sv-dark"));
  const darkHalf = theme.slice(theme.indexOf(":root.sv-dark"));
  const PAIR = {
    "--sv-amber": { light: "#c88a2e", dark: "#d89a2b" },
    "--sv-accent": { light: "#6a74c4", dark: "#6c74dd" },
  };

  it("each is defined in the light :root and again in the dark override", () => {
    for (const [token, v] of Object.entries(PAIR)) {
      expect(lightHalf).toContain(`${token}: ${v.light};`);
      expect(darkHalf).toContain(`${token}: ${v.dark};`);
    }
  });

  it("and no stylesheet still carries a fallback for either — a fallback on a defined token is the old bug waiting", () => {
    const offenders = [];
    for (const file of scss) {
      const text = fs.readFileSync(file, "utf8");
      for (const m of text.matchAll(/var\(\s*--sv-(amber|accent)\s*,/g)) offenders.push(`${path.relative(SRC, file)}: ${m[0]}`);
    }
    expect(offenders).toEqual([]);
  });
});

describe("every --sv- token a stylesheet asks for", () => {
  const phantom = [...used.keys()].filter((t) => !defined.has(t)).sort();

  it("is defined in the theme, or is a dynamic element variable a component sets inline", () => {
    const fresh = phantom.filter((t) => !DYNAMIC.includes(t));
    expect(
      fresh.map((t) => `${t} — used in ${[...used.get(t)].join(", ")}`),
    ).toEqual([]);
  });

  // The allowlist is exact, both directions: a dynamic var that stops being used leaves it, and a
  // theme definition for one of these would be a bug (one element's state leaking to every sibling).
  it("and the dynamic list carries exactly the element variables still in use", () => {
    expect(DYNAMIC.filter((t) => !phantom.includes(t))).toEqual([]);
    expect(DYNAMIC.filter((t) => defined.has(t))).toEqual([]);
  });

  // THE ONE THAT WAS ACTUALLY UNREADABLE. `inherit` as a fallback is worse than a bad hex: the
  // text takes whatever the surrounding chrome is, which for a drawer is deliberately quiet.
  it("never falls back to `inherit` for a colour — that inherits the chrome's quiet", () => {
    const bad = [];
    for (const file of scss) {
      const text = fs.readFileSync(file, "utf8");
      for (const m of text.matchAll(/color:\s*var\(\s*--sv-[a-z0-9-]+\s*,\s*inherit\s*\)/g)) {
        bad.push(`${path.relative(SRC, file)}: ${m[0]}`);
      }
    }
    expect(bad).toEqual([]);
  });

  it("and the theme defines the four-step text ramp the rest of the app names", () => {
    for (const t of ["--sv-text", "--sv-text-strong", "--sv-text-muted", "--sv-text-faint"]) {
      expect(defined.has(t)).toBe(true);
    }
  });
});

// THE FOUR KIND COLOURS HAVE ONE SOURCE, and this is what keeps it that way.
//
// They were declared in SIX files with identical hexes — the trail, the how-we-work page, three
// dashboards and the tile legend — and nothing compared them. The drift had already started and
// nobody had seen it: five carried dark-mode values and the legend did not, so in dark mode the
// page's own legend disagreed with every chip it was labelling.
describe("the four kind colours", () => {
  const KINDS = ["rfc", "arc", "gap", "report"];
  const theme = fs.readFileSync(path.join(SRC, "sass", "theme.scss"), "utf8");

  it("are defined in the theme, for both modes", () => {
    for (const k of KINDS) {
      expect(theme.match(new RegExp(`--sv-kind-${k}:\\s*#[0-9a-f]{6}`, "gi"))).toHaveLength(2);
    }
  });

  // THE ASSERTION WITH TEETH: a hex anywhere else means a seventh copy was born.
  it("appear as a literal colour NOWHERE else — a local name may only alias the theme's", () => {
    const strays = [];
    for (const file of scss) {
      if (file.endsWith(path.join("sass", "theme.scss"))) continue;
      const text = fs.readFileSync(file, "utf8");
      for (const m of text.matchAll(/--[a-z]+-(rfc|arc|gap|report):\s*(#[0-9a-fA-F]{3,8})/g)) {
        strays.push(`${path.relative(SRC, file)}: ${m[0]}`);
      }
    }
    expect(strays).toEqual([]);
  });

  it("and every local kind token aliases the theme rather than inventing a value", () => {
    const bad = [];
    for (const file of scss) {
      const text = fs.readFileSync(file, "utf8");
      for (const m of text.matchAll(/--([a-z]+)-(rfc|arc|gap|report):\s*([^;]+);/g)) {
        if (m[1] === "sv" && m[2]) continue;
        if (!/var\(--sv-kind-/.test(m[3])) bad.push(`${path.relative(SRC, file)}: ${m[0]}`);
      }
    }
    expect(bad).toEqual([]);
  });
});

// ── THE DOCUMENT SCOPE'S OWN COPY OF THE TOKENS ────────────────────────────────────────────────
//
// A document is explicitly light or explicitly dark, independent of the app, so `.markdown`
// re-declares the tokens an embedded component reads — that is how a chart inside a light document
// stays light while the app is dark. The whole mechanism depends on the SET being complete: a
// mode-dependent token left out is not a missing style, it is a value that silently reaches past
// the document and takes the APP's, and only when the two modes disagree.
//
// MEASURED 2026-11-07: of the twelve mode-dependent tokens this stylesheet reads, four were not
// redeclared — `--sv-inset`, `--sv-hover`, `--sv-blue`, `--sv-blue-deep`. The card that found it
// named one. Nothing compared the two lists, which is why it had sat since August.
describe("the markdown scope redeclares every mode-dependent token it reads", () => {
  const read = (f) => fs.readFileSync(f, "utf8");
  const theme = read(path.join(SRC, "sass", "theme.scss"));
  const md = read(path.join(SRC, "atoms", "Markdown", "styles.scss"));

  // The brace-matched body of a rule, so a nested block cannot end the scan early.
  const body = (src, open) => {
    const i = src.indexOf("{", src.indexOf(open));
    let depth = 0;
    for (let j = i; j < src.length; j += 1) {
      if (src[j] === "{") depth += 1;
      else if (src[j] === "}") {
        depth -= 1;
        if (depth === 0) return src.slice(i + 1, j);
      }
    }
    return "";
  };
  const declared = (src) => {
    const out = {};
    for (const m of src.matchAll(/(--sv-[\w-]+)\s*:\s*([^;]+);/g)) out[m[1]] = m[2].split("//")[0].trim();
    return out;
  };

  const light = declared(body(theme, ":root {"));
  const dark = declared(body(theme, ":root.sv-dark {"));
  const modeDependent = Object.keys(light).filter((k) => k in dark && light[k] !== dark[k]);

  // The redeclaration is the `.markdown` rule that sets --sv-surface, not the typography rule that
  // shares the class name.
  const scope = body(md, md.slice(0, md.indexOf("--sv-surface: #fff;")).lastIndexOf(".markdown {") >= 0
    ? md.slice(md.slice(0, md.indexOf("--sv-surface: #fff;")).lastIndexOf(".markdown {"))
    : ".markdown {");

  it("there are mode-dependent tokens to protect, and the document scope redeclares the ones it reads", () => {
    expect(modeDependent.length).toBeGreaterThan(10);
    const usedHere = new Set([...md.matchAll(/var\((--sv-[\w-]+)/g)].map((m) => m[1]));
    // THE LIGHT HALF SPECIFICALLY. Scanning the whole scope would count a token that exists only in
    // the dark block as covered — and that asymmetry is its own bug, which the next claim owns.
    const lightHalf = scope.replace(body(scope, "&--dark {"), "");
    const inScope = new Set([...lightHalf.matchAll(/(--sv-[\w-]+)\s*:/g)].map((m) => m[1]));
    const missing = modeDependent.filter((k) => usedHere.has(k) && !inScope.has(k));
    expect(missing).toEqual([]);
  });

  it("and the dark half redeclares exactly what the light half does — an asymmetry IS the bug", () => {
    const darkHalf = body(scope, "&--dark {");
    const lightNames = [...scope.replace(darkHalf, "").matchAll(/(--sv-[\w-]+)\s*:/g)].map((m) => m[1]).sort();
    const darkNames = [...darkHalf.matchAll(/(--sv-[\w-]+)\s*:/g)].map((m) => m[1]).sort();
    expect(darkNames).toEqual(lightNames);
  });
});
