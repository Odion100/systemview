import React from "react";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import CodebaseNav from "./CodebaseNav";
import { setHub } from "../../utils/hub";

// THE TREE LOADS A FOLDER AT A TIME. This is the behaviour the whole change exists for, and it is
// invisible from the outside until it is wrong: a tree that walks the entire repo on mount looks
// identical to one that does not, right up to the repo where the walk hits its cap and the tail —
// his CHANGED files, as it happened — silently stops existing.
//
// So what is asserted here is WHAT WAS ASKED OF THE HUB, not just what ended up on screen.

// A repo whose interesting file is two folders down, where a capped walk would never reach it.
const SHALLOW = {
  "": [
    { name: "src", path: "src", dir: true },
    { name: "README.md", path: "README.md", dir: false },
  ],
  src: [
    { name: "deep", path: "src/deep", dir: true },
    { name: "App.js", path: "src/App.js", dir: false },
  ],
  "src/deep": [{ name: "Tail.js", path: "src/deep/Tail.js", dir: false }],
};

let asked;
const makeHub = (over = {}) => ({
  SystemView: {
    listFiles: async (_p, { dir, shallow } = {}) => {
      const key = dir === "." || !dir ? "" : dir;
      if (shallow) {
        asked.shallow.push(key);
        return { ok: true, dir: key, shallow: true, entries: SHALLOW[key] || [], truncated: false };
      }
      asked.deep.push(key);
      return { ok: true, dir: key, files: [], truncated: false };
    },
    searchFiles: async (_p, opts) => {
      asked.search.push(opts);
      return opts.names
        ? { ok: true, names: true, results: [{ path: "src/deep/Tail.js" }], truncated: false }
        : { ok: true, results: [] };
    },
    changedFiles: async () => ({ ok: true, files: [] }),
    gitState: async () => ({ ok: true, repo: true, branch: "main", log: [], staged: [], unstaged: [], untracked: [] }),
    readFile: async () => ({ ok: false, error: "no such file" }),
    ...over,
  },
});

const draw = (props = {}) =>
  render(
    <MemoryRouter>
      <CodebaseNav
        connectedServices={[{ projectCode: "p", serviceId: "S", root: "/repo" }]}
        projectCode="p"
        openFile={null}
        onOpenFile={() => {}}
        showHelp={false}
        {...props}
      />
    </MemoryRouter>,
  );

beforeEach(() => {
  // jsdom has no layout, so it has no scrollIntoView — the tree calls it whenever a row is revealed.
  window.HTMLElement.prototype.scrollIntoView = () => {};
  asked = { shallow: [], deep: [], search: [] };
  localStorage.clear();
  setHub(makeHub());
});

describe("the codebase tree loads a folder at a time", () => {
  it("reads the ROOT and nothing else on mount — a folder nobody opened is never walked", async () => {
    draw();
    await screen.findByText("src");
    expect(screen.getByText("README.md")).toBeInTheDocument();
    // The thing that must NOT have happened: src (or anything under it) being read unasked.
    expect(asked.shallow).toEqual([""]);
    expect(screen.queryByText("App.js")).not.toBeInTheDocument();
  });

  it("opening a folder fetches it ONCE — closing and reopening does not ask again", async () => {
    draw();
    fireEvent.click(await screen.findByText("src"));
    await screen.findByText("App.js");
    expect(asked.shallow).toEqual(["", "src"]);
    fireEvent.click(screen.getByText("src")); // closed
    fireEvent.click(screen.getByText("src")); // open again
    await screen.findByText("App.js");
    expect(asked.shallow.filter((d) => d === "src")).toHaveLength(1);
  });

  it("REVEALING a deep file loads the folders on the way down — this is how a changed file in the tail becomes reachable", async () => {
    draw({ reveal: { kind: "file", projectCode: "p", path: "src/deep/Tail.js" } });
    // Nothing was loaded under src at mount; the reveal is what pulls both levels in.
    expect(await screen.findByText("Tail.js")).toBeInTheDocument();
    expect(asked.shallow).toEqual(expect.arrayContaining(["", "src", "src/deep"]));
  });

  it("a QUERY goes to disk by name — the answer is not limited to the folders already open", async () => {
    draw();
    await screen.findByText("src");
    fireEvent.change(screen.getByPlaceholderText("filter files…"), { target: { value: "tail" } });
    // src/deep was never opened, so a local filter could not possibly find this row.
    expect(await screen.findByText("src/deep/Tail.js")).toBeInTheDocument();
    await waitFor(() => expect(asked.search.length).toBeGreaterThan(0));
    expect(asked.search[0]).toMatchObject({ query: "tail", names: true });
    expect(asked.shallow).toEqual([""]);
  });

  it("says where a filtered list came from, instead of letting it read as the whole repo", async () => {
    draw();
    await screen.findByText("src");
    fireEvent.change(screen.getByPlaceholderText("filter files…"), { target: { value: "tail" } });
    expect(await screen.findByText(/from disk/)).toBeInTheDocument();
  });

  it("names the folder that hit the cap — not the repo", async () => {
    setHub(
      makeHub({
        listFiles: async (_p, { dir, shallow } = {}) => {
          const key = dir === "." || !dir ? "" : dir;
          if (!shallow) return { ok: true, dir: key, files: [], truncated: false };
          return { ok: true, dir: key, shallow: true, entries: SHALLOW[key] || [], truncated: key === "src" };
        },
      }),
    );
    draw();
    fireEvent.click(await screen.findByText("src"));
    expect(await screen.findByText(/over 4000/)).toHaveTextContent("src");
  });
});
