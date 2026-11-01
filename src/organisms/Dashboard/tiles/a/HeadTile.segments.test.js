// ─── THE HEAD RENDERS WHATEVER THE HEAD DERIVATION RETURNS ─────────────────────────────────────
//
// `owedHead` grew five outstanding segments the day the lump was broken up — *"of course I want to
// filter by obligations, and add more obligations up there"* — and it carries an explicit promise
// that a `why` nobody has written a word for STILL arrives, under the old bucket key, because an
// undercount reads as RESOLVED and that is the one thing these numbers may never say.
//
// A head that switched on the keys it could see would honour that promise in the derivation and
// break it on the screen. So the fold is replaced here and the real `HeadTileA` is driven with a
// segment list nothing in this repo has ever produced: if it can draw that one and press it by
// its own key, it can draw whatever comes next.
import React from "react";
import { render, screen } from "@testing-library/react";

let mockFold;
jest.mock("./fold", () => ({ useFold: () => mockFold }));

// eslint-disable-next-line import/first
import HeadTileA from "./HeadTile";

const setOnly = jest.fn();
const foldWith = (segs, over = {}) => ({
  all: {
    head: { segs, unread: 0 },
    totals: { registered: 2, read: 2, projects: 1, live: 1, fixtures: 0, endings: 0 },
  },
  d: null,
  fixtures: false,
  setFixtures: jest.fn(),
  open: jest.fn(),
  only: null,
  setOnly,
  filtering: false,
  ...over,
});

beforeEach(() => setOnly.mockClear());

it("draws a segment kind it has never met, with the derivation's own words", () => {
  mockFold = foldWith([
    { key: "approval", flag: "⚑", text: "2 approvals waiting", keys: ["a", "b"] },
    { key: "somethingNobodyHasNamed", flag: "", text: "7 of a thing with no word yet", keys: ["c"] },
  ]);
  render(<HeadTileA data={{ read: true }} />);
  const segs = [...document.querySelectorAll(".dba__gauge .dba-tile")];
  expect(segs.map((s) => s.textContent)).toEqual(["⚑2 approvals waiting", "7 of a thing with no word yet"]);
  // and the class is the key, so a hue can be given to a new kind later without touching this file
  expect(segs[1].className).toContain("is-somethingNobodyHasNamed");
});

it("presses an unfamiliar segment by its own key, never by a list it knew in advance", () => {
  mockFold = foldWith([{ key: "undecidable", flag: "", text: "2 drafts nothing can decide", keys: ["c", "d"] }]);
  render(<HeadTileA data={{ read: true }} />);
  document.querySelector(".dba__gauge .dba-tile").click();
  expect(setOnly).toHaveBeenCalledWith("undecidable");
});

it("renders every one of owedHead's five outstanding kinds, not just the ones with a hue", () => {
  const five = ["mine", "blocked", "unplanned", "undecidable", "claims"];
  mockFold = foldWith(five.map((key, i) => ({ key, flag: "", text: `${i + 1} ${key}`, keys: [String(i)] })));
  render(<HeadTileA data={{ read: true }} />);
  expect(document.querySelectorAll(".dba__gauge .dba-tile")).toHaveLength(5);
  for (const key of five) expect(document.querySelector(`.dba-tile.is-${key}`).tagName).toBe("BUTTON");
});

// A CONTROL THAT FILTERS TO THE EMPTY SET IS A CONTROL THAT LIES ABOUT HAVING ONE. `owedHead`
// emits "nothing owed" with no keys behind it precisely so a surface can tell the difference.
it("leaves a segment with nothing behind it as a plain box", () => {
  mockFold = foldWith([{ key: "clear", flag: "", text: "nothing owed", keys: [] }]);
  render(<HeadTileA data={{ read: true }} />);
  const seg = document.querySelector(".dba__gauge .dba-tile");
  expect(seg.tagName).toBe("DIV");
  expect(seg).not.toHaveAttribute("aria-pressed");
  expect(screen.getByText("nothing owed")).toBeInTheDocument();
});

it("fills exactly the held one, whatever kind it is", () => {
  mockFold = foldWith(
    [
      { key: "blocked", flag: "", text: "3 blocked", keys: ["a"] },
      { key: "claims", flag: "", text: "2 claim sets resting on nothing", keys: ["b"] },
    ],
    { only: "claims" },
  );
  render(<HeadTileA data={{ read: true }} />);
  expect(document.querySelector(".dba-tile.is-blocked").className).not.toContain("is-held");
  expect(document.querySelector(".dba-tile.is-claims").className).toContain("is-held");
  expect(document.querySelector(".dba-tile.is-claims")).toHaveAttribute("aria-pressed", "true");
});
