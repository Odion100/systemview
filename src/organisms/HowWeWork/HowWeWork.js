import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import "./styles.scss";
import { setHelpTopic } from "../../atoms/Help/helpStore";
import { stateOf, objectiveComplete } from "../../atoms/Markdown/blocks/lifecycleState";
import commandRunner from "../../utils/hostCommand";
import { richParts } from "./rich";
import {
  CHAIN,
  DOORS,
  LAYERS,
  LEAVES,
  LIFECYCLES,
  PIPELINE,
  REASONS,
  STAGES,
  SUBTYPES,
} from "./howWeWork.data";

// ─── THE DEMO'S FOLD — counts only; THE STATION COMES FROM THE ONE DEFINITION ──────────────────
//
// This page used to carry its own `deriveArc`, a second derivation of the arc rule whose own
// comment admitted it could disagree with `lifecycleState.js`. RFC-076 §7 names that file as the
// defect and the remedy is deletion, not maintenance: the fixture fold below produces the same
// counts the registry row carries ({total, planned, complete}), and the STATION is asked of
// `stateOf` — the function the real trail draws with — so the teaching surface can no longer
// drift from the thing it teaches.

/** One fixture objective — the id plus THE one definition's fold. No rule lives here: the
 * completeness logic is `objectiveComplete` in lifecycleState, the same place the station comes
 * from, so this page cannot drift from the thing it teaches. */
export function objectiveState(objective) {
  return { id: objective && objective.id, ...objectiveComplete((objective && objective.plans) || []) };
}

/** The whole demo arc: the one definition's station, plus the page's why-sentence. */
export function arcDemo(objectives = []) {
  const states = objectives.map(objectiveState);
  const counts = {
    total: states.length,
    planned: states.filter((s) => s.planned).length,
    complete: states.filter((s) => s.complete).length,
  };
  const station = stateOf("arc", { state: { verdict: "approved", objectives: counts } });
  const unplanned = states.filter((s) => !s.planned);
  const left = states.reduce((n, s) => n + (s.total - s.settled), 0);
  const why =
    states.length === 0
      ? "an arc with no objectives is not settled — it is empty"
      : unplanned.length
      ? `${unplanned.map((s) => s.id).join(" and ")} ${
          unplanned.length === 1 ? "has" : "have"
        } no plan attached — an objective with no plan is incomplete, not merely un-planned`
      : station === "inProgress"
      ? `every objective has a plan, and ${left} ${left === 1 ? "plan is" : "plans are"} still moving`
      : "every plan settled, so every objective is complete, so the arc is — derived upward, never pressed";
  return { station, why, objectives: states, planned: counts.planned, complete: counts.complete };
}

/** What a press on a station can do — the page's own reading of its data, so the panel and the
 * badge can never disagree about whether something is pressable. */
export function pressLine(station) {
  if (!station) return "";
  return station.pressable
    ? station.press
    : `${station.press} A press cannot fake this one — the surface says what is missing instead.`;
}

// HOW WE WORK — the page you land on with nothing open, and the only surface in this window written
// for a HUMAN WHO HAS NEVER SEEN THIS SYSTEM. His words about what used to fill this space (the
// SystemView documentation tree): "it's kind of bullshit." What belongs here is the whole flow of
// the system, taught: educational and dashboard-like at once, somewhere people come back to.
//
// THREE RULES IT IS BUILT TO:
//   1. It is for humans. Not a reference page — scroll it and you understand how work moves.
//   2. It is a WEB PAGE, not an IDE panel: it animates, it draws, things move and show flow.
//   3. The content is HARDCODED and the page says so. Wiring it to live state was explicitly
//      waved off; a page pretending to show your repo while showing examples would be worse than
//      a page that is honest about being a manual.
//
// The one thing on it that is NOT a picture is the upward-derivation demo — that calls the same
// `arcDemo` Jest calls, because a surface teaching how state derives should not fake deriving it.

// ───────────────────────────────────────────────────────────────────────────────────────────────

/** The page's two-mark markup, rendered. See rich.js for why it is only two marks. */
const Rich = ({ children }) => (
  <>
    {richParts(children).map((p, i) =>
      p.t === "code" ? (
        <code key={i}>{p.v}</code>
      ) : p.t === "bold" ? (
        <b key={i}>{p.v}</b>
      ) : (
        <React.Fragment key={i}>{p.v}</React.Fragment>
      )
    )}
  </>
);

/** True when the machine has asked for less motion — every auto-animation on this page checks it. */
function useReducedMotion() {
  return useMemo(
    () =>
      typeof window !== "undefined" &&
      window.matchMedia &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    []
  );
}

// EVERY PAGE WEARS THE SAME HEADER (his shape, 2026-10-28: "the top section with prose, the tabs,
// of course, and then bodies"). One component, so a page CANNOT invent its own head — the prose and
// the links differ per page, the shape never does. The links are the header's "nice link looking
// stuff": each one goes somewhere real — another tab, or a help topic — because a link that only
// decorates would teach this surface to lie.
//
// AND THE TOP SECTION DOES NOT MOVE (his correction, same day: "switching should not move the top
// section"). Every page's header is mounted, stacked in one grid cell, and only the active one is
// visible — so the header area is always exactly as tall as the tallest page's header at this
// width, and a switch swaps words without shoving the tabs or the body. Visibility is INLINE, not
// a class, so the hidden ones are out of reach for clicks, tab order and tests alike.
// A SLIDER, NOT A FADE (his correction, 2026-10-28: "it's already a slider… it probably doesn't
// need to do a real fade transition"). `from` is the direction of travel: the incoming header
// rides in full-width from the side you moved toward while `out` — the header you just left —
// gets pushed out the other side. No opacity anywhere; the movement is the whole effect. Both
// empty on first mount, so the landing header stands still. The outgoing header stays visible
// through its exit (it rests off-canvas behind overflow:hidden); aria-hidden is the target state,
// which is what assistive tech and the tests read.
const PageHeader = ({ page, go, on, from, out, dragPx = 0 }) => (
  <header
    className={`hww-hero${on ? ` is-at${from ? ` is-from-${from}` : ""}` : ""}${
      out ? ` is-out-${out}` : ""
    }`}
    style={{
      visibility: on || out ? "visible" : "hidden",
      // mid-drag the header follows the hand directly; the class animation yields to it
      ...(on && dragPx ? { transform: `translateX(${dragPx}px)`, animation: "none" } : {}),
    }}
    aria-hidden={!on}
  >
    <div className="hww-hero__kicker">{page.kicker}</div>
    <h1 className="hww-hero__title">{page.title}</h1>
    {(Array.isArray(page.lede) ? page.lede : [page.lede]).filter(Boolean).map((p, i) => (
      <p className="hww-hero__lede" key={i}>
        <Rich>{p}</Rich>
      </p>
    ))}
    {page.honest ? (
      <p className="hww-hero__honest">
        <Rich>{page.honest}</Rich>
      </p>
    ) : null}
    {page.links && page.links.length ? (
      <nav className="hww-hero__links" aria-label="related">
        {page.links.map((l) => (
          <button
            key={l.label}
            type="button"
            className="hww-hero__link"
            onClick={() => (l.help ? setHelpTopic(l.help) : go(l.to))}
          >
            {l.label} <span aria-hidden="true">→</span>
          </button>
        ))}
      </nav>
    ) : null}
  </header>
);

// ───────────────────────────────────────────────────────────────────────────────────────────────
// 1 · THE FLOW. The spine of the page: six stages on a rail with a current running through it. It
// walks itself until a hand takes the wheel — the same rule the chat's reading follows, because an
// animation that keeps moving under somebody who is reading is a surface fighting its reader.

const FlowRail = () => {
  const reduced = useReducedMotion();
  const [at, setAt] = useState(0);
  const [held, setHeld] = useState(false);

  useEffect(() => {
    if (held || reduced) return undefined;
    const t = setInterval(() => setAt((i) => (i + 1) % STAGES.length), 3600);
    return () => clearInterval(t);
  }, [held, reduced]);

  const take = (i) => {
    setHeld(true);
    setAt(i);
  };
  const stage = STAGES[at];

  return (
    <div className="hww-flow">
      <ol className={`hww-flow__rail${held || reduced ? "" : " hww-flow__rail--live"}`}>
        {STAGES.map((s, i) => (
          <li
            key={s.id}
            className={`hww-flow__node hww-flow__node--${s.hand.replace(/[^a-z]/g, "")}${
              i === at ? " is-at" : ""
            }${i < at ? " is-past" : ""}`}
          >
            <button type="button" className="hww-flow__btn" onClick={() => take(i)}>
              <span className="hww-flow__dot" />
              <span className="hww-flow__label">{s.label}</span>
              <span className="hww-flow__kicker">{s.kicker}</span>
            </button>
            {i < STAGES.length - 1 && <span className="hww-flow__link" aria-hidden="true" />}
          </li>
        ))}
      </ol>

      <div className="hww-flow__card" key={stage.id}>
        <div className="hww-flow__cardhead">
          <span className={`hww-hand hww-hand--${stage.hand.replace(/[^a-z]/g, "")}`}>{stage.hand}</span>
          <h3>{stage.label}</h3>
          <code className="hww-leafchip">{stage.leaf}</code>
        </div>
        <p className="hww-flow__body">
          <Rich>{stage.body}</Rich>
        </p>
        <div className="hww-flow__after">
          <span className="hww-flow__afterlbl">what exists afterwards</span>
          <span className="hww-flow__afterval">{stage.artifact}</span>
        </div>
        <p className="hww-flow__note">
          <Rich>{stage.note}</Rich>
        </p>
      </div>

      <p className="hww-hint">
        {held || reduced
          ? "You have the wheel — pick any stage."
          : "It is walking itself. Click a stage and it stops."}
      </p>
    </div>
  );
};

// ───────────────────────────────────────────────────────────────────────────────────────────────
// 2 · REGISTRATION. The first line of a document is how the system hears it.

const Leaves = () => (
  <div className="hww-leaves">
    {LEAVES.map((l) => (
      <div className={`hww-leaf hww-leaf--${l.kind}`} key={l.kind}>
        <div className="hww-leaf__top">
          <span className="hww-leaf__kind">{l.kind}</span>
          <span className="hww-leaf__one">{l.one}</span>
        </div>
        <code className="hww-leaf__code">{l.leaf}</code>
        <p className="hww-leaf__hint">
          <Rich>{l.hint}</Rich>
        </p>
      </div>
    ))}
  </div>
);

// ───────────────────────────────────────────────────────────────────────────────────────────────
// 3 · THE LIFECYCLES. Four trails, one at a time, each state pressable for its detail. On the page
// a position on a trail is a STATE, which is the word his document uses; the code below it keeps
// saying `station` deliberately, because `stateOf()` already returns one value called state and two
// values in one signature cannot both carry the name. The fork
// at the end of a gap is drawn as a fork, because `rejected` is a destination and not a failure to
// reach `resolved`.

const Trails = () => {
  const [kind, setKind] = useState("rfc");
  const life = LIFECYCLES.find((l) => l.kind === kind) || LIFECYCLES[0];
  const [at, setAt] = useState(0);
  const pick = (k) => {
    setKind(k);
    setAt(0);
  };
  const station = life.stations[Math.min(at, life.stations.length - 1)];

  return (
    <div className="hww-life">
      <div className="hww-life__tabs" role="tablist">
        {LIFECYCLES.map((l) => (
          <button
            key={l.kind}
            type="button"
            role="tab"
            aria-selected={l.kind === kind}
            className={`hww-life__tab hww-life__tab--${l.kind}${l.kind === kind ? " is-on" : ""}`}
            onClick={() => pick(l.kind)}
          >
            <span className="hww-life__tabkind">{l.title}</span>
            <span className="hww-life__tabn">{l.stations.length} states</span>
          </button>
        ))}
      </div>

      <p className="hww-life__lede">
        <b>{life.title}</b> — {life.sub}. <Rich>{life.lede}</Rich>
      </p>

      <ol className={`hww-trail hww-trail--${kind}`}>
        {life.stations.map((s, i) => (
          <li
            key={s.id}
            className={`hww-trail__st${s.fork ? " hww-trail__st--fork" : ""}${
              s.id === station.id ? " is-at" : ""
            }`}
          >
            <button type="button" className="hww-trail__btn" onClick={() => setAt(i)}>
              <span className="hww-trail__ring">{s.pressable ? "⌾" : "◦"}</span>
              <span className="hww-trail__name">{s.id}</span>
            </button>
          </li>
        ))}
      </ol>

      <div className="hww-st" key={`${kind}-${station.id}`}>
        <div className="hww-st__head">
          <h3 className="hww-st__name">{station.id}</h3>
          <span className={`hww-st__press${station.pressable ? " is-yes" : " is-no"}`}>
            {station.pressable ? "a press can reach it" : "a press cannot fake it"}
          </span>
        </div>
        <dl className="hww-st__rows">
          <div>
            <dt>the fact it reads</dt>
            <dd>
              <Rich>{station.reads}</Rich>
            </dd>
          </div>
          <div>
            <dt>what moves it here</dt>
            <dd>
              <Rich>{station.moves}</Rich>
            </dd>
          </div>
          <div>
            <dt>press it</dt>
            <dd>
              <Rich>{pressLine(station)}</Rich>
            </dd>
          </div>
        </dl>
        <p className="hww-st__means">
          <Rich>{station.means}</Rich>
        </p>
      </div>
    </div>
  );
};

const Retirement = () => (
  <div className="hww-retire">
    <div className="hww-retire__cols">
      {["ending", "pause"].map((g) => (
        <div className={`hww-retire__col hww-retire__col--${g}`} key={g}>
          <h4>{g === "ending" ? "endings — they leave the active lists" : "pauses — they stay findable"}</h4>
          {REASONS.filter((r) => r.group === g).map((r) => (
            <div className="hww-reason" key={r.word}>
              <code>as={r.word}</code>
              <span>
                <Rich>{r.gloss}</Rich>
              </span>
            </div>
          ))}
        </div>
      ))}
    </div>
    <p className="hww-retire__note">
      <Rich>
        **The reason replaces the gate.** Refusing the button teaches nothing; a closed list of
        reasons is strictly more honest, and it has to be CLOSED because conditions branch on it —
        an unrecognised reason would be a state nothing can read. **And no timer moves state on any
        kind.** A timer that retires a document is a decision nobody made, attributed to nobody,
        with no reason attached. A clock's only job here is disposal, strictly downstream of a
        decision somebody already made.
      </Rich>
    </p>
  </div>
);

const Subtypes = () => (
  <div className="hww-subs">
    <table className="hww-table">
      <thead>
        <tr>
          <th>as=</th>
          <th>what it is</th>
          <th>what makes it done</th>
          <th>its clock</th>
        </tr>
      </thead>
      <tbody>
        {SUBTYPES.map((s) => (
          <tr key={s.as}>
            <td>
              <code>{s.as}</code>
            </td>
            <td>
              <Rich>{s.what}</Rich>
            </td>
            <td>
              <Rich>{s.done}</Rich>
            </td>
            <td className="hww-table__quiet">
              <Rich>{s.clock}</Rich>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);

// ───────────────────────────────────────────────────────────────────────────────────────────────
// 4 · UPWARD. The one live thing on the page. Press the plans; the objectives complete; the arc
// settles — through `arcDemo`, the same function the tests call, whose station is `stateOf`'s own answer.

const DEMO = [
  { id: "O1", why: "the trail is drawn on the document", plans: [{ id: "RFC-073" }, { id: "RFC-074" }] },
  { id: "O2", why: "a claim carries its proof", plans: [{ id: "RFC-075" }] },
  { id: "O3", why: "every kind's lifecycle, settled", plans: [] },
];

const ArcUpward = () => {
  const [objs, setObjs] = useState(() => DEMO.map((o) => ({ ...o, plans: o.plans.map((p) => ({ ...p, settled: false })) })));
  const [n, setN] = useState(76);
  const arc = arcDemo(objs);

  const toggle = (oi, pi) =>
    setObjs((prev) =>
      prev.map((o, i) =>
        i !== oi ? o : { ...o, plans: o.plans.map((p, j) => (j !== pi ? p : { ...p, settled: !p.settled })) }
      )
    );
  const attach = (oi) => {
    setObjs((prev) =>
      prev.map((o, i) => (i !== oi ? o : { ...o, plans: [...o.plans, { id: `RFC-0${n}`, settled: false }] }))
    );
    setN((v) => v + 1);
  };
  const reset = () => {
    setObjs(DEMO.map((o) => ({ ...o, plans: o.plans.map((p) => ({ ...p, settled: false })) })));
    setN(76);
  };

  // THE WIRING IS DRAWN, NOT DECORATED. Three objective columns at the centres of the stage's
  // thirds (120 · 360 · 600 of a 720 viewBox), plans fanned under their own column, the arc above —
  // so attaching a plan re-wires itself instead of invalidating a hand-drawn picture. The stage is
  // a fixed 250px tall and the SVG stretches to it (`preserveAspectRatio="none"`), which is what
  // keeps the curve ends landing on the real elements laid over them.
  const COL = [120, 360, 600];
  const planX = (oi, pi, total) => COL[oi] + (pi - (total - 1) / 2) * 92;

  return (
    <div className="hww-up">
      <div className="hww-up__stage">
        <svg className="hww-up__wire" viewBox="0 0 720 250" preserveAspectRatio="none" aria-hidden="true">
          {objs.map((o, oi) => {
            const st = arc.objectives[oi];
            return (
              <g key={o.id}>
                {o.plans.map((p, pi) => {
                  const x = planX(oi, pi, o.plans.length);
                  return (
                    <path
                      key={p.id}
                      className={`hww-up__link${p.settled ? " is-live" : ""}`}
                      d={`M ${x} 196 C ${x} 174 ${COL[oi]} 172 ${COL[oi]} 150`}
                    />
                  );
                })}
                <path
                  className={`hww-up__link${st.complete ? " is-live" : ""}`}
                  d={`M ${COL[oi]} 96 C ${COL[oi]} 74 360 72 360 50`}
                />
              </g>
            );
          })}
        </svg>

        <div className="hww-up__arcrow">
          <div className={`hww-up__arc is-${arc.station}`}>
            <span className="hww-up__kind">arc</span>
            <code>::arc{"{"}id=ARC-004{"}"}</code>
            <span className="hww-up__station">{arc.station}</span>
          </div>
        </div>

        <div className="hww-up__objrow">
          {objs.map((o, oi) => {
            const st = arc.objectives[oi];
            return (
              <div className="hww-up__objcell" key={o.id}>
                <div
                  className={`hww-up__obj${st.complete ? " is-complete" : ""}${st.planned ? "" : " is-unplanned"}`}
                >
                  <div className="hww-up__objtop">
                    <span className="hww-up__objid">ARC-004-{o.id}</span>
                    <span className="hww-up__objcount">
                      {st.settled}/{st.total || "—"}
                    </span>
                  </div>
                  <span className="hww-up__objwhy">{o.why}</span>
                </div>
              </div>
            );
          })}
        </div>

        <div className="hww-up__planrow">
          {objs.map((o, oi) => {
            const st = arc.objectives[oi];
            return (
              <div className="hww-up__plancell" key={o.id}>
                {o.plans.map((p, pi) => (
                  <button
                    type="button"
                    key={p.id}
                    className={`hww-up__plan${p.settled ? " is-settled" : ""}`}
                    onClick={() => toggle(oi, pi)}
                    title={p.settled ? "settled — click to un-settle it" : "click to settle this plan"}
                  >
                    {p.id}
                  </button>
                ))}
                {!st.planned && (
                  <button type="button" className="hww-up__attach" onClick={() => attach(oi)}>
                    + attach a plan
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div className="hww-up__read">
        <span className={`hww-up__badge is-${arc.station}`}>{arc.station}</span>
        <span className="hww-up__why">{arc.why}</span>
        <button type="button" className="hww-btn hww-btn--quiet" onClick={reset}>
          reset
        </button>
      </div>
      <p className="hww-hint">
        Press a plan to settle it. Nothing on the arc is pressed — its state is read off the plans,
        which is what a living spec means.
      </p>
    </div>
  );
};

// ───────────────────────────────────────────────────────────────────────────────────────────────
// 5 · BEING TOLD. Membership lives in the markdown, and `told=` is the receipt of a delivery that
// happened. A demo, and labelled as one — the real one sends into a project's room.

const TellDemo = () => {
  const MEMBERS = ["systemview-test", "autobot", "buapi"];
  const [edits, setEdits] = useState(0);
  const [told, setTold] = useState(MEMBERS.slice());
  const behind = MEMBERS.filter((m) => !told.includes(m));

  return (
    <div className="hww-told">
      <code className="hww-told__line">
        ::members{"{"}who={MEMBERS.join("|")}
        {told.length ? ` told=${told.join("|")}` : ""}
        {"}"}
      </code>
      <div className="hww-told__chips">
        {MEMBERS.map((m) => (
          <span key={m} className={`hww-told__chip${told.includes(m) ? " is-told" : " is-behind"}`}>
            {m}
            <i>{told.includes(m) ? "told" : "behind"}</i>
          </span>
        ))}
      </div>
      <div className="hww-told__acts">
        <button
          type="button"
          className="hww-btn"
          onClick={() => {
            setEdits((e) => e + 1);
            setTold([]);
          }}
        >
          edit the document
        </button>
        <button type="button" className="hww-btn hww-btn--go" disabled={!behind.length} onClick={() => setTold(MEMBERS.slice())}>
          {behind.length ? `tell the ${behind.length} behind` : "everyone is current"}
        </button>
        <span className="hww-told__count">{edits} edit{edits === 1 ? "" : "s"}</span>
      </div>
      <p className="hww-hint">
        A demonstration — your own documents send for real, into the project's room. Behind means
        “has not heard about THIS version”, and an agent never hand-writes <code>told=</code>: it is
        the receipt of a delivery that happened, so inventing one marks somebody as told who is not.
      </p>
    </div>
  );
};

// ───────────────────────────────────────────────────────────────────────────────────────────────
// 6 · THE MACHINE. A moment travelling down the chain — event, hook, the fork between offered and
// given, and the account at the end.

const Chain = () => {
  const reduced = useReducedMotion();
  const [lit, setLit] = useState(-1);
  const timers = useRef([]);
  const [open, setOpen] = useState("hook");

  const clear = () => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
  };
  useEffect(() => clear, []);

  const fire = useCallback(() => {
    clear();
    if (reduced) {
      setLit(CHAIN.length - 1);
      return;
    }
    setLit(-1);
    CHAIN.forEach((_, i) => {
      timers.current.push(setTimeout(() => setLit(i), 120 + i * 520));
    });
    timers.current.push(setTimeout(() => setLit(CHAIN.length - 1), 120 + CHAIN.length * 520));
  }, [reduced]);

  const node = CHAIN.find((c) => c.id === open) || CHAIN[0];

  return (
    <div className="hww-chain">
      <div className="hww-chain__rail">
        {CHAIN.map((c, i) => (
          <React.Fragment key={c.id}>
            <button
              type="button"
              className={`hww-chain__node hww-chain__node--${c.id}${i <= lit ? " is-lit" : ""}${
                open === c.id ? " is-open" : ""
              }`}
              onClick={() => setOpen(c.id)}
            >
              <span className="hww-chain__label">{c.label}</span>
              <span className="hww-chain__one">{c.one}</span>
            </button>
            {i < CHAIN.length - 1 && (
              <span className={`hww-chain__arrow${i < lit ? " is-lit" : ""}`} aria-hidden="true">
                ›
              </span>
            )}
          </React.Fragment>
        ))}
      </div>
      <div className="hww-chain__acts">
        <button type="button" className="hww-btn hww-btn--go" onClick={fire}>
          announce a moment
        </button>
        <span className="hww-hint hww-hint--inline">
          a hook is offered to an agent (a skill) or GIVEN to it (a job) — the fork in the middle is
          the whole difference in trust
        </span>
      </div>
      <div className="hww-chain__card" key={node.id}>
        <h4>{node.label}</h4>
        <p>
          <Rich>{node.body}</Rich>
        </p>
      </div>
    </div>
  );
};

// ───────────────────────────────────────────────────────────────────────────────────────────────
// 7 · CONTEXT. What an agent runs on, in layers — and the layers differ in who pulls the trigger.

const ContextStack = () => (
  <div className="hww-ctx">
    <div className="hww-ctx__groups">
      {[
        { g: "loaded", title: "loaded", sub: "paid in attention every turn, forever" },
        { g: "retrieved", title: "retrieved", sub: "paid only when the agent asks" },
        { g: "pushed", title: "pushed", sub: "arrives at a moment the agent would not think to ask" },
      ].map((grp) => (
        <div className={`hww-ctx__group hww-ctx__group--${grp.g}`} key={grp.g}>
          <div className="hww-ctx__ghead">
            <h4>{grp.title}</h4>
            <span>{grp.sub}</span>
          </div>
          {LAYERS.filter((l) => l.group === grp.g).map((l) => (
            <div className="hww-ctx__layer" key={l.name}>
              <span className="hww-ctx__name">{l.name}</span>
              <span className="hww-ctx__carries">
                <Rich>{l.carries}</Rich>
              </span>
              <span className="hww-ctx__when">{l.when}</span>
            </div>
          ))}
        </div>
      ))}
    </div>
    <p className="hww-ctx__rule">
      <Rich>
        **A fact in the wrong layer is either paid for every turn forever, or never found at all.**
        Instructions load WHOLE — a constraint sitting in a chunk that did not score silently does
        not exist, and if the work is unattended nobody is there to notice. Reference gets
        retrieved, where missing a section costs a re-read.
      </Rich>
    </p>
    <div className="hww-pipe">
      <h4 className="hww-pipe__title">
        And the pipeline between the two shelves — a note about a documented topic is a bug report
        against the doc
      </h4>
      <ol className="hww-pipe__steps">
        {PIPELINE.map((p, i) => (
          <li key={p.step}>
            <span className="hww-pipe__n">{i + 1}</span>
            <span className="hww-pipe__step">{p.step}</span>
            <span className="hww-pipe__body">
              <Rich>{p.body}</Rich>
            </span>
          </li>
        ))}
      </ol>
    </div>
  </div>
);

// ───────────────────────────────────────────────────────────────────────────────────────────────
// 9 · THE DOORS. They hand you the WORDS, because in this system the words ARE the door. A button
// that silently did nothing would teach the surface lies, so each one copies and says it copied.

const Doors = () => {
  const [copied, setCopied] = useState("");
  const t = useRef(null);
  useEffect(() => () => clearTimeout(t.current), []);

  const copy = async (d) => {
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) await navigator.clipboard.writeText(d.say);
      setCopied(d.id);
    } catch (e) {
      setCopied(`${d.id}:no`);
    }
    clearTimeout(t.current);
    t.current = setTimeout(() => setCopied(""), 2400);
  };

  // THE ONE DOOR THAT RUNS. The page this replaced had a pressable `systemview --help`, and the
  // replacement quietly deleted it — a regression a blind review named. A SAY door is right to
  // only copy (the words are the real door), but a COMMAND door that cannot run is a picture of a
  // door: it runs through the same pty every `:::cmd` block uses, and where there is no terminal
  // host it says so instead of shipping a button that silently does nothing.
  const [out, setOut] = useState(null); // { id, text, code }
  const run = async (d) => {
    const runner = commandRunner("machine", null, `hww-${d.id}`);
    if (!runner) {
      setOut({ id: d.id, text: "no terminal host here — copy it instead", code: null });
      return;
    }
    setOut({ id: d.id, text: "", code: null });
    try {
      const r = await runner.run({
        command: d.say,
        onOutput: (text) => setOut({ id: d.id, text, code: null }),
      });
      setOut({ id: d.id, text: r.output || "", code: r.code });
    } catch (e) {
      setOut({ id: d.id, text: String((e && e.message) || e), code: -1 });
    }
  };

  return (
    <div className="hww-doors">
      {DOORS.map((d) => (
        <div className={`hww-door hww-door--${d.kind}`} key={d.id}>
          <div className="hww-door__top">
            <span className="hww-door__label">{d.label}</span>
            <span className="hww-door__kind">{d.kind === "command" ? "a command" : "say it to an agent"}</span>
          </div>
          <code className="hww-door__say">{d.say}</code>
          <p className="hww-door__hint">{d.hint}</p>
          <button type="button" className="hww-btn hww-btn--go" onClick={() => copy(d)}>
            {copied === d.id ? "copied ✓" : copied === `${d.id}:no` ? "couldn't copy — select it" : "copy"}
          </button>
          {d.kind === "command" ? (
            <button type="button" className="hww-btn hww-btn--run" onClick={() => run(d)}>
              run it
            </button>
          ) : null}
          {out && out.id === d.id ? (
            <pre className="hww-door__out" aria-label="command output">
              {out.text || "running…"}
              {out.code != null ? `\n— exit ${out.code}` : ""}
            </pre>
          ) : null}
        </div>
      ))}
    </div>
  );
};

// ───────────────────────────────────────────────────────────────────────────────────────────────
// THE PAGES. One entry per tab — the body SWITCHES instead of one long scroll (his step one,
// 2026-10-28: "I actually want everything to be in separate tabs… the top section with prose, the
// tabs, of course, and then bodies"). Every page carries the same header shape — kicker, title,
// lede, links — and its own body; the details of each page get worked on from here, extracting
// components as they prove themselves.

const PAGES = [
  {
    id: "flow",
    label: "The flow",
    kicker: "the shape of the work",
    title: "How this works",
    lede: [
      "One person directs a team of agents from this window. The way that stays honest is that **every piece of it is a document, and every document is pressable** — the plan, the decision, the claim, the proof, the account of what ran while nobody was watching. Nothing here is a state somebody typed into a row: a state is read off a fact in a document, and a press writes the fact rather than the state.",
      "Not rules — the shape the work tends to take. Plenty happens outside it: a fix you ask for lands straight in your tree, a question gets answered in the chat. But when something is big enough to be worth a record, this is the path, and at every step there is a document somebody can open.",
    ],
    honest:
      "This page is the manual, not a dashboard of your repo — every id, count and document on it is an example. The one exception is the arc in **Upward**, which really derives.",
    links: [
      { label: "registration", to: "register" },
      { label: "start something", to: "start" },
    ],
    body: () => <FlowRail />,
  },
  {
    id: "register",
    label: "Registration",
    kicker: "identity",
    title: "A document says what it is on its first line",
    lede: "A document is an RFC, an arc, a report or a gap because it **says so at the top** — never because of the folder it sits in. Write the leaf, save, and one parse registers it: `{ id, kind, path, project }`. From that moment it has an identity anything can point at and a state anything can read.",
    links: [{ label: "the lifecycles those kinds walk", to: "lifecycle" }],
    body: () => (
      <>
        <Leaves />
        <div className="hww-note">
          <Rich>
            **The id is the identity, not the path.** A moved or renamed file updates its row — it is
            never a second document, and every pointer at it survives. A file in `RFCs/` with no leaf
            is a file; a design anywhere else carrying `::rfc` is an RFC. And the registry is a
            **lookup, never an authority**: delete it and it rebuilds from the documents, because the
            documents were always the truth.
          </Rich>
        </div>
      </>
    ),
  },
  {
    id: "lifecycle",
    label: "Lifecycles",
    wide: true,
    kicker: "state",
    title: "Each kind walks its own trail, and the state is read off the document",
    lede: "Four kinds, four trails, and not one of them is stored anywhere. Every state is a CONDITION over facts in the document — a block, a heading, the claims bar, the leaf itself — which is what lets a press honestly stop short and say so.",
    links: [{ label: "how an arc derives upward", to: "upward" }],
    body: () => (
      <>
        <div className="hww-rule">
          <span className="hww-rule__mark">⌾</span>
          <div>
            <b>The state is in the document, and nowhere else.</b>
            <span>
              Never a row written somewhere that then has to be kept in sync — four answers read off
              one document. So whether you can press a state is <b>only a question about the fact
              behind it</b>: a signature — no. A heading — yes. An attribute on the leaf — yes. A
              count of claims — no, but it can say what is missing: <i>“3 of the 26 claims belong to
              another agent.”</i>
            </span>
          </div>
        </div>
        <Trails />
        <h3 className="hww-sub">Leaving active service is a hand, with a reason</h3>
        <Retirement />
        <h3 className="hww-sub">A report's leaf is dynamic — the subtype decides what done means</h3>
        <Subtypes />
        <div className="hww-layers3">
          <h4>And when you disagree with the document, the trail says which of three layers is talking</h4>
          <ol>
            <li>
              <b>the fact</b> — a block, a heading, the claims bar, the objectives
            </li>
            <li>
              <b>the leaf's own word</b> — <code>retired=</code>, <code>resolved=</code>
            </li>
            <li>
              <b>an override</b>, visibly marked as one — lit differently, because a surface reads
              state and never testifies
            </li>
          </ol>
        </div>
      </>
    ),
  },
  {
    id: "upward",
    label: "Upward",
    kicker: "handoff",
    title: "An arc's state is a summary of its plans, so it cannot lie about them",
    lede: "An arc grows objectives. Objectives get plans attached BY ID — `::rfc{id=RFC-073 arc=ARC-004-O2}`, the objective's address, never a path. A plan settles in its own document, which completes the objective, which settles the arc. Three of an arc's five states cannot be pressed at all, because the facts they read live in other documents.",
    links: [{ label: "the trails themselves", to: "lifecycle" }],
    body: () => (
      <>
        <ArcUpward />
        <div className="hww-note">
          <Rich>
            **Strict state, loose execution.** An arc that cannot read `settled` until every
            objective has a plan never stops anybody building — it stops the record from saying the
            arc is finished when half of it was never designed. Strict exactly where looseness would
            make the record lie; loose everywhere else.
          </Rich>
        </div>
      </>
    ),
  },
  {
    id: "told",
    label: "Being told",
    kicker: "delivery",
    title: "A document knows who is on it, and tells them when it changes",
    lede: "A document carries `::members{who=…}` — project rooms, not people, because delivery already works in rooms. When a block gets an ANSWER and nobody covering that audience has been told, the system delivers one update and stamps `told=` on the block's own line for exactly who was reached.",
    links: [{ label: "what runs when nobody is in the room", to: "machine" }],
    body: () => <TellDemo />,
  },
  {
    id: "machine",
    label: "Hooks & jobs",
    wide: true,
    kicker: "the machinery",
    title: "Events announce moments; hooks point at procedures; jobs are given and file accounts",
    lede: "This is how work happens when you are not in the room. The chain is deliberately four separate things, because each one is a different kind of trust.",
    links: [{ label: "the context those agents run on", to: "context" }],
    body: () => <Chain />,
  },
  {
    id: "context",
    label: "Context",
    wide: true,
    kicker: "what an agent runs on",
    title: "Context arrives in layers, and the layers differ in who pulls the trigger",
    lede: "An agent is its context. Getting a layer wrong is the commonest way knowledge fails to arrive — and the symptom is never an error, it is an agent confidently acting on a world that moved.",
    links: [{ label: "living specs", to: "specs" }],
    body: () => <ContextStack />,
  },
  {
    id: "specs",
    label: "Living specs",
    kicker: "the newest idea",
    title: "A living spec — where “is this still true?” is a button",
    lede: "A claim can carry its proof in a fold: a test that lives as a file in the project's suite, or a run block that runs right there in the document. Pressing it is the difference between a design you remember agreeing to and a design that answers for itself.",
    links: [{ label: "the full block vocabulary", help: "markdown" }],
    body: () => (
      <>
        <div className="hww-specs">
          <div className="hww-specs__half">
            <h4>
              <code>::test[…]</code> — the library spec
            </h4>
            <p>
              The contract lives as a FILE in the project's suite, where the whole suite keeps running
              it long after the plan settles. The claim's fold points at it and shows pass or fail.
              <b> Addressable</b> — other work can cite it.
            </p>
          </div>
          <div className="hww-specs__half">
            <h4>
              <code>:::run</code> · <code>:::cmd</code> — proof in the fold
            </h4>
            <p>
              Steps written on the fly, or a shell command whose output lands back in the block with
              its exit code. It lives only where it was written — right for a one-off check, and the
              reason a document can be a fixture for itself.
            </p>
          </div>
        </div>
        <div className="hww-specs__spec">
          <h4>
            And a document can BE one — <code>::report{"{"}id=… as=spec retain=30d{"}"}</code>
          </h4>
          <p>
            <Rich>
              The other four report subtypes are READ — you read a notice, a planning table, an audit,
              an account. **A spec is PRESSED**: *this is what I am claiming, check it yourself.* So
              it is the one whose condition is neither time nor attention but whether the evidence
              still passes — which makes **current** and **drifted** real states rather than feelings.
              And it is **not permanent by nature**: retention is `retain=` on the leaf, set when it
              is filed. One written to answer a question in a conversation may be worth three days;
              another may be worth a year. The subtype does not decide that.
            </Rich>
          </p>
        </div>
        <div className="hww-specs__why">
          <Rich>
            **Why this is the one that makes orchestration possible rather than hopeful.** A failing
            proof on a met claim is the moment a spec stops describing the system — and on a settled
            spec it is the sharpest alarm the design can produce. Without proofs that moment is
            invisible; with them it costs a press. Which is also why `resolved` on a gap requires one:
            it is the only state in the system where **the press cannot outrun the evidence.**
          </Rich>
        </div>
      </>
    ),
  },
  {
    id: "start",
    label: "Start something",
    wide: true,
    kicker: "doors",
    title: "Start something",
    lede: "There is no form to fill in. You tell an agent what you want, in your words, and the document comes back — which is why these doors hand you the WORDS.",
    links: [{ label: "back to the flow", to: "flow" }],
    body: () => (
      <>
        <Doors />
        <p className="hww-hint">
          These copy to your clipboard. Nothing on this page writes to a repo or starts a run — say it
          in the chat and the agent does the rest.
        </p>
      </>
    ),
  },
];

// The tab you were on is where you come back to — same contract as the work band's strip. Guarded
// the same way too: private mode keeps the choice for the page's life instead of refusing it.
export const HWW_TAB_KEY = "sv.hww.tab";
const readTab = (store) => {
  try {
    return (store || window.localStorage).getItem(HWW_TAB_KEY) || "";
  } catch {
    return "";
  }
};
const writeTab = (value, store) => {
  try {
    (store || window.localStorage).setItem(HWW_TAB_KEY, value);
  } catch {
    /* private mode */
  }
};

export default function HowWeWork() {
  const [at, setAt] = useState(() => {
    const stored = readTab();
    return PAGES.some((p) => p.id === stored) ? stored : PAGES[0].id;
  });
  const rootRef = useRef(null);
  const page = PAGES.find((p) => p.id === at) || PAGES[0];

  // Which way you travelled decides the slide: the next header arrives from that side, and the
  // one you left gets pushed out the other. `out` is the header currently exiting.
  const [slide, setSlide] = useState({ from: "", out: null });
  const go = (id) => {
    const here = PAGES.findIndex((p) => p.id === at);
    const there = PAGES.findIndex((p) => p.id === id);
    if (there !== here) setSlide({ from: there > here ? "right" : "left", out: at });
    setAt(id);
    writeTab(id);
    if (rootRef.current) rootRef.current.scrollTop = 0;
  };

  const Body = page.body;

  // THE TOP SECTION IS ITSELF A SLIDER — drag it, or scroll it sideways, and the tab changes (his
  // ask, 2026-10-28: "you can slide the top section and it changes the tab… you should be able to
  // scroll it or drag it"). Drag: the active header follows the hand, and releasing past the
  // threshold commits to the neighbour — short of it, it snaps home. Scroll: horizontal wheel
  // delta accumulates to one step per gesture, with a cooldown so trackpad momentum cannot page
  // twice. A real drag also swallows the click that would otherwise land on a header link.
  const idx = PAGES.findIndex((p) => p.id === at);
  const [dragPx, setDragPx] = useState(0);
  const pointer = useRef({ x: 0, down: false, moved: 0 });
  const wheel = useRef({ acc: 0, last: 0, until: 0 });

  const step = (dir) => {
    const to = PAGES[idx + dir];
    if (to) go(to.id);
  };
  const dragStart = (e) => {
    if (e.button != null && e.button !== 0) return;
    pointer.current = { x: e.clientX, down: true, moved: 0 };
  };
  const dragMove = (e) => {
    const p = pointer.current;
    if (!p.down) return;
    const dx = e.clientX - p.x;
    p.moved = Math.max(p.moved, Math.abs(dx));
    setDragPx(dx);
  };
  const dragEnd = () => {
    if (!pointer.current.down) return;
    pointer.current.down = false;
    if (dragPx <= -60) step(1);
    else if (dragPx >= 60) step(-1);
    setDragPx(0);
  };
  const swallowDraggedClick = (e) => {
    if (pointer.current.moved > 10) {
      e.preventDefault();
      e.stopPropagation();
      pointer.current.moved = 0;
    }
  };
  const onWheel = (e) => {
    if (Math.abs(e.deltaX) <= Math.abs(e.deltaY)) return; // vertical scroll belongs to the page
    const w = wheel.current;
    const now = Date.now();
    if (now < w.until) return; // momentum tail of a gesture that already paged
    if (now - w.last > 400) w.acc = 0; // a fresh gesture
    w.acc += e.deltaX;
    w.last = now;
    if (Math.abs(w.acc) < 80) return;
    w.acc = 0;
    w.until = now + 500;
    step(e.deltaX > 0 ? 1 : -1);
  };

  return (
    <div className="hww" ref={rootRef}>
      <div
        className="hww-heads"
        onPointerDown={dragStart}
        onPointerMove={dragMove}
        onPointerUp={dragEnd}
        onPointerLeave={dragEnd}
        onClickCapture={swallowDraggedClick}
        onWheel={onWheel}
      >
        <div className="hww-heads__art" aria-hidden="true">
          <svg viewBox="0 0 900 120" preserveAspectRatio="none">
            <path className="hww-hero__path" d="M0 96 C 160 96 190 24 350 24 C 520 24 540 96 700 96 C 820 96 860 60 900 56" />
            <path className="hww-hero__flow" d="M0 96 C 160 96 190 24 350 24 C 520 24 540 96 700 96 C 820 96 860 60 900 56" />
          </svg>
        </div>
        {PAGES.map((p) => (
          <PageHeader
            key={p.id}
            page={p}
            go={go}
            on={p.id === at}
            from={slide.from}
            out={p.id === slide.out ? slide.from : ""}
            dragPx={dragPx}
          />
        ))}
      </div>

      <nav className="hww-chaps" role="tablist" aria-label="How we work">
        {PAGES.map((p) => (
          <button
            key={p.id}
            type="button"
            role="tab"
            aria-selected={at === p.id}
            className={`hww-chaps__chip${at === p.id ? " is-at" : ""}`}
            onClick={() => go(p.id)}
          >
            {p.label}
          </button>
        ))}
      </nav>

      <main className={`hww-page${page.wide ? " hww-page--wide" : ""}`} key={page.id}>
        <Body />
      </main>

      <footer className="hww-foot">
        <span>
          The method, written down: <code>docs/how-we-work/</code> · the block vocabulary:{" "}
          <code>agents/markdown.md</code> · the lifecycles as argued:{" "}
          <code>meetings/2026-10-27-the-lifecycle-of-every-kind-we-register.md</code>
        </span>
      </footer>
    </div>
  );
}
