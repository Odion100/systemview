import fs from "fs";
import path from "path";
import { FLOOR } from "./docEdit";

// THE PARITY CLAIM — one rule, two parsers, and nothing in the build makes them agree.
//
// `api/` is CommonJS and `src/` is ESM under react-scripts: CRA's ModuleScopePlugin forbids
// src→api, and package.json's `files` forbids api→src. So every rule about the document format
// exists TWICE, and three separate drift bugs landed in a single day because of it — a reply verb
// that could not see a thread carrying members, a teaching error handing back swollen ids, and
// this one, where the window wrote a width the reply verb could never match.
//
// A shared module is not available. What IS available is reading the other side's source off disk
// and asserting the rule, which is what this does. It fails the moment either side moves — which
// is the only thing that was missing.
const apiSource = () =>
  fs.readFileSync(path.join(__dirname, "..", "..", "..", "api", "reports.js"), "utf8");

describe("the window and the reply verb agree about a thread's fence", () => {
  it("api/reports.js still states the floor in the shape this claim reads", () => {
    expect(apiSource()).toMatch(/const THREAD_OPEN = \/\^\(:\{\d,\}\)thread/);
  });

  it("the window's floor is exactly the one the reply verb requires", () => {
    const m = /const THREAD_OPEN = \/\^\(:\{(\d+),\}\)thread/.exec(apiSource());
    expect(m).toBeTruthy();
    expect(FLOOR.thread).toBe(Number(m[1]));
  });

  // The id list the teaching error hands back is a SECOND copy of the same rule inside the same
  // file, and it has already drifted from the opener once.
  it("the reply verb's own two copies of the rule agree with each other", () => {
    const src = apiSource();
    const opener = /const THREAD_OPEN = \/\^\(:\{(\d+),\}\)thread/.exec(src);
    const idList = /matchAll\(\/\(:\{(\d+),\}\)thread/.exec(src);
    expect(opener).toBeTruthy();
    expect(idList).toBeTruthy();
    expect(idList[1]).toBe(opener[1]);
  });
});
