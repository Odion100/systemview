import React, { useEffect, useState } from "react";
import { useDocMembers, useMarkdownWrite } from "../context";
import { claimsOf } from "../claims";
import { rowsOf } from "../claimRows";
import { askProofs, clear as clearMarks, subscribe } from "../../../utils/proofsBus";
import { rollupOf } from "../../../utils/specRun";
import useEffectiveProject from "../../../utils/effectiveProject";
import "../../PlanLedger/styles.scss";

// `::claims` — HOW MANY ARE VERIFIED, counted off the `::claim` blocks in the same document every
// render. The number is derived and stored nowhere, which is the whole point: the STATUS line an
// author used to type ("built, 11/12 met") was an assertion; this cannot disagree with the marks
// below it. Unchecked is its own count, never folded into either side — a claim nobody looked at is
// not met, and it is not failed either.
//
// ALL MET IS A MOMENT, NOT A JUMP (RFC-075 round two, his: "when all claims are met, will it
// automatically jump to—"). All-met is arithmetic; BUILT is a declaration with a date. So the bar
// never advances the lifecycle by itself — it says "all met", and when the document has no STATUS
// yet it offers ONE press that writes the dated heading. The press changes the file, the watcher
// re-derives, and the trail at the top advances on its own: a jump through a dated line, never
// behind anyone's back.
// IT IS THE SUMMARY, AND ONLY THE SUMMARY. The arc's `::progress` was rebuilt as a summary block over rows
// that each say their own state and what is stopping them; this is the same display for the same
// reason. `::claims` drew one bar and then eight chips — `2 not met`, `2 marked, unproved`,
// `1 unchecked`, `3/5 spec'd`, `1 owed` — every one of them a count of rows the reader could not
// then see. Being told how many are wrong without being told WHICH is the failure the ledger
// exists to end, and it was happening here too.
//
// AND THE ROWS ARE NOT HERE. For one build every claim got a row under this bar carrying what it
// owed — which read well on a six-claim fixture and was a wall on a real file: three RFCs' worth
// of claims in one document, expanding the whole page, with each sentence two hundred pixels from
// the claim it was about. The sentences moved ONTO the claim cards, where the thing they describe
// already is. This keeps the bar, the counts and the two controls.
//
// THE SAME STYLESHEET as the arc's ledger, deliberately: one visual vocabulary for "where is this
// and what does it owe", so a colour or a control means the same thing in an arc and in a plan.
const Claims = ({ attrs = {} }) => {
  const { source = "", id: docId = "" } = useDocMembers() || {};
  const { editable, appendEnd } = useMarkdownWrite();
  const projectCode = useEffectiveProject(attrs.projectCode);
  const c = claimsOf(source);
  const view = rowsOf(c);

  // The same marks the side panel's cards write — so a spec run anywhere lights the claim it
  // defends, without this block knowing a run exists.
  const [marks, setMarks] = useState({});
  useEffect(() => subscribe((st) => setMarks(st.marks || {})), []);
  const tone = rollupOf(Object.keys(marks), marks);

  if (!view.total) return <div className="md-claims md-claims--empty">no claims in this document yet</div>;

  const hasStatus = /^##\s*STATUS/m.test(source);
  const allMet = view.met === view.total;
  const today = () => {
    const d = new Date();
    const p = (x) => String(x).padStart(2, "0");
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
  };

  return (
    <div className="pl md-claims-ledger">
      <div className="pl__head">
        <div className="pl__headline">
          <span className="pl__pct">{view.pct}%</span>
          <span className="pl__id">claims</span>
          {/* RUN THIS DOCUMENT'S SPECS, from the document. The same control the arc carries, so
              the press, the colour and the hover mean one thing wherever they appear. */}
          {docId && projectCode ? (
            <button
              type="button"
              className={`pl__play${tone ? ` is-${tone}` : ""}`}
              title={`run this document's specs in the side panel`}
              onClick={() => askProofs(projectCode, { kind: "document", id: docId })}
            >
              <svg viewBox="0 0 18 18" aria-hidden="true">
                <path d="M5 3.4 14.6 9 5 14.6z" strokeWidth="1.6" strokeLinejoin="round" />
              </svg>
            </button>
          ) : null}
          {tone ? (
            <button type="button" className="pl__clear" title="clear these results" onClick={clearMarks}>
              clear
            </button>
          ) : null}
        </div>
        {/* THREE LAYERS, THREE WORDS, and the layering is the point — his, and I dropped it for a
            build by collapsing this to one fill. The PALE band is MARKED: somebody's word. The
            solid band is REVIEWED: a signature. The red tail is NOT MET. A mark alone never
            paints the bar done, and the gap between the pale and the solid is exactly how much
            of this document is resting on testimony. */}
        <div className="pl__bar pl__bar--layered" aria-hidden="true">
          <i className="is-marked" style={{ width: `${Math.round(((view.met + view.unproved) / view.total) * 100)}%` }} />
          <i className="is-reviewed" style={{ width: `${Math.round((view.reviewed / view.total) * 100)}%` }} />
          <i className="is-unmet" style={{ width: `${Math.round((view.unmet / view.total) * 100)}%` }} />
        </div>
        <div className="pl__meta">
          <span className="pl__meta-label">met</span>
          <span>
            <b>{view.met}</b> of {view.total} claims
          </span>
          {view.behavioral ? (
            <span>
              <b>{view.specd}</b> of {view.behavioral} spec&apos;d
            </span>
          ) : null}
          {view.owed ? <span className="is-warn">{view.owed} owed</span> : null}
          {view.unproved ? <span className="is-warn">{view.unproved} marked, unproved</span> : null}
          {view.unmet ? <span className="is-warn">{view.unmet} not met</span> : null}
          {view.unchecked ? <span className="is-warn">{view.unchecked} unchecked</span> : null}
          <span>
            <b>{view.reviewed}</b> of {view.total} reviewed
          </span>
          {/* ALL MET IS A MOMENT, NOT A JUMP. Marked-and-proved across the board is arithmetic;
              BUILT is a declaration with a date, and review is a third axis that arithmetic
              cannot close — so the tag says which of the three is still open. */}
          {allMet ? (
            <span className="pl__tag">
              {view.reviewed !== view.total ? "all met — review open" : hasStatus ? "all met & reviewed" : "all met — awaiting STATUS"}
            </span>
          ) : null}
          {allMet && !hasStatus && editable && appendEnd ? (
            <button
              type="button"
              className="pl__clear"
              title="Writes the dated heading; the registry re-derives and the lifecycle advances to built"
              onClick={() => appendEnd(`## STATUS — built ${today()}\n\n::claims`)}
            >
              write the STATUS
            </button>
          ) : null}
        </div>
      </div>

    </div>
  );
};

export default Claims;
