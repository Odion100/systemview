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
];

describe("the segment floor is actually wired", () => {
  it.each(WIRED)("%s sizes its segments through meterWidth", (rel) => {
    const text = fs.readFileSync(path.join(SRC, rel), "utf8");
    expect(text).toMatch(/\b(fillStyle|pctStyle)\s*\(/);
  });

  // THE ANTI-PATTERN, named exactly: an inline template width built from a percentage. That is
  // what every one of the five sites looked like, and what a sixth would look like.
  //
  // SCOPED TO THE DASHBOARD TREE AND THE CLAIMS BAR, which is where his complaint was and the only
  // place I actually read every meter. There are ~11 more inline percentage widths in AgentChat,
  // CallStats, Reports, AgentProfile and ContextManager; some are ratios with no count behind them
  // and legitimately cannot use this. Listing them here as "allowed" without having read them would
  // be the test asserting something nobody checked, so they are a board card instead.
  it("no meter in the dashboards or the claims bar builds its own width percentage", () => {
    const GOVERNED = [path.join(SRC, "organisms", "Dashboard"), path.join(SRC, "organisms", "DashboardA"), path.join(SRC, "organisms", "DashboardB"), path.join(SRC, "organisms", "DashboardC"), path.join(SRC, "atoms", "Markdown", "blocks", "Claims.js")];
    const files = GOVERNED.flatMap((p) => (fs.existsSync(p) ? (fs.statSync(p).isDirectory() ? walk(p) : [p]) : []));
    const offenders = [];
    for (const file of files) {
      fs.readFileSync(file, "utf8").split("\n").forEach((line, i) => {
        if (/width:\s*`\$\{[^`]*\}%`/.test(line)) offenders.push(`${path.relative(SRC, file)}:${i + 1}`);
      });
    }
    expect(offenders).toEqual([]);
  });
});
