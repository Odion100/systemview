import React from "react";
import { useDocMembers } from "../context";
import { decisionsOf, decisionsByWho } from "../decisions";
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
  const groups = decisionsByWho(source);

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
      {/* EVERY DECISION, UNDER THE PERSON IT BELONGS TO, EACH WEARING ITS STATE. One list rather
          than two — a row under the bar and a grouped section below read as unrelated things, and
          they are one set of addresses. Which person a decision belongs to depends on its state:
          `owner` owes the answer while the fork is open, `by` made the call once it closed.

          The colours ARE the bar's, so the bar and this list cannot disagree and the list is the
          bar's legend. Open is the plain one because open is the bar's unfilled remainder — every
          colour here means something was actually done. Pressable because an id is an address:
          *"you should be able to click one of those and it brings you right to the block."* */}
      {groups.size ? (
        <div className="md-decisions__owed">
          {[...groups.entries()].map(([who, rows]) => (
            <span key={who} className="md-decisions__owes">
              <span className="md-decisions__who">{who}</span>
              <span className="md-decisions__ids">
                {rows.map((row, i) => (
                  <React.Fragment key={`${row.id}-${row.n}`}>
                    {i ? <span className="md-decisions__sep"> · </span> : null}
                    <button
                      type="button"
                      className={`md-decisions__id md-decisions__id--${row.tone}`}
                      title={`${row.id} — ${TONE_WORDS[row.tone] || row.tone}`}
                      onClick={(e) =>
                        revealBlock(
                          e.currentTarget && e.currentTarget.closest ? e.currentTarget.closest(".markdown") : null,
                          row.line,
                        )
                      }
                    >
                      {row.id}
                    </button>
                  </React.Fragment>
                ))}
              </span>
            </span>
          ))}
        </div>
      ) : null}
    </div>
  );
};

export default Decisions;
