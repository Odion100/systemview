// FILES ARE THE HUB'S — AND NOTHING MAY GATE THEM ON THE SHELL BRIDGE.
//
// `hostFiles` used to route through `window.systemview.files`, so a `hasHostFiles()` test before
// touching files made sense. It stopped routing through it — every verb asks the hub now — and the
// guard quietly became a question about the wrong mechanism, answering NO in any window that is
// not the Electron shell. A plain browser tab on the hub is an ordinary way to use this package.
//
// IT HAS BEEN WRITTEN TWICE AND COST A SURFACE BOTH TIMES: the report picker sat permanently empty,
// and the board sat on "opening…" under the invented line "no live service for this project" while
// the code pane beside it read files perfectly well.
//
// This is a SOURCE assertion, deliberately, and the reason is not convenience: the two surfaces
// that carried the guard — `Board` and `AgentChat` — cannot be mounted in this suite at all
// (react-markdown is ESM outside `transformIgnorePatterns`), and the failure mode is not a
// rendering bug. It is somebody writing the guard back in a third place, which no amount of
// rendering the other two would catch.
import fs from "fs";
import path from "path";

const SRC = path.join(__dirname, "..");

const walk = (dir) =>
  fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) return e.name === "node_modules" ? [] : walk(p);
    return /\.jsx?$/.test(e.name) ? [p] : [];
  });

const files = walk(SRC);

it("no module asks whether the shell bridge is present before using files", () => {
  const guilty = files
    .filter((f) => !/hostFiles\.callsites\.test\.js$/.test(f))
    .filter((f) => /hasHostFiles/.test(fs.readFileSync(f, "utf8")))
    // A COMMENT SAYING WHY THE GUARD IS ABSENT IS THE OPPOSITE OF THE FAULT, so a file whose only
    // mention is in a comment passes. What fails is a CALL.
    .filter((f) => /hasHostFiles\s*\(/.test(fs.readFileSync(f, "utf8").replace(/\/\/[^\n]*/g, "")));
  expect(guilty.map((f) => path.relative(SRC, f))).toEqual([]);
});

it("hostFiles exports no shell-bridge test for anyone to reach for", () => {
  const src = fs.readFileSync(path.join(SRC, "utils/hostFiles.js"), "utf8");
  expect(src).not.toMatch(/export\s+(const|function)\s+hasHostFiles/);
});

// WHAT IS STILL ALLOWED, so this file is not read as "the shell bridge is forbidden": `writeFile`
// touches `window.systemview` AFTER a successful hub write, to tell the shell to parse the document
// (RFC-073 §3). That is an announcement, not a gate — the file is already written, and outside the
// shell there is simply no announcement. The fault was never using the bridge; it was asking the
// bridge for PERMISSION to use the hub.
