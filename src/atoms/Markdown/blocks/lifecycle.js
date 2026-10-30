import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getAgent } from "../../../utils/hub";
import Trail from "../../Trail/Trail";
import { useDocMembers, useMarkdownWrite } from "../context";
import DocProofs from "./DocProofs";
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
import { facilitate, rfcCurrent } from "./facilitation";

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
    const timers = [];
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
    //
    // AND A ROW THAT ISN'T THERE YET GETS ASKED FOR AGAIN — bounded, not polled. A leaf written by
    // a cmd-press mounts the moment the document re-renders, which is BEFORE the shell's parse has
    // written the row (the fixture's raise, 2026-10-29: the leaf showed, the trail never came, and
    // only a remount would have fixed it — a surface requiring a refresh). Two retries cover the
    // parse lag; a document that is genuinely unregistered stops being asked about after that,
    // because absence stated beats a poll that never believes it.
    const askAndRetry = (delays) =>
      ask().then((found) => {
        if (found || dead || !delays.length) return found;
        timers.push(setTimeout(() => askAndRetry(delays.slice(1)), delays[0]));
        return null;
      });
    askAndRetry([1500, 4000]);
    if (nonce) timers.push(setTimeout(ask, 1200));
    return () => {
      dead = true;
      timers.forEach(clearTimeout);
    };
  }, [kind, id, projectCode, nonce]);
  return row;
}

/**
 * EVERY ROW, UNFILTERED — what an arc's facilitation needs and `useRegistryRow` cannot give it.
 * An arc's plans are RFCs, reports and gaps carrying `arc=<ARC-nnn-Ox>`, so a read filtered to
 * `kind=arc` returns the arc itself and none of the work it is waiting on. Only fetched for an
 * arc, and only while its panel is open: the rows are a lookup, and nothing else here needs them.
 */
export function useRegistryRows(wanted, nonce = 0) {
  const [rows, setRows] = useState([]);
  useEffect(() => {
    if (!wanted) return undefined;
    let dead = false;
    const agent = getAgent();
    if (!agent || !agent.documentsRegistry) return undefined;
    Promise.resolve(agent.documentsRegistry({}))
      .then((all) => {
        if (!dead) setRows(Array.isArray(all) ? all : []);
        return null;
      })
      .catch(() => null);
    return () => {
      dead = true;
    };
  }, [wanted, nonce]);
  return rows;
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
  // The pointer field is SUMMONED, not standing — only `superseded` needs a document named, and a
  // field sitting beside every reason read as a mystery ("what is superseded by anyway?" — his,
  // 2026-10-29, looking at exactly that).
  const [needPtr, setNeedPtr] = useState(false);
  // §4.5 — a gap's rejection asks too, and its reason is a LINE rather than a word from a list,
  // because §3's gap table describes a closed list but never names its members.
  const [declining, setDeclining] = useState(false);
  const [declined, setDeclined] = useState("");
  // RFC-076 §3's fourth column — the station a press cannot reach directly opens its STEPS instead
  // of a refusal. Only the TARGET is state; the plan body is derived fresh every render from the
  // live source, so a button that just wrote 23 marks comes back as the next step, not a stale one.
  const [helping, setHelping] = useState("");
  const panelRef = useRef(null);
  const row = useRegistryRow(kind, id, nonce);
  const { editable, setAttr, setAttrs, appendEnd } = useMarkdownWrite() || {};
  const { source = "", projectCode = "" } = useDocMembers() || {};
  // An arc's steps are about documents that are not this one — the registry is the only place
  // those live. Fetched only for an arc whose panel is open (see useRegistryRows).
  const planRows = useRegistryRows(kind === "arc" && !!helping && id, nonce);
  const ctx = useMemo(
    () => ({ rows: planRows, id, project: projectCode, attrs }),
    // keyed on the attribute VALUES a step reads, not the object, which is new every render
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [planRows, id, projectCode, attrs.resolved, attrs.rejected, attrs.by, attrs.why]
  );
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
      // UN-RETIRING A REPORT CLEARS ITS CLOCK IN THE SAME STEP (RFC-076 §3, c39) — or the
      // retention sweep retires it again the next time it runs, off the old first-open. The
      // ledger restart re-measures attention from the moment he chose to bring it back.
      if (kind === "report" && plan.attrs && plan.attrs.retired === null && id) {
        try {
          const agent = require("../../../utils/hub").getAgent();
          if (agent && agent.documentOpened) agent.documentOpened({ id, restart: true });
        } catch {}
      }
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
        setNeedPtr(false);
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
      // §3's COLUMN FOUR, BEFORE THE WRITE: a station with steps between here and there opens the
      // steps. Null means nothing to facilitate — the write (or its named refusal) is the answer.
      // THE CURRENT STATE COMES OFF THE SOURCE (rfcCurrent), never the registry row: the row is
      // the last parse's cache and it was stale at the first live walk — the panel never opened
      // because the row still said draft about approvals signed on the screen.
      const current = kind === "rfc" ? rfcCurrent(source, leaf) : stateOf(kind, row, leaf);
      // THE STATION YOU ARE ON IGNORES THE CLICK (his, 2026-10-29: "I can already see I'm in
      // draft") — the lit station says it; a red "already draft" line was a refusal where nothing
      // was refused.
      if (station === current) return;
      if (facilitate(kind, station, current, source, Date.now(), leaf, today(), ctx)) {
        setRefused("");
        setHelping(station);
        return;
      }
      setHelping("");
      write(station);
    },
    [canPress, write, kind, row, leaf, source, ctx]
  );

  // Apply one STEP of a plan — its writes in ONE SAVE (setAttrs; sequential setAttr calls clobber
  // each other), the leaf's own pairs merged in, the STATUS heading through the same door the
  // claims bar uses. The panel stays open: the source moves, the ladder re-derives, the ✓ lands
  // and the next step's button takes the floor without another trail press.
  const applyStep = useCallback(
    (step) => {
      if (!step) return;
      if (step.appendStatus) {
        if (appendEnd) appendEnd(`## STATUS — built ${today()}`);
        setNonce((n) => n + 1);
        return;
      }
      // A step that ADDS A BLOCK to the document — the gap's proof skeleton. Same door the claims
      // bar writes its STATUS heading through, so there is one way text reaches a document's end.
      if (step.appendText) {
        if (appendEnd) appendEnd(step.appendText);
        setNonce((n) => n + 1);
        return;
      }
      const writes = [...(step.writes || [])];
      if (step.leafPairs && line) writes.push({ line, pairs: step.leafPairs });
      if (!writes.length) return;
      if (setAttrs) setAttrs(writes);
      else if (writes.length === 1 && setAttr) setAttr(writes[0].line, writes[0].pairs);
      else {
        setRefused("this surface cannot write several lines in one save");
        return;
      }
      setNonce((n) => n + 1);
    },
    [setAttrs, setAttr, appendEnd, line]
  );

  const give = useCallback(
    (reason) => {
      const r = reasonOf(reason);
      // `superseded` needs a document named, so the first press on it SUMMONS the field rather
      // than writing a retirement nobody can follow back to its replacement.
      if (r && r.needs && !String(pointer).trim()) {
        setNeedPtr(true);
        setRefused("superseded by what? name the document that replaced this one");
        return;
      }
      if (write("retired", reason, pointer)) {
        setAsking(false);
        setNeedPtr(false);
      }
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

  // THE LADDER DISMISSES ITSELF ON ARRIVAL (his catch, 2026-10-29: the "nothing in the way" button
  // "usually shows up when you're already there"). When the document's own derived state lands on
  // the target — the last step wrote, or the state moved on its own — the lit station is the
  // confirmation, and a button offering to mark what already is would only have a refusal to give.
  // ABOVE the row gate, because a hook below an early return is a conditional hook.
  const helpCurrent = kind === "rfc" ? rfcCurrent(source, leaf) : stateOf(kind, row, leaf);
  const arrived = !!helping && helpCurrent === helping;
  useEffect(() => {
    if (arrived) setHelping("");
  }, [arrived]);

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
  // The helping panel's body, derived from the live source EVERY render — a step that just ran
  // comes back wearing its ✓, and the next one's button takes the floor.
  const plan = helping ? facilitate(kind, helping, helpCurrent, source, Date.now(), leaf, today(), ctx) : null;
  const nextStep = plan ? (plan.steps || []).find((s) => !s.done) : null;

  // THE BAR AND THE PANEL ARE SIBLINGS, never nested. The leaf is one row and it must not move:
  // anything that opens — a refusal, the reason menu, a step list — goes in `__panel`, which the
  // leaf's `flex-wrap` drops onto its own full-width line underneath. Rendered inside the bar they
  // competed with the stations for width and shoved the document's identity sideways.
  // THE LEAF IS THE TRAIL (his call, 2026-10-28: the how-we-work drawing becomes the
  // registration block). One shared component — src/atoms/Trail — with the document's real state
  // lit; everything that needs a surface is SUMMONED beneath it and gone when it is done.
  const o = (row.state && row.state.objectives) || null;
  const stations = steps.map((s, i) => ({
    id: s,
    label:
      s === "inProgress"
        ? o && i === reached
          ? `in progress ${o.complete || 0}/${o.total}`
          : "in progress"
        : s,
    fork: alt.includes(s),
    dead: s === "rejected" && i === reached,
    glyph: canPress && !derived[s] ? "⌾" : "◦",
    title:
      i === reached
        ? // THE DOCUMENT ITSELF HAS TO SAY WHEN IT CANNOT PLACE THE REASON (c6).
          s === "retired" && retiredAs
          ? standing
            ? `this document is retired — ${standing.label}: ${standing.why}`
            : `this document is retired, but “${retiredAs}” is not a reason anything can read — it is neither an ending nor a pause`
          : `this document is ${s}`
        : derived[s]
        ? `${s} comes from ${derived[s]} — this cannot set it`
        : s === "retired"
        ? "retire it — asks you why first, and the reason is what it writes"
        : `mark it ${s} — writes the declaration into this document`,
  }));

  return (
    <>
    <Trail
      kind={kind}
      stations={stations}
      at={current}
      onPress={canPress ? press : undefined}
      className="sv-trail--leaf"
    />
    {/* RUN THIS DOCUMENT'S OWN SPECS — his gap, named out loud: "you're supposed to be able to run
        all tests in the document… there's no ability to run all?" There wasn't. Every `:::run`
        carried its own play and nothing ran the document, so the only in-document run-all was the
        arc diagram's menu — which exists on arcs and nowhere else. The leaf is the right home
        because it is the one control every registered document already has, and it is holding the
        id and the spec inventory this needs. */}
    <DocProofs id={id} projectCode={projectCode} />
    {asking || declining || refused || unreadable || helping ? (
    <span className="md-arc__panel" ref={panelRef}>
      {/* THE STEP LIST a press opened (RFC-076 §3, column four). One button for the mechanical
          half; what is not yours is NAMED, never done for its owner. When the steps run dry the
          panel offers the finish, so the walk ends where the press began. */}
      {helping ? (
        <span className="md-arc__why md-arc__ladder" role="group" aria-label={`steps to ${helping}`}>
          <span className="md-arc__why-ask">{(plan && plan.title) || `to reach ${helping}`}</span>
          {plan ? (
            (plan.steps || []).map((s, i) => (
              <span key={i} className={`md-arc__step${s.done ? " md-arc__step--done" : ""}`}>
                {s.done ? (
                  <span className="md-arc__why-note">✓ {s.label}</span>
                ) : s === nextStep && (s.writes || s.appendStatus || s.leafPairs) ? (
                  <button type="button" className="md-arc__why-pick md-arc__why-pick--pause" onClick={() => applyStep(s)}>
                    {s.label}
                  </button>
                ) : (
                  <span className="md-arc__why-note">☐ {s.label}</span>
                )}
                {s.note ? <span className="md-arc__why-note">{s.note}</span> : null}
              </span>
            ))
          ) : (
            <button
              type="button"
              className="md-arc__why-pick md-arc__why-pick--pause"
              onClick={() => {
                if (write(helping)) setHelping("");
              }}
            >
              nothing left in the way — mark it {helping}
            </button>
          )}
          <button
            type="button"
            className="md-arc__why-pick md-arc__why-pick--off"
            onClick={() => {
              setHelping("");
              setRefused("");
            }}
            title="leave it where it is"
          >
            never mind
          </button>
        </span>
      ) : null}
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
          {needPtr ? (
            <input
              className="md-arc__why-ptr"
              type="text"
              autoFocus
              value={pointer}
              placeholder="superseded by…"
              aria-label="superseded by"
              onChange={(e) => setPointer(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") give("superseded");
              }}
            />
          ) : null}
          <button
            type="button"
            className="md-arc__why-pick md-arc__why-pick--off"
            onClick={() => {
              setAsking(false);
              setNeedPtr(false);
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
