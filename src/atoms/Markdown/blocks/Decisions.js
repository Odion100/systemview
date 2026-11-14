import React from "react";
import { useDocMembers } from "../context";
import { decisionsOf, owedBy, decisionIndex } from "../decisions";
import { fillStyle } from "../../meterWidth";
import { revealBlock } from "../revealBlock";

// `::decisions` — WHAT THIS DOCUMENT HAS SETTLED AND WHAT IT STILL OWES, recounted off the
// `::decision` blocks in the same document on every render.
//
// The number is derived and stored nowhere, which is the point and the same point `::claims` and
// `::progress` make: a planning report's first screen used to be nine sections of prose with a
// `**DECIDE HERE:**` list in each, and nothing anywhere could say how many forks were still open or
// whose they were. Reading all nine was the only way to find out, so nobody did.
//
// IT COUNTS FOUR THINGS AND THEY ARE NOT INTERCHANGEABLE:
//
//   open      — nobody has chosen. The work cannot proceed past these.
//   decided   — a choice was made. It stands whether or not anybody approved it.
//   awaiting  — made, and still owed somebody's signature. This number exists ONLY because
//               deciding and approving are different acts; it is his whole correction, as a count.
//   reversed  — decided, then overturned. Kept visible rather than deleted, because a record that
//               cannot say a choice was undone lies by omission about the one thing a later reader
//               most needs.
//
// AND `unsaid` IS ITS OWN NUMBER — a decision recorded with no `chose=`. Not folded into `decided`,
// because it is the wrong half of a record: it says the fork closed and not which way, which is
// worse than leaving it open.
// The words a chip says on hover — the tone names are the bar's vocabulary and two of them are
// terse to the point of being wrong on their own.
const TONE_WORDS = {
  unsaid: "decided, no choice written down",
  answered: "answered, not closed",
  awaiting: "decided, awaiting approval",
};

const Decisions = () => {
  const { source = "" } = useDocMembers() || {};
  const got = decisionsOf(source);
  const owed = owedBy(source);
  // ONE ROW, NOT TWO, AND THE COLOUR IS WHAT SEPARATES THEM. The first version put what had been
  // ACTED ON directly under the bar and left the OPEN ones in an owner-grouped section below, which
  // read as two unrelated things — his catch: *"that's separated because it's right under the bar,
  // from the others, which is like a whole other section… it should be all together and then the
  // colours could tell me which one."* They are one set of addresses; state is a property of each,
  // not a reason to file them in different places.
  const index = decisionIndex(source);

  if (!got.total)
    // ABSENCE STATED, never a blank. A document carrying this block and no decisions is a real
    // state — a plan whose forks have not been named yet — and saying so is more useful than
    // rendering nothing, which reads as the block being broken.
    return (
      <div className="md-decisions md-decisions--none">
        <span className="md-decisions__kind">decisions</span>
        <span className="md-decisions__empty">None recorded in this document yet</span>
      </div>
    );

  return (
    <div className="md-decisions">
      <div className="md-decisions__head">
        <span className="md-decisions__kind">decisions</span>
        <span className="md-decisions__total">{got.total}</span>
      </div>
      {/* THE BAR IS THE CHIPS, LAID OUT TO SCALE — and that is the whole idea, because the chips
          below it are already this block's own vocabulary. Each segment is the colour of the chip
          it belongs to, so the row underneath IS the legend and nothing has to be explained.
          There is no percentage beside it: the head already carries the total, and a `%` next to a
          big number is `::claims`' idea, not this one's. His, after I made exactly that mistake by
          wholesale-copying the claims ledger: *"it had its own look and with slight modification it
          could have showed progress too."* */}
      <div className="md-decisions__bar" aria-hidden="true">
        <i className="is-decided" style={fillStyle(got.decided, got.total)} />
        <i className="is-answered" style={fillStyle(got.answered, got.total)} />
        <i className="is-awaiting" style={fillStyle(got.awaiting, got.total)} />
        <i className="is-reversed" style={fillStyle(got.reversed, got.total)} />
      </div>
      {/* EVERY DECISION, IN DOCUMENT ORDER, EACH WEARING ITS STATE. The colours ARE the bar's four
          variables, so the bar and this row cannot disagree and this row is the bar's legend —
          which is also why the open ones are the plain ones: open is the bar's unfilled remainder,
          so every colour here means something was actually done. Pressable because an id is an
          address: *"you should be able to click one of those and it brings you right to the
          block — it becomes an easy communication method."* */}
      <div className="md-decisions__index">
        {index.map((row) => (
          <button
            key={`${row.id}-${row.n}`}
            type="button"
            className={`md-decisions__id md-decisions__id--${row.tone}`}
            title={`${row.id} — ${TONE_WORDS[row.tone] || row.tone}${row.who ? ` · ${row.who}` : ""}`}
            onClick={(e) =>
              revealBlock(
                e.currentTarget && e.currentTarget.closest ? e.currentTarget.closest(".markdown") : null,
                row.line,
              )
            }
          >
            {row.id}
          </button>
        ))}
      </div>
      <div className="md-decisions__counts">
        <span className="md-decisions__count md-decisions__count--decided">{got.decided} decided</span>
        <span className={`md-decisions__count md-decisions__count--open${got.open ? "" : " is-zero"}`}>
          {got.open} open
        </span>
        {got.answered ? (
          <span className="md-decisions__count md-decisions__count--answered">
            {got.answered} answered, not closed
          </span>
        ) : null}
        {got.awaiting ? (
          <span className="md-decisions__count md-decisions__count--awaiting">
            {got.awaiting} awaiting approval
          </span>
        ) : null}
        {got.reversed ? (
          <span className="md-decisions__count md-decisions__count--reversed">{got.reversed} reversed</span>
        ) : null}
        {got.unsaid ? (
          <span className="md-decisions__count md-decisions__count--unsaid">
            {got.unsaid} with no choice written down
          </span>
        ) : null}
      </div>
      {/* WHOSE ANSWER IS MISSING — kept, because "17 open" tells him nothing he can do and "3
          yours" is the ask. As NAMES AND COUNTS rather than a second list of ids: the addresses
          are all in the row above now, and printing them twice was the thing that made this read
          as two unrelated sections. The unowned group stays visible because nothing will ever
          chase those. */}
      {owed.size ? (
        <div className="md-decisions__owed">
          {[...owed.entries()].map(([who, ids]) => (
            <span key={who} className="md-decisions__owes">
              <span className="md-decisions__who">{who}</span>
              <span className="md-decisions__owes-n" title={`${ids.length} open — ${ids.map((r) => r.id).join(", ")}`}>
                {ids.length}
              </span>
            </span>
          ))}
        </div>
      ) : null}
    </div>
  );
};

export default Decisions;
