import React, { useCallback, useEffect, useMemo, useState } from "react";
import { getAgent } from "../../../utils/hub";
import { useDocMembers, useMarkdownWrite } from "../context";
import {
  TRAILS,
  stateOf,
  pressTo,
  declaredOn,
  DERIVED_FROM,
  reasonsFor,
  reasonOf,
  stepsFor,
} from "./lifecycleState";

// RFC-075 §2 (his, folded at execution): *"the blocks for RFC and reports are literally just
// labels — make the interactive component about the LIFE CYCLE of the document."*
//
// The registration leaf renders its kind's lifecycle with the document's current state lit, read
// from the registry's derived state — the one place that state already lives (RFC-073: the shell's
// parse derives it, nothing else writes it). A document with no registry row shows no trail at all,
// because absence stated beats a trail invented.
//
// AND THE STATIONS ARE PRESSABLE (his: *"just give me the ability to click and change it"*). That is
// not a second state machine — a press WRITES THE DECLARATION INTO THE DOCUMENT, which is the same
// source the trail is read from, so the file stays the single state and the click is only a door
// onto it. Going back clears the declaration rather than storing a new one.
//
// A STATION A PRESS CANNOT REACH SAYS SO instead of sitting there dead. `approved` comes from the
// approval block's verdict and `done` from an arc's objectives; `setAttr` cannot unwrite a STATUS
// heading, so built → approved is refused by name. The rule and its reasons are in
// `lifecycleState.js`, which is pure and tested — this file is the control, not the law.
export { TRAILS, stateOf } from "./lifecycleState";

// The row for THIS document, by identity — the id is the address everything points at. Re-read when
// `nonce` moves, which is how a press sees its own write land: the document write triggers the
// shell's parse, the parse rewrites the row, and this asks again.
export function useRegistryRow(kind, id, nonce = 0) {
  const { projectCode = "" } = useDocMembers() || {};
  const [row, setRow] = useState(null);
  useEffect(() => {
    let dead = false;
    const agent = getAgent();
    if (!agent || !agent.documentsRegistry || !id) return undefined;
    const ask = () =>
      Promise.resolve(agent.documentsRegistry({ projectCode: projectCode || undefined, kind }))
        .then((rows) => {
          if (dead) return null;
          const found = (rows || []).find((r) => r.id === id) || null;
          setRow(found);
          return found;
        })
        .catch(() => null);
    // Two asks after a press, not one. The parse is triggered by the write and lands a beat later,
    // so the first read is usually the state as it WAS — and a station that snaps back to where it
    // started is indistinguishable from a press that did nothing.
    ask();
    const t = nonce ? setTimeout(ask, 1200) : null;
    return () => {
      dead = true;
      if (t) clearTimeout(t);
    };
  }, [kind, id, projectCode, nonce]);
  return row;
}

const today = () => new Date().toISOString().slice(0, 10);

// The trail itself: every station the kind passes through, the current one lit. A rejected RFC
// shows its real ending — the trail is draft → rejected, because approved/built are stations it
// will never reach and drawing them would read as "still coming".
export const LifecycleTrail = ({ kind, id, line, attrs = {} }) => {
  // THE LEAF'S OWN ATTRIBUTES ARE THE LIVE HALF. The registry row is a cache of the last parse and
  // this used to read it once at mount, so a `settled=` that changed in the file never moved the
  // trail — and a press then argued with the stale copy. These come from the parse of the document
  // on screen, so they are never behind it.
  const leaf = useMemo(
    () => declaredOn(kind, attrs),
    // The declared attributes are the only ones that matter here, so the memo keys on their values
    // rather than on the attrs object, which is new on every render. `rejected` joined the list
    // with RFC-076 §4.5 — a gap's second ending is declared on the leaf like the first.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [kind, attrs.settled, attrs.retired, attrs.resolved, attrs.rejected]
  );
  const [nonce, setNonce] = useState(0);
  const [refused, setRefused] = useState("");
  const [needs, setNeeds] = useState("");
  // THE REASON MENU IS THE GATE'S REPLACEMENT (§4.3). Pressing `retired` no longer writes — it
  // ASKS, because the old design refused the press and this one refuses only an unsaid reason.
  // `asking` holds the station being retired into; `pointer` is the superseded-by field, which
  // only one reason needs and which therefore only appears when that reason is chosen.
  const [asking, setAsking] = useState(false);
  const [pointer, setPointer] = useState("");
  // §4.5 — a gap's rejection asks too, and its reason is a LINE rather than a word from a list,
  // because §3's gap table describes a closed list but never names its members.
  const [declining, setDeclining] = useState(false);
  const [declined, setDeclined] = useState("");
  const row = useRegistryRow(kind, id, nonce);
  const { editable, setAttr, appendEnd } = useMarkdownWrite() || {};
  const canPress = !!editable && !!line && !!setAttr && !!row;

  const write = useCallback(
    (station, reason = "", ptr = "") => {
      if (!canPress) return false;
      const plan = pressTo(kind, station, row, today(), leaf, reason, ptr);
      if (!plan.ok) {
        setRefused(plan.why);
        // A refusal that names something you can ADD carries it through, so the control can offer
        // the fix beside the complaint rather than leaving you to read the sentence and go hunting.
        setNeeds(plan.needs || "");
        return false;
      }
      setRefused("");
      setNeeds("");
      // The STATUS heading first: `built` is the one station no leaf attribute declares, and the
      // claims bar already writes it this way. Then the attributes, in one write.
      if (plan.appendStatus && appendEnd) appendEnd(`## STATUS — built ${today()}`);
      if (Object.keys(plan.attrs).length) setAttr(line, plan.attrs);
      setNonce((n) => n + 1);
      return true;
    },
    [canPress, kind, row, line, setAttr, appendEnd, leaf]
  );

  const press = useCallback(
    (station) => {
      if (!canPress) return;
      // RETIRING OPENS THE MENU INSTEAD OF WRITING. Every other station still writes on the press,
      // because every other station is reached by saying one thing; retirement is reached by
      // saying two, and the second one cannot be guessed on your behalf.
      if (station === "retired") {
        setRefused("");
        setPointer("");
        setAsking(true);
        return;
      }
      // A GAP'S REJECTION ASKS THE SAME WAY, for the same reason: declining something without
      // saying why is indistinguishable from never looking at it, so the press is a question.
      // ONLY a gap's — an RFC's rejection is a verdict on its approval block, not a leaf
      // declaration, so opening a reason field there would be offering a write that cannot land.
      if (station === "rejected" && kind === "gap") {
        setRefused("");
        setPointer("");
        setDeclining(true);
        return;
      }
      setAsking(false);
      setDeclining(false);
      write(station);
    },
    [canPress, write]
  );

  const give = useCallback(
    (reason) => {
      const r = reasonOf(reason);
      // `superseded` needs a document named, so the first press on it opens the field rather than
      // writing a retirement nobody can follow back to its replacement.
      if (r && r.needs && !String(pointer).trim()) {
        setRefused("superseded by what? name the document that replaced this one");
        return;
      }
      if (write("retired", reason, pointer)) setAsking(false);
    },
    [write, pointer]
  );

  const decline = useCallback(() => {
    if (write("rejected", declined)) {
      setDeclining(false);
      setDeclined("");
    }
  }, [write, declined]);

  // §4.5's offer, and it is what makes the refusal a step instead of a wall: a gap one block away
  // from being resolved gets that block written for it, with the press still his. The skeleton is
  // a `:::cmd` because it is the proof that needs no harness — whatever closed the gap, you can
  // usually show it from a shell.
  const offerProof = useCallback(() => {
    if (!appendEnd) return;
    appendEnd(":::cmd\n# what proves this gap is closed — press it\n:::");
    setRefused("");
  }, [appendEnd]);

  if (!row) return null; // unregistered, or an older hub — the leaf stays the label it was
  const current = stateOf(kind, row, leaf);
  // WHAT THE TRAIL DRAWS IS ITS OWN QUESTION, and it now lives in the pure module — a gap forks,
  // so what it shows depends on which side it took, and a trail drawing both would mark two
  // mutually exclusive endings as past.
  const { steps, alt } = stepsFor(kind, current, row, leaf);
  const reached = steps.indexOf(current);
  const derived = DERIVED_FROM[kind] || {};
  // NARROWED BY WHERE YOU STAND, which is the gate's honest form: `cancelled` from `draft`,
  // `out of service` only once there is something finished to take out of service. The words
  // change, the button never disappears.
  const offered = asking ? reasonsFor(current) : [];
  const retiredAs = String((row.state || {}).retiredAs || "");
  const standing = retiredAs ? reasonOf(retiredAs) : null;
  // A REASON NOBODY PUT ON THE LIST IS SAID IN THE DOCUMENT, visibly, read-only included — not in
  // a hover. The reasons are closed because conditions branch on them, so a word the system cannot
  // read is a fact the reader needs: the document is retired AND unfileable, and a tooltip only
  // the editable render carried was the surface keeping that to itself.
  const unreadable = current === "retired" && retiredAs && !standing;

  // THE BAR AND THE PANEL ARE SIBLINGS, never nested. The leaf is one row and it must not move:
  // anything that opens — a refusal, the reason menu, a step list — goes in `__panel`, which the
  // leaf's `flex-wrap` drops onto its own full-width line underneath. Rendered inside the bar they
  // competed with the stations for width and shoved the document's identity sideways.
  return (
    <>
    <span
      className={`md-arc__life${canPress ? " md-arc__life--live" : ""}`}
      title={canPress ? "" : "the registry's derived state — parse, never testimony"}
    >
      {steps.map((s, i) => {
        // THE IN-FLIGHT STATION WEARS THE FOLD'S OWN NUMBERS — complete over total, because "how
        // many objectives have their plans settled" is the question inProgress exists to answer.
        const o = (row.state && row.state.objectives) || null;
        const label =
          s === "inProgress"
            ? o && i === reached
              ? `in progress ${o.complete || 0}/${o.total}`
              : "in progress"
            : s;
        const cls = `md-arc__station${i === reached ? " md-arc__station--now" : ""}${
          i < reached ? " md-arc__station--past" : ""
        }${s === "rejected" && i === reached ? " md-arc__station--dead" : ""}${
          // An ALTERNATIVE, not a step after the one before it — drawn with "/" instead of "›", so
          // a gap's two endings do not read as a sequence you pass through.
          alt.includes(s) ? " md-arc__station--alt" : ""
        }`;
        if (!canPress) return <span key={s} className={cls}>{label}</span>;
        return (
          <button
            key={s}
            type="button"
            className={`${cls} md-arc__station--press`}
            onClick={() => press(s)}
            title={
              i === reached
                ? // THE DOCUMENT ITSELF HAS TO SAY WHEN IT CANNOT PLACE THE REASON (c6). This fell
                  // back to a bare "this document is retired" for an unlisted word, so the only
                  // surface admitting the problem was the drawer — and c6 says *the document*
                  // says so. Caught by a blind review reading the claim against the code.
                  s === "retired" && retiredAs
                  ? standing
                    ? `this document is retired — ${standing.label}: ${standing.why}`
                    : `this document is retired, but “${retiredAs}” is not a reason anything can read — it is neither an ending nor a pause`
                  : `this document is ${s}`
                : derived[s]
                ? `${s} comes from ${derived[s]} — this cannot set it`
                : s === "retired"
                ? "retire it — asks you why first, and the reason is what it writes"
                : `mark it ${s} — writes the declaration into this document`
            }
          >
            {label}
          </button>
        );
      })}
    </span>
    {asking || declining || refused || unreadable ? (
    <span className="md-arc__panel">
      {unreadable ? (
        <span className="md-arc__refused" role="note">
          retired as {retiredAs} — not a reason anything can read, so it files as neither an ending nor a pause
        </span>
      ) : null}
      {/* THE REASON MENU — what the gate became. It is not a confirm: there is nothing to confirm,
          because the words ARE the decision. The one reason that needs a pointer grows a field
          instead of being refused twice. */}
      {asking ? (
        <span className="md-arc__why" role="group" aria-label="why is this being retired">
          <span className="md-arc__why-ask">why?</span>
          {offered.map((r) => (
            <button
              key={r.id}
              type="button"
              className={`md-arc__why-pick md-arc__why-pick--${r.group}`}
              onClick={() => give(r.id)}
              title={`${r.why} — ${r.group === "pause" ? "stays in the lists, showing this" : "leaves the active lists"}`}
            >
              {r.label}
            </button>
          ))}
          <input
            className="md-arc__why-ptr"
            type="text"
            value={pointer}
            placeholder="superseded by…"
            aria-label="superseded by"
            onChange={(e) => setPointer(e.target.value)}
          />
          <button
            type="button"
            className="md-arc__why-pick md-arc__why-pick--off"
            onClick={() => {
              setAsking(false);
              setRefused("");
            }}
            title="leave it where it is"
          >
            never mind
          </button>
        </span>
      ) : null}
      {/* §4.5 — SAY WHY IT IS DECLINED. A line, not a menu: the closed list §3 describes has no
          members anywhere in the RFC, and inventing five words would put a vocabulary nobody
          approved into the system. */}
      {declining ? (
        <span className="md-arc__why" role="group" aria-label="why is this being declined">
          <span className="md-arc__why-ask">why?</span>
          <input
            className="md-arc__why-ptr md-arc__why-ptr--wide"
            type="text"
            value={declined}
            placeholder="declined because…"
            aria-label="why this is declined"
            onChange={(e) => setDeclined(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") decline();
            }}
          />
          <button type="button" className="md-arc__why-pick md-arc__why-pick--ending" onClick={decline}>
            decline it
          </button>
          <button
            type="button"
            className="md-arc__why-pick md-arc__why-pick--off"
            onClick={() => {
              setDeclining(false);
              setRefused("");
            }}
          >
            never mind
          </button>
        </span>
      ) : null}
      {refused ? (
        <span className="md-arc__refused" role="status">
          {refused}
          {/* THE REFUSAL THAT IS A STEP. `resolved` on an unproven gap is one block away from
              true, so the control offers the block instead of only naming the problem. */}
          {needs === "proof" && appendEnd ? (
            <button type="button" className="md-arc__why-pick md-arc__why-pick--pause" onClick={offerProof}>
              add a proof block
            </button>
          ) : null}
        </span>
      ) : null}
    </span>
    ) : null}
    </>
  );
};

export default LifecycleTrail;
