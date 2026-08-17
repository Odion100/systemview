// WHERE A NAME COMES FROM — the small amount of "understanding" the search needs, in one place so
// the editor's marks and the pane's trace button can never disagree about the same line. No parser
// and no index: a handful of shapes that JavaScript actually writes, and an honest "don't know".
//
// His catch, and the reason this file exists: a DESTRUCTURED import spanning several lines
//
//     import {
//       changeMarksOf,
//       hunksOf,
//     } from "./gitLines";
//
// has no `from` on the line the name is on, so anything line-based sees a bare word and offers you
// nothing — which is exactly the case you hit most in real code.

export const escapeRe = (t) => String(t).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// Every `import { … } from "x"` and `const { … } = require("x")` in the text, with the OFFSETS of
// what's between the braces — so a name can be tested by position rather than by line.
export function importBlocks(text) {
  const src = String(text || "");
  const out = [];
  const forms = [
    /import\s*\{([\s\S]*?)\}\s*from\s*['"]([^'"]+)['"]/g,
    /(?:const|let|var)\s*\{([\s\S]*?)\}\s*=\s*require\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
  ];
  forms.forEach((re) => {
    let m;
    while ((m = re.exec(src))) {
      const inner = m[1];
      const at = m.index + m[0].indexOf(inner);
      out.push({ from: at, to: at + inner.length, spec: m[2], members: inner });
    }
  });
  return out;
}

// The name a member is known by in the OTHER file: `import { a as b }` means chase `a` over there.
export function originalName(members, term) {
  const m = String(members || "").match(new RegExp(`\\b([A-Za-z_$][\\w$]*)\\s+as\\s+${escapeRe(term)}\\b`));
  return m ? m[1] : term;
}

// What does this line do with the name? `decl` — it is declared here. `import` — it arrives here from
// somewhere else. `use` — it is merely used. The distinction matters twice over: in a file, an import
// IS where the name comes from; across a project, the declaration is, and the import is a signpost.
export function kindOfLine(term, line) {
  const q = escapeRe(term);
  const decl = [
    new RegExp(`\\b(?:const|let|var)\\s+${q}\\b`),
    new RegExp(`\\bfunction\\s*\\*?\\s*${q}\\b`),
    new RegExp(`\\bclass\\s+${q}\\b`),
    new RegExp(`\\bexport\\b[^\\n]*\\b${q}\\b`),
    new RegExp(`\\b${q}\\s*[:=]\\s*(?:async\\s*)?(?:function\\b|\\(|[A-Za-z_$][\\w$]*\\s*=>)`),
  ];
  if (decl.some((r) => r.test(line))) return "decl";
  if (new RegExp(`\\b(?:import|require)\\b[^\\n]*\\b${q}\\b`).test(line)) return "import";
  return "use";
}

// WHICH WORD IS THIS, more precisely: `function`, `const`, `class`, `import`… Used for the hover, so
// "1 def" can say what kind of thing it found without the label growing a vocabulary of its own.
export function declWord(term, line) {
  const q = escapeRe(term);
  if (new RegExp(`\\bfunction\\s*\\*?\\s*${q}\\b`).test(line)) return "function";
  if (new RegExp(`\\bclass\\s+${q}\\b`).test(line)) return "class";
  if (new RegExp(`\\b${q}\\s*[:=]\\s*(?:async\\s*)?(?:function\\b|\\(|[A-Za-z_$][\\w$]*\\s*=>)`).test(line))
    return "function";
  if (new RegExp(`\\b(?:const|let|var)\\s+${q}\\b`).test(line)) return "const";
  return "definition";
}

// IS THIS HIT INSIDE A STRING? A path like `"./utils/mcp.mjs"` contains the very name you searched
// for, so the import line scored TWO definitions for one definition — his catch. Counting quotes
// before the column is crude and it is right for the case that actually bites.
export function insideString(lineText, col) {
  const before = String(lineText).slice(0, col);
  const singles = (before.match(/(^|[^\\])'/g) || []).length;
  const doubles = (before.match(/(^|[^\\])"/g) || []).length;
  const backs = (before.match(/(^|[^\\])`/g) || []).length;
  return singles % 2 === 1 || doubles % 2 === 1 || backs % 2 === 1;
}

// Everything the search knows about one hit, in one call: is it in a string, what does its line do
// with the name, and — if it arrives by a destructured import — which file it comes from.
export function classifyHit(text, blocks, term, offset, lineText, col) {
  if (insideString(lineText, col)) return { kind: "use", str: true };
  const block = blocks.find((b) => offset >= b.from && offset <= b.to);
  if (block) return { kind: "import", spec: block.spec, name: originalName(block.members, term) };
  const kind = kindOfLine(term, lineText);
  return { kind, word: kind === "decl" ? declWord(term, lineText) : undefined };
}
