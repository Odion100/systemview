import { parseBoard, parseTitle, serializeBoard, stateOf, STATES, DONE, REPORT_KINDS } from "./boardFormat";
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
  "a card declaring what the work owes": '<!--card 1014 by=you title="the report pills" report=spec-->\nthe ask\n',
  "a declaration with a status under it": "<!--card 1015 by=you report=audit-->\nthe ask\n<!--status by=systemview-test ts=1016-->\npartial — half of it landed\n",
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

// `reviewed` is a WORD, read off the front of the account like every other state — not something
// the surface works out for itself. Both copies, or the panel and the hub disagree about who read
// what.
describe("the reviewed state", () => {
  it("is read off the account in both copies", () => {
    expect(stateOf("reviewed — this is about the hook he wants after a commit")).toBe("reviewed");
    expect(hub.stateOf("reviewed — this is about the hook he wants after a commit")).toBe("reviewed");
  });
  it("is not finished — a clear must never take it", () => {
    expect(DONE).toEqual(["resolved"]);
    expect(hub.DONE).toEqual(["resolved"]);
    expect(STATES).toEqual(hub.STATES);
  });
});

// THE DECLARATION — what the work on this card owes, written before the work starts. It is set by
// the hub door and by an agent as well as by his press, so the panel is not the only writer: a
// `report=` this copy could not read would be one his next keystroke silently un-declares.
describe("the card's report declaration", () => {
  const FILE = "<!--card 20 by=you report=spec-->\nthe ask\n";
  it("parses out of the stamp in both copies", () => {
    expect(parseBoard(FILE)[0].report).toBe("spec");
    expect(hub.parseBoard(FILE).cards[0].report).toBe("spec");
  });
  it("round-trips byte for byte, in both copies", () => {
    expect(serializeBoard(parseBoard(FILE), "")).toBe(FILE);
    expect(hub.serializeBoard(hub.parseBoard(FILE))).toBe(FILE);
  });
  it("is ABSENT on a card nobody has declared for — undeclared is a real state, not an empty word", () => {
    const old = "<!--card 21 by=you-->\nraw off the recorder\n";
    expect("report" in parseBoard(old)[0]).toBe(false);
    expect("report" in hub.parseBoard(old).cards[0]).toBe(false);
    expect(serializeBoard(parseBoard(old), "")).toBe(old);
  });
  // The pills are a closed list; the FIELD is not. An agent may declare a kind no pill draws yet,
  // and the panel must carry that word through rather than normalising it to something it knows.
  it("carries a word that is not one of the pills", () => {
    const odd = "<!--card 22 by=you report=postmortem-->\nthe ask\n";
    expect(parseBoard(odd)[0].report).toBe("postmortem");
    expect(serializeBoard(parseBoard(odd), "")).toBe(odd);
  });
  it("offers the reports chapter's kinds, and never the one that was cut", () => {
    expect(REPORT_KINDS).toEqual(["planning", "account", "audit", "brief", "spec"]);
    expect(REPORT_KINDS).not.toContain("notice");
  });
});
