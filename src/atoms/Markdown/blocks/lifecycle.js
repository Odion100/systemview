import React, { useCallback, useEffect, useMemo, useState } from "react";
import { getAgent } from "../../../utils/hub";
import { useDocMembers, useMarkdownWrite } from "../context";
import { TRAILS, stateOf, pressTo, declaredOn, DERIVED_FROM } from "./lifecycleState";

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
    // rather than on the attrs object, which is new on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [kind, attrs.settled, attrs.retired, attrs.resolved]
  );
  const [nonce, setNonce] = useState(0);
  const [refused, setRefused] = useState("");
  const row = useRegistryRow(kind, id, nonce);
  const { editable, setAttr, appendEnd } = useMarkdownWrite() || {};
  const canPress = !!editable && !!line && !!setAttr && !!row;

  const press = useCallback(
    (station) => {
      if (!canPress) return;
      const plan = pressTo(kind, station, row, today(), leaf);
      if (!plan.ok) {
        setRefused(plan.why);
        return;
      }
      setRefused("");
      // The STATUS heading first: `built` is the one station no leaf attribute declares, and the
      // claims bar already writes it this way. Then the attributes, in one write.
      if (plan.appendStatus && appendEnd) appendEnd(`## STATUS — built ${today()}`);
      if (Object.keys(plan.attrs).length) setAttr(line, plan.attrs);
      setNonce((n) => n + 1);
    },
    [canPress, kind, row, line, setAttr, appendEnd, leaf]
  );

  if (!row) return null; // unregistered, or an older hub — the leaf stays the label it was
  const current = stateOf(kind, row, leaf);
  const steps = current === "rejected" ? ["draft", "rejected"] : TRAILS[kind] || [];
  const reached = steps.indexOf(current);
  const derived = DERIVED_FROM[kind] || {};

  return (
    <span
      className={`md-arc__life${canPress ? " md-arc__life--live" : ""}`}
      title={canPress ? "" : "the registry's derived state — parse, never testimony"}
    >
      {steps.map((s, i) => {
        const label =
          s === "done" && row.state && row.state.objectives && i === reached
            ? `done ${row.state.objectives.done}/${row.state.objectives.total}`
            : s;
        const cls = `md-arc__station${i === reached ? " md-arc__station--now" : ""}${
          i < reached ? " md-arc__station--past" : ""
        }${s === "rejected" && i === reached ? " md-arc__station--dead" : ""}`;
        if (!canPress) return <span key={s} className={cls}>{label}</span>;
        return (
          <button
            key={s}
            type="button"
            className={`${cls} md-arc__station--press`}
            onClick={() => press(s)}
            title={
              i === reached
                ? `this document is ${s}`
                : derived[s]
                ? `${s} comes from ${derived[s]} — this cannot set it`
                : `mark it ${s} — writes the declaration into this document`
            }
          >
            {label}
          </button>
        );
      })}
      {refused ? (
        <span className="md-arc__refused" role="status">
          {refused}
        </span>
      ) : null}
    </span>
  );
};

export default LifecycleTrail;
