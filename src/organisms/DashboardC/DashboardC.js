import React, { useContext, useEffect, useMemo, useRef, useState } from "react";
import "./styles.scss";
import ServiceContext from "../../ServiceContext";
import RetainClock from "../AgentChat/RetainClock";
import { groupOwed } from "../AgentChat/owed";
import { openAddress } from "../../atoms/Markdown/openRef";
import { hostFiles } from "../../utils/hostFiles";
import { KINDS, KIND_PLURAL, KIND_WORD, currentFrom, shelvesFrom } from "./dashboardC.data";

// ═══ THE SHELVES ═══════════════════════════════════════════════════════════════════════════════
//
// ONE PLACE TO SEE EVERY KIND OF THING AND ITS PROGRESS, ACROSS EVERY PROJECT AT ONCE. His words:
// *"the dashboard is about all the different kind of things, you know, arcs or RFCs, in their
// progress, and reports"* — and *"to be able to see all the stuff that's waiting, all the projects
// going on at the same time."*
//
// THE POINT OF VIEW THIS PAGE COMMITS TO, in one sentence: **a dashboard is not an inventory, it
// is a debt statement.** Three things follow from it and they are the whole design.
//
//   1. IT OPENS WITH WHAT NEEDS HIM, not with how much exists. The first thing on the page is the
//      owed band — presses in one column, outstanding work in the other, each one a SENTENCE
//      somebody wrote about a specific document. "31 documents" is a fact about the folder; "the
//      proof is in the file — one press from resolved" is a fact about his afternoon.
//
//   2. THEN IT SHOWS WHERE THE MASS SITS. The current: four tracks, one per kind, each one that
//      kind's own lifecycle trail, with every document in every project as a dot at its station.
//      Nothing to read — a pile at `draft` is a planning backlog, a pile at `built` is proof debt,
//      a pile at `approved` on arcs is work nobody has planned. That is the "what is going on"
//      half, and it is a picture rather than a number because the question is about SHAPE.
//
//   3. THEN THE SHELVES — one per project, four stacks each, his own visual cue taken seriously
//      and generalised: *"reports looking like a stack with numbers, and then you click them and
//      they expand out horizontally."* A stack is a physical thing with depth; press it and it
//      FANS, card after card sliding out sideways, each with its own meter. Every project is on
//      screen at once as four stacks, so "all the projects going on at the same time" is the
//      default state of the page and not a filter he has to set.
//
// AND THE METERS REFUSE TO FLATTER. One percent-done over four kinds would be a number nothing can
// act on, so progress is drawn in each kind's own terms: objectives for an arc with blocked as its
// own segment, CLAIMS for an RFC with `unproved` as its own segment — met is marked met AND proved,
// and the width between them is the width of the lie a green bar would tell — and for a report, a
// clock draining, the only thing on this page that gets worse while he does nothing.
//
// IT PRESSES NOTHING. Every card and every owed row OPENS ITS DOCUMENT, because that is where the
// control lives: the facilitation ladder for an approval, the clock's keep-or-let-go on a report's
// leaf, the objective's own block. A list that signs for you is a list that decides for you.
//
// NOTHING HERE IS DERIVED. Every number comes from the module that already owned it — arcRows,
// rfcRows, gapRows, claimsOf, retainLine, stateOf, owedFrom — joined in `dashboardC.data.js`,
// which has its own jest suite. This file is a wire and a stylesheet.

const FLAG = { press: "⚑", clock: "⧗" };

// WHAT A CARD'S MARK MEANS, and the mark belongs to the KIND of attention, never to the position —
// the rule `owed.js` wrote for the band head, obeyed here so one glyph cannot mean two things in
// one window. ⚑ is "a decision is waiting on you"; a press that is a CLOCK carries ⧗ instead,
// because a deadline is not a decision: nothing he presses makes it not have been due.
const markOf = (card) => (card.meter && card.meter.urgent ? FLAG.clock : card.press ? FLAG.press : "");

/** A meter: segments in their own hues, widths in proportion, and nothing drawn when there is nothing to say. */
const Meter = ({ meter, kind }) => {
  if (!meter || !meter.segs || !meter.segs.length) return null;
  const total = meter.total || meter.segs.reduce((n, s) => n + s.n, 0) || 1;
  return (
    <div className={`dbc-meter dbc-meter--${kind}`} aria-hidden="true">
      {meter.segs.map((s) => (
        <i key={s.k} className={`dbc-meter__seg is-${s.k}`} style={{ flexGrow: s.n / total }} />
      ))}
    </div>
  );
};

/**
 * ONE CARD — a document's face on the shelf. It opens the document and does nothing else: see
 * `open` below for the one door, and the reason there is only one.
 */
const Card = ({ card, open }) => (
  <button
    type="button"
    className={`dbc-card dbc-card--${card.kind}${card.press ? " is-press" : ""}${card.work ? " is-work" : ""}${
      card.unread || card.missing ? " is-blind" : ""
    }${card.fixture ? " is-fixture" : ""}`}
    onClick={() => open(card)}
    title={`${card.id} — ${card.path}`}
  >
    <span className="dbc-card__top">
      <span className="dbc-card__id">{card.id}</span>
      {card.station ? <span className="dbc-card__station">{card.station}</span> : <span className="dbc-card__station is-none">not parsed</span>}
      {markOf(card) ? <span className={`dbc-card__mark${card.meter && card.meter.urgent ? " is-urgent" : ""}`}>{markOf(card)}</span> : null}
    </span>
    <span className="dbc-card__title">{card.title || card.path}</span>
    <Meter meter={card.meter} kind={card.kind} />
    <span className={`dbc-card__line${card.meter && card.meter.urgent ? " is-urgent" : ""}`}>
      {/* THE ONE NUMBER ON THIS PAGE THAT MOVES ON ITS OWN. `RetainClock` is the drawer's own
          counting face — one interval at the cadence the words have — so a report in its last hour
          ticks here exactly as it ticks there, and neither is a second clock. */}
      {card.kind === "report" && card.meter && card.meter.counting ? (
        <RetainClock state={card.rowState} openedAt={card.openedAt} className="dbc-card__clock" />
      ) : (
        card.line
      )}
    </span>
    {card.says.length ? <span className="dbc-card__says">{card.says[0]}</span> : null}
    {/* THE ROW IS A CACHE OF THE LAST PARSE, and when the file on disk is newer the card SAYS so
        rather than quietly being wrong about where a document stands. */}
    {card.stale ? <span className="dbc-card__stale">the file has moved on since this was read</span> : null}
    {card.fixture ? <span className="dbc-card__stale">a proof fixture — owed.js counts it out of his obligations</span> : null}
  </button>
);

/**
 * ONE STACK — closed it is depth and a number, pressed it FANS horizontally. His cue, taken as the
 * page's whole interaction model: a stack you can riffle. The closed face carries the count and
 * the one thing worth knowing before opening it (how many of these need him), so a stack he does
 * not open has still told him something.
 */
const Stack = ({ kind, cards, fanned, onToggle, open }) => {
  const needs = cards.reduce((n, c) => n + c.press, 0);
  const work = cards.reduce((n, c) => n + c.work, 0);
  const urgent = cards.some((c) => c.meter && c.meter.urgent);
  if (!cards.length)
    return (
      <div className={`dbc-stack dbc-stack--${kind} is-empty`}>
        <span className="dbc-stack__count">0</span>
        <span className="dbc-stack__kind">no {KIND_PLURAL[kind]} registered</span>
      </div>
    );
  return (
    <div className={`dbc-stack dbc-stack--${kind}${fanned ? " is-fanned" : ""}`}>
      <button type="button" className="dbc-stack__face" onClick={onToggle} aria-expanded={fanned}>
        {/* THE DEPTH IS DRAWN, up to four leaves — a stack of thirty and a stack of three must not
            look the same, and a stack of thirty drawn thirty deep is a smear. */}
        <span className="dbc-stack__leaves" aria-hidden="true">
          {[...Array(Math.min(4, cards.length - 1))].map((_, i) => (
            <i key={i} style={{ transform: `translate(${(i + 1) * 3}px, ${(i + 1) * 3}px)` }} />
          ))}
        </span>
        <span className="dbc-stack__count">{cards.length}</span>
        <span className="dbc-stack__kind">{cards.length === 1 ? KIND_WORD[kind] : KIND_PLURAL[kind]}</span>
        <span className="dbc-stack__owed">
          {needs ? (
            <b className={urgent ? "is-urgent" : ""}>
              {urgent ? FLAG.clock : FLAG.press} {needs}
            </b>
          ) : null}
          {work ? <i>{work} outstanding</i> : null}
          {!needs && !work ? <i className="is-clear">nothing owed</i> : null}
        </span>
      </button>
      {/* IT EXPANDS OUT HORIZONTALLY — his words exactly. The fan is a horizontal scroller, so a
          project with thirty RFCs riffles sideways instead of pushing every other project's
          shelf off the bottom of the page. */}
      <div className="dbc-fan" role="list">
        {fanned
          ? cards.map((c, i) => (
              <div className="dbc-fan__slot" role="listitem" key={c.key} style={{ animationDelay: `${Math.min(i, 12) * 22}ms` }}>
                <Card card={c} open={open} />
              </div>
            ))
          : null}
      </div>
    </div>
  );
};

/** THE CURRENT — one track per kind, every document a dot at its station, all projects at once. */
const Track = ({ track, open }) => (
  <div className={`dbc-track dbc-track--${track.kind}`}>
    <div className="dbc-track__name">
      {KIND_PLURAL[track.kind]} <b>{track.total}</b>
      {track.unparsed ? <i> · {track.unparsed} the registry has no state for</i> : null}
    </div>
    <div className="dbc-track__rail">
      {track.stations.map((s) => (
        <div key={s.station} className={`dbc-stn${s.cards.length ? " has-mass" : ""}`}>
          <div className="dbc-stn__dots">
            {s.cards.slice(0, 18).map((c) => (
              <button
                type="button"
                key={c.key}
                className={`dbc-dot${c.press ? " is-press" : ""}${c.meter && c.meter.urgent ? " is-urgent" : ""}${
                  c.work ? " is-work" : ""
                }`}
                title={`${c.project ? `${c.project} · ` : ""}${c.id} — ${c.title || c.path}${c.line ? ` · ${c.line}` : ""}`}
                onClick={() => open(c)}
              />
            ))}
            {s.cards.length > 18 ? <span className="dbc-stn__more">+{s.cards.length - 18}</span> : null}
          </div>
          {/* THE TICK IS ITS OWN ELEMENT, not a pseudo on the station. As a `::after` it was
              positioned against the station box and landed in the middle of the station's own
              NAME — a dot sitting on the word "draft", which is what made the row unreadable. */}
          <span className="dbc-stn__tick" aria-hidden="true" />
          <div className="dbc-stn__foot">
            <span className="dbc-stn__name">{s.station}</span>
            {/* ZERO IS SAID OUT LOUD. A blank under a station could mean none, or could mean
                nobody measured it, and those are not the same answer. */}
            <b className="dbc-stn__n">{s.cards.length}</b>
          </div>
        </div>
      ))}
    </div>
  </div>
);

/**
 * ONE OWED CARD PER DOCUMENT — a sentence somebody wrote about it, and a door to it.
 *
 * An arc with four obligations was four cards in a column of nine, so the column read as nine
 * places to go when it was four. The card carries the strongest one and opens into the rest.
 */
const Owed = ({ item, open, shown, onToggle }) => {
  const one = !item.n || item.n === 1;
  return (
    <div className={`dbc-owed__g${shown ? " is-open" : ""}`}>
      <button
        type="button"
        className={`dbc-owed dbc-owed--${item.kind} is-${item.why}`}
        aria-expanded={one ? undefined : shown}
        onClick={() => (one ? open(item) : onToggle())}
      >
        <span className="dbc-owed__who">
          {item.project ? <em>{item.project}</em> : null}
          <b>{item.id}</b>
          <i>{item.why}</i>
        </span>
        <span className="dbc-owed__says">{item.says}</span>
        {item.tail ? <span className="dbc-owed__tail">{item.tail}</span> : null}
        {one ? null : <span className="dbc-owed__n">and {item.n - 1} more on this document ⌄</span>}
      </button>
      {one || !shown ? null : (
        <div className="dbc-owed__items">
          {item.items.map((o) => (
            <button type="button" key={o.key} className={`dbc-owed__item is-${o.why}`} onClick={() => open(o)}>
              <i>{o.why}</i>
              <span>{o.says}</span>
              {o.tail ? <em>{o.tail}</em> : null}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

// ═══ THE WIRE ══════════════════════════════════════════════════════════════════════════════════

/**
 * EVERY PROJECT'S REGISTRY, AND EVERY DOCUMENT'S TEXT. `documentsRegistry({})` with no filters is
 * the whole list across every project — that is the door's own contract — and `projectRoots()` is
 * the WIDER list of projects, folder-only ones included, which is why both are asked.
 *
 * THE FINGERPRINT IS WHAT MAKES THE POLL CHEAP. Re-reading forty documents every thirty seconds
 * would be forty hub round-trips for an answer that did not change; the print over
 * (id, path, parsed, openedAt, stale, missing) changes exactly when a re-read would say something
 * new. Copied from the band's own wiring (AgentChat.js) rather than invented, because it is the
 * same read with the same cost.
 *
 * AND A FAILURE IS AN EMPTY ANSWER WITH A REASON, never a stale one. `counted: 0` is what makes
 * the band say nothing at all rather than "nothing owed" — a zero nobody measured must never read
 * as a zero.
 */
function useEverything() {
  const { SystemViewService } = useContext(ServiceContext);
  const [state, setState] = useState({ docs: [], roots: {}, at: 0, error: "" });
  const print = useRef("");
  const docs = useRef([]);

  useEffect(() => {
    let dead = false;
    const pull = async () => {
      try {
        const svc = SystemViewService && SystemViewService.Agent;
        const hub = SystemViewService && SystemViewService.SystemView;
        if (!svc || !svc.documentsRegistry) {
          if (!dead) setState({ docs: [], roots: {}, at: Date.now(), error: "this hub has no document registry — nothing was read" });
          return;
        }
        const roots = (hub && hub.projectRoots ? await hub.projectRoots() : null) || {};
        const raw = (await svc.documentsRegistry({})) || [];
        const rows = (Array.isArray(raw) ? raw : []).filter((r) => r && r.id && r.path);
        const next = rows
          .map((r) => `${r.id}@${r.path}@${(r.state || {}).parsed || 0}@${r.openedAt || 0}@${r.stale ? 1 : 0}@${r.missing ? 1 : 0}`)
          .sort()
          .join("|");
        if (next !== print.current) {
          print.current = next;
          // A row whose file is gone, and a retired document, owe nothing and are not read — both
          // are still handed to the derivation, which counts them out loud. `text: undefined` is
          // what "could not be read" means there, and it is carried rather than swallowed.
          docs.current = await Promise.all(
            rows.map(async (row) => {
              if (row.missing || (row.state || {}).retired) return { row };
              try {
                const files = hostFiles(row.project || "");
                const f = await files.readFile({ path: row.path });
                return { row, text: f && f.ok !== false ? f.content || "" : undefined };
              } catch {
                return { row };
              }
            }),
          );
        }
        if (!dead) setState({ docs: docs.current, roots, at: Date.now(), error: "" });
      } catch (e) {
        if (!dead) setState({ docs: [], roots: {}, at: Date.now(), error: String((e && e.message) || e) });
      }
    };
    pull();
    const t = setInterval(pull, 30000);
    return () => {
      dead = true;
      clearInterval(t);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [SystemViewService]);

  return state;
}

const EMPTY = {
  projects: "No project is registered with this hub. Nothing was read — this is not an empty inbox.",
  documents:
    "Projects are registered and the document registry is empty. Nothing has been parsed yet, so no arc, RFC, gap or report exists to show — that is a cold registry, not a clear desk.",
  unread:
    "Documents are registered and not one of them could be opened. Every number on this page comes out of the text, so there are no numbers — the hub could not read the files.",
};

export default function DashboardC() {
  const { docs, roots, at, error } = useEverything();
  // A BEAT, so a clock that is counting keeps the page honest between polls. The cards' own
  // RetainClock ticks itself; this is only for the band's urgency wording, and it is a minute —
  // the finest granularity anything up here reads at.
  const [, setBeat] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setBeat((b) => b + 1), 60000);
    return () => clearInterval(t);
  }, []);

  const data = useMemo(() => shelvesFrom({ docs, roots, now: Date.now() }), [docs, roots, at]); // eslint-disable-line react-hooks/exhaustive-deps
  const tracks = useMemo(() => currentFrom(data.shelves), [data]);
  // WHICH STACKS ARE FANNED — the page's only state, and it is per project-and-kind so opening the
  // RFCs on one project leaves every other shelf exactly as it was. Nothing is open by default: a
  // page that opens every stack is the table this is not.
  const [fanned, setFanned] = useState({});
  // WHICH COUNT HE PRESSED, or "" for everything. A view, not a fact — nothing here changes
  // what is owed, so this is the one piece of page state that no document can disagree with.
  const [only, setOnly] = useState("");

  // THE FILTER IS MEMBERSHIP IN THE SEGMENT'S OWN LIST — never a second predicate. A `why ===`
  // test written here would agree with the head today and drift the first time either side
  // learns a new kind of obligation.
  const chosen = data.head.segs.find((s) => s.key === only);
  const keep = chosen ? new Set(chosen.keys) : null;
  // FOLDED AFTER FILTERING, not before — filter the obligations, then group what survived, or a
  // document would keep a count of things the filter had already taken off the page.
  const shownPress = groupOwed(keep ? data.owed.press.filter((p) => keep.has(p.key)) : data.owed.press);
  const shownWork = groupOwed(keep ? data.owed.work.filter((p) => keep.has(p.key)) : data.owed.work);

  const toggle = (key) => setFanned((f) => ({ ...f, [key]: !f[key] }));

  // THE ONE OPENER (openRef.js): *"every surface that opens a file address calls THIS, and nothing
  // else dispatches sv:openFileInNav."* A document is a markdown file, so it rides the door files
  // already ride — the Code page's own listener (pages/SystemView) and every other page's doc
  // panel (useOpenedFile) both answer it, which is why there is no second branch here and no
  // navigation fallback: throwing the window over to another page to read one card would undo the
  // thing this page is for. `lines` carries the obligation's own line, so a card marked by an
  // unsigned approval lands him ON the approval rather than at the top of a forty-page RFC.
  //
  // ONE DOOR FOR BOTH SHAPES. A card carries the line as `at` (its `line` is the row's SENTENCE);
  // an owed item carries it as `line`, a number, straight from `owedFrom`. Both are accepted here
  // so there is one opener rather than two — and `Number` on a sentence is NaN, which is falsy, so
  // a card's words can never be mistaken for a line number.
  const open = (t) =>
    openAddress({
      projectCode: t.project || "",
      path: t.path,
      language: "markdown",
      lines: Number(t.at) ? [Number(t.at)] : Number(t.line) ? [Number(t.line)] : null,
    });

  return (
    <div className="dbc">
      {/* ── WHAT NEEDS HIM. First, loudest, in sentences. ───────────────────────────────────── */}
      <header className="dbc-head">
        <div className="dbc-head__top">
          <h1>Across everything</h1>
          <span className="dbc-head__counts">
            {data.projects} {data.projects === 1 ? "project" : "projects"} · {data.documents}{" "}
            {data.documents === 1 ? "document" : "documents"} · {data.counted} read
          </span>
        </div>
        {/* THE COUNTS ARE DOORS. *"Waiting, expiring, outstanding — those look like you should be
            able to click them."* They did not look pressable by accident: they were the only
            numbers on the page with nothing behind them, so reading "4 approvals waiting" left
            him to go and find which four.

            THE SEGMENT CARRIES THE ITEMS IT COUNTED (`owedHead`), so pressing one shows exactly
            the rows the number came from — the list cannot drift from the count, because they
            are the same array. A segment with nothing behind it (nothing owed) stays a label:
            a control that filters to the empty set is a control that lies about having one. */}
        <div className="dbc-head__segs">
          {data.head.segs.map((s) =>
            s.keys && s.keys.length ? (
              <button
                type="button"
                key={s.key}
                className={`dbc-seg is-${s.key}${only === s.key ? " is-on" : ""}`}
                aria-pressed={only === s.key}
                title={only === s.key ? "showing only these — press to show everything" : `show only ${s.text}`}
                onClick={() => setOnly((o) => (o === s.key ? "" : s.key))}
              >
                {s.flag ? <b>{s.flag}</b> : null}
                {s.text}
              </button>
            ) : (
              <span key={s.key} className={`dbc-seg is-${s.key}`}>
                {s.flag ? <b>{s.flag}</b> : null}
                {s.text}
              </span>
            ),
          )}
          {data.head.unread ? <span className="dbc-seg is-unread">{data.head.unread} unread</span> : null}
        </div>
        {/* A SURFACE THAT SILENTLY OMITS IS THE FAILURE THIS SYSTEM EXISTS TO STOP, so what was
            left out is said in `owed.js`'s own sentence, not hidden behind a count. */}
        {data.skipped ? <div className="dbc-head__skipped">{data.skipped}</div> : null}
        {error ? <div className="dbc-head__error">nothing was read — {error}</div> : null}
      </header>

      {data.empty ? <div className="dbc-void">{EMPTY[data.empty]}</div> : null}

      {data.owed.press.length || data.owed.work.length ? (
        <section className="dbc-owes">
          <div className="dbc-owes__col">
            <h2>
              <b>⚑</b> press — your signature finishes it
            </h2>
            {shownPress.length ? (
              shownPress.map((p) => <Owed key={p.key} item={p} open={open} shown={!!fanned[p.key]} onToggle={() => toggle(p.key)} />)
            ) : (
              <p className="dbc-owes__none">
                {only ? "none of these are in what you pressed" : "nothing waiting on a verdict of yours"}
              </p>
            )}
          </div>
          <div className="dbc-owes__col">
            <h2>outstanding — nobody can press it away</h2>
            {shownWork.length ? (
              shownWork.map((p) => <Owed key={p.key} item={p} open={open} shown={!!fanned[p.key]} onToggle={() => toggle(p.key)} />)
            ) : (
              <p className="dbc-owes__none">{only ? "none of these are in what you pressed" : "nothing outstanding"}</p>
            )}
          </div>
        </section>
      ) : null}

      {/* ── WHERE THE MASS SITS. Four lifecycles, every project's documents on them. ────────── */}
      {tracks.length ? (
        <section className="dbc-current">
          {/* THE HEADING SAYS WHAT YOU ARE LOOKING AT, in words nobody has to be taught. "The
              current" was a metaphor about where the mass flows, and it cost him the section:
              *"I can't read the current… just make this section make sense, I don't understand
              what it means."* A title you have to decode is a title that fails the one reader. */}
          <h2>
            Where everything stands{" "}
            <i>every document in every project, parked at the step its lifecycle says it reached</i>
          </h2>
          {/* THE KEY IS PART OF THE SECTION, NOT A FOOTNOTE. A field of coloured dots means
              nothing until something says a dot is a document; it was readable only to whoever
              wrote it. */}
          <p className="dbc-current__key">
            <span>each dot is one document — press it to open · they travel left to right</span>
            <span className="dbc-key">
              <i className="dbc-dot is-press" /> waiting on your press
            </span>
            <span className="dbc-key">
              <i className="dbc-dot is-work" /> outstanding
            </span>
            <span className="dbc-key">
              <i className="dbc-dot" /> nothing owed
            </span>
          </p>
          {tracks.map((t) => (
            <Track key={t.kind} track={t} open={open} />
          ))}
        </section>
      ) : null}

      {/* ── THE SHELVES. One per project, four stacks, press one and it fans. ───────────────── */}
      {data.shelves.length ? (
        <section className="dbc-shelves">
          <h2>
            The shelves <i>press a stack and it fans out</i>
          </h2>
          {data.shelves.map((s) => (
            <div className="dbc-shelf" key={s.project || "(no project)"}>
              <div className="dbc-shelf__name">
                <b>{s.project || "no project on the row"}</b>
                <span className="dbc-shelf__owed">
                  {s.press ? <em className="is-press">⚑ {s.press} to press</em> : null}
                  {s.work ? <em className="is-work">{s.work} outstanding</em> : null}
                  {!s.press && !s.work && s.documents ? <em className="is-clear">nothing owed</em> : null}
                  {!s.documents ? <em className="is-clear">nothing registered here</em> : null}
                  {s.unread ? <em className="is-blind">{s.unread} unreadable</em> : null}
                </span>
                {s.root ? <code>{s.root}</code> : null}
              </div>
              <div className="dbc-shelf__stacks">
                {KINDS.map((k) => (
                  <Stack
                    key={k}
                    kind={k}
                    cards={s.cards[k]}
                    fanned={!!fanned[`${s.project}:${k}`]}
                    onToggle={() => toggle(`${s.project}:${k}`)}
                    open={open}
                  />
                ))}
              </div>
            </div>
          ))}
        </section>
      ) : null}

      <footer className="dbc-foot">
        Every number here is read from the module that owns it — <code>arcRows</code>, <code>rfcRows</code>,{" "}
        <code>gapRows</code>, <code>claimsOf</code>, <code>retainLine</code>, <code>stateOf</code>, <code>owedFrom</code> — joined
        in <code>dashboardC.data.js</code>. Nothing on this page presses anything: a card opens its document, because the
        control lives there.
      </footer>
    </div>
  );
}
