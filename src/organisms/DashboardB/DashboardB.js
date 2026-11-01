import React, { useContext, useEffect, useMemo, useRef, useState } from "react";
import "./styles.scss";
import { groupOwed } from "../AgentChat/owed";
import ServiceContext from "../../ServiceContext";
import { hostFiles } from "../../utils/hostFiles";
import { onCodePage, openAddress } from "../../atoms/Markdown/openRef";
import { KINDS, emptyWords, floorFrom } from "./dashboardB.data";

// ─── THE FLOOR ─────────────────────────────────────────────────────────────────────────────────
//
// ONE PLACE FOR EVERY KIND OF THING AND ITS PROGRESS, ACROSS EVERY PROJECT. His ask, verbatim:
// *"the dashboard is about all the different kind of things, you know, arcs or RFCs, in their
// progress, and reports"* and *"to be able to see all the stuff that's waiting, all the projects
// going on at the same time."*
//
// THE POINT OF VIEW, committed to rather than hedged:
//
//   A DOCUMENT IS NOT A ROW, IT IS A THING STANDING SOMEWHERE. Every kind already has a lifecycle
//   trail, and the useful picture of a hundred documents is not their count — it is WHERE THEY ARE
//   STANDING. Eleven RFCs parked at `draft` and eleven parked at `built` are the same number and
//   completely different situations: one means nothing is getting decided, the other means nothing
//   is getting finished. A table shows one figure for both. So the middle of this page is three
//   TRACKS — the trails themselves — with every document a bead at its own station, carrying a
//   ring of its own progress and the mark of whatever it wants from him.
//
//   REPORTS ARE NOT ON A TRACK, BECAUSE REPORTS DO NOT PROGRESS — THEY AGE. Their trail is
//   `filed → retired` and the second station is their death. They arrive in a pile and the pile
//   drains, which is exactly the one visual he described: *"reports looking like a stack with
//   numbers, and then you click them and they expand out horizontally."* One stack per project,
//   because the other half of the ask is every project at once.
//
//   THE TOP IS ABOUT HIM, NOT ABOUT INVENTORY. The first thing on the page is what needs him,
//   split the way `owed.js` splits it — PRESS (your signature finishes it) and OUTSTANDING (nobody
//   can press it away) — because that is the question every pixel here is answering.
//
// THREE RULES IT IS BUILT TO:
//   1. IT DERIVES NOTHING NEW. Every number comes from the module that owns it, through
//      `dashboardB.data.js`. A second answer to "how far along is this arc" is how a surface starts
//      disagreeing with the drawer.
//   2. IT PRESSES NOTHING. Every bead, row and card OPENS ITS DOCUMENT, because that is where the
//      control lives — the facilitation ladder for an approval, the clock's keep-or-let-go on a
//      report's leaf. A list that signs for you is a list that decides for you.
//   3. IT NEVER CALLS AN UNMEASURED NOTHING A NOTHING. A zero over documents nobody could read is
//      not a zero, and the head says which it is.

const HUES = { rfc: "var(--dbb-rfc)", arc: "var(--dbb-arc)", gap: "var(--dbb-gap)", report: "var(--dbb-report)" };

// The station words a human says out loud. `inProgress` is the only one that needs it.
const STATION_WORDS = { inProgress: "in progress" };
const stationWord = (s) => STATION_WORDS[s] || s;

/** How often the page re-reads the registry. Same cadence and the same justification as the band's
 * owed poll: the fingerprint below makes an unchanged tick cost one registry read and no file
 * reads, and the derivation still re-runs every tick because a retention clock crosses into urgent
 * by the passage of time and nothing else. */
const EVERY = 30000;

// ─── THE RING ──────────────────────────────────────────────────────────────────────────────────
//
// SVG, not a conic gradient: a stroked arc is one compositor-cheap path and it reads correctly at
// 18px, where a gradient's edge goes to mush. NO ANIMATION ON IT — this page can hold a hundred of
// these and a hundred animated rings is a hot GPU for no information gained.
const Ring = ({ ratio, hue, drains }) => {
  const R = 7.5;
  const C = 2 * Math.PI * R;
  // NULL IS A REAL ANSWER and it draws as an EMPTY ring with a dashed edge, never as 0%. An RFC
  // with no claims list has no progress; painting it at zero would invent a failure nobody reported.
  const none = ratio == null;
  return (
    <svg className="dbb-ring" viewBox="0 0 20 20" aria-hidden="true">
      <circle className={`dbb-ring__track${none ? " is-none" : ""}`} cx="10" cy="10" r={R} />
      {!none && (
        <circle
          className="dbb-ring__fill"
          cx="10"
          cy="10"
          r={R}
          // STYLE, NOT A PRESENTATION ATTRIBUTE. `hue` is `var(--dbb-rfc)`, and `var()` is NOT
          // substituted inside an SVG presentation attribute in any browser — `stroke="var(…)"`
          // is an invalid paint, and SVG's initial stroke is `none`, so with no CSS rule supplying
          // one the arc never drew at all. Every ring showed its grey track and nothing else: the
          // progress signal this page is built around was invisible, and the tests could not see
          // it because jsdom computes no SVG paint.
          style={{ stroke: hue }}
          strokeDasharray={`${Math.max(0, Math.min(1, ratio)) * C} ${C}`}
          // a draining ring reads anticlockwise from the top — it is giving the length back
          transform={drains ? "rotate(-90 10 10) scale(1,-1) translate(0,-20)" : "rotate(-90 10 10)"}
        />
      )}
    </svg>
  );
};

// ─── ONE BEAD ──────────────────────────────────────────────────────────────────────────────────

const Bead = ({ bead, onOpen }) => (
  <button
    type="button"
    className={`dbb-bead${bead.press ? " is-press" : ""}${bead.work ? " is-work" : ""}${bead.stale ? " is-stale" : ""}`}
    style={{ "--hue": HUES[bead.kind] }}
    onClick={() => onOpen(bead)}
    title={[
      `${bead.id}${bead.title ? ` — ${bead.title}` : ""}`,
      bead.project,
      bead.says,
      bead.warn,
      bead.owes,
      bead.stale ? "the file has changed since this was parsed" : "",
    ]
      .filter(Boolean)
      .join("\n")}
  >
    <Ring ratio={bead.ratio} hue={HUES[bead.kind]} drains={bead.drains} />
    <span className="dbb-bead__id">{bead.id}</span>
    {bead.mark ? <span className="dbb-bead__mark">{bead.mark}</span> : null}
  </button>
);

// ─── THE PAGE ──────────────────────────────────────────────────────────────────────────────────

export default function DashboardB() {
  const { SystemViewService } = useContext(ServiceContext);
  const [floor, setFloor] = useState(null);
  const [trouble, setTrouble] = useState("");
  const [fanned, setFanned] = useState("");
  const [openTrack, setOpenTrack] = useState("");
  const [showQuiet, setShowQuiet] = useState(false);
  // WHICH DOCUMENTS ARE FANNED OPEN in the owed lists. Keyed by `groupOwed`'s key, which carries
  // the project — so opening alpha's RFC-001 does not open beta's.
  const [fold, setFold] = useState({});

  // THE GATE. The fingerprint is every row's identity, its last parse, when he first opened it and
  // whether the file has drifted past that parse — which is every input the obligations and the
  // progress turn on. Unchanged → no file reads at all; the texts already in hand are re-derived
  // anyway, because a clock moves on its own.
  const print = useRef("");
  const docs = useRef([]);
  const roots = useRef({});

  useEffect(() => {
    let dead = false;
    const pull = async () => {
      try {
        const agent = SystemViewService && SystemViewService.Agent;
        const sv = SystemViewService && SystemViewService.SystemView;
        if (!agent || !agent.documentsRegistry) {
          if (!dead) setTrouble("this hub has no document registry door — nothing here can be read");
          return;
        }
        // THE WIDEST LIST OF PROJECTS THERE IS. `projectRoots()` includes the folder-only projects
        // `getProjects()` misses, and the denominator is the whole point of this page: a count over
        // one project out of twelve is not a picture of the system.
        if (sv && sv.projectRoots) {
          try {
            roots.current = (await sv.projectRoots()) || {};
          } catch {
            roots.current = {};
          }
        }
        // NO FILTERS — every kind, every project, in one read. The registry IS the list of what
        // exists (RFC-073); this never walks a folder, because a folder scan picks up the
        // playground documents that hold a live unverdicted approval for the reader to press.
        const rows = (await agent.documentsRegistry({})) || [];
        const all = (Array.isArray(rows) ? rows : []).filter((r) => r && r.id && r.path);
        const fp = all
          .map((r) => `${r.id}@${r.project}@${r.path}@${(r.state || {}).parsed || 0}@${r.openedAt || 0}@${r.stale ? 1 : 0}@${r.missing ? 1 : 0}`)
          .sort()
          .join("|");
        if (fp !== print.current) {
          print.current = fp;
          // A ROW WHOSE FILE IS GONE AND A RETIRED ONE ARE NOT READ — but both are still handed to
          // the derivation, which counts them out loud. `text: undefined` is what "could not be
          // read" means there, and it is carried rather than swallowed.
          docs.current = await Promise.all(
            all.map(async (row) => {
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
        if (!dead) {
          setTrouble("");
          setFloor(floorFrom({ docs: docs.current, projects: roots.current, now: Date.now() }));
        }
      } catch (e) {
        // AN EMPTY ANSWER, NOT A STALE ONE, AND IT SAYS SO. `counted: 0` is what makes the head
        // refuse to say "nothing owed" — a zero we did not measure must never read as a zero.
        if (!dead) {
          setTrouble(String((e && e.message) || e));
          setFloor(floorFrom({ docs: [], projects: roots.current, now: Date.now() }));
        }
      }
    };
    pull();
    const t = setInterval(pull, EVERY);
    return () => {
      dead = true;
      clearInterval(t);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [SystemViewService]);

  // THE ONE OPENER (openRef.js) — offer it to whatever document display this page is mounted in,
  // and navigate only if nothing answered, which is the rule that file already writes. `lines` is
  // the obligation's own block, so a press is one scroll away rather than a file hunt.
  //
  // IT PRESSES NOTHING. Opening the document is the whole interaction this page offers, because
  // the control lives in the document — the facilitation ladder for an approval, the keep-or-let-go
  // on a report's leaf, the objective's own block.
  const open = (bead) => {
    const d = openAddress({
      projectCode: bead.project,
      path: bead.path,
      language: "markdown",
      lines: bead.line > 1 ? [bead.line, bead.line] : undefined,
    });
    if (d.handled || onCodePage()) return;
    // Nothing on this page hosted it. Rather than leaving a dead click, take the last-resort route
    // openRef documents: the Code page's own file door, which becomes a tab there.
    const q = new URLSearchParams();
    q.set("tab", "docs");
    q.set("file", bead.path);
    q.set("fproj", bead.project);
    q.set("flang", "markdown");
    if (bead.line > 1) q.set("flines", `${bead.line}-${bead.line}`);
    window.history.pushState({}, "", `/specs/${bead.project}?${q.toString()}`);
    // the router listens to popstate — this is how a pushed URL reaches it without a reload, which
    // is never on the table here (his standing rule: never suggest a page reload to him again)
    window.dispatchEvent(new PopStateEvent("popstate"));
  };

  const byId = useMemo(() => {
    const m = {};
    (floor ? floor.beads : []).forEach((b) => (m[`${b.project}:${b.id}`] = b));
    return m;
  }, [floor]);

  // An owed row is about a DOCUMENT, so it opens through the same bead the tracks open — one door,
  // one line, one place that decides where a click lands.
  const openOwed = (o) =>
    open(byId[`${o.project}:${o.id}`] ? { ...byId[`${o.project}:${o.id}`], line: o.line } : { project: o.project, path: o.path, line: o.line });

  // NO FLOOR YET IS EITHER THE FIRST TICK OR A DOOR THAT IS NOT THERE, and those must not look the
  // same: a page that says "reading…" forever about a hub with no registry is a page lying by
  // omission. The trouble is the message when there is one.
  if (!floor)
    return (
      <div className="dbb">
        <div className={`dbb-empty${trouble ? " is-bad" : ""}`}>{trouble || "reading the registry…"}</div>
      </div>
    );

  const { head, owed, tide, tracks, stacks, projects, beads, measured } = floor;
  const live = projects.filter((p) => !p.quiet);
  const quiet = projects.filter((p) => p.quiet);

  return (
    <div className="dbb">
      {/* ── THE HEAD: one sentence about him, then the shape of everything ───────────────── */}
      <header className="dbb-head">
        <div className="dbb-head__title">
          <h1>The floor</h1>
          <p>every kind of thing this system carries, in every project, and what it wants from you</p>
        </div>
        <div className="dbb-head__say">
          {head.segs.map((s) => (
            <span key={s.key} className={`dbb-say dbb-say--${s.key}`}>
              {s.mark ? <b className="dbb-say__mark">{s.mark}</b> : null}
              {s.text}
            </span>
          ))}
        </div>
        <div className="dbb-head__reach">
          {head.reach}
          {/* WHAT WAS LEFT OUT, ONCE. `skippedLine` is owed.js's own sentence and it already counts
              the fixtures — in OBLIGATIONS, which is the number that was actually excluded. Saying
              it again in documents put two different figures for one exclusion side by side. */}
          {head.skipped ? <span className="dbb-aside"> · {head.skipped}</span> : null}
          {trouble ? <span className="dbb-aside dbb-aside--bad"> · {trouble}</span> : null}
        </div>

        {/* THE TIDE — one bar, every document, four postures. The shape of the system before any
            reading happens: how much of it is waiting on him, how much is work nobody can press
            away, how much is clear, how much has left active service. */}
        {/* THE BAR COUNTS DOCUMENTS; THE SENTENCE ABOVE COUNTS OBLIGATIONS, and one document can
            hold two. Unlabelled, the two sets of numbers read as a contradiction, so the bar says
            what it is counting. */}
        <div className="dbb-tide__cap">every registered document, by what it wants from you</div>
        <div className="dbb-tide" role="img" aria-label={tide.map((t) => `${t.n} ${t.label}`).join(", ")}>
          {tide.map((t) => (
            <span key={t.key} className={`dbb-tide__seg dbb-tide__seg--${t.key}`} style={{ width: `${t.pct}%` }} title={`${t.n} ${t.label}`} />
          ))}
        </div>
        <div className="dbb-tide__legend">
          {tide.map((t) => (
            <span key={t.key} className={`dbb-tide__key dbb-tide__key--${t.key}`}>
              <i /> {t.n} {t.label}
            </span>
          ))}
        </div>
      </header>

      {/* ── WHAT NEEDS YOU ──────────────────────────────────────────────────────────────────
          The split is `owed.js`'s and the words are its words. PRESS means your signature
          finishes it; OUTSTANDING means nobody can press it away. Two unlike things, said as two,
          because that is the shape of the question he asked. */}
      <section className="dbb-needs">
        {[
          { key: "press", title: "waiting on your press", sub: "your signature finishes it", rows: groupOwed(owed.press) },
          { key: "work", title: "outstanding", sub: "nobody can press these away", rows: groupOwed(owed.work) },
        ].map((col) => (
          <div key={col.key} className={`dbb-col dbb-col--${col.key}`}>
            <div className="dbb-col__head">
              <h2>{col.title}</h2>
              <span>{col.sub}</span>
            </div>
            {col.rows.length ? (
              <ul className="dbb-owed">
                {/* ONE ROW PER DOCUMENT. An arc with four obligations was four rows, so a list
                    of nine read as nine places to go when it was four. The row carries the
                    strongest one; the fold carries the rest, each opening at its own block. */}
                {col.rows.map((o) => (
                  <li key={o.key}>
                    <button
                      type="button"
                      className="dbb-owed__row"
                      style={{ "--hue": HUES[o.kind] }}
                      aria-expanded={o.n > 1 ? !!fold[o.key] : undefined}
                      onClick={() => (o.n > 1 ? setFold((f) => ({ ...f, [o.key]: !f[o.key] })) : openOwed(o))}
                    >
                      <i className="dbb-owed__dot" />
                      <span className="dbb-owed__id">{o.id}</span>
                      <span className="dbb-owed__says">{o.says}</span>
                      <span className="dbb-owed__tail">{o.n > 1 ? `+${o.n - 1} more` : o.tail}</span>
                      <span className="dbb-owed__proj">{o.project}</span>
                    </button>
                    {o.n > 1 && fold[o.key] ? (
                      <ul className="dbb-owed__sub">
                        {o.items.map((x) => (
                          <li key={x.key}>
                            <button type="button" className="dbb-owed__subrow" onClick={() => openOwed(x)}>
                              <span className="dbb-owed__says">{x.says}</span>
                              <span className="dbb-owed__tail">{x.tail}</span>
                            </button>
                          </li>
                        ))}
                      </ul>
                    ) : null}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="dbb-col__none">{emptyWords(measured, "nothing", true)}</p>
            )}
          </div>
        ))}
      </section>

      {/* ── THE TRACKS ──────────────────────────────────────────────────────────────────────
          One track per kind that MOVES, drawn on the kind's own lifecycle trail. The empty station
          is the whole value of the picture: the distance between a crowded `draft` and an empty
          `settled` is the sentence "nothing is finishing", and no count says it. */}
      <section className="dbb-flow">
        <div className="dbb-flow__head">
          <h2>where everything is standing</h2>
          <span>each kind on its own trail · a ring is that document's own progress · ⚑ a decision of yours · ⧗ a clock</span>
        </div>
        {tracks.map((t) => {
          const k = KINDS.find((x) => x.kind === t.kind);
          const alone = openTrack && openTrack !== t.kind;
          return (
            <div key={t.kind} className={`dbb-track dbb-track--${t.kind}${alone ? " is-dimmed" : ""}`} style={{ "--hue": HUES[t.kind] }}>
              <button
                type="button"
                className="dbb-track__name"
                onClick={() => setOpenTrack(openTrack === t.kind ? "" : t.kind)}
                title={k.blurb}
              >
                <i />
                <b>{k.label}</b>
                <span>{t.total}</span>
              </button>
              <div className="dbb-track__rail">
                {t.stations.map((s) => (
                  <div key={s.station} className={`dbb-station${s.beads.length ? "" : " is-empty"}`}>
                    <div className="dbb-station__cap">
                      <span className="dbb-station__word">{stationWord(s.station)}</span>
                      <span className="dbb-station__n">{s.beads.length}</span>
                    </div>
                    <div className="dbb-station__beads">
                      {s.beads.map((b) => (
                        <Bead key={b.key} bead={b} onOpen={open} />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
        {!beads.length ? (
          <p className="dbb-flow__none">
            no documents are registered anywhere — which is not the same as nothing happening. A document is real
            when it carries a registration leaf and the shell has parsed it; until then nothing in this window can
            see it, including this page.
          </p>
        ) : null}
      </section>

      {/* ── THE REPORT STACKS ───────────────────────────────────────────────────────────────
          His one visual cue, and it lands on reports because it is TRUE of reports: a view with a
          lifecycle of days, arriving in a pile that drains. Press a stack and it opens out
          horizontally into the reports themselves, each wearing its own clock. */}
      <section className="dbb-stacks">
        <div className="dbb-flow__head">
          <h2>the reports</h2>
          <span>
            a report does not progress, it ages — the ring is what is LEFT of its retention, and the clock does not
            start until you first open it
          </span>
        </div>
        {stacks.length ? (
          <div className="dbb-stacks__row">
            {stacks.map((s) => {
              const isOpen = fanned === s.project;
              return (
                <div key={s.project} className={`dbb-stack${isOpen ? " is-open" : ""}${s.urgent ? " is-urgent" : ""}`}>
                  <button
                    type="button"
                    className="dbb-stack__face"
                    onClick={() => setFanned(isOpen ? "" : s.project)}
                    aria-expanded={isOpen}
                  >
                    <span className="dbb-stack__n">{s.n}</span>
                    <span className="dbb-stack__proj">{s.project}</span>
                    <span className="dbb-stack__urgent">
                      {s.urgent ? `${s.urgent} about to go` : isOpen ? "press to close" : "press to open out"}
                    </span>
                  </button>
                  <div className="dbb-fan">
                    {s.cards.map((c, i) => (
                      <button
                        key={c.key}
                        type="button"
                        className={`dbb-rcard${c.mark === "⧗" ? " is-urgent" : ""}`}
                        style={{ "--i": i, zIndex: s.cards.length - i }}
                        onClick={() => open(c)}
                        tabIndex={isOpen ? 0 : -1}
                        title={`${c.id}${c.title ? ` — ${c.title}` : ""}\n${c.says}`}
                      >
                        <span className="dbb-rcard__top">
                          <Ring ratio={c.ratio} hue={HUES.report} drains />
                          {c.mark ? <b className="dbb-rcard__mark">{c.mark}</b> : null}
                        </span>
                        <span className="dbb-rcard__id">{c.title || c.id}</span>
                        <span className="dbb-rcard__says">{c.says}</span>
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <p className="dbb-flow__none">no reports are registered in any project.</p>
        )}
      </section>

      {/* ── THE PROJECTS ────────────────────────────────────────────────────────────────────
          "All the projects going on at the same time" — and EVERY project the hub knows, not only
          the ones carrying documents. A project with nothing registered is a fact, not an absence;
          folding them into one honest line beats eleven empty cards and beats hiding them. */}
      <section className="dbb-projects">
        <div className="dbb-flow__head">
          <h2>the projects</h2>
          <span>ordered by what they want from you · the time is when the shell last PARSED something there</span>
        </div>
        <div className="dbb-projects__grid">
          {live.map((p) => (
            <div key={p.code} className={`dbb-proj${p.press ? " is-press" : ""}`}>
              <div className="dbb-proj__name">
                <b>{p.code}</b>
                {p.press ? <span className="dbb-proj__flag">⚑ {p.press}</span> : null}
              </div>
              <div className="dbb-proj__pips">
                {KINDS.map((k) => (
                  <span key={k.kind} className={`dbb-pip${p.counts[k.kind] ? "" : " is-none"}`} style={{ "--hue": HUES[k.kind] }} title={`${p.counts[k.kind]} ${k.label}`}>
                    <i />
                    {p.counts[k.kind]}
                  </span>
                ))}
              </div>
              <div className="dbb-proj__foot">
                {p.work ? <span>{p.work} outstanding</span> : <span className="dbb-aside">nothing outstanding</span>}
                {p.lastWords ? <span className="dbb-aside">parsed {p.lastWords}</span> : null}
                {p.stale ? <span className="dbb-proj__stale">{p.stale} drifted past their parse</span> : null}
              </div>
            </div>
          ))}
        </div>
        {quiet.length ? (
          <p className="dbb-quiet">
            <button type="button" onClick={() => setShowQuiet(!showQuiet)}>
              {`${quiet.length} ${quiet.length === 1 ? "project" : "projects"} the hub knows with no registered documents`}
            </button>
            {showQuiet ? <span className="dbb-quiet__list"> — {quiet.map((p) => p.code).join(" · ")}</span> : null}
            <span className="dbb-aside">
              {" "}
              — registered, not empty: nothing in them carries a registration leaf the shell has parsed, so this page
              cannot see inside them and neither can anything else in the window.
            </span>
          </p>
        ) : null}
      </section>
    </div>
  );
}
