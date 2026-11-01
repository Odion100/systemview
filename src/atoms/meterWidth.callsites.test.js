// ONE FLOOR, AND NOBODY REINVENTS IT.
//
// `meterWidth.js` exists because five meters had each invented their own minimum — `Math.max(1, …)`,
// `Math.max(2, …)`, `Math.max(3, …)` — all in PERCENT, all different, none of them enough on a short
// bar. His complaint was the symptom: *"you gotta add a minimum size, at least like 10px or
// something minimum to this progress bars — you make him just disappear."*
//
// The module was written and then wired to NOTHING for a day, which is the failure this file
// guards: a floor that exists and is not called is identical, on screen, to no floor at all.
//
// It is a SOURCE assertion, deliberately. Mounting every meter means mounting half the window, and
// the thing that goes wrong here is not a rendering bug — it is somebody writing a width string by
// hand again, in a sixth place, which no amount of rendering the other five will catch.
import fs from "fs";
import path from "path";

const SRC = path.join(__dirname, "..");

const walk = (dir) =>
  fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) return e.name === "node_modules" ? [] : walk(p);
    return /\.jsx?$/.test(e.name) && !/\.test\.jsx?$/.test(e.name) ? [p] : [];
  });

// Every meter whose segment is sized from a count. Each one must hand `fillStyle`/`pctStyle` the
// raw numbers — the floor has to know whether the real value is zero, and a percentage has already
// thrown that away.
const WIRED = [
  "organisms/Dashboard/tiles/a/pieces.js",
  "organisms/Dashboard/tiles/b/HeadTile.js",
  "organisms/DashboardA/DashboardA.js",
  "organisms/DashboardB/DashboardB.js",
  "atoms/Markdown/blocks/Claims.js",
  "organisms/AgentChat/AgentChat.js",
  "organisms/CallStats/CallStats.js",
  "organisms/ContextManager/ContextManager.js",
  "organisms/AgentProfile/AgentProfile.js",
  "organisms/AgentWorkbench/Feed.js",
  "pages/Reports/Reports.js",
  "atoms/Markdown/blocks/Progress.js",
  "atoms/PlanLedger/PlanLedger.js",
];

describe("the segment floor is actually wired", () => {
  it.each(WIRED)("%s sizes its segments through meterWidth", (rel) => {
    const text = fs.readFileSync(path.join(SRC, rel), "utf8");
    expect(text).toMatch(/\b(fillStyle|pctStyle)\s*\(/);
  });

  // THE ANTI-PATTERN, named exactly: an inline template width built from a percentage. That is
  // what every one of these sites looked like, and what the next one would look like.
  //
  // IT COVERS THE WHOLE OF src/ NOW. It was scoped to the dashboards and the claims bar, with a
  // note that eleven more lived in AgentChat, CallStats, Reports, AgentProfile and ContextManager
  // and had not been read — because a test asserting something nobody checked is worse than no
  // test. They have been read: each was a COUNT against a total (done of items, calls against the
  // busiest, a note's reads against the most-read, tokens against the heaviest row), so each takes
  // `fillStyle` with its raw numbers. Four of them had invented their own floors —
  // `Math.max(1, …)`, `Math.max(2, …)`, `Math.max(3, …)`, `Math.max(pct, 1.5)` — all in percent,
  // all different, which is the drift one definition exists to end.
  //
  // `meterWidth.js` itself is exempt: it is the one place allowed to write the percentage, because
  // it is the thing every other site now asks.
  it("nothing in src builds its own width percentage — meterWidth is the only writer", () => {
    const offenders = [];
    for (const file of walk(SRC)) {
      if (file.endsWith(path.join("atoms", "meterWidth.js"))) continue;
      fs.readFileSync(file, "utf8").split("\n").forEach((line, i) => {
        if (/width:\s*`\$\{[^`]*\}%`/.test(line)) offenders.push(`${path.relative(SRC, file)}:${i + 1}`);
      });
    }
    expect(offenders).toEqual([]);
  });
});
