import fs from "fs";
import path from "path";

// A THEME TOKEN THAT DOES NOT EXIST FAILS SILENTLY, WHICH IS WHY THIS IS A TEST AND NOT A REVIEW.
//
// `var(--sv-text-dim, #5a6378)` renders perfectly: the token is undefined, so the fallback is
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

// THE KNOWN DEBT, NAMED IN FULL. Sixteen tokens that are referenced and never defined, each
// rendering a hardcoded fallback instead. They are listed rather than quietly tolerated because a
// cap nobody can see reads as coverage — the point of the list is that it may only SHRINK, and the
// assertion below is what makes a new one impossible to add by accident.
const KNOWN_PHANTOM = [
  "--sv-accent", "--sv-amber", "--sv-bg-raised", "--sv-border-faint", "--sv-buffered",
  "--sv-dim", "--sv-hover-strong", "--sv-line", "--sv-mono", "--sv-panel",
  "--sv-row-hover", "--sv-surface-soft", "--sv-text-soft", "--sv-tree-max",
];

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

describe("every --sv- token a stylesheet asks for", () => {
  const phantom = [...used.keys()].filter((t) => !defined.has(t)).sort();

  it("is defined in the theme, or is one of the sixteen already known", () => {
    const fresh = phantom.filter((t) => !KNOWN_PHANTOM.includes(t));
    expect(
      fresh.map((t) => `${t} — used in ${[...used.get(t)].join(", ")}`),
    ).toEqual([]);
  });

  // The list is a debt, not a licence: a token that gets defined or repointed must leave it, or
  // the list stops describing anything and starts excusing everything.
  it("and the known list carries nothing that has since been fixed", () => {
    expect(KNOWN_PHANTOM.filter((t) => !phantom.includes(t))).toEqual([]);
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
