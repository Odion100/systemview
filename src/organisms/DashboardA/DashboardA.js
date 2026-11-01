import React, { useContext, useEffect, useMemo, useRef, useState } from "react";
import "./styles.scss";
import ServiceContext from "../../ServiceContext";
import { hostFiles } from "../../utils/hostFiles";
import { openAddress } from "../../atoms/Markdown/openRef";
import { tickFor } from "../../atoms/Markdown/blocks/retention";
import { skippedLine, groupOwed } from "../AgentChat/owed";
import dashboard, { PHASES, readingLine } from "./dashboardA.data";

// ─── THE DASHBOARD — EVERY PROJECT, EVERY KIND, AND WHAT NEEDS HIM ─────────────────────────────
//
// His ask, verbatim: *"the dashboard is about all the different kind of things, you know, arcs or
// RFCs, in their progress, and reports"* — *"to be able to see all the stuff that's waiting, all
// the projects going on at the same time."* He deliberately did not specify it, so this page
// commits to a reading of it rather than hedging:
//
//   1. THE PAGE OPENS WITH WHAT NEEDS HIM, and that half is not scrollable past. It is
//      `owed.js`'s answer, over every project at once — the first time that derivation has been
//      asked anything but "this one repo".
//   2. THEN ONE LANE PER PROJECT, each a TRACK the work travels down: five columns, left to right,
//      proposed → agreed → moving → landed → set down. Every RFC, arc and gap is one MARK on its
//      project's track, and the mark carries three facts at once — its KIND in the colour, its
//      PROGRESS in the ring it fills, and whether it OWES him in the pulse. Scan down the page and
//      you read where the mass is: a hundred things agreed and nothing moving is a different day
//      from a hundred things moving, and that difference is the whole point of a dashboard.
//   3. REPORTS ARE NOT ON THE TRACK. They do not travel — they DECAY. So each lane ends in a
//      STACK, which is his one visual instruction taken literally: *"reports looking like a stack
//      with numbers, and then you click them and they expand out horizontally."* The stack's job
//      is the countdown, because the clock is the only thing on this page that destroys something.
//
// IT PRESSES NOTHING. Every mark, every row and every card opens its DOCUMENT, because the control
// lives there — the facilitation ladder for an approval, the clock's keep-or-let-go on a report's
// leaf. *"A list that signs for you is a list that decides for you."*
//
// IT DERIVES NOTHING. Every number is `dashboardA.data.js`, which is itself a wire over `owed.js`,
// `arcRows`, `rfcRows`, `gapRows`, `claimsOf`, `retainLine` and `stateOf`. This file is pixels and
// one fetch — which is also what keeps it MOUNTABLE: nothing in its import graph reaches
// react-markdown, so `DashboardA.test.js` renders the real component and holds it to the two
// things a pure module cannot answer (a page nobody could read must not draw as a clear page, and
// the only event this surface may emit is the one opener).

const KIND_WORD = { rfc: "RFC", arc: "arc", gap: "gap", report: "report" };

// ─── THE FETCH ─────────────────────────────────────────────────────────────────────────────────
//
// ONE READ OF THE REGISTRY WITH NO FILTERS — that is what "every project" means here, and it is
// the only call in the window that asks for all of it. Then one file read per document, because
// the row is a CACHE of the last parse and the text is what the document actually wants (RFC-073:
// the row says WHICH documents exist, the text says what they want).
//
// THE GATE IS THE SAME JUSTIFIED SHAPE THE DRAWER'S POLL USES, and for the same stated reason —
// *"isn't polling inefficient? …you have to justify it."* The fingerprint is every row's identity,
// its last parse, when he first opened it and whether the file has drifted past that parse, which
// is every input any of these derivations turns on. Unchanged → the tick costs one registry read
// and no file reads at all.
const printOf = (rows) =>
  rows
    .map((r) => `${r.id}@${r.path}@${(r.state || {}).parsed || 0}@${r.openedAt || 0}@${r.stale ? 1 : 0}@${r.missing ? 1 : 0}`)
    .sort()
    .join("|");

const useRegistry = (SystemViewService) => {
  // `read: false` until a registry answer has actually landed. A zero we did not measure must
  // never draw as a zero — that is the one lie this whole system exists to stop.
  const [state, setState] = useState({ read: false, docs: [], roots: {}, error: "" });
  const print = useRef("");
  const docs = useRef([]);
  useEffect(() => {
    let dead = false;
    const pull = async () => {
      const agent = SystemViewService && SystemViewService.Agent;
      const sv = SystemViewService && SystemViewService.SystemView;
      if (!agent || !agent.documentsRegistry) return; // an older hub — the page says so rather than guessing
      try {
        const [raw, roots] = await Promise.all([
          agent.documentsRegistry({}),
          sv && sv.projectRoots ? Promise.resolve(sv.projectRoots()).catch(() => ({})) : Promise.resolve({}),
        ]);
        const rows = (Array.isArray(raw) ? raw : []).filter((r) => r && r.id && r.kind && r.path);
        const p = printOf(rows);
        if (p !== print.current) {
          print.current = p;
          docs.current = await Promise.all(
            rows.map(async (row) => {
              // A ROW WHOSE FILE IS GONE AND A RETIRED ONE OWE NOTHING, so neither is read. Both
              // are still handed to the fold, which counts them out loud. `text: undefined` is
              // what "could not be read" means, carried rather than swallowed.
              if (row.missing || (row.state || {}).retired) return { row };
              try {
                const f = await hostFiles(row.project).readFile({ path: row.path });
                return { row, text: f && f.ok !== false ? f.content || "" : undefined };
              } catch {
                return { row };
              }
            }),
          );
        }
        if (!dead) setState({ read: true, docs: docs.current, roots: roots && typeof roots === "object" ? roots : {}, error: "" });
      } catch (e) {
        // AN EMPTY ANSWER, NOT A STALE ONE, and it SAYS it failed — the page must not read as
        // "nothing to do" when it means "nothing came back".
        if (!dead) setState({ read: false, docs: [], roots: {}, error: String((e && e.message) || e) });
      }
    };
    pull();
    const t = setInterval(pull, 30000);
    return () => {
      dead = true;
      clearInterval(t);
    };
  }, [SystemViewService]);
  return state;
};

// ─── THE PRESS: OPEN THE DOCUMENT, AND THAT IS ALL IT DOES ─────────────────────────────────────
//
// ONE OPENER, AND IT IS NOT A NEW ONE. `openRef.js`: *"every surface that opens a file address
// calls THIS, and nothing else dispatches sv:openFileInNav."* An arc, an RFC, a gap and a report
// are all markdown files, so they ride the door files already ride and land in whatever document
// display the hosting page owns.
//
// TODO (wiring owner): this page is mounted behind a tab switcher with two sibling dashboards, and
// the mount decides which panel hears `sv:openFileInNav`. If the host page owns no file panel,
// nothing opens — and navigating from in here would be a SECOND rule about where a document lands,
// which `openRef.js` exists to prevent. The fallback belongs at the mount, beside the switcher.
const open = ({ project, path, line }) =>
  openAddress({ projectCode: project || "", path, language: "markdown", lines: line > 1 ? [line, line] : undefined });

// ─── PIECES ────────────────────────────────────────────────────────────────────────────────────

/** The kind's letter in the kind's colour — the legend for every mark and row on the page. */
const Chip = ({ kind, children }) => (
  <span className={`dba-chip dba-chip--${kind}`}>{children || KIND_WORD[kind] || kind}</span>
);

/**
 * ONE MARK ON A TRACK — three facts in one 18px circle.
 *
 *   COLOUR    which kind it is (the same four hues the How-we-work page uses, so a colour means
 *             the same thing on both surfaces).
 *   THE RING  how far through its own interior it is — claims met for an RFC, objectives done for
 *             an arc — with the HONEST MIDDLE drawn in the dimmed hue: marked-but-unproved claims
 *             and blocked objectives are neither done nor untouched, and a ring that folded them
 *             into either neighbour would be the lie the derivations were written to stop.
 *   THE PULSE it owes him something. The pulse is a POINTER, not a press: clicking opens the file.
 *
 * A mark whose file has drifted past the last parse gets a motion trail, because on a page about
 * movement the one honest signal of movement is the registry's own lag (§1.4).
 */
const Mark = ({ m }) => {
  const total = m.bar ? m.bar.total : 0;
  const done = total ? Math.round((m.bar.done / total) * 100) : 0;
  const extra = total ? Math.round(((m.bar.done + m.bar.extra) / total) * 100) : 0;
  const cls = [
    "dba-mark",
    `dba-mark--${m.kind}`,
    m.press ? "is-press" : m.work ? "is-work" : "",
    m.stale ? "is-stale" : "",
    m.missing ? "is-gone" : "",
    m.fixture ? "is-fixture" : "",
    m.bar ? "has-ring" : "",
  ]
    .filter(Boolean)
    .join(" ");
  return (
    <button
      type="button"
      className={cls}
      style={{ "--done": done, "--extra": extra }}
      onClick={() => open({ project: m.project, path: m.path, line: (m.owes[0] && m.owes[0].line) || 1 })}
      aria-label={`${m.id} — ${m.title}`}
    >
      <span className="dba-mark__dot" />
      <span className="dba-card" role="tooltip">
        <b className="dba-card__id">
          <Chip kind={m.kind} /> {m.id}
        </b>
        <i className="dba-card__title">{m.title || "untitled"}</i>
        <span className="dba-card__state">{m.line || m.station}</span>
        {m.bar ? (
          <span className="dba-card__bar">
            <span className="dba-bar">
              <span className="dba-bar__done" style={{ width: `${done}%` }} />
              <span className="dba-bar__extra" style={{ width: `${extra - done}%` }} />
            </span>
            <em>
              {m.bar.done} of {m.bar.total} {m.bar.unitWord} {m.bar.doneWord}
              {m.bar.extra ? ` · ${m.bar.extra} ${m.bar.extraWord}` : ""}
            </em>
          </span>
        ) : null}
        {m.owes.map((o) => (
          <span key={o.key} className={`dba-card__owes is-${o.group}`}>
            {o.group === "press" ? "needs your press" : "outstanding"} — {o.says}
          </span>
        ))}
        {m.stale ? <span className="dba-card__stale">the file has moved since anybody parsed it</span> : null}
        {m.missing ? <span className="dba-card__stale">the registry points at a file that is gone</span> : null}
        {m.fixture ? <span className="dba-card__stale">a proof fixture, not work</span> : null}
      </span>
    </button>
  );
};

/**
 * THE REPORT STACK — his one visual instruction, taken literally: *"reports looking like a stack
 * with numbers, and then you click them and they expand out horizontally."*
 *
 * Closed, it is a pile with a number and the SOONEST clock on its face, because that is the only
 * thing in the pile that is about to be destroyed. Open, the cards fan out sideways and each one
 * says its own clock in `retainLine`'s words. Clicking a card opens the report, where the
 * keep-or-let-go actually lives.
 */
const StackPile = ({ reports, open: fanned, onToggle }) => {
  if (!reports.length) return <div className="dba-pile-none">no reports</div>;
  const lead = reports[0];
  const depth = Math.min(reports.length, 4);
  return (
    <button
      type="button"
      className={`dba-pile${fanned ? " is-open" : ""}`}
      onClick={onToggle}
      aria-expanded={fanned}
      aria-label={`${reports.length} ${reports.length === 1 ? "report" : "reports"} — press to fan them out`}
    >
      {Array.from({ length: depth }).map((_, i) => (
        <span key={i} className="dba-pile__sheet" style={{ "--i": depth - 1 - i }} />
      ))}
      <span className="dba-pile__n">{reports.length}</span>
      <span className={`dba-pile__lead${lead.urgent ? " is-soon" : ""}`}>
        {lead.counting ? lead.clock : `${reports.filter((r) => r.unread).length || reports.length} to read`}
      </span>
    </button>
  );
};

// THE FAN IS A SIBLING OF THE TRACK, NOT A CHILD OF ITS LAST CELL — "expand out horizontally"
// needs the lane's whole width, and a cell 200px wide cannot give it one. The stagger is a
// transition-delay off each card's index, so the pile opens as a deal rather than a pop.
const StackFan = ({ reports, open: fanned }) =>
  !reports.length ? null : (
    <div className={`dba-fan${fanned ? " is-open" : ""}`} aria-hidden={!fanned}>
      {reports.map((r, i) => (
        <button
          type="button"
          key={r.key}
          className={`dba-sheet${r.urgent ? " is-soon" : ""}${r.retired ? " is-retired" : ""}${r.fixture ? " is-fixture" : ""}`}
          style={{ "--i": i }}
          tabIndex={fanned ? 0 : -1}
          onClick={() => open({ project: r.project, path: r.path })}
        >
          <span className="dba-sheet__sub">{r.subtype || "report"}</span>
          <span className="dba-sheet__title">{r.title || r.id}</span>
          <span className={`dba-sheet__clock${r.urgent ? " is-soon" : ""}`}>
            {r.clock || (r.undeclared ? "no retention declared" : "")}
            {r.unread ? " · never opened" : ""}
          </span>
        </button>
      ))}
    </div>
  );

/** One obligation, in `owed.js`'s own words. The chevron is the only affordance: it opens. */
/**
 * ONE DOCUMENT, ONE ROW — and its obligations are what the row opens into.
 *
 * *"It has multiple of the same RFC or arc with multiple things outstanding — outstanding should
 * be expandable, it should be bringing those things together."* An arc with five blocked
 * objectives is one place to go and work, so it gets one line; the five are behind a fold.
 *
 * THE FACE CARRIES THE STRONGEST ONE, never a summary. `groupOwed` inherits the first item's
 * words because the list arrived ranked — so the row says the worst thing about the document and
 * the count says how much else is in there. "3 outstanding" on its own would make him open every
 * row to find out whether any of it mattered.
 *
 * A ROW OF ONE IS AN ORDINARY ROW: no fold, no count, and the press opens the document. A fold
 * that opens to reveal the sentence already on its face is furniture.
 */
const OwedGroup = ({ g, open: shown, onToggle }) => {
  const one = g.n === 1;
  return (
    <div className={`dba-owed__g${shown ? " is-open" : ""}`}>
      <button
        type="button"
        className={`dba-owed is-${g.group} is-${g.why}${one ? "" : " is-many"}`}
        aria-expanded={one ? undefined : shown}
        onClick={() => (one ? open({ project: g.project, path: g.path, line: g.line }) : onToggle())}
      >
        <span className="dba-owed__mark">{g.group === "press" ? (g.why === "clock" ? "⧗" : "⚑") : "·"}</span>
        <Chip kind={g.kind} />
        <b className="dba-owed__id">{g.id}</b>
        <span className="dba-owed__says">{g.says}</span>
        <i className="dba-owed__tail">{g.tail}</i>
        {/* RENDERED EVEN WHEN EMPTY: the row is a grid, and a missing cell slides the
            project column left on every single-obligation row. */}
        <em className="dba-owed__n">{one ? "" : `+${g.n - 1} more`}</em>
        <span className="dba-owed__where">{g.project}</span>
        <span className="dba-owed__fold" aria-hidden="true">{one ? "" : shown ? "⌃" : "⌄"}</span>
      </button>
      {one || !shown ? null : (
        <div className="dba-owed__items">
          {g.items.map((o) => (
            <button
              key={o.key}
              type="button"
              className={`dba-owed__item is-${o.why}`}
              onClick={() => open({ project: o.project, path: o.path, line: o.line })}
            >
              <span className="dba-owed__says">{o.says}</span>
              <i className="dba-owed__tail">{o.tail}</i>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

/** One project: who it is, what it owes, the track, the stack, and the numbers on request. */
const Lane = ({ p, fanned, onFan, shown, onShow }) => (
  <article className={`dba-lane${p.registered ? "" : " is-quiet"}`}>
    <header className="dba-lane__head">
      <h3 className="dba-lane__code">{p.code}</h3>
      <span className="dba-lane__counts">
        {["rfc", "arc", "gap", "report"].map((k) =>
          p.counts[k] ? (
            <span key={k} className={`dba-count dba-count--${k}`}>
              {p.counts[k]} {KIND_WORD[k]}
              {p.counts[k] === 1 || k === "rfc" ? "" : "s"}
            </span>
          ) : null,
        )}
      </span>
      <span className="dba-lane__owes">
        {p.press ? <b className="is-press">⚑ {p.press} to press</b> : null}
        {p.work ? <b className="is-work">{p.work} outstanding</b> : null}
        {p.stale ? <i>{p.stale} moved since the last parse</i> : null}
        {p.gone ? <i className="is-press">{p.gone} pointing at a file that is gone</i> : null}
        {p.unknownRoot ? <i className="is-press">no folder registered for this project</i> : null}
      </span>
    </header>
    {p.registered ? (
      <>
        <div className="dba-track">
          {PHASES.map((ph) => (
            <div key={ph.id} className={`dba-cell dba-cell--${ph.id}`}>
              {p.marks
                .filter((m) => m.phase === ph.id)
                .map((m) => (
                  <Mark key={m.key} m={m} />
                ))}
            </div>
          ))}
          <div className="dba-track__stack">
            <StackPile reports={p.reports} open={fanned} onToggle={onFan} />
          </div>
        </div>
        <StackFan reports={p.reports} open={fanned} />
        {p.marks.length ? (
          <button type="button" className="dba-lane__more" onClick={onShow} aria-expanded={shown}>
            {shown ? "hide the numbers" : "the numbers"}
          </button>
        ) : null}
        {shown ? (
          <ul className="dba-list">
            {p.marks.map((m) => (
              <li key={m.key}>
                <button type="button" className="dba-row" onClick={() => open({ project: m.project, path: m.path, line: (m.owes[0] && m.owes[0].line) || 1 })}>
                  <Chip kind={m.kind} />
                  <b className="dba-row__id">{m.id}</b>
                  <span className="dba-row__title">{m.title || "untitled"}</span>
                  {m.bar ? (
                    <span className="dba-row__bar">
                      <span className="dba-bar">
                        <span className="dba-bar__done" style={{ width: `${(m.bar.done / m.bar.total) * 100}%` }} />
                        <span className="dba-bar__extra" style={{ width: `${(m.bar.extra / m.bar.total) * 100}%` }} />
                      </span>
                      <em>
                        {m.bar.done}/{m.bar.total} {m.bar.doneWord}
                        {m.bar.extra ? ` · ${m.bar.extra} ${m.bar.extraWord}` : ""}
                      </em>
                    </span>
                  ) : (
                    <span className="dba-row__bar" />
                  )}
                  <i className="dba-row__state">{m.line || m.station}</i>
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </>
    ) : (
      // A PROJECT IS DRAWN EVEN WITH NOTHING IN IT, and it says WHY it is empty. A lane missing
      // from the page reads as "no work here"; a lane that says "nothing has ever been parsed"
      // reads as what it is. Those are not the same sentence and only one of them is ever true of
      // a folder nobody has looked at.
      <p className="dba-lane__none">
        nothing registered — no document in this project carries a leaf anything has parsed
        {p.root ? <code>{p.root}</code> : null}
      </p>
    )}
  </article>
);

// ─── THE PAGE ──────────────────────────────────────────────────────────────────────────────────

const DashboardA = () => {
  const { SystemViewService } = useContext(ServiceContext);
  const { read, docs, roots, error } = useRegistry(SystemViewService);
  const [fixtures, setFixtures] = useState(false);
  const [fanned, setFanned] = useState("");
  const [shown, setShown] = useState({});
  // WHICH DOCUMENTS ARE FANNED OPEN in the owed lists. Keyed by `groupOwed`'s key, which carries
  // the project — so opening alpha's RFC-001 does not open beta's.
  const [openOwed, setOpenOwed] = useState({});
  const toggleOwed = (k) => setOpenOwed((o) => ({ ...o, [k]: !o[k] }));

  // THE CLOCKS COUNT. One beat for the page, at the cadence the WORDS have (`tickFor` — the same
  // rule the drawer's clock and the leaf's own face follow), and none at all when nothing is
  // counting. A dashboard that said "retires in 4 hours" for a day would be worse than one with no
  // clock on it, and a one-second interval behind twelve projects is a tax on nothing.
  const [beat, setBeat] = useState(0);
  const d = useMemo(
    () => dashboard({ docs, roots, now: Date.now(), fixtures }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [docs, roots, fixtures, beat],
  );
  const soonest = d.reports.filter((r) => r.counting).reduce((lo, r) => (lo == null || r.left < lo ? r.left : lo), null);
  const every = tickFor(soonest);
  useEffect(() => {
    if (!every) return undefined;
    const t = setInterval(() => setBeat((b) => b + 1), every);
    return () => clearInterval(t);
  }, [every]);

  const { totals, head, owed } = d;
  const skipped = skippedLine(owed.skipped);

  return (
    <div className="dba">
      <header className="dba__top">
        <div className="dba__mast">
          <h1>What is going on, and what needs you</h1>
          {/* THE PAGE SAYS WHAT IT IS STANDING ON, always. An empty dashboard that read as "you
              are clear" when it meant "nobody answered" is the one failure this page may not have,
              so the reading line is above the fold and never conditional. */}
          <p className="dba__reading">
            {error ? `the registry could not be read — ${error}` : read ? readingLine(totals) : "reading the registry…"}
          </p>
        </div>
        {/* THE GAUGE IS `owedHead`'s OWN SEGMENTS — same marks, same words, same order as the
            drawer's band, because two surfaces disagreeing about how much he owes is worse than
            either of them being slightly wrong. ⚑ means a decision waits on him; ⧗ means a
            deadline, which is not a decision: nothing he presses makes it not have been due. */}
        <div className="dba__gauge">
          {head.segs.map((s) => (
            <div key={s.key} className={`dba-tile is-${s.key}`}>
              <span className="dba-tile__flag">{s.flag}</span>
              <span className="dba-tile__text">{s.text}</span>
            </div>
          ))}
          {!head.segs.length && read ? <div className="dba-tile is-cold">nothing was read — no answer to give</div> : null}
          {head.unread ? <div className="dba-tile is-cold">{head.unread} unread</div> : null}
        </div>
        {/* THE EXCLUSION IS ARGUABLE, NEVER SILENT — `owed.js`'s rule, kept: the number is what
            lets him disagree with the exclusion instead of taking it on trust. No fixtures in the
            registry means no switch, because a switch over nothing is furniture. */}
        {totals.fixtures ? (
          <label className="dba__fixtures">
            <input type="checkbox" checked={fixtures} onChange={(e) => setFixtures(e.target.checked)} />
            show the {totals.fixtures} proof {totals.fixtures === 1 ? "fixture" : "fixtures"} — test data wearing a document
          </label>
        ) : null}
      </header>

      <section className="dba__owed">
        <div className="dba__half">
          <h2>
            Press <span>your signature finishes it</span>
          </h2>
          {owed.press.length ? (
            groupOwed(owed.press).map((g) => (
              <OwedGroup key={g.key} g={g} open={!!openOwed[g.key]} onToggle={() => toggleOwed(g.key)} />
            ))
          ) : (
            <p className="dba__clear">{read && totals.read ? "nothing waiting on a verdict of yours" : "not measured"}</p>
          )}
        </div>
        <div className="dba__half">
          <h2>
            Outstanding <span>nobody can press it away</span>
          </h2>
          {owed.work.length ? (
            groupOwed(owed.work).map((g) => (
              <OwedGroup key={g.key} g={g} open={!!openOwed[g.key]} onToggle={() => toggleOwed(g.key)} />
            ))
          ) : (
            <p className="dba__clear">{read && totals.read ? "nothing outstanding" : "not measured"}</p>
          )}
        </div>
        {skipped ? <p className="dba__skipped">{skipped}</p> : null}
      </section>

      <section className="dba__flow">
        <h2 className="dba__h2">
          Every project, and where its work is standing
          <span>
            {totals.marks} travelling {totals.marks === 1 ? "document" : "documents"} · {totals.reports} reports · across{" "}
            {totals.live} of {totals.projects} projects
          </span>
        </h2>
        {/* THE LEGEND IS THE HEADER, ONCE, and the lanes are a grid under it so a column means the
            same thing all the way down — that alignment is what makes the mass readable. The
            columns are named for what is true of the WORK, not for any one kind's vocabulary:
            `built` means something only to an RFC and a column headed with it would be a lie about
            the other three. */}
        <div className="dba-axis">
          {PHASES.map((ph) => (
            <div key={ph.id} className={`dba-axis__col dba-axis__col--${ph.id}`}>
              <b>{ph.label}</b>
              <i>{ph.hint}</i>
              <span className="dba-axis__n">{totals.phases[ph.id] || 0}</span>
            </div>
          ))}
          <div className="dba-axis__col dba-axis__col--stack">
            <b>reports</b>
            <i>they do not travel — they expire. press a stack to fan it out</i>
            <span className="dba-axis__n">{totals.reports}</span>
          </div>
        </div>
        {d.projects.map((p) => (
          <Lane
            key={p.code}
            p={p}
            fanned={fanned === p.code}
            onFan={() => setFanned((f) => (f === p.code ? "" : p.code))}
            shown={!!shown[p.code]}
            onShow={() => setShown((s) => ({ ...s, [p.code]: !s[p.code] }))}
          />
        ))}
        {!d.projects.length ? (
          <p className="dba-lane__none">
            {read
              ? "no projects — neither the registry nor the shell's folder list has anything in it"
              : "waiting on the hub"}
          </p>
        ) : null}
      </section>

      <footer className="dba__foot">
        <span className="dba-legend">
          <Chip kind="rfc" /> a design, reduced to claims somebody can check
        </span>
        <span className="dba-legend">
          <Chip kind="arc" /> a body of work, made of objectives
        </span>
        <span className="dba-legend">
          <Chip kind="gap" /> something another project gets wrong or lacks
        </span>
        <span className="dba-legend">
          <Chip kind="report" /> an account of work done, with a clock on it
        </span>
        <span className="dba-legend dba-legend--rule">
          a filled ring is progress and the dim part of it is the honest middle — claims marked but
          unproved, objectives declared blocked. A pulsing mark owes you something. Everything here
          opens its document; nothing here presses it.
        </span>
      </footer>
    </div>
  );
};

export default DashboardA;
