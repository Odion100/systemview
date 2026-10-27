import React, { useState } from "react";
import { useDocMembers, useMarkdownWrite } from "../context";
import { normalizeState, normalizeKind, ordinalOf, claimAt } from "../claims";

// `::claim[do this → this should happen]{id=…}` — a statement somebody can check, and the mark.
//
// It reads like the numbered claim it replaces and it can be PRESSED: met, not met, or back to
// unchecked. The press writes the mark into the line — `state= by= at= note=` — exactly as
// `:::approval` takes `verdict=`, so the document carries who checked what and when, and a reader
// opening it sees which claims were verified before they got there. An unmarked claim reads as
// UNCHECKED, visibly; silence is never a pass.
//
// THE STATEMENT RULE IS FOR AN AGENT, NOT FOR HIM. An agent's mark is its word, and the note is the
// only thing the word rests on — `met` says what was done and seen, `unmet` what happens instead —
// so an agent writing `by=<projectCode>` without `note=` has not marked anything (the chapter says
// so; the block cannot police a file write). His press is its own evidence: he looked. So ✓ and ✗
// write at once — `state= by=you at=` — and a note is OPTIONAL afterwards (his: *"I'm never as a
// human going to write what I saw"*). Pressing the state somebody ELSE gave COUNTERSIGNS it; the
// state you yourself signed takes your signature off — "I take that back" stays expressible without
// a second person's press ever meaning erase.
const when = (ms) => {
  if (!ms) return "";
  const d = new Date(Number(ms));
  return Number.isNaN(d.getTime()) ? "" : d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
};

const Claim = ({ attrs = {}, kind, label, line, children }) => {
  const { editable, setAttr } = useMarkdownWrite();
  const { source = "" } = useDocMembers() || {};
  const [local, setLocal] = useState(null); // { state, by, at, note } after a press, until the save lands
  // RFC-075 — THE PROOF, folded. A container claim is the same claim grown a body: the children are
  // ordinary result blocks (`:::cmd`, `:::run`, `::test`) rendered live through the registry, so
  // pressing one runs it where it stands. Folded by default — fifty-six claims never become
  // fifty-six walls — and the fold holds only the proof: the statement rides the opening line
  // (directives.js lifts the label out of the body).
  const [proofOpen, setProofOpen] = useState(false);
  const hasProof = kind === "container";

  const mark = local || {
    state: normalizeState(attrs.state),
    by: attrs.by || "",
    at: Number(attrs.at) || 0,
    note: attrs.note || "",
  };
  const n = ordinalOf(source, line);
  const statement = String(label || "").trim();
  // WHAT THIS CLAIM OWES, on the claim itself. A behavioural claim owes a living spec — a defence
  // the change loop runs without anybody remembering to — and one marked met with nothing in its
  // fold but a screenshot or a grep is a commitment defended by nobody once the conversation ends.
  // So the row says it, quietly, rather than reading identical to a claim that is actually held.
  // An experiential claim says what it is instead: his eye IS the instrument, no spec will exist,
  // and that is honest rather than missing.
  const claimKind = normalizeKind(attrs.kind);
  const parsed = claimAt(source, line);
  const owesSpec = claimKind === "behavioral" && !!mark.state && !(parsed && parsed.hasSpec);
  // RFC-075 round two — A CLAIM KNOWS ITS REVIEWERS (his: "the badges show up because the claim
  // knows who the reviewer is. And you check it off"). `reviewers=` declares who owes this claim a
  // look; each renders as a HOLLOW badge until their signature lands in `by=`. The human is the one
  // implicit reviewer — his badge is always offered, and it is the one badge a press can fill.

  // A PRESS IS A SIGNATURE, AND A PRESS NEVER ERASES WORDS (his, after his agreement-press wiped an
  // agent's mark and note: "sometimes I click mark-as-met when you already marked it met… let's stop
  // erasing it"). `by=` is a LIST — the two-signatures design needs the line to hold both names:
  //   · press the standing state when you haven't signed → you COUNTERSIGN (by= gains |you)
  //   · press it when you have → your signature comes off; the mark stands while anyone else holds it
  //   · last signature off → unchecked, but the note STAYS IN THE LINE — withdrawal is not erasure
  //   · press the OTHER state → the state flips under your name alone — and the note still stays;
  //     what somebody saw is a record. There is no note UI at all (his: "there's no need for that")
  //     — notes are the statements agents write WITH their marks; changing one is a document edit.
  const signersOf = (by) => String(by || "").split(/[|,]/).map((s) => s.trim()).filter(Boolean);
  const press = (value) => {
    if (!editable) return;
    const signers = signersOf(mark.by);
    if (mark.state === value) {
      if (!signers.includes("you")) {
        // countersign — agreement adds a name, touches nothing else
        const by = [...signers, "you"].join("|");
        setLocal({ ...mark, by });
        setAttr(line, { by });
      } else if (signers.length > 1) {
        // step off — the mark stands on the other signatures
        const by = signers.filter((s) => s !== "you").join("|");
        setLocal({ ...mark, by });
        setAttr(line, { by });
      } else {
        // the last signature comes off — unchecked, the note kept in the line
        setLocal({ state: "", by: "", at: 0, note: mark.note });
        setAttr(line, { state: null, by: null, at: null });
      }
      return;
    }
    // A FLIP NEVER EATS SIGNATURES (his: "why did yours go away just because I said unmet? It
    // better come back when I switch to met"). A signature belongs to the STATE it signed: the
    // outgoing state's signers are stashed (metBy=/unmetBy=) and restored when the state returns.
    const stashKey = mark.state === "met" ? "metBy" : mark.state === "unmet" ? "unmetBy" : null;
    const restoreKey = value === "met" ? "metBy" : "unmetBy";
    const restored = signersOf(attrs[restoreKey]).filter((s) => s !== "you");
    const by = [...restored, "you"].join("|");
    const pairs = { state: value, by, at: Date.now(), [restoreKey]: null };
    if (stashKey) {
      const others = signers.filter((s) => s !== "you");
      pairs[stashKey] = others.length ? others.join("|") : null;
    }
    setLocal({ state: value, by, at: pairs.at, note: mark.note });
    setAttr(line, pairs);
  };

  // On an UNMET claim the badges wear the ✗ (his): a signature there signs "not met, and I
  // checked" — the glyph says what is being signed, the fill says it was.
  const glyph = mark.state === "unmet" ? "✗" : "✓";
  const cls = `md-claim${mark.state ? ` md-claim--${mark.state}` : " md-claim--unchecked"}`;
  const word = mark.state === "met" ? "met" : mark.state === "unmet" ? "not met" : "unchecked";
  const ro = !editable ? "Read-only here — this surface has nothing to save to" : "";

  return (
    <div className={cls} data-claim-id={attrs.id || undefined}>
      <div className="md-claim__row">
        <span className="md-claim__n" aria-hidden="true">{n || "·"}</span>
        {/* The rendered label when there is one — inline code keeps its look — else the flat text.
            A CONTAINER's children are its proof, never its statement: the flat label is the row. */}
        <span className="md-claim__statement">
          {!hasProof && React.Children.count(children)
            ? children
            : statement || <em>an empty claim — the statement goes in the brackets</em>}
        </span>
        <span className={`md-claim__state md-claim__state--${mark.state || "unchecked"}`}>{word}</span>
        <span className="md-claim__actions">
          <button
            type="button"
            className={`md-claim__btn md-claim__btn--met${mark.state === "met" ? " is-on" : ""}`}
            disabled={!editable}
            title={
              ro ||
              (mark.state === "met"
                ? signersOf(mark.by).includes("you")
                  ? "Take your signature off"
                  : "Agree — adds your signature"
                : "Met — writes into the document")
            }
            onClick={() => press("met")}
          >
            ✓
          </button>
          <button
            type="button"
            className={`md-claim__btn md-claim__btn--unmet${mark.state === "unmet" ? " is-on" : ""}`}
            disabled={!editable}
            title={
              ro ||
              (mark.state === "unmet"
                ? signersOf(mark.by).includes("you")
                  ? "Take your signature off"
                  : "Agree — adds your signature"
                : "Not met — writes into the document")
            }
            onClick={() => press("unmet")}
          >
            ✗
          </button>
        </span>
      </div>
      <div className="md-claim__stamp">
        {/* EVERY SIGNATURE IS ITS OWN CHIP — by= is a |-list the moment somebody countersigns, and
            a comma blob read as one mystery name. Filled = signed; hollow = a declared reviewer
            who has not signed yet — an open obligation you can SEE. */}
        {/* THE BADGE GRAMMAR (his): dashed + ✓ is the INVITATION — "click this and you've checked
            it" — and signing FILLS it. The check glyph never moves; the fill is the signature. */}
        {signersOf(mark.by)
          .filter((who) => who !== "you") // yours renders once, below, as the pressable badge
          .map((who) => (
            <span key={who} className="md-claim__signer md-claim__signer--signed">
              {glyph} {who}
            </span>
          ))}
        {signersOf(attrs.reviewers)
          .filter((r) => r !== "you" && !signersOf(mark.by).includes(r))
          .map((r) => (
            <span key={r} className="md-claim__signer md-claim__signer--invite" title="named a reviewer — has not checked it yet">
              {glyph} {r}
            </span>
          ))}
        {/* YOUR badge — the one a press can fill. On an unchecked claim it signs met; on a marked
            one it countersigns the standing state; pressed again it steps your signature off. The
            corner ✓/✗ stay for the first call and for saying unmet — his ruling. */}
        {!signersOf(mark.by).includes("you") ? (
          <button
            type="button"
            className="md-claim__signer md-claim__signer--invite md-claim__signer--press"
            disabled={!editable}
            title={
              !editable
                ? "Read-only here — this surface has nothing to save to"
                : mark.state
                  ? "Agree — adds your signature"
                  : "Check it met — writes into the document"
            }
            onClick={() => press(mark.state || "met")}
          >
            {glyph} you
          </button>
        ) : (
          <button
            type="button"
            className="md-claim__signer md-claim__signer--signed md-claim__signer--press"
            disabled={!editable}
            title={!editable ? "Read-only here — this surface has nothing to save to" : "Take your signature off"}
            onClick={() => press(mark.state)}
          >
            {glyph} you
          </button>
        )}
        {claimKind === "experiential" ? (
          <span
            className="md-claim__kind"
            title="experiential — concluded by your own eye; no spec can be written for it, and none is owed"
          >
            by eye
          </span>
        ) : null}
        {owesSpec ? (
          <span
            className="md-claim__owed"
            title="behavioural and marked, with no ::test or :::run in its fold — nothing the change loop runs defends this claim once the conversation ends"
          >
            no spec
          </span>
        ) : null}
        {mark.state && mark.at ? <span className="md-claim__at">{when(mark.at)}</span> : null}
        {mark.state && mark.note ? <span className="md-claim__note">{mark.note}</span> : null}
      </div>
      {/* THE PROOF'S OWN HEADER — a section label at the bottom-left, directly above the fold it
          opens, so pressing it expands in place rather than a chip on the far right opening
          content on the far left. */}
      {hasProof ? (
        <button
          type="button"
          className={`md-claim__proofhead${proofOpen ? " is-on" : ""}`}
          title={proofOpen ? "Fold the proof away" : "The check, pressable — expand it"}
          onClick={() => setProofOpen((v) => !v)}
        >
          {proofOpen ? "▾" : "▸"} proof
        </button>
      ) : null}
      {/* THE FOLD HIDES, IT NEVER UNMOUNTS (his, in the c2 thread: a run's result vanished on
          collapse while its process kept going). The children stay mounted so a :::cmd keeps its
          exit, output and in-flight run across folds — collapse is a curtain, not a teardown. */}
      {hasProof ? (
        <div className="md-claim__proof" style={proofOpen ? undefined : { display: "none" }}>
          {children}
        </div>
      ) : null}
    </div>
  );
};

export default Claim;
