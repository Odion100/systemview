import React, { useEffect, useState } from "react";
import { useMarkdownScope } from "../context";
import { useCapability, useCapabilityState } from "../capabilities";

// `::branch[refine/dead-code]{base=main}` — a branch offered for REVIEW, as a live pointer.
//
// The block never carries a patch. It names a ref, and everything on screen is computed from git
// AT VIEW TIME — `base...branch`, the three-dot question: what does this branch add since it
// forked. A pasted diff goes stale the moment main moves; a pointer cannot, which is the whole
// reason an agent's refinement report can sit unread for a day and still be true when opened.
//
// The verbs are the human's: SWITCH moves the working tree to the branch (two-step, and `git
// switch` refusing over dirty files is an answer we show, never a thing we stash around), and
// BACK returns to the base. The agent that wrote the block gets no button — it delivered a
// report; what happens to the branch is decided here.
const BranchBlock = ({ label, attrs = {} }) => {
  const scope = useMarkdownScope();
  const projectCode = attrs.project || scope.projectCode;
  const branch = label || attrs.name || "";
  const git = useCapability("git");
  const gitGrant = useCapabilityState("git");
  const [diff, setDiff] = useState(null);
  const [state, setState] = useState(null);
  const [open, setOpen] = useState({});
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [armed, setArmed] = useState(false);
  // WHERE YOU CAME FROM. The return trip goes back to the branch you were standing on when you
  // pressed switch — not to the base, which may be a place you never were. Base is only the
  // fallback when the block never saw you arrive.
  const [cameFrom, setCameFrom] = useState("");

  const load = async () => {
    if (!projectCode || !git || !branch) return;
    try {
      const p = git(projectCode);
      if (!p.branchDiff) throw new Error("this surface's git bridge has no branch verbs yet");
      const [d, s] = await Promise.all([p.branchDiff({ branch, base: attrs.base }), p.gitState()]);
      if (!d.ok) throw new Error(d.error || "could not diff the branch");
      setDiff(d);
      setState(s);
      setError("");
    } catch (e) {
      setError((e && e.message) || "could not read the branch");
    }
  };

  useEffect(() => {
    load();
    const onGit = () => load();
    window.addEventListener("sv:git", onGit);
    return () => window.removeEventListener("sv:git", onGit);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectCode, branch, !!git]);

  const doSwitch = async (name) => {
    if (name === branch && state && state.branch && state.branch !== branch) setCameFrom(state.branch);
    setBusy(true);
    setArmed(false);
    try {
      const r = await git(projectCode).switchBranch({ name });
      if (!r.ok) setError(r.error || "switch refused");
      else {
        setError("");
        // one surface moving git must tell the others — same broadcast the nav listens to
        window.dispatchEvent(new Event("sv:git"));
      }
    } catch (e) {
      setError((e && e.message) || "switch failed");
    }
    setBusy(false);
  };

  if (!branch) return <div className="md-branch md-branch--err">::branch needs a branch name</div>;
  if (!git)
    return (
      <div className="md-branch md-branch--err">
        {gitGrant === "denied" ? "version control isn't allowed here" : "this surface has no version control"}
      </div>
    );

  const onIt = state && state.branch === branch;
  const perFile = (diff && diff.patch ? diff.patch.split(/^diff --git /m).filter(Boolean) : []).reduce((m, chunk) => {
    const hit = /b\/(\S+)/.exec(chunk);
    if (hit) m[hit[1]] = `diff --git ${chunk}`;
    return m;
  }, {});
  const mark = { A: "+", M: "±", D: "−", R: "→" };

  return (
    <div className="md-branch">
      <div className="md-branch__head">
        <span className="md-branch__icon">⎇</span>
        {/* whose repo this is — a switch button aimed at an unnamed project was his confusion */}
        <span className="md-branch__project">{projectCode}</span>
        <span className="md-branch__name">{branch}</span>
        {diff && <span className="md-branch__vs">vs {diff.base}</span>}
        {diff && <span className="md-branch__count">{diff.files.length} file{diff.files.length === 1 ? "" : "s"}</span>}
        {!diff ? null : onIt ? (
          <button type="button" className="md-branch__btn" disabled={busy} onClick={() => doSwitch(cameFrom || diff.base)}>
            back to {cameFrom || diff.base}
          </button>
        ) : armed ? (
          <span className="md-branch__confirm">
            switch your working tree?
            <button type="button" className="md-branch__btn md-branch__btn--yes" disabled={busy} onClick={() => doSwitch(branch)}>yes</button>
            <button type="button" className="md-branch__btn" onClick={() => setArmed(false)}>no</button>
          </span>
        ) : (
          <button type="button" className="md-branch__btn" disabled={busy} onClick={() => setArmed(true)}>
            switch to it
          </button>
        )}
      </div>
      {onIt && <div className="md-branch__note">your working tree is on this branch</div>}
      {error && <div className="md-branch__error">{error}</div>}
      {diff && (
        <ul className="md-branch__files">
          {diff.files.map((f) => (
            <li key={f.path} className="md-branch__file">
              <button type="button" className="md-branch__filehead" onClick={() => setOpen((o) => ({ ...o, [f.path]: !o[f.path] }))}>
                <span className={`md-branch__status md-branch__status--${f.status[0]}`}>{mark[f.status[0]] || f.status[0]}</span>
                <span className="md-branch__path">{f.path}</span>
              </button>
              {open[f.path] && <pre className="md-branch__patch">{perFile[f.path] || "no patch for this file"}</pre>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default BranchBlock;
