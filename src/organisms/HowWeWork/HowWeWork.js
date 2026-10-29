import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import "./styles.scss";
import { setHelpTopic } from "../../atoms/Help/helpStore";
import Trail from "../../atoms/Trail/Trail";
import { stateOf, objectiveComplete } from "../../atoms/Markdown/blocks/lifecycleState";
import { richParts } from "./rich";
import {
  AGENTS,
  CHAIN,
  LAYERS,
  LEAVES,
  LIFECYCLES,
  PIPELINE,
  STAGES,
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
      : "every plan settled, so every objective is complete, so the arc is — nobody wrote that anywhere, it is read off the plans";
  return { station, why, objectives: states, planned: counts.planned, complete: counts.complete };
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

// THE DASHES STAND STILL — BUT THE MOTION IS A SWITCH, NOT A DELETION (his call, 2026-10-28:
// stopped for now, "in a way that can be figured out to turn on later"). Every travelling version
// measured real GPU on this machine — dash-march ~110%, offset-path ~47%, sampled transforms ~15
// points — so OFF is the default; flip DASHES_MOVE and the sampled-keyframe travel (the cheapest
// of the three) comes back exactly as it was.
const DASHES_MOVE = false;
const DASH_CURVE = [
  [[0, 96], [160, 96], [190, 24], [350, 24]],
  [[350, 24], [520, 24], [540, 96], [700, 96]],
  [[700, 96], [820, 96], [860, 60], [900, 56]],
];
const dashPoint = (seg, t) => {
  const [a, b, c, d] = seg;
  const u = 1 - t;
  return [
    u * u * u * a[0] + 3 * u * u * t * b[0] + 3 * u * t * t * c[0] + t * t * t * d[0],
    u * u * u * a[1] + 3 * u * u * t * b[1] + 3 * u * t * t * c[1] + t * t * t * d[1],
  ];
};
const dashTransform = (f) => {
  const g = f * DASH_CURVE.length;
  const si = Math.min(DASH_CURVE.length - 1, Math.floor(g));
  const t = Math.min(1, g - si);
  const [x, y] = dashPoint(DASH_CURVE[si], t);
  const [x2, y2] = dashPoint(DASH_CURVE[si], Math.min(1, t + 0.01));
  const ang = (Math.atan2(y2 - y, x2 - x) * 180) / Math.PI;
  return `translate(${(x - 5).toFixed(1)}px, ${(y - 1.25).toFixed(1)}px) rotate(${ang.toFixed(1)}deg)`;
};
// still mode: three dashes parked on the curve at the original dasharray spacing
const DASH_SPOTS = [0.18, 0.47, 0.76].map(dashTransform);
// moving mode: the bezier sampled into ~50 translate+rotate keyframes, compositor-only
const DASH_KEYFRAMES = (() => {
  const N = 48;
  const steps = [];
  for (let i = 0; i <= N; i += 1) {
    steps.push(`${((i / N) * 100).toFixed(2)}% { transform: ${dashTransform(i / N)}; }`);
  }
  return `@keyframes hww-dash { ${steps.join(" ")} }`;
})();

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
const PageHeader = ({ page, go, on, from, out, dragPx = 0, phase = "idle" }) => (
  <header
    className={`hww-hero${on ? ` is-at${from ? ` is-from-${from}` : ""}` : ""}${
      out ? ` is-out-${out}` : ""
    }`}
    style={{
      visibility: on || out ? "visible" : "hidden",
      // mid-drag the header follows the hand directly; released short of the line it BOUNCES home
      // (a transition with a little overshoot) instead of snapping — his correction, 2026-10-28
      ...(on && phase !== "idle"
        ? {
            transform: `translateX(${dragPx}px)`,
            animation: "none",
            transition: phase === "settle" ? "transform 0.3s cubic-bezier(0.25, 0.9, 0.3, 1.15)" : "none",
          }
        : {}),
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
    {page.tour ? <TourCall prompt={page.tour} /> : null}
  </header>
);

// ───────────────────────────────────────────────────────────────────────────────────────────────
// ONE CALL TO ACTION PER PAGE (his call, 2026-10-29: "you just need one call to action per page",
// and "it shouldn't be an input anymore"). The rail's six station doors used to try to START the
// work; a newcomer's first press should get shown around instead. Each chapter carries one button
// that sends a prepared ask invoking the guided voice tour, scoped to the page it sits on — the
// real work starts in the chat, in their own words, once they can see what they are looking at.
const TourCall = ({ prompt }) => {
  const [sent, setSent] = useState(false);
  const t = useRef(null);
  useEffect(() => () => clearTimeout(t.current), []);
  return (
    <div className="hww-hero__teach" data-voice-skip="true">
      <button
        type="button"
        title="sends the agent a prepared ask — the guided voice tour of this page"
        onClick={() => {
          window.dispatchEvent(new CustomEvent("sv:say", { detail: { text: prompt } }));
          setSent(true);
          clearTimeout(t.current);
          t.current = setTimeout(() => setSent(false), 2400);
        }}
      >
        {sent ? "sent ✓ — watch the chat" : "teach me"}
      </button>
    </div>
  );
};

// ───────────────────────────────────────────────────────────────────────────────────────────────
// 1 · THE FLOW. The spine of the page: six stages on a rail with a current running through it. It
// walks itself until a hand takes the wheel — the same rule the chat's reading follows, because an
// animation that keeps moving under somebody who is reading is a surface fighting its reader.

const FlowRail = () => {
  const reduced = useReducedMotion();
  const [at, setAt] = useState(0);
  const [held, setHeld] = useState(false);
  const [reading, setReading] = useState(false); // the cursor is over the card — hovering IS reading

  // SLOW ENOUGH TO READ (his correction, 2026-10-28: "I like this, it just moves too fast") — the
  // card carries a body, an artifact line and a note, and 3.6s outran all three.
  useEffect(() => {
    if (held || reading || reduced) return undefined;
    const t = setInterval(() => setAt((i) => (i + 1) % STAGES.length), 7000);
    return () => clearInterval(t);
  }, [held, reading, reduced]);

  // A HAND TAKES THE WHEEL, BUT THE WHEEL DOES NOT DIE (same correction: "it should eventually
  // start going back to moving") — a click holds the walk for half a minute of quiet, then it
  // resumes. The same shape as the window's own update hold: wait for a costless moment.
  const holdT = useRef(null);
  useEffect(() => () => clearTimeout(holdT.current), []);
  const take = (i) => {
    setHeld(true);
    setAt(i);
    clearTimeout(holdT.current);
    holdT.current = setTimeout(() => setHeld(false), 30000);
  };
  const stage = STAGES[at];
  const hold = () => take(at); // touching the door takes the wheel — the card must not walk away mid-sentence

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

      <div
        className="hww-flow__card"
        key={stage.id}
        onMouseEnter={() => setReading(true)}
        onMouseLeave={() => setReading(false)}
      >
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
          ? "You have the wheel — pick any stage. Left alone, it walks on."
          : "It is walking itself — reading the card holds it, and a click takes the wheel."}
      </p>
    </div>
  );
};

// ───────────────────────────────────────────────────────────────────────────────────────────────
// 2 · REGISTRATION. The first line of a document is how the system hears it.

// EACH CARD IS A MINI-DOCUMENT (his design, 2026-10-28: "act like a little preview document, but
// the words in the document are actually help"). The top keeps its grammar — the kind, the line
// under it, the leaf code block as it renders in a real document — and the body underneath is the
// real help: that kind's LIFECYCLE, with its trail as the page's footer.
const Leaves = () => (
  <div className="hww-leaves">
    {LEAVES.map((l) => (
      <div className={`hww-leaf hww-leaf--${l.kind}`} key={l.kind}>
        <div className="hww-leaf__top">
          <span className="hww-leaf__kind">{l.kind}</span>
          <span className="hww-leaf__one">{l.one}</span>
        </div>
        <code className="hww-leaf__code">{l.leaf}</code>
        {/* the lifecycle as STEPS — one compact block per state, the name leading into what it
            means for the work; the states are here, so no trail repeats them at the foot */}
        <div className="hww-leaf__life">
          {l.life.map((row) => (
            <p className="hww-leaf__st" key={row.st}>
              <b>{row.st}</b> — <Rich>{row.is}</Rich>
            </p>
          ))}
        </div>
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
  const [kind, setKind] = useState("arc");
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

      {/* THE SHARED DRAWING — src/atoms/Trail, extracted from this page. The registration leaf
          renders the same component against the document's real state; here it teaches, so a
          press just moves the card below. */}
      <Trail
        kind={kind}
        stations={life.stations.map((s) => ({
          id: s.id,
          fork: s.fork,
          glyph: s.pressable ? "⌾" : "◦",
        }))}
        at={station.id}
        onPress={(id) => setAt(life.stations.findIndex((s) => s.id === id))}
      />

      {/* a press answers with ONE human sentence — what being here means for the work. The
          three-row anatomy (the fact it reads / what moves it / press it) was reference
          material, cut 2026-10-28: the trail depicts, the sentence teaches. */}
      <div className="hww-st" key={`${kind}-${station.id}`}>
        <h3 className="hww-st__name">{station.id}</h3>
        <p className="hww-st__how">
          <Rich>{station.moves}</Rich>
        </p>
        <p className="hww-st__means">
          <Rich>{station.means}</Rich>
        </p>
      </div>
    </div>
  );
};

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
                    <span className="hww-up__objkind">objective</span>
                    <span className="hww-up__objid">{o.id}</span>
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

    </div>
  );
};

// ───────────────────────────────────────────────────────────────────────────────────────────────
// 5 · THE MACHINE. The chain DRAWN as a rail with a literal fork (his correction, 2026-10-28: "it's
// just a bunch of blocks… it was about making it look good"): the event runs into the hook, the
// hook's output forks — offered rides the upper branch to a skill, given rides the lower branch to
// a job — and both branches converge on the account. The fork is the drawing's whole argument:
// offered and given are different roads, not adjacent boxes. Wires are center-to-center beziers
// UNDER the stations (the hww-up trick, so the drawing re-wires itself), and the pulse is a few
// event-driven class toggles — no continuous animation, which is the dash-march lesson (110% GPU).

const CHAIN_POS = {
  event: { x: 72, y: 110 },
  hook: { x: 246, y: 110 },
  skill: { x: 458, y: 44 },
  job: { x: 458, y: 176 },
  account: { x: 642, y: 110 },
};
// The pulse's clock: the fork lights BOTH branches at once — the moment does not pick a road here,
// the hook's pointer kind already did.
const CHAIN_STEP = { event: 0, hook: 1, skill: 2, job: 2, account: 3 };

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
      setLit(3);
      return;
    }
    setLit(-1);
    for (let i = 0; i <= 3; i += 1) {
      timers.current.push(setTimeout(() => setLit(i), 120 + i * 520));
    }
  }, [reduced]);

  const node = CHAIN.find((c) => c.id === open) || CHAIN[0];
  const wire = (key, d, from, branch) => (
    <path
      key={key}
      className={`hww-chain__wire${branch ? ` hww-chain__wire--${branch}` : ""}${lit >= from ? " is-lit" : ""}`}
      d={d}
    />
  );

  return (
    <div className="hww-chain">
      <div className="hww-chain__stage">
        <svg className="hww-chain__wires" viewBox="0 0 720 220" preserveAspectRatio="none" aria-hidden="true">
          {wire("eh", "M 72 110 L 246 110", 1)}
          {wire("hs", "M 246 110 C 332 110 366 44 458 44", 2, "skill")}
          {wire("hj", "M 246 110 C 332 110 366 176 458 176", 2, "job")}
          {wire("sa", "M 458 44 C 552 44 578 110 642 110", 3, "skill")}
          {wire("ja", "M 458 176 C 552 176 578 110 642 110", 3, "job")}
        </svg>
        <span className="hww-chain__forklbl hww-chain__forklbl--skill" aria-hidden="true">
          offered
        </span>
        <span className="hww-chain__forklbl hww-chain__forklbl--job" aria-hidden="true">
          given
        </span>
        {CHAIN.map((c) => (
          <button
            key={c.id}
            type="button"
            className={`hww-chain__st hww-chain__st--${c.id}${CHAIN_STEP[c.id] <= lit ? " is-lit" : ""}${
              open === c.id ? " is-open" : ""
            }`}
            style={{
              left: `${((CHAIN_POS[c.id].x / 720) * 100).toFixed(2)}%`,
              top: `${((CHAIN_POS[c.id].y / 220) * 100).toFixed(2)}%`,
            }}
            onClick={() => {
              setOpen(c.id);
              // PRESSING THE EVENT ANNOUNCES THE MOMENT — the pulse walks the chain. The separate
              // "announce a moment" button is gone (his rule, 2026-10-29: one button per page —
              // teach me); the drawing's own first station carries the demonstration now.
              if (c.id === "event") fire();
            }}
          >
            <span className="hww-chain__label">{c.label}</span>
            <span className="hww-chain__one">{c.one}</span>
          </button>
        ))}
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
// THE AGENTS — who does the work, DRAWN (his correction, 2026-10-28: the six cards were "just a
// bunch of blocks"). The drawing is the chapter's claim as structure: ONE window at the top, a
// wire down to each project — the wire is the room, you talk to a project and its owner answers —
// and exactly one owner inside each. The middle project is magnified (the dashed wedge is the
// lens): around its owner sit the four things that define and answer for it — the doc, skills,
// jobs, the record. The six AGENTS facts did not leave the page: every part of the drawing is a
// press, and the card below answers with the fact that part depicts. Wires are beziers UNDER the
// elements (the hww-up trick); nothing on this drawing moves.

const FLEET_PROJECTS = ["autobot", "systemview", "bustudio"];

const Agents = () => {
  const [open, setOpen] = useState(AGENTS[0].name);
  const fact = AGENTS.find((a) => a.name === open) || AGENTS[0];
  const press = (name, className, children) => (
    <button
      type="button"
      className={`${className}${open === name ? " is-open" : ""}`}
      onClick={() => setOpen(name)}
    >
      {children}
    </button>
  );
  return (
    <div className="hww-agents">
      <div className="hww-fleet">
        <svg className="hww-fleet__wires" viewBox="0 0 720 360" preserveAspectRatio="none" aria-hidden="true">
          {/* the rooms — you talk to a project, its owner answers. Endpoints tuck UNDER the
              cards (opaque surfaces over the wire layer), so nothing ever reads as detached. */}
          <path className="hww-fleet__wire" d="M 360 48 C 360 80 128 64 128 96" />
          <path className="hww-fleet__wire" d="M 360 48 L 360 96" />
          <path className="hww-fleet__wire" d="M 360 48 C 360 80 592 64 592 96" />
          {/* the lens — the middle project, opened up */}
          <path className="hww-fleet__wire hww-fleet__wire--lens" d="M 296 142 L 70 200" />
          <path className="hww-fleet__wire hww-fleet__wire--lens" d="M 424 142 L 650 200" />
          {/* the anatomy around one owner — two satellites a side (his add, 2026-10-29:
              "it's missing one thing, sub-agents"), the record below */}
          <path className="hww-fleet__wire" d="M 282 248 C 242 248 220 228 184 226" />
          <path className="hww-fleet__wire" d="M 282 268 C 242 268 220 288 180 290" />
          <path className="hww-fleet__wire" d="M 438 248 C 478 248 500 228 536 226" />
          <path className="hww-fleet__wire" d="M 438 268 C 478 268 500 288 540 290" />
          <path className="hww-fleet__wire" d="M 360 280 L 360 322" />
        </svg>
        <div className="hww-fleet__lens" aria-hidden="true" />
        {press(
          "the room",
          "hww-fleet__you",
          <>
            <span className="hww-fleet__kicker">you</span>
            <span className="hww-fleet__name">one window</span>
          </>
        )}
        {FLEET_PROJECTS.map((id, i) => (
          <React.Fragment key={id}>
            {press(
              "one owner per project",
              `hww-fleet__proj hww-fleet__proj--${["left", "mid", "right"][i]}`,
              <>
                <span className="hww-fleet__kicker">project</span>
                <span className="hww-fleet__name">{id}</span>
                <span className="hww-fleet__owner">one owner</span>
              </>
            )}
          </React.Fragment>
        ))}
        <div className="hww-fleet__agent">
          <span className="hww-fleet__kicker">the owner</span>
          <span className="hww-fleet__name">one agent</span>
          <span className="hww-fleet__owner">answers for all of systemview</span>
        </div>
        {press("the doc", "hww-fleet__sat hww-fleet__sat--doc", "the doc")}
        {press("sub-agents", "hww-fleet__sat hww-fleet__sat--subs", "sub-agents")}
        {press("skills", "hww-fleet__sat hww-fleet__sat--skills", "skills")}
        {press("jobs", "hww-fleet__sat hww-fleet__sat--jobs", "jobs")}
        {press("the record", "hww-fleet__sat hww-fleet__sat--record", "the record")}
      </div>
      <div className="hww-agent" key={fact.name}>
        <div className="hww-agent__top">
          <span className="hww-agent__name">{fact.name}</span>
          <span className="hww-agent__one">{fact.one}</span>
        </div>
        <p className="hww-agent__body">
          <Rich>{fact.body}</Rich>
        </p>
      </div>
    </div>
  );
};

// ───────────────────────────────────────────────────────────────────────────────────────────────
// 6 · CONTEXT. What an agent runs on, DRAWN AS THE STACK IT IS (his correction, 2026-10-28: three
// equal cards were "just a bunch of blocks"). The strata make the cost structure visible: loaded
// is the BASE — widest, everything rests on it, paid every turn — retrieved narrows above it,
// pushed is the small top. The agent stands beside the stack and the three wires carry the whole
// lesson in their arrowheads: loaded flows AT the agent unasked, the retrieved arrow points INTO
// the stack because the agent is the one reaching, and pushed arrives on its own at the moment.
// Each layer is a pressable brick; the card below answers with what it carries. Still drawing —
// the only motion is the answer card's entrance.

const CTX_STRATA = [
  { g: "pushed", title: "pushed", sub: "arrives at a moment the agent would not think to ask" },
  { g: "retrieved", title: "retrieved", sub: "paid only when the agent asks" },
  { g: "loaded", title: "loaded", sub: "paid in attention every turn, forever" },
];

const ContextStack = () => {
  const [open, setOpen] = useState(LAYERS[0].name);
  const layer = LAYERS.find((l) => l.name === open) || LAYERS[0];
  return (
    <div className="hww-ctx">
      <div className="hww-ctx__stage">
        <svg className="hww-ctx__wires" viewBox="0 0 720 320" preserveAspectRatio="none" aria-hidden="true">
          {/* loaded → the agent: unasked, every turn — the arrow lands on the agent */}
          <path className="hww-ctx__wire hww-ctx__wire--loaded" d="M 504 243 C 560 243 590 224 600 196" />
          <path className="hww-ctx__head hww-ctx__head--loaded" d="M 594 201 L 600 188 L 606 201 Z" />
          {/* the agent → retrieved: the agent is the one reaching — the arrow lands on the stack */}
          <path className="hww-ctx__wire hww-ctx__wire--retrieved" d="M 566 152 C 530 152 505 142 468 142" />
          <path className="hww-ctx__head hww-ctx__head--retrieved" d="M 473 136 L 461 142 L 473 148 Z" />
          {/* pushed → the agent: the moment arrives on its own */}
          <path className="hww-ctx__wire hww-ctx__wire--pushed" d="M 405 51 C 520 51 600 72 621 108" />
          <path className="hww-ctx__head hww-ctx__head--pushed" d="M 615 104 L 627 102 L 622 115 Z" />
        </svg>
        {CTX_STRATA.map((grp) => (
          <div className={`hww-ctx__stratum hww-ctx__stratum--${grp.g}`} key={grp.g}>
            <div className="hww-ctx__ghead">
              <h4>{grp.title}</h4>
              <span>{grp.sub}</span>
            </div>
            <div className="hww-ctx__bricks">
              {LAYERS.filter((l) => l.group === grp.g).map((l) => (
                <button
                  type="button"
                  className={`hww-ctx__layer${open === l.name ? " is-open" : ""}`}
                  key={l.name}
                  onClick={() => setOpen(l.name)}
                >
                  {l.name}
                </button>
              ))}
            </div>
          </div>
        ))}
        <div className="hww-ctx__agentnode">
          <span className="hww-ctx__agentkicker">the agent</span>
          <span className="hww-ctx__agentname">a turn in progress</span>
        </div>
        <span className="hww-ctx__wirelbl hww-ctx__wirelbl--loaded" aria-hidden="true">
          every turn, unasked
        </span>
        <span className="hww-ctx__wirelbl hww-ctx__wirelbl--retrieved" aria-hidden="true">
          the agent reaches in
        </span>
        <span className="hww-ctx__wirelbl hww-ctx__wirelbl--pushed" aria-hidden="true">
          the moment arrives
        </span>
      </div>
      <div className={`hww-ctx__card hww-ctx__card--${layer.group}`} key={layer.name}>
        <div className="hww-ctx__cardtop">
          <span className="hww-ctx__name">{layer.name}</span>
          <span className="hww-ctx__when">
            {layer.when} · costs {layer.cost}
          </span>
        </div>
        <p className="hww-ctx__carries">
          <Rich>{layer.carries}</Rich>
        </p>
      </div>
      <div className="hww-pipe">
        <h4 className="hww-pipe__title">
          And the pipeline between the two shelves — a note about a documented topic is a bug report
          against the doc
        </h4>
        <ol className="hww-pipe__steps">
          {PIPELINE.map((p) => (
            <li key={p.step}>
              <span className="hww-pipe__dot" aria-hidden="true" />
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
};

// ───────────────────────────────────────────────────────────────────────────────────────────────
// THE PAGES. One entry per tab — the body SWITCHES instead of one long scroll (his step one,
// 2026-10-28: "I actually want everything to be in separate tabs… the top section with prose, the
// tabs, of course, and then bodies"). Every page carries the same header shape — kicker, title,
// lede, links — and its own body; the details of each page get worked on from here, extracting
// components as they prove themselves.

const PAGES = [
  {
    // THE INTRODUCTION — it names SystemView and talks TO you (his call, 2026-10-28: "it's just
    // that YOU direct a team of agents… this is about introducing SystemView"). The lede does the
    // three enablers in order — one medium, nothing invisible, nothing on trust — and stays ONE
    // paragraph, because the tallest header sets the height of all nine: the rail's own caption
    // and the manual-not-dashboard note live in the body now, where length is free.
    id: "flow",
    label: "The flow",
    // "the shape of the work" / SystemView — the kicker he liked stays; the title names the thing.
    kicker: "the shape of the work",
    title: "SystemView",
    lede: "You direct a team of agents. The work moves as documents — plans, decisions, claims, proofs — the agents build from them, and everything they run shows up here as it happens. And none of it asks for your trust: every document is pressable, and every state is read off a fact in one, so what the system says is what the disk says.",
    // THE FIRST PAGE'S BUTTON IS THE FULL-TOUR DOOR (his call, 2026-10-29: "I don't want
    // click-every-page to be the only option") — same "teach me" face as every other header, but
    // its ask is the whole walk. The skill breaks the walk into two halves and asks before the
    // second, so full never means endless.
    tour: "Run the voice tour of the How-we-work page — the whole walk.",
    body: () => (
      <>
        <p className="hww-intro">
          Below is the shape the work tends to take — not rules. Plenty happens outside it: a fix
          you ask for lands straight in your tree, a question gets answered in the chat. But when
          something is big enough to be worth a record, this is the path, and at every step there is
          a document somebody can open.
        </p>
        <FlowRail />
      </>
    ),
  },
  {
    id: "register",
    label: "Documentation",
    kicker: "identity",
    title: "Documentation as state",
    lede: "The work here is tracked through markdown documentation — RFCs, arcs, reports and gaps. A document says what it is with an interactive markdown block inside, and saving the file registers it with the system. From that moment it has an identity in the system — anything can point at it, and its state lives within the document itself.",
    tour: "Run the voice tour of the documentation chapter of the How-we-work page.",
    body: () => (
      <>
        {/* the one point worth making here (his pick, assembled from two drafts): the plans and
            the tests are ONE document — which is what makes these documents alive */}
        <p className="hww-intro">
          The plans and the tests live in the same document — a design carries its claims, the
          claims carry their proofs, and the document never drifts from the thing it describes.
        </p>
        <Leaves />
        <div className="hww-note">
          <Rich>
            **Documents are tracked and identified by their embedded markdown blocks** — not their
            file paths — so you can move or rename a file freely: it stays the same document, and every
            pointer at it survives.
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
    title: "Nothing is marked done by hand",
    lede: "From draft to retired, everything in the system moves through its own states — A state is a condition over facts in the document itself, so the system always knows where everything stands — and a surface can read it, but never fake it.",
    tour: "Run the voice tour of the lifecycles chapter of the How-we-work page.",
    // NO INSERT ABOVE THE TABS, and NO INSTRUCTIONS anywhere on this page (his ruling,
    // 2026-10-28: this surface teaches the method, it never ushers — "people can press whatever
    // they press"). The body is the kind tabs, the prose under each, and the states. That is all.
    body: () => (
      <>
        <Trails />
      </>
    ),
  },
  {
    // ONE PAGE, NOT TWO (his call, 2026-10-28): the upward demo IS a living spec — an arc whose
    // state is read off its plans is exactly "is this still true?" as a derivation — so the demo
    // and the proof shapes teach one idea and share one tab, wearing the specs name.
    id: "specs",
    label: "Living specs",
    kicker: "the newest idea",
    title: "A living spec — a document that keeps answering",
    lede: "A claim carries its proof where it stands — a test in the project's suite, or a run kept in the document with its output. So a design is not just a record of what was agreed: the whole development arc can be validated in one shot, any time, against evidence instead of memory.",
    tour: "Run the voice tour of the Living specs chapter of the How-we-work page.",
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
        <h3 className="hww-sub">Claims and proofs</h3>
        <div className="hww-specs">
          <div className="hww-specs__half">
            <h4>claims</h4>
            <p>
              <Rich>
                When an RFC settles its argument, the design reduces to **claims** — assertions
                that can be verified.
              </Rich>
            </p>
          </div>
          <div className="hww-specs__half">
            <h4>proofs</h4>
            <p>
              <Rich>
                A proof adds evidence to a claim — a test the project's suite can run at will, or
                a run kept in the document with its output. A claim with nothing behind it reads
                **unproved**.
              </Rich>
            </p>
          </div>
          <div className="hww-specs__half">
            <h4>the arc</h4>
            <p>
              <Rich>
                Specs roll up the wires of the arc — plans answer objectives, objectives answer
                the arc. That is what makes the one-shot validation real: the entire development
                arc, **tested at once**.
              </Rich>
            </p>
          </div>
        </div>
        <div className="hww-specs__spec">
          <h4>The spec report</h4>
          <p>
            <Rich>
              A report can be a spec too: filed with claims and their evidence, it reads **current**
              while the evidence passes and **drifted** when it stops.
            </Rich>
          </p>
        </div>
        <div className="hww-specs__why">
          <Rich>
            **Why this is the one that makes orchestration possible rather than hopeful.** A failing
            proof on a met claim is the moment a spec stops describing the system — and on a settled
            spec it is the sharpest alarm the design can produce. Without proofs that moment is
            invisible; with them it is caught the moment anyone asks. Which is also why `resolved`
            on a gap requires one: it is the only state in the system where **the claim cannot
            outrun the evidence.**
          </Rich>
        </div>
      </>
    ),
  },
  {
    // WHO DOES THE WORK — the hero says the structure (one window, one owner per project, the doc
    // and the record), the intro makes the single point the six cards orbit (one owner is the
    // anti-drift rule), and the note keeps the umbrella claim: nothing here runs on trust.
    id: "agents",
    label: "Agents",
    kicker: "who does the work",
    title: "One agent owns each project",
    lede: "You direct a team of agents from one window. One agent owns each project and answers for everything in it — the code, the documents, the gaps. A doc defines what each agent is for, skills and jobs equip it, and the record shows you what it actually did.",
    tour: "Run the voice tour of the agents chapter of the How-we-work page.",
    body: () => (
      <>
        <p className="hww-intro">
          One owner is what keeps a project coherent. Two owners of one repo drift apart slowly and
          silently; one owner with disposable workers does not. So every question about a project
          already has an address, and work for another project goes to its owner — never around it.
        </p>
        <Agents />
        <div className="hww-note">
          <Rich>
            **Nothing here runs on trust.** The doc defines what an agent is for, and the record
            answers for what it did — between the two, the agent's own word decides nothing.
          </Rich>
        </div>
      </>
    ),
  },
  {
    // WHAT AN AGENT RUNS ON — the hero teaches the layers and who pulls the trigger, the intro
    // makes the bounded-growth point the pipeline below demonstrates, and the note carries the one
    // rule the whole table exists for: a fact in the wrong layer fails silently.
    id: "context",
    label: "Context",
    wide: true,
    kicker: "what an agent runs on",
    title: "An agent is its context",
    lede: "Everything an agent knows arrives in layers. A few load every turn — where it stands, how this place works, what it is for. The rest waits until the agent asks, or arrives on its own at a moment the agent would not think to ask. The layers differ in who pulls the trigger, and the wrong layer is the commonest way knowledge fails to arrive.",
    tour: "Run the voice tour of the context chapter of the How-we-work page.",
    body: () => (
      <>
        <p className="hww-intro">
          Nothing here grows without bound. Notes cost almost nothing to write, so agents write them
          the moment they learn something — and when several notes circle one subject, the handbook
          absorbs them and the absorbed notes get deleted. Knowledge keeps moving up, and the store
          stays small enough to search.
        </p>
        <ContextStack />
        <div className="hww-note">
          <Rich>
            **A fact in the wrong layer is either paid for every turn forever, or never found at
            all.** Instructions load whole, because a constraint sitting in a chunk that did not
            score silently does not exist. Reference lives where a search finds it, where missing a
            section costs only a re-read. Which is why, when an agent fails, the first suspect is
            the instruction that failed it — **the agent is rarely at fault; it was instructed.**
          </Rich>
        </div>
      </>
    ),
  },
  {
    // THE MACHINERY — the hero walks the chain in one breath (events, hooks, the offered/given
    // fork, accounts), the intro makes the point that the chain's separations ARE the design, and
    // the note keeps the two rules that guard it: carrying arms a hook, and a job binds its inputs.
    id: "machine",
    label: "Hooks & jobs",
    wide: true,
    kicker: "the machinery",
    title: "What runs when nobody is in the room",
    lede: "The system announces its moments as events. A hook watches for one and points — at a skill the agent may choose, or at a job it is given whole, with every input the job declares. And whatever runs files an account of what it actually did, so unattended work stays checkable instead of hopeful.",
    tour: "Run the voice tour of the hooks and jobs chapter of the How-we-work page.",
    body: () => (
      <>
        <p className="hww-intro">
          The chain turns a moment nobody was watching into a record somebody can read. It stays
          five separate things on purpose — an event claims nothing, a hook only points, a skill
          leaves the agent the decision, a job carries bounds and named inputs — because each link
          asks for a different kind of trust.
        </p>
        <Chain />
        <div className="hww-note">
          <Rich>
            **A job is given, never chosen.** Writing a hook does not arm it — an agent has to carry
            it first. And a hook that cannot supply every input its job declares fails at the
            writing door, not silently at three in the morning.
          </Rich>
        </div>
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

  // The dash layer is drawn in the path's own 900px space and scaled to the real width — measured
  // once per resize, never per frame. jsdom has no ResizeObserver; the guard keeps tests honest.
  const artRef = useRef(null);
  const [artScale, setArtScale] = useState(1);
  useEffect(() => {
    if (typeof ResizeObserver === "undefined" || !artRef.current) return undefined;
    const ro = new ResizeObserver(() => {
      const w = artRef.current ? artRef.current.clientWidth : 0;
      if (w) setArtScale(w / 900);
    });
    ro.observe(artRef.current);
    return () => ro.disconnect();
  }, []);

  // Which way you travelled decides the slide: the next header arrives from that side, and the
  // one you left gets pushed out the other. `out` is the header currently exiting.
  const [slide, setSlide] = useState({ from: "", out: null });
  // THE SLIDE CLASSES CLEAR THEMSELVES after the push has played (his bug, 2026-10-28: a bounce —
  // or even a bare click on the header — re-triggered the entrance, because toggling an inline
  // `animation: none` on an element that still carries `is-from-*` restarts that animation from
  // zero). Once cleared, there is nothing to replay.
  const slideT = useRef(null);
  useEffect(() => () => clearTimeout(slideT.current), []);
  const go = (id) => {
    const here = PAGES.findIndex((p) => p.id === at);
    const there = PAGES.findIndex((p) => p.id === id);
    if (there !== here) {
      setSlide({ from: there > here ? "right" : "left", out: at });
      clearTimeout(slideT.current);
      slideT.current = setTimeout(() => setSlide({ from: "", out: null }), 420);
    }
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
  // idle → drag (following the hand) → settle (bouncing home) → idle. The settle phase is what
  // turns a released drag into a bounce instead of a snap.
  const [phase, setPhase] = useState("idle");
  const settleT = useRef(null);
  useEffect(() => () => clearTimeout(settleT.current), []);
  const pointer = useRef({ x: 0, down: false, moved: 0 });

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
    let dx = e.clientX - p.x;
    if (Math.abs(dx) < 2 && phase === "idle") return; // a click's jitter is not a drag
    // RUBBER-BAND AT THE ENDS — there is no page that way, so the header gives only a third of
    // the hand ("it shouldn't go so far"): the resistance itself says you are at the edge.
    if ((dx > 0 && idx === 0) || (dx < 0 && idx === PAGES.length - 1)) dx = dx / 3;
    p.moved = Math.max(p.moved, Math.abs(dx));
    setPhase("drag");
    setDragPx(dx);
  };
  const dragEnd = () => {
    if (!pointer.current.down) return;
    pointer.current.down = false;
    if (dragPx <= -60 && idx < PAGES.length - 1) {
      setDragPx(0);
      setPhase("idle");
      step(1);
    } else if (dragPx >= 60 && idx > 0) {
      setDragPx(0);
      setPhase("idle");
      step(-1);
    } else {
      // short of the line, or at an edge: BOUNCE home — transition on, then let go of the value
      setPhase("settle");
      requestAnimationFrame(() => requestAnimationFrame(() => setDragPx(0)));
      clearTimeout(settleT.current);
      settleT.current = setTimeout(() => setPhase("idle"), 350);
    }
  };
  const swallowDraggedClick = (e) => {
    if (pointer.current.moved > 10) {
      e.preventDefault();
      e.stopPropagation();
      pointer.current.moved = 0;
    }
  };
  // SCROLL-TO-SLIDE IS GONE (his call, 2026-10-28, after three cuts: threshold paging read as "a
  // suggestion", and live-follow fought trackpad momentum — "scroll doesn't work, get rid of it").
  // The drag is the slider; a wheel over the top section does nothing, which is at least honest.

  return (
    <div className="hww" ref={rootRef}>
      <div
        className="hww-heads"
        onPointerDown={dragStart}
        onPointerMove={dragMove}
        onPointerUp={dragEnd}
        onPointerLeave={dragEnd}
        onClickCapture={swallowDraggedClick}
      >
        <div className="hww-heads__art" aria-hidden="true" ref={artRef}>
          <svg viewBox="0 0 900 120" preserveAspectRatio="none">
            <path className="hww-hero__path" d="M0 96 C 160 96 190 24 350 24 C 520 24 540 96 700 96 C 820 96 860 60 900 56" />
          </svg>
          {/* THE DASHES — the original current: three 10px pieces of the line flowing ALONG the
              curve (`stroke-dasharray: 10 260` made three at once on this path). Each is a tiny
              pill riding the literal bezier via `offset-path`, auto-rotated to its tangent,
              staggered a third apart. Motion-path is transform-family, so the travel stays on the
              compositor — the dash-march this replaces repainted the whole strip every frame and
              held the GPU at ~110% (measured 2026-10-28). The layer is drawn in the path's own
              900×120 space and scaled to the container, exactly what preserveAspectRatio=none did
              to the drawing. */}
          <div
            className={`hww-heads__dashes${DASHES_MOVE ? " is-moving" : ""}`}
            style={{ transform: `scaleX(${artScale})` }}
          >
            {DASHES_MOVE ? <style>{DASH_KEYFRAMES}</style> : null}
            {DASH_SPOTS.map((tf) => (
              <i key={tf} style={DASHES_MOVE ? undefined : { transform: tf }} />
            ))}
          </div>
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
            phase={phase}
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
            // the chapter's stable address — a saved tour command presses `[data-chap="specs"]`,
            // immune to reordering (his ruling: our application assigns its own attributes)
            data-chap={p.id}
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
