import React, { useEffect, useState } from "react";
import { run, subscribe } from "../../utils/proofsBus";
import { lightLine } from "./arcProofsLine";

// RUN AN ARC'S SPECS FROM THE DRAWER — his ask: "also give me the ability to run all tests from the
// arcs, from the drawer."
//
// LIGHT PROGRESS, AND THAT IS THE DESIGN: "in the drawer it would probably just show some light
// progress, nothing crazy. You can go back and open it if you want and see if anything goes wrong,
// from wherever you ran it." So this is a press and a few words — never a list of failures in a
// 300px strip. The run belongs to `utils/proofsBus`, which is what makes "go back and open it"
// true: the Proofs tab is showing this same run whether or not it was open when you pressed.
//
// IT ONLY SPEAKS ABOUT ITS OWN ARC. The bus holds one run, so a row has to check the scope before
// claiming the result — otherwise every arc row in the drawer would show the numbers from whichever
// arc was run last.
const ArcProofs = ({ projectCode, arcId }) => {
  const [state, setState] = useState(null);
  useEffect(() => subscribe((s) => setState(s)), []);

  const line = lightLine(state, arcId);
  const busy = !!(state && state.running && state.scope && state.scope.arc === arcId);

  return (
    <span className="agent-chat__arcproofs">
      {line ? <span className={`agent-chat__arcproofs-line agent-chat__arcproofs-line--${line.tone}`}>{line.text}</span> : null}
      <button
        type="button"
        className="agent-chat__arcproofs-btn"
        title={`run the specs in ${arcId} and everything attached to it`}
        disabled={busy}
        onClick={(e) => {
          // The row behind this is an opener; pressing run must not also open the document.
          e.stopPropagation();
          run(projectCode, { arc: arcId });
        }}
      >
        {busy ? "…" : "▶"}
      </button>
    </span>
  );
};

export default ArcProofs;
