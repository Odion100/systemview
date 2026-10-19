import { listReports } from "./reportOps";
import { hostFiles } from "./hostFiles";

jest.mock("./hostFiles");

// THE INDEX IS A CACHE, THE DISK IS THE TRUTH. Every claim here is about that gap: a report filed
// through this door and then deleted by hand, by git, or by a lane's cleanup leaves an index entry
// behind, and a pointer that is offered while the file is gone opens nothing. His report: *"the TV
// button at the top of the chat opens up to files that don't exist anymore."*
const ix = (rows, hidden = []) =>
  JSON.stringify({ sv: rows, ...(hidden.length ? { __hidden: hidden } : {}) });

const door = ({ index, walk }) =>
  hostFiles.mockReturnValue({
    readFile: async () => ({ content: index }),
    listFiles: async () => {
      if (walk === "fails") throw new Error("no listing door here");
      return { files: walk };
    },
  });

describe("listReports — only a report that is really there is offered", () => {
  it("drops an index entry whose file is gone", async () => {
    door({
      index: ix([
        { name: "alive", path: ".systemview/report.sv.alive.md", ts: 2 },
        { name: "deleted", path: ".systemview/report.sv.deleted.md", ts: 1 },
      ]),
      walk: [{ path: ".systemview/report.sv.alive.md", mtime: 2 }],
    });
    const list = await listReports("sv");
    expect(list.map((r) => r.name)).toEqual(["alive"]);
  });

  it("keeps an index entry whose file is on disk", async () => {
    door({
      index: ix([{ name: "alive", path: ".systemview/report.sv.alive.md", ts: 5 }]),
      walk: [{ path: ".systemview/report.sv.alive.md", mtime: 5 }],
    });
    expect((await listReports("sv")).map((r) => r.name)).toEqual(["alive"]);
  });

  // The one that keeps this from being dangerous: a door that cannot answer must not read as
  // "every report was deleted".
  it("prunes NOTHING when the listing itself fails", async () => {
    door({
      index: ix([
        { name: "one", path: ".systemview/report.sv.one.md", ts: 2 },
        { name: "two", path: ".systemview/report.sv.two.md", ts: 1 },
      ]),
      walk: "fails",
    });
    expect((await listReports("sv")).map((r) => r.name)).toEqual(["one", "two"]);
  });

  it("still lists a report that is on disk but never made the index", async () => {
    door({
      index: ix([]),
      walk: [{ path: ".systemview/report.sv.A-walked-in-report.md", mtime: 9 }],
    });
    expect((await listReports("sv")).map((r) => r.name)).toEqual(["A walked in report"]);
  });

  it("leaves a hidden report hidden, file or no file", async () => {
    door({
      index: ix(
        [{ name: "gone-by-hand", path: ".systemview/report.sv.gone-by-hand.md", ts: 3 }],
        [".systemview/report.sv.gone-by-hand.md"],
      ),
      walk: [{ path: ".systemview/report.sv.gone-by-hand.md", mtime: 3 }],
    });
    expect(await listReports("sv")).toEqual([]);
  });

  it("orders newest first, whichever half of the list it came from", async () => {
    door({
      index: ix([{ name: "indexed", path: ".systemview/report.sv.indexed.md", ts: 10 }]),
      walk: [
        { path: ".systemview/report.sv.indexed.md", mtime: 10 },
        { path: ".systemview/report.sv.walked.md", mtime: 20 },
      ],
    });
    expect((await listReports("sv")).map((r) => r.name)).toEqual(["walked", "indexed"]);
  });
});
