import { parseBoard, parseTitle, serializeBoard, stateOf, STATES, DONE } from "./boardFormat";
// THE OTHER IMPLEMENTATION. The window cannot IMPORT from `api/` at build time (CRA's module scope
// stops at `src/`) and the hub cannot import from `src/` (it is not in the published package), so
// the format exists twice on purpose — and jest, which is not webpack, can reach both. That is the
// whole trick that makes this file possible.
const hub = require("../../../api/board");

// WHY THIS TEST EXISTS AT ALL. The panel holds the entire board in memory and rewrites the entire
// file on every keystroke-triggered save, so a field it fails to parse is a field it DELETES.
// Replies learned that the hard way (they used to vanish); statuses would have been next. Drift
// between these two copies is data loss, not inconsistency — so it is pinned here.
const FIXTURES = {
  "a plain card": "<!--card 1000 by=you-->\njust a note\n",
  "a card with no author (the old form)": "<!--card 1001-->\nwritten before writers were stamped\n",
  "a card with a status": "<!--card 1002 by=systemview-test-->\nthe ask\n<!--status by=systemview-test ts=1003-->\nimplemented — the band is tabs now\n",
  "a card with a conversation": "<!--card 1004 by=you-->\nthe ask\n<!--reply by=systemview-test ts=1005-->\nfirst\n<!--reply by=you ts=1006-->\nsecond\n",
  "a card with both, status first": "<!--card 1007 by=you-->\nthe ask\n<!--status by=systemview-test ts=1008-->\nanswered — cause in the gap file\n<!--reply by=you ts=1009-->\nthanks\n",
  "markdown, angle brackets and em dashes in every slot": "<!--card 1010 by=you-->\n`a < b` **and** a — dash\n<!--status by=systemview-test ts=1011-->\nimplemented — `x > y` holds\n",
  "a titled board with two cards": "# my board\n\n<!--card 1012 by=you-->\none\n\n<!--card 1013 by=you-->\ntwo\n",
};

describe("the board's two implementations of its own file format agree", () => {
  Object.entries(FIXTURES).forEach(([what, file]) => {
    it(`parses the same: ${what}`, () => {
      const mine = parseBoard(file);
      const theirs = hub.parseBoard(file).cards;
      expect(mine).toEqual(theirs);
    });

    it(`serializes the same: ${what}`, () => {
      const cards = parseBoard(file);
      const title = parseTitle(file);
      expect(serializeBoard(cards, title)).toEqual(hub.serializeBoard({ title, cards }));
    });

    it(`round-trips byte for byte: ${what}`, () => {
      expect(serializeBoard(parseBoard(file), parseTitle(file))).toEqual(file);
    });
  });

  // The two claims that are about the format itself rather than about agreement.
  it("reads a status as ONE slot — a file with two keeps the last", () => {
    const file = "<!--card 1-->\nc\n<!--status ts=1-->\nold\n<!--status ts=2-->\nnew\n";
    expect(parseBoard(file)[0].status.text).toBe("new");
    expect(hub.parseBoard(file).cards[0].status.text).toBe("new");
  });

  it("leaves the status field ABSENT on a card that has none, in both", () => {
    const file = "<!--card 1-->\nno account yet\n";
    expect("status" in parseBoard(file)[0]).toBe(false);
    expect("status" in hub.parseBoard(file).cards[0]).toBe(false);
  });

  it("never mistakes a status for a reply, even when they say the same thing", () => {
    const file = "<!--card 1-->\nc\n<!--status by=a ts=5-->\nsame words\n<!--reply by=a ts=5-->\nsame words\n";
    const card = parseBoard(file)[0];
    expect(card.status.text).toBe("same words");
    expect(card.replies.map((r) => r.text)).toEqual(["same words"]);
    expect(card).toEqual(hub.parseBoard(file).cards[0]);
  });
});

// THE STATE IS PARSED, NOT STORED — so the two copies must read the same word off the same line or
// the panel's view of "finished" disagrees with the hub's, which is the number a bulk clear runs on.
describe("the state at the front of an account", () => {
  const CASES = [
    ["resolved — reports are a band tab now", "resolved"],
    ["resolved: cause written into the gap file", "resolved"],
    ["Partial — the panel half only", "partial"],
    ["blocked", "blocked"],
    ["the agent door works end to end", null],
    ["resolved-ish, sort of", null],
    ["", null],
  ];
  it.each(CASES)("reads %p as %p in both copies", (line, want) => {
    expect(stateOf(line)).toBe(want);
    expect(hub.stateOf(line)).toBe(want);
  });
  it("rides on the parsed status in both copies, and survives a round trip", () => {
    const file = "<!--card 9 by=you-->\nthe ask\n<!--status by=systemview-test ts=10-->\npartial — the panel half only\n";
    expect(parseBoard(file)[0].status.state).toBe("partial");
    expect(hub.parseBoard(file).cards[0].status.state).toBe("partial");
    expect(serializeBoard(parseBoard(file), "")).toBe(file);
  });
  it("agrees on which states count as finished — the vocabulary cannot drift", () => {
    expect(STATES).toEqual(hub.STATES);
    expect(DONE).toEqual(hub.DONE);
  });
});

// THE TITLE IS A FIELD ON THE STAMP, and this panel rewrites the whole file on every save — so a
// title it cannot parse is a title his next keystroke deletes. Both copies, same bytes.
describe("the card's title", () => {
  const FILE = '<!--card 11 by=me title="the status picker"-->\nthe ask\n';
  it("parses out of the stamp in both copies", () => {
    expect(parseBoard(FILE)[0].title).toBe("the status picker");
    expect(hub.parseBoard(FILE).cards[0].title).toBe("the status picker");
    expect(parseBoard(FILE)[0].by).toBe("me");
    expect(hub.parseBoard(FILE).cards[0].by).toBe("me");
  });
  it("round-trips byte for byte, in both copies", () => {
    expect(serializeBoard(parseBoard(FILE), "")).toBe(FILE);
    expect(hub.serializeBoard(hub.parseBoard(FILE))).toBe(FILE);
  });
  it("leaves an untitled card exactly as it was — nothing already on disk moves", () => {
    const old = "<!--card 12 by=me-->\nplain\n";
    expect(serializeBoard(parseBoard(old), "")).toBe(old);
    expect(hub.serializeBoard(hub.parseBoard(old))).toBe(old);
    expect("title" in parseBoard(old)[0]).toBe(false);
  });
});
