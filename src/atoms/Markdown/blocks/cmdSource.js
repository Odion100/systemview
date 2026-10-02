// THE `:::cmd` GRAMMAR, on its own — pure parsing, no React, no transport — so the tests (and
// anything else that wants to know what a block would run) can read it without pulling the block in.
// Same shape as `runSteps.js`, and for the same reason.
//
// The grammar is deliberately the smallest one that can exist: **the body IS the command**, kept
// verbatim. There is no step syntax, no substitution, no variables. A document that explains a
// command should carry that command CHARACTER FOR CHARACTER, or the thing you press stops being the
// thing you read.
//
//   :::cmd{title="Rebuild the bundle"}
//   BUILD_PATH=build.next ./node_modules/.bin/react-scripts build && mv build.next build
//   :::
//
// ONE ACCOMMODATION, because everyone writes it anyway: a body wrapped in a fenced code block is
// unwrapped. An agent reaching for "show a shell command" types ``` by reflex, and a block that ran
// ```` ```bash ```` as its first line would be a trap.

// A fence is ``` or ~~~ with an optional info string (```bash, ```sh, ```console).
const FENCE = /^\s*(`{3,}|~{3,})\s*[^\n]*$/;

// Leading/trailing blank lines are formatting, never command.
function trimBlank(lines) {
  let a = 0;
  let b = lines.length;
  while (a < b && !lines[a].trim()) a += 1;
  while (b > a && !lines[b - 1].trim()) b -= 1;
  return lines.slice(a, b);
}

// The command a `:::cmd` block would run, exactly as written. Multi-line survives: the build
// incantation is one line, but a three-line sequence is a normal thing to want and joining it with
// `;` would change what it means.
export function parseCommand(src) {
  let lines = trimBlank(String(src || "").split("\n"));
  if (lines.length >= 2 && FENCE.test(lines[0])) {
    const open = (lines[0].match(/`{3,}|~{3,}/) || [""])[0][0];
    const close = lines.findIndex((l, i) => i > 0 && new RegExp(`^\\s*\\${open}{3,}\\s*$`).test(l));
    lines = trimBlank(lines.slice(1, close > 0 ? close : undefined));
  }
  return lines.join("\n");
}

// What the block shows on its face when there is no title: the first non-comment line, shortened.
// A 130-character build incantation makes a useless heading, and the whole command is on screen
// underneath it anyway.
export function summarize(command, max = 60) {
  const first = String(command || "")
    .split("\n")
    .map((l) => l.trim())
    .find((l) => l && !l.startsWith("#")) || "";
  return first.length > max ? `${first.slice(0, max - 1)}…` : first;
}

// Is there anything to run? A block holding only comments or whitespace renders inert rather than
// offering a button that would do nothing.
export function isRunnable(command) {
  return !!summarize(command);
}

export default parseCommand;
