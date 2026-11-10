import React from "react";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { docKey, owedFrom, owedHead } from "../../../AgentChat/owed";
import { forgetFloor } from "./floor";
import HeadTile from "./HeadTile";
import OwedTile from "./OwedTile";
import StandingTile from "./StandingTile";
import ReportsTile from "./ReportsTile";
import ProjectsTile from "./ProjectsTile";
import { TILES } from "./index";

// ─── B'S TILES ─────────────────────────────────────────────────────────────────────────────────
//
// WHAT IS WORTH PROVING ABOUT A TILE is not that it renders. It is the two things the move from a
// page to a surface could quietly break:
//
//   1. IT DOES NOT READ. The whole point of lifting these out is that five sections on one
//      surface agree, and they can only agree if exactly one of them opens the registry — which
//      is none of them.
//   2. IT STILL SAYS WHAT IT SAID. Every behaviour the page was built around has to survive the
//      extraction: one row per document, the empty station, the stack that fans, every project
//      the hub knows, and the rule under all of them — an unmeasured nothing is not a nothing.
//
// Plus the one thing that is NEW: a head segment filters the whole surface, and the head itself
// is the one thing that must never narrow.

const NOW = 1_700_000_000_000;
const DAY = 86400000;

const doc = (row, text) => ({ row: { project: "p", at: NOW - DAY, ...row }, text });

// An RFC holding an unsigned approval — one PRESS, keyed `approval`.
const WAITING = doc(
  { id: "RFC-001", kind: "rfc", path: "RFCs/RFC-001-a-thing.md", state: { verdict: "approved" } },
  '::rfc{id=RFC-001}\n\n:::approval{ask="Approve the plan?"}\nx\n:::\n',
);

// An arc with an objective of his and a blocked one — TWO outstanding rows on ONE document, which
// is what `groupOwed` exists to fold.
const ARC = doc(
  { id: "ARC-001", kind: "arc", path: "RFCs/arcs/ARC-001-the-work.md", state: { verdict: "approved" } },
  [
    '::arc{id=ARC-001 owner=p title="The work"}',
    "",
    ":::objective{id=O1 state=doing owner=you}",
    "one",
    ":::",
    ':::objective{id=O2 state=blocked owner=p because="the hub has no door for it"}',
    "two",
    ":::",
    "",
  ].join("\n"),
);

// A REAL REPORT DECLARES ITS SUBTYPE — `as=` picked the retention the clock runs on, and it is the
// word an open stack draws a chip for.
const REPORT = (id, { project = "p", retain = "14d", openedAt, as = "account" } = {}) =>
  doc(
    { id, kind: "report", project, path: `.systemview/report.${project}.${id}.md`, openedAt, state: { retain, subtype: as } },
    `::report{id=${id} as=${as} retain=${retain}}\n\n# ${id}\n`,
  );

const ALL = [WAITING, ARC, REPORT("r-one"), REPORT("r-two", { project: "q" })];

/** The shared value the surface hands every tile — the shape `dashboardData.js` publishes. */
const mk = ({ docs = ALL, allDocs, roots = { p: "/p", q: "/q", quietone: "/z" }, ...rest } = {}) => {
  const every = allDocs || docs;
  const owed = owedFrom({ docs, now: NOW });
  const all = owedFrom({ docs: every, now: NOW });
  return {
    read: true,
    error: "",
    docs,
    allDocs: every,
    roots,
    owed,
    allOwed: { ...all, head: owedHead(all) },
    beat: 0,
    open: jest.fn(() => ({ handled: true })),
    only: null,
    setOnly: jest.fn(),
    filtering: docs !== every,
    ...rest,
  };
};

// Each `mk()` makes fresh arrays, so the shared derivation's cache keys apart on its own — but a
// test that reuses one must not inherit another's answer.
beforeEach(() => forgetFloor());

// ─── 1. NOT ONE OF THEM READS ──────────────────────────────────────────────────────────────────

it("no tile opens the registry, reads a file or starts a clock of its own", () => {
  const documentsRegistry = jest.fn(async () => []);
  const projectRoots = jest.fn(async () => ({}));
  const setInterval = jest.spyOn(window, "setInterval");
  const data = mk();
  render(
    <div>
      {TILES.map((t) => (
        <t.Component key={t.kind} data={data} />
      ))}
    </div>,
  );
  expect(documentsRegistry).not.toHaveBeenCalled();
  expect(projectRoots).not.toHaveBeenCalled();
  expect(setInterval).not.toHaveBeenCalled();
  setInterval.mockRestore();
});

// A TILE RENDERED WITH NOTHING SAYS SO. Outside a provider there is no data at all, and the one
// thing it may not do is draw an empty floor — an unmeasured nothing is not a nothing.
it("a tile with no data at all says it is reading, not that there is nothing", () => {
  const { container } = render(<StandingTile data={null} />);
  expect(container.querySelector(".dbb-empty").textContent).toBe("reading the registry…");
  expect(container.querySelector(".dbb-flow")).toBe(null);
});

// EVERY TILE CARRIES THE CONTEXT CLASS, which is not decoration: outside `.dbb` it is the only
// thing supplying `--dbb-rfc` and the rest, and a tile that lost it paints with nothing.
it("every tile wears .dbb-ctx, so its hues and its type come with it", () => {
  const data = mk();
  TILES.forEach((t) => {
    const { container } = render(<t.Component data={data} />);
    expect(container.firstChild).toHaveClass("dbb-ctx");
  });
});

// ─── 2. THE HEAD ───────────────────────────────────────────────────────────────────────────────

describe("the head counts the whole world and filters everything else", () => {
  // THE ONE RULE THAT MAKES THE FILTER USABLE. A head counting the filtered set restates its own
  // press back at itself: press "1 approval waiting" and it becomes "1 of 1", with no way left to
  // see there were ever more.
  it("reads allDocs, so narrowing the surface does not narrow the counts", () => {
    const narrowed = mk({ docs: [WAITING], allDocs: ALL, only: "approval" });
    render(<HeadTile data={narrowed} />);
    // the arc's two outstanding obligations are still counted, though no section below shows them
    expect(screen.getByText("1 objective yours")).toBeInTheDocument();
    expect(screen.getByText("1 blocked")).toBeInTheDocument();
    // and the tide is still a picture of all four documents
    expect(screen.getByLabelText(/1 waiting on you, 1 outstanding, 2 clear/)).toBeInTheDocument();
  });

  // THE SEGMENTS ARE WHATEVER `owedHead` HANDS BACK — never a list this file knows in advance.
  // Outstanding is broken out by what the work IS, and it will learn more kinds.
  it("draws a segment per obligation kind, not one lump", () => {
    render(<HeadTile data={mk()} />);
    ["1 approval waiting", "1 objective yours", "1 blocked"].forEach((t) =>
      expect(screen.getByText(t)).toBeInTheDocument(),
    );
  });

  it("a segment with items behind it is a button, and pressing it narrows the surface by that key", () => {
    const data = mk();
    render(<HeadTile data={data} />);
    fireEvent.click(screen.getByText("1 approval waiting").closest("button"));
    expect(data.setOnly).toHaveBeenCalledWith("approval");
  });

  // A CONTROL THAT FILTERS TO THE EMPTY SET IS A CONTROL LYING ABOUT HAVING ONE.
  it("a segment with nothing behind it stays a label", () => {
    const empty = mk({ docs: [], allDocs: [] });
    const { container } = render(<HeadTile data={empty} />);
    expect(screen.getByText(/nothing is registered in any project/)).toBeInTheDocument();
    expect(container.querySelectorAll(".dbb-head__say button")).toHaveLength(0);
  });

  // A FILTER YOU CANNOT SEE IS ON MEANS READING A PART OF THE WORLD AS THE WHOLE OF IT.
  it("the held segment says so to the eye and to a screen reader", () => {
    const { container } = render(<HeadTile data={mk({ only: "approval" })} />);
    const on = container.querySelector(".dbb-say.is-on");
    expect(on.textContent).toContain("1 approval waiting");
    expect(on).toHaveAttribute("aria-pressed", "true");
    // exactly one, and every other pressable segment says it is not the one
    expect(container.querySelectorAll(".dbb-say.is-on")).toHaveLength(1);
  });

  // COLOUR IS THE POSTURE, NEVER THE KEY. `owedHead` names nine segments today and will name
  // more; a rule per key means the next one arrives in no colour at all.
  it("colours a segment by its posture, so a new kind of obligation is never uncoloured", () => {
    const { container } = render(<HeadTile data={mk()} />);
    const classes = [...container.querySelectorAll(".dbb-say")].map((n) => n.className);
    expect(classes.some((c) => c.includes("dbb-say--press"))).toBe(true);
    expect(classes.some((c) => c.includes("dbb-say--work"))).toBe(true);
    // the obligation's own key never becomes a colour of its own
    expect(classes.some((c) => /dbb-say--(approval|blocked|mine)\b/.test(c))).toBe(false);
  });
});

// ─── 3. WHAT IS OWED ───────────────────────────────────────────────────────────────────────────

describe("the owed columns still fold by document", () => {
  // HIS COMPLAINT, AND THE REASON `groupOwed` IS THERE: an arc with two obligations was two rows,
  // so a list of three read as three places to go when it was two.
  it("one row per document, with the rest behind a fold", () => {
    const { container } = render(<OwedTile data={mk()} />);
    const work = container.querySelector(".dbb-col--work");
    expect(within(work).getAllByRole("listitem")).toHaveLength(1);
    expect(within(work).getByText(/^\+\d+ more$/)).toBeInTheDocument();
    fireEvent.click(within(work).getByText("ARC-001").closest("button"));
    expect(work.querySelector(".dbb-owed__sub")).toBeInTheDocument();
  });

  // THE ARROW TRAVELS AND THE ROW DOES NOT (his ruling, 2026-11-06). A single-obligation row has
  // nothing to fold, so its body is reading — a row that only travelled is exactly what the ruling
  // took out.
  it("the arrow opens the document, and the row's own body is not a press", () => {
    const data = mk();
    const { container } = render(<OwedTile data={data} />);
    const line = container.querySelector(".dbb-col--press .dbb-owed__line");
    expect(line.querySelector("button.dbb-owed__row")).toBe(null);
    fireEvent.click(line.querySelector(".dbb-owed__go"));
    expect(data.open).toHaveBeenCalledWith(expect.objectContaining({ project: "p", path: WAITING.row.path }));
  });

  // THREE NOTHINGS WEAR ONE BLANK SPACE and the column may never blur them.
  it("an empty column says WHICH nothing it is", () => {
    render(<OwedTile data={mk({ docs: [], allDocs: [] })} />);
    expect(screen.getAllByText("nothing is registered yet").length).toBe(2);
  });

  // IT NARROWS FOR FREE. The tile reads `docs`, which the surface already shortened.
  it("shows only the filtered documents when the surface is narrowed", () => {
    const { container } = render(<OwedTile data={mk({ docs: [WAITING], allDocs: ALL })} />);
    expect(container.querySelectorAll(".dbb-owed__row")).toHaveLength(1);
    expect(container.querySelector(".dbb-col--work .dbb-owed")).toBe(null);
  });
});

// ─── 4. WHERE EVERYTHING IS STANDING ───────────────────────────────────────────────────────────

describe("the tracks are the trails, empty stations and all", () => {
  // THE EMPTY STATION IS THE WHOLE VALUE OF THE PICTURE: the distance between a crowded draft and
  // an empty settled is the sentence "nothing is finishing", and dropping it deletes that.
  it("draws every station on a kind's trail even when nothing is standing there", () => {
    const { container } = render(<StandingTile data={mk()} />);
    const rfc = container.querySelector(".dbb-track--rfc");
    const words = [...rfc.querySelectorAll(".dbb-station__word")].map((n) => n.textContent);
    expect(words).toEqual(["draft", "approved", "built", "settled", "retired"]);
    expect(rfc.querySelectorAll(".dbb-station.is-empty").length).toBeGreaterThan(0);
  });

  // THE ARROW IS THE DOOR NOW — his ruling, 2026-11-06: *"Nothing should actually be clicked to
  // travel, except an explicit symbol, like an arrow."* The bead's body goes nowhere; the arrow
  // opens the document through the surface's one opener.
  it("a bead's body does not open; its arrow does, through the surface's one opener", () => {
    const data = mk();
    const { container } = render(<StandingTile data={data} />);
    fireEvent.click(container.querySelector(".dbb-bead .dbb-bead__body") || container.querySelector(".dbb-bead"));
    expect(data.open).not.toHaveBeenCalled();
    fireEvent.click(container.querySelector(".dbb-bead__go"));
    expect(data.open).toHaveBeenCalledWith(expect.objectContaining({ project: "p" }));
  });

  // HIS REORDER, 2026-11-06: *"arcs on top, then RFCs — they're a pair — then gaps."*
  it("stacks the tracks arcs first, then RFCs, then gaps", () => {
    const { container } = render(<StandingTile data={mk()} />);
    const kinds = [...container.querySelectorAll(".dbb-track")].map((t) =>
      [...t.classList].find((c) => c.startsWith("dbb-track--")),
    );
    expect(kinds).toEqual(["dbb-track--arc", "dbb-track--rfc", "dbb-track--gap"]);
  });

  // HIS RULING, 2026-11-06: *"you should be able to click on arcs and it should filter all the
  // RFCs for that arc."* The arc bead publishes to the stack; the RFC track in this very tile
  // narrows with it, because the RFCs are the pair standing right under the arc he pressed.
  describe("an arc bead is a filter", () => {
    // An RFC planned INTO the arc (its leaf carries the address) and one that is not.
    const PLANNED = doc(
      { id: "RFC-009", kind: "rfc", path: "RFCs/RFC-009-planned.md", arc: "ARC-001-O1", state: { verdict: "approved" } },
      "::rfc{id=RFC-009 arc=ARC-001-O1}\n",
    );
    const docs = [WAITING, ARC, PLANNED];

    const up = (filter) => render(<StandingTile data={mk({ docs, allDocs: docs })} filter={filter} />);

    it("publishes the arc to the stack and wears the fill while held", () => {
      const set = jest.fn();
      const { container } = up({ above: {}, mine: {}, set });
      const arcBody = container.querySelector(".dbb-track--arc .dbb-bead__body");
      expect(arcBody.tagName).toBe("BUTTON");
      fireEvent.click(arcBody);
      const hold = docKey({ project: "p", id: "ARC-001" });
      expect(set).toHaveBeenCalledWith("arc", hold);
      // held: the fill is on, and the RFC track narrows to the plans that serve the arc
      const held = up({ above: {}, mine: { arc: hold }, set }).container;
      expect(held.querySelector(".dbb-track--arc .dbb-bead.is-on")).toBeTruthy();
      const rfcIds = [...held.querySelectorAll(".dbb-track--rfc .dbb-bead__id")].map((n) => n.textContent);
      expect(rfcIds).toEqual(["RFC-009"]);
    });

    it("an rfc or gap bead publishes nothing — its body is not a control", () => {
      const set = jest.fn();
      const { container } = up({ above: {}, mine: {}, set });
      const rfcBody = container.querySelector(".dbb-track--rfc .dbb-bead__body");
      expect(rfcBody.tagName).not.toBe("BUTTON");
      fireEvent.click(rfcBody);
      expect(set).not.toHaveBeenCalled();
    });
  });

  it("dims the other tracks when one is held open", () => {
    const { container } = render(<StandingTile data={mk()} />);
    fireEvent.click(container.querySelector(".dbb-track--rfc .dbb-track__name"));
    expect(container.querySelector(".dbb-track--arc")).toHaveClass("is-dimmed");
    expect(container.querySelector(".dbb-track--rfc")).not.toHaveClass("is-dimmed");
  });

  // A ZERO OVER NOTHING REGISTERED IS NOT A ZERO, and the words say which it is.
  it("says what an empty floor means rather than drawing a blank", () => {
    render(<StandingTile data={mk({ docs: [], allDocs: [] })} />);
    expect(screen.getByText(/no documents are registered anywhere/)).toBeInTheDocument();
  });
});

// ─── 5. THE REPORTS ────────────────────────────────────────────────────────────────────────────

describe("the report stacks", () => {
  // His one visual cue: a pile per project, with the number on its face, that opens out sideways.
  it("one stack per project, with its count on the face", () => {
    const { container } = render(<ReportsTile data={mk()} />);
    const stacks = container.querySelectorAll(".dbb-stack");
    expect(stacks).toHaveLength(2);
    expect([...stacks].map((s) => s.querySelector(".dbb-stack__proj").textContent).sort()).toEqual(["p", "q"]);
  });

  // THE CARD ITSELF IS NOT FOCUSABLE — it is reading. What the fold gates is its ARROW: a closed
  // stack's doors must stay out of the tab order, or tabbing walks through piles he cannot see.
  it("a stack fans out when pressed, and only then is its arrow reachable", () => {
    const { container } = render(<ReportsTile data={mk()} />);
    const face = container.querySelector(".dbb-stack__face");
    expect(container.querySelector(".dbb-rcard")).not.toHaveAttribute("tabindex");
    expect(container.querySelector(".dbb-rcard__go")).toHaveAttribute("tabindex", "-1");
    fireEvent.click(face);
    expect(face).toHaveAttribute("aria-expanded", "true");
    expect(container.querySelector(".dbb-rcard__go")).toHaveAttribute("tabindex", "0");
  });

  it("says plainly when no project has filed one", () => {
    render(<ReportsTile data={mk({ docs: [WAITING], allDocs: [WAITING] })} />);
    expect(screen.getByText("no reports are registered in any project.")).toBeInTheDocument();
  });

  // HIS RULING, 2026-11-07: *"What the fuck could a report filter? What is a report sitting on top
  // of?"* A DASHBOARD selection needs something underneath it, and a report holds nothing — so no
  // press in here publishes one, the card is reading, and the arrow is the only door on it. The
  // chips an open stack grows are a different thing entirely: they narrow this stack's OWN fan,
  // which is not the question he ruled on, and they still publish nothing.
  it("nothing here publishes a dashboard selection — not the card, not the words", () => {
    const set = jest.fn();
    const data = mk();
    const { container } = render(<ReportsTile data={data} filter={{ above: {}, mine: {}, set }} />);
    const card = container.querySelector(".dbb-rcard");
    fireEvent.click(card);
    expect(set).not.toHaveBeenCalled();
    expect(data.open).not.toHaveBeenCalled();
    expect(card).not.toHaveAttribute("role");
    expect(card).not.toHaveAttribute("aria-pressed");
    fireEvent.click(card.querySelector(".dbb-rcard__go"));
    expect(data.open).toHaveBeenCalledWith(expect.objectContaining({ path: expect.stringContaining("report") }));
    // AND THE WORDS PUBLISH NOTHING EITHER — they narrow this stack's own fan and reach no further.
    fireEvent.click(container.querySelector(".dbb-stack__face"));
    fireEvent.click(container.querySelector(".dbb-stack__pick"));
    expect(set).not.toHaveBeenCalled();
  });
});

// ─── THE WORDS AN OPEN STACK GROWS ─────────────────────────────────────────────────────────────
//
// His ask, verbatim: *"when it's a card it should look the same way that it is right now when it's
// closed. When you click it open it just grows more options and those options become clickable
// options to filter the list right next to it."* Both halves are claims: the closed card is
// untouched, and the open one's options reach the fan beside them and nothing else.

describe("the ways an open stack offers to read itself", () => {
  // Four reports in `p` — three accounts (one of them never opened) and an audit — and one brief in
  // `q`, so the pile that grows chips is not the only pile on the row. The floor reads the clocks at
  // the real now and the fixture's `NOW` is long past, so every report here that has been OPENED is
  // over its window and carries ⧗; the one never opened has no clock running at all.
  const PILE = [
    WAITING,
    REPORT("r-acct", { openedAt: NOW - DAY }),
    REPORT("r-again", { openedAt: NOW - 2 * DAY }),
    REPORT("r-audit", { as: "audit", openedAt: NOW - DAY }),
    REPORT("r-new"),
    REPORT("r-other", { project: "q", as: "brief", openedAt: NOW - DAY }),
  ];
  const draw = () => {
    const { container } = render(<ReportsTile data={mk({ docs: PILE, allDocs: PILE })} />);
    const stacks = [...container.querySelectorAll(".dbb-stack")];
    return { container, mine: stacks[0], other: stacks[1] };
  };
  const said = (el) => [...el.querySelectorAll(".dbb-stack__pick")].map((c) => c.textContent);
  const cards = (el) => [...el.querySelectorAll(".dbb-rcard")].map((c) => c.querySelector(".dbb-rcard__id").textContent);

  // HIS FIRST HALF, AS A CLAIM: *"when it's a card it should look the same way that it is right now
  // when it's closed."* A closed pile grows nothing at all.
  it("a closed card grows nothing", () => {
    const { container } = draw();
    expect(container.querySelectorAll(".dbb-stack__pick")).toHaveLength(0);
  });

  it("an open card grows more of its own words, under the two it already said", () => {
    const { mine, other } = draw();
    fireEvent.click(mine.querySelector(".dbb-stack__face"));
    expect(said(mine)).toEqual(["3 about to go", "1 unopened", "3 account", "1 audit"]);
    // ONE PILE AT A TIME, so the pile he did not press has grown nothing either.
    expect(said(other)).toEqual([]);
  });

  // THERE IS NO `all`, AND NOTHING HOLDS WHEN IT OPENS — his point: *"naturally there would be no
  // all filter… you click it, it stretches out, it spreads the cards out."* The open card already
  // IS everything, so a control for that state would be a button for where you are standing.
  it("opens showing every card, with no word holding and no all to press", () => {
    const { mine } = draw();
    fireEvent.click(mine.querySelector(".dbb-stack__face"));
    expect(cards(mine)).toHaveLength(4);
    expect(mine.querySelectorAll(".dbb-stack__pick.is-on")).toHaveLength(0);
    expect(said(mine)).not.toContain("all");
  });

  it("pressing a word narrows the fan beside it, and only that fan", () => {
    const { mine, other } = draw();
    fireEvent.click(mine.querySelector(".dbb-stack__face"));
    fireEvent.click(within(mine).getByTitle("show only the 1 audit report"));
    expect(cards(mine)).toEqual(["r-audit"]);
    expect(mine.querySelector(".dbb-stack__pick.is-on").textContent).toBe("1 audit");
    // THE OTHER PILE IS UNTOUCHED — these words are this stack's own and reach nothing outside it.
    expect(cards(other)).toEqual(["r-other"]);
  });

  // PRESSING THE HELD WORD AGAIN IS HOW HE LETS GO, which is what makes `all` unnecessary rather
  // than merely absent. Single-select, because two at once makes an empty fan ambiguous between
  // "this pile has no audits" and "it has no unopened audits".
  it("one word holds at a time, and pressing it again gives the pile back", () => {
    const { mine } = draw();
    fireEvent.click(mine.querySelector(".dbb-stack__face"));
    fireEvent.click(within(mine).getByTitle("show only the 1 not opened yet"));
    expect(cards(mine)).toEqual(["r-new"]);
    fireEvent.click(within(mine).getByTitle("show only the 3 about to go"));
    expect(mine.querySelectorAll(".dbb-stack__pick.is-on")).toHaveLength(1);
    expect(cards(mine).sort()).toEqual(["r-acct", "r-again", "r-audit"]);
    fireEvent.click(within(mine).getByTitle("show only the 3 about to go"));
    expect(mine.querySelectorAll(".dbb-stack__pick.is-on")).toHaveLength(0);
    expect(cards(mine)).toHaveLength(4);
  });

  // THE CHOICE DIES WITH THE PILE. It is one selection for the whole row, so a filter surviving the
  // close would come back on whichever project he opened next — holding `audit` over a pile that
  // has none, which draws an empty fan and reads as "no reports".
  it("the choice does not survive the close, and does not follow him to another project", () => {
    const { mine, other } = draw();
    const face = (el) => el.querySelector(".dbb-stack__face");
    fireEvent.click(face(mine));
    fireEvent.click(within(mine).getByTitle("show only the 1 audit report"));
    fireEvent.click(face(mine));
    fireEvent.click(face(mine));
    expect(cards(mine)).toHaveLength(4);
    expect(mine.querySelectorAll(".dbb-stack__pick.is-on")).toHaveLength(0);
    fireEvent.click(face(other));
    expect(cards(other)).toEqual(["r-other"]);
    expect(other.querySelectorAll(".dbb-stack__pick.is-on")).toHaveLength(0);
  });
});

// ─── 6. THE PROJECTS ───────────────────────────────────────────────────────────────────────────

describe("the projects, all of them", () => {
  // A PROJECT WITH NOTHING REGISTERED IS A FACT, NOT AN ABSENCE. The denominator is the point:
  // a count over one project out of twelve is not a picture of the system.
  it("cards the live projects and folds the quiet ones into one honest line", () => {
    const { container } = render(<ProjectsTile data={mk()} />);
    expect([...container.querySelectorAll(".dbb-proj__name b")].map((n) => n.textContent).sort()).toEqual(["p", "q"]);
    const quiet = screen.getByText("1 project the hub knows with no registered documents");
    expect(container.querySelector(".dbb-quiet__list")).toBe(null);
    fireEvent.click(quiet);
    expect(container.querySelector(".dbb-quiet__list").textContent).toContain("quietone");
  });

  // FOUR PIPS IN THE SAME ORDER ON EVERY CARD, zeroes included — that is what makes two projects
  // comparable at a glance instead of readable one at a time.
  it("every card shows all four kinds, including the ones it has none of", () => {
    const { container } = render(<ProjectsTile data={mk()} />);
    container.querySelectorAll(".dbb-proj").forEach((card) => {
      expect(card.querySelectorAll(".dbb-pip")).toHaveLength(4);
    });
  });

  // THE SELECTION LIVES HERE — his ruling, 2026-11-07: *"the projects you should be able to click
  // to filter, and it needs to show it selected properly."* A press publishes `project`, so every
  // tile below is that project; pressing the same one again lets go.
  it("a card is a press that publishes its project to the stack", () => {
    const set = jest.fn();
    const { container } = render(<ProjectsTile data={mk()} filter={{ above: {}, mine: {}, set }} />);
    const card = container.querySelector(".dbb-proj");
    expect(card.tagName).toBe("BUTTON");
    fireEvent.click(card);
    expect(set).toHaveBeenCalledWith("project", card.querySelector(".dbb-proj__name b").textContent);
  });

  it("the held project wears the fill and says so to a screen reader", () => {
    const { container } = render(
      <ProjectsTile data={mk()} filter={{ above: {}, mine: { project: "q" }, set: jest.fn() }} />
    );
    const on = container.querySelectorAll(".dbb-proj.is-on");
    expect(on).toHaveLength(1);
    expect(on[0].querySelector(".dbb-proj__name b").textContent).toBe("q");
    expect(on[0]).toHaveAttribute("aria-pressed", "true");
    expect(on[0].getAttribute("title")).toContain("press to show every project again");
  });

  // WITH NO STACK AROUND IT the tile is still a tile: the chooser previews it, and a preview with
  // no filter wiring must render rather than throw.
  it("without a filter it is cards and nothing more — no press, no fill", () => {
    const { container } = render(<ProjectsTile data={mk()} />);
    expect(container.querySelector(".dbb-proj").tagName).toBe("DIV");
    expect(container.querySelector(".dbb-proj.is-on")).toBe(null);
  });
});

// ─── 7. THE INVENTORY ──────────────────────────────────────────────────────────────────────────

// ONE LIST, GREPPABLE. The registry's own rule: a `registerTile()` at the bottom of each file
// makes what is on the surface depend on what happened to be imported.
it("the index names every one of B's tiles, each at variant b", () => {
  expect(TILES.map((t) => t.kind).sort()).toEqual(["head", "owed", "projects", "reports", "standing"]);
  TILES.forEach((t) => {
    expect(t.variant).toBe("b");
    expect(typeof t.Component).toBe("function");
    expect(t.label).toMatch(/^B · /);
  });
});
