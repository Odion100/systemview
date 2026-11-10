import React from "react";
import { PHASES, kindsIn } from "../../../DashboardA/dashboardA.data";
import { fillStyle } from "../../../../atoms/meterWidth";

// ─── A'S PIECES — THE PARTS MORE THAN ONE OF A'S TILES DRAWS ───────────────────────────────────
//
// These came out of `DashboardA.js` unchanged, character for character, because the one thing this
// extraction may not do is move a pixel. They live here rather than in a tile file because the
// chip is in all three tiles and the mark is in two, and a copy per tile is how two versions of
// the same dot start disagreeing about what a colour means.
//
// NOTHING HERE READS THE HUB and nothing here holds a timer. Every one of them is handed what it
// draws, including `open` — the surface's own opener, so a tile on the configurable surface and a
// tile on this page send a file address through the same single door.

export const KIND_WORD = { rfc: "RFC", arc: "arc", gap: "gap", report: "report" };

/** The kind's letter in the kind's colour — the legend for every mark and row on the page. */
export const Chip = ({ kind, children }) => (
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
 *   THE PULSE it owes him something. The pulse is a POINTER, not a press.
 *
 * PRESSING ONE FILTERS THE LANE BELOW IT TO THAT ONE DOCUMENT — it does not open the file. His
 * call: *"clicking them shouldn't take you to the document. I don't like that."* The card already
 * says what the mark is, so the press is for narrowing, and the row it reveals is the door.
 *
 * A mark whose file has drifted past the last parse gets a motion trail, because on a page about
 * movement the one honest signal of movement is the registry's own lag (§1.4).
 */
export const Mark = ({ m, onPress, pressed }) => {
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
      onClick={onPress}
      aria-pressed={!!pressed}
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
              <span className="dba-bar__done" style={fillStyle(m.bar.done, total)} />
              <span className="dba-bar__extra" style={fillStyle(m.bar.extra, total)} />
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
export const StackPile = ({ reports, open: fanned, onToggle }) => {
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
export const StackFan = ({ reports, open: fanned, onOpen }) =>
  !reports.length ? null : (
    <div className={`dba-fan${fanned ? " is-open" : ""}`} aria-hidden={!fanned}>
      {reports.map((r, i) => (
        <button
          type="button"
          key={r.key}
          className={`dba-sheet${r.urgent ? " is-soon" : ""}${r.retired ? " is-retired" : ""}${r.fixture ? " is-fixture" : ""}`}
          style={{ "--i": i }}
          tabIndex={fanned ? 0 : -1}
          onClick={() => onOpen({ project: r.project, path: r.path })}
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
export const OwedGroup = ({ g, open: shown, onToggle, onOpen }) => {
  const one = g.n === 1;
  return (
    <div className={`dba-owed__g${shown ? " is-open" : ""}`}>
      <button
        type="button"
        className={`dba-owed is-${g.group} is-${g.why}${one ? "" : " is-many"}`}
        aria-expanded={one ? undefined : shown}
        onClick={() => (one ? onOpen({ project: g.project, path: g.path, line: g.line }) : onToggle())}
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
              onClick={() => onOpen({ project: o.project, path: o.path, line: o.line })}
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

/** One project: who it is, what it owes, the track, the stack, and the numbers it is asked for. */
export const Lane = ({ p, fanned, onFan, picks, onPick, only, onOnly, heldAny, open }) => {
  // THE LANE'S OWN FILTER WORDS, and the rows they open. Derived from the marks in front of him,
  // so a word never offers a count that opens an empty list.
  const kinds = kindsIn(p.marks);
  const held = kinds.filter((k) => picks[k.kind]).map((k) => k.kind);
  // THE NUMBERS ARE ALWAYS SHOWING — that is the whole reason the show-hide went. Nothing held is
  // every document in the lane; the words NARROW it, they do not open it.
  //
  // A PINNED MARK IS THE NARROWEST FILTER THERE IS, so it wins over the kind words rather than
  // intersecting with them — pressing a mark means "just that one", and an intersection could
  // only ever answer with the same row or with nothing.
  const rows = only
    ? p.marks.filter((m) => m.key === only)
    : held.length
      ? p.marks.filter((m) => held.includes(m.kind))
      : p.marks;
  return (
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
                  <Mark key={m.key} m={m} pressed={only === m.key} onPress={() => onOnly(m.key)} />
                ))}
            </div>
          ))}
          <div className="dba-track__stack">
            {p.reports.length || !heldAny ? <StackPile reports={p.reports} open={fanned} onToggle={onFan} /> : null}
          </div>
        </div>
        <StackFan reports={p.reports} open={fanned} onOpen={open} />
        {/* THE KINDS IN THE LANE ARE THE CONTROL — there is no show-hide button left, because a
            show-hide answers one question ("is there more?") and the words answer the one he
            actually has ("where are the gaps?"). Pressing a word opens the numbers filtered to
            that kind; more than one at a time; letting them all go shows all of them again. */}
        {kinds.length ? (
          <div className="dba-lane__picks">
            {kinds.map((k) => (
              <button
                key={k.kind}
                type="button"
                className={`dba-pick dba-pick--${k.kind}${picks[k.kind] ? " is-on" : ""}`}
                aria-pressed={!!picks[k.kind]}
                onClick={() => onPick(k.kind)}
              >
                {k.n} {KIND_WORD[k.kind]}
                {k.n === 1 || k.kind === "rfc" ? "" : "s"}
              </button>
            ))}
          </div>
        ) : null}
        {rows.length ? (
          <ul className="dba-list">
            {rows.map((m) => (
              <li key={m.key}>
                <button type="button" className="dba-row" onClick={() => open({ project: m.project, path: m.path, line: (m.owes[0] && m.owes[0].line) || 1 })}>
                  <Chip kind={m.kind} />
                  <b className="dba-row__id">{m.id}</b>
                  <span className="dba-row__title">{m.title || "untitled"}</span>
                  {m.bar ? (
                    <span className="dba-row__bar">
                      <span className="dba-bar">
                        <span className="dba-bar__done" style={fillStyle(m.bar.done, m.bar.total)} />
                        <span className="dba-bar__extra" style={fillStyle(m.bar.extra, m.bar.total)} />
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
      // a folder nobody has looked at. This lane lives behind the fold now — folded, not dropped,
      // so the sentence is still there to open.
      <p className="dba-lane__none">
        nothing registered — no document in this project carries a leaf anything has parsed
        {p.root ? <code>{p.root}</code> : null}
      </p>
    )}
  </article>
  );
};
