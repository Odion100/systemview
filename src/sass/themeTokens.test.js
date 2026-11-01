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
  "--sv-danger", "--sv-dim", "--sv-hover-strong", "--sv-line", "--sv-mono", "--sv-panel",
  "--sv-red", "--sv-row-hover", "--sv-surface-soft", "--sv-text-soft", "--sv-tree-max",
];

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
