import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import "./styles.scss";
import { setHelpTopic } from "../../atoms/Help/helpStore";
import { stateOf, objectiveComplete } from "../../atoms/Markdown/blocks/lifecycleState";
import commandRunner from "../../utils/hostCommand";
import { hasHostDictation, startHostRecording } from "../../utils/hostDictation";
import SEND_ICON from "../../assets/send.png";
import { richParts } from "./rich";
import {
  AGENTS,
  CHAIN,
  DOORS,
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
// THE STAGE DOOR — every flow card is a FACILITATOR (his design, 2026-10-28): the CHAT'S OWN
// composer in miniature, because "if it's going to be an input it looks and behaves like the
// input" — a textarea that wraps and grows, the same recorder the chat uses (the host utility,
// already integrated — nothing lifted), and the same send icon. The stem is prefilled and yours to
// finish; send dispatches `sv:say`, and the first chat panel runs it through its own send().
const doorGrow = (el) => {
  el.style.height = "auto";
  el.style.height = `${Math.min(el.scrollHeight, 110)}px`;
};
// THE STEM IS OURS, THE WORDS ARE YOURS (his correction, 2026-10-28: "how is it you can delete
// the beginning sentence that was there to help?"). The stem renders as a fixed prompt line inside
// the box — not text in the field, so it cannot be deleted, selected or half-edited — and the
// field itself starts EMPTY with a placeholder that actually helps. Send composes the two.
const StageDoor = ({ stage, onTouch }) => {
  const [text, setText] = useState("");
  const [sent, setSent] = useState(false);
  const [listening, setListening] = useState(false);
  const boxRef = useRef(null);
  const micRef = useRef(null);
  const t = useRef(null);
  useEffect(() => {
    setText("");
    setSent(false);
    setTimeout(() => boxRef.current && doorGrow(boxRef.current), 0);
  }, [stage.id, stage.say]);
  useEffect(
    () => () => {
      clearTimeout(t.current);
      if (micRef.current) micRef.current.cancel();
    },
    []
  );

  // TEACH IS A BUTTON (his design, 2026-10-28: "teach me was supposed to be a button… it gives
  // them the RIGHT prompt, not a prompt that I necessarily saw"). One press sends a PREPARED ask
  // that carries the context the agent needs — where you are standing, what to ground the lesson
  // in, what to read — because a bare "teach me X" is a prompt the agent can only guess at. The
  // label is yours to read; the brief rides underneath it.
  if (stage.teach) {
    const teach = () => {
      window.dispatchEvent(new CustomEvent("sv:say", { detail: { text: stage.teach.prompt } }));
      setSent(true);
      clearTimeout(t.current);
      t.current = setTimeout(() => setSent(false), 2400);
    };
    return (
      <div className="hww-flow__say">
        <button
          type="button"
          className="hww-btn hww-btn--go"
          onClick={teach}
          title="sends the agent a prepared ask, with the context it needs"
        >
          {sent ? "sent ✓ — watch the chat" : stage.teach.label}
        </button>
      </div>
    );
  }
  if (!stage.say) return null;

  const stopMic = () => {
    const rec = micRef.current;
    micRef.current = null;
    setListening(false);
    if (rec) rec.cancel();
  };
  const toggleMic = async () => {
    if (listening) return stopMic();
    onTouch && onTouch();
    try {
      micRef.current = await startHostRecording({
        onSegment: (said) =>
          setText((cur) => {
            const next = cur && !/\s$/.test(cur) ? `${cur} ${said}` : `${cur}${said}`;
            setTimeout(() => boxRef.current && doorGrow(boxRef.current), 0);
            return next;
          }),
      });
      setListening(true);
    } catch {
      setListening(false);
    }
  };
  // A stage that NEEDS your words refuses to send the bare stem ("Write the RFC for" alone is
  // noise); a teach stem is a whole sentence and sends as it stands.
  const ready = stage.need ? !!text.trim() : true;
  const fire = () => {
    if (!ready) return;
    if (listening) stopMic(); // you said what you had to say — same rule as the chat's send
    const msg = [stage.say, text.trim()].filter(Boolean).join(" ");
    window.dispatchEvent(new CustomEvent("sv:say", { detail: { text: msg } }));
    setText("");
    setSent(true);
    clearTimeout(t.current);
    t.current = setTimeout(() => setSent(false), 2400);
  };

  return (
    <div className="hww-flow__say">
      <div className="hww-flow__saybox">
        <span className="hww-flow__saystem">{stage.say}</span>
        <textarea
          ref={boxRef}
          className="hww-flow__sayinput"
          rows={1}
          value={text}
          placeholder={stage.ph || ""}
          aria-label="say it to the agent"
          onFocus={onTouch}
          onChange={(e) => {
            setText(e.target.value);
            doorGrow(e.target);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              fire();
            }
          }}
        />
      </div>
      {hasHostDictation() && (
        <button
          type="button"
          className={`hww-flow__saymic${listening ? " is-on" : ""}`}
          title={listening ? "Stop listening" : "Dictate — speech goes into the input"}
          onClick={toggleMic}
        >
          🎙
        </button>
      )}
      <button
        type="button"
        className="hww-flow__saysend"
        onClick={fire}
        disabled={!ready}
        title={sent ? "sent ✓" : "Send"}
      >
        <img src={SEND_ICON} alt="send" />
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
        <StageDoor stage={stage} onTouch={hold} />
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

      {/* A FORK IS A COLUMN OF TWO: a `fork` station shares its column with the station before it
          — the line runs through the one on it, and the fork's own strokes diverge from the line
          and rejoin it, because `rejected` is a destination with the same next stop, not a drop
          off the trail. The strokes are the column's, fixed geometry, so they survive any width. */}
      <ol className={`hww-trail hww-trail--${kind}`}>
        {life.stations
          .reduce((cols, s) => {
            if (s.fork && cols.length) cols[cols.length - 1].push(s);
            else cols.push([s]);
            return cols;
          }, [])
          .map((col) => (
            <li
              key={col[0].id}
              className={`hww-trail__col${col.length > 1 ? " hww-trail__col--split" : ""}`}
            >
              {col.map((s) => (
                <div
                  key={s.id}
                  className={`hww-trail__st${s.fork ? " hww-trail__st--fork" : ""}${
                    s.id === station.id ? " is-at" : ""
                  }`}
                >
                  <button
                    type="button"
                    className="hww-trail__btn"
                    onClick={() => setAt(life.stations.indexOf(s))}
                  >
                    <span className="hww-trail__ring">{s.pressable ? "⌾" : "◦"}</span>
                    <span className="hww-trail__name">{s.id}</span>
                  </button>
                </div>
              ))}
            </li>
          ))}
      </ol>

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
// THE AGENTS — who does the work. Six cards off the data file; the one claim under all of them is
// that nothing here runs on trust: the doc defines, the record answers.

const Agents = () => (
  <div className="hww-agents">
    {AGENTS.map((a) => (
      <div className="hww-agent" key={a.name}>
        <div className="hww-agent__top">
          <span className="hww-agent__name">{a.name}</span>
          <span className="hww-agent__one">{a.one}</span>
        </div>
        <p className="hww-agent__body">
          <Rich>{a.body}</Rich>
        </p>
      </div>
    ))}
  </div>
);

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
    links: [
      { label: "registration", to: "register" },
      { label: "start something", to: "start" },
    ],
    body: () => (
      <>
        <p className="hww-intro">
          Below is the shape the work tends to take — not rules. Plenty happens outside it: a fix
          you ask for lands straight in your tree, a question gets answered in the chat. But when
          something is big enough to be worth a record, this is the path, and at every step there is
          a document somebody can open.
        </p>
        <p className="hww-hero__honest">
          <Rich>
            This page is the manual, not a dashboard of your repo — every id, count and document on
            it is an example. The one exception is the arc in **Living specs**, which really derives.
          </Rich>
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
    links: [{ label: "the lifecycles those kinds walk", to: "lifecycle" }],
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
    links: [{ label: "how a plan settling settles the arc", to: "specs" }],
    // NO INSERT ABOVE THE TABS, and NO INSTRUCTIONS anywhere on this page (his ruling,
    // 2026-10-28: this surface teaches the method, it never ushers — "people can press whatever
    // they press"). The body is the kind tabs, the prose under each, and the states. That is all.
    body: () => <Trails />,
  },
  {
    // ONE PAGE, NOT TWO (his call, 2026-10-28): the upward demo IS a living spec — an arc whose
    // state is read off its plans is exactly "is this still true?" as a derivation — so the demo
    // and the proof shapes teach one idea and share one tab, wearing the specs name.
    id: "specs",
    label: "Living specs",
    kicker: "the newest idea",
    title: "A living spec — where “is this still true?” is a button",
    lede: [
      "A claim can carry its proof in a fold: a test that lives as a file in the project's suite, or a run block that runs right there in the document. Pressing it is the difference between a design you remember agreeing to and a design that answers for itself.",
      "And a state can BE one. An arc grows objectives; objectives get plans attached BY ID — `::rfc{id=RFC-073 arc=ARC-004-O2}` — and a plan settling in its own document completes the objective, which settles the arc. Three of an arc's five states cannot be pressed at all, because the facts they read live in other documents.",
    ],
    links: [
      { label: "the trails themselves", to: "lifecycle" },
      { label: "the full block vocabulary", help: "markdown" },
    ],
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
        <h3 className="hww-sub">The proof shapes — where the evidence lives</h3>
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
    id: "told",
    label: "Being told",
    kicker: "delivery",
    title: "A document knows who is on it, and tells them when it changes",
    lede: "A document carries `::members{who=…}` — project rooms, not people, because delivery already works in rooms. When a block gets an ANSWER and nobody covering that audience has been told, the system delivers one update and stamps `told=` on the block's own line for exactly who was reached.",
    links: [{ label: "who does the work", to: "agents" }],
    body: () => <TellDemo />,
  },
  {
    id: "agents",
    label: "Agents",
    kicker: "who does the work",
    title: "Every project is owned by an agent, and an agent is its context",
    lede: "The window is one person directing a team of agents. Each one is a session wearing a definition — a doc saying what it is for, loaded every turn — equipped with procedures it can choose and procedures it is given, reachable in its project's room, and watched through a record that never asks you to take its word.",
    links: [
      { label: "the context an agent runs on", to: "context" },
      { label: "what runs when nobody is in the room", to: "machine" },
    ],
    body: () => <Agents />,
  },
  {
    id: "context",
    label: "Context",
    wide: true,
    kicker: "what an agent runs on",
    title: "Context arrives in layers, and the layers differ in who pulls the trigger",
    lede: "An agent is its context. Getting a layer wrong is the commonest way knowledge fails to arrive — and the symptom is never an error, it is an agent confidently acting on a world that moved.",
    links: [{ label: "what runs when nobody is in the room", to: "machine" }],
    body: () => <ContextStack />,
  },
  {
    id: "machine",
    label: "Hooks & jobs",
    wide: true,
    kicker: "the machinery",
    title: "Events announce moments; hooks point at procedures; jobs are given and file accounts",
    lede: "This is how work happens when you are not in the room. The chain is deliberately four separate things, because each one is a different kind of trust.",
    links: [{ label: "start something", to: "start" }],
    body: () => <Chain />,
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
