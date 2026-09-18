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
  // LAND (his design): accept the branch onto the one you are standing on — no switch, no CLI
  // tour. Two-step like every destructive verb here, and the commits are on screen when you
  // confirm: a lane is one piece of work, and accepting it means seeing ITS commit the way a
  // ::commit block shows a message — not signing unread history.
  const [armLand, setArmLand] = useState(false);
  const [landed, setLanded] = useState("");
  // BRING OVER AS CHANGES (his design): review-first accept — the work arrives UNCOMMITTED on
  // the branch he is standing on, because on the lane branch it is already committed and there
  // is nothing left to look at as changes. His words: "sometimes I got to have it set on top
  // and review it."
  const [armApply, setArmApply] = useState(false);
  const [applied, setApplied] = useState(false);
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

  // LAND FROM ON THE BRANCH (his ask): fast-forward the base up to here — no walk back first.
  // Only clean when the base has not moved since the fork; the non-ff refusal is shown as the
  // answer it is: go stand on the base and land with a real merge.
  const doFastForward = async () => {
    setBusy(true);
    setArmLand(false);
    try {
      const r = await git(projectCode).fastForward({ branch, to: diff.base });
      if (!r.ok) setError(r.error || "fast-forward refused");
      else {
        setError("");
        setLanded(diff.base);
        window.dispatchEvent(new Event("sv:git"));
      }
    } catch (e) {
      setError((e && e.message) || "fast-forward failed");
    }
    setBusy(false);
  };

  const doApply = async () => {
    setBusy(true);
    setArmApply(false);
    try {
      const r = await git(projectCode).applyBranch({ branch, base: attrs.base });
      if (!r.ok) setError(r.error || "could not bring the changes over");
      else {
        setError("");
        setApplied(true);
        window.dispatchEvent(new Event("sv:git"));
        // the changes are now a LIST somewhere — ask the surfaces that show one to show it
        window.dispatchEvent(new Event("sv:openChanges"));
      }
    } catch (e) {
      setError((e && e.message) || "apply failed");
    }
    setBusy(false);
  };

  const doLand = async () => {
    setBusy(true);
    setArmLand(false);
    try {
      const r = await git(projectCode).mergeBranch({ branch });
      if (!r.ok) setError(r.error || "merge refused");
      else {
        setError("");
        setLanded(r.into || "your branch");
        window.dispatchEvent(new Event("sv:git"));
      }
    } catch (e) {
      setError((e && e.message) || "merge failed");
    }
    setBusy(false);
  };

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
          armLand ? (
            <span className="md-branch__confirm">
              move {diff.base} forward to this commit?
              <button type="button" className="md-branch__btn md-branch__btn--yes" disabled={busy} onClick={doFastForward}>yes</button>
              <button type="button" className="md-branch__btn" onClick={() => setArmLand(false)}>no</button>
            </span>
          ) : (
            <>
              {diff.commits && diff.commits.length > 0 && landed === "" && (
                <button type="button" className="md-branch__btn md-branch__btn--land" disabled={busy} onClick={() => setArmLand(true)}>
                  fast-forward {diff.base} to here
                </button>
              )}
              <button type="button" className="md-branch__btn" disabled={busy} onClick={() => doSwitch(cameFrom || diff.base)}>
                back to {cameFrom || diff.base}
              </button>
            </>
          )
        ) : armLand ? (
          <span className="md-branch__confirm">
            merge {diff.commits ? diff.commits.length : 0} commit{diff.commits && diff.commits.length === 1 ? "" : "s"} onto {(state && state.branch) || diff.base}?
            <button type="button" className="md-branch__btn md-branch__btn--yes" disabled={busy} onClick={doLand}>yes</button>
            <button type="button" className="md-branch__btn" onClick={() => setArmLand(false)}>no</button>
          </span>
        ) : armApply ? (
          <span className="md-branch__confirm">
            apply as uncommitted changes on {(state && state.branch) || diff.base} — your review, your commit?
            <button type="button" className="md-branch__btn md-branch__btn--yes" disabled={busy} onClick={doApply}>yes</button>
            <button type="button" className="md-branch__btn" onClick={() => setArmApply(false)}>no</button>
          </span>
        ) : armed ? (
          <span className="md-branch__confirm">
            switch your working tree?
            <button type="button" className="md-branch__btn md-branch__btn--yes" disabled={busy} onClick={() => doSwitch(branch)}>yes</button>
            <button type="button" className="md-branch__btn" onClick={() => setArmed(false)}>no</button>
          </span>
        ) : (
          <>
            {/* LAND FIRST — accepting reviewed work is the common verb; the tour is the fallback */}
            {diff.commits && diff.commits.length > 0 && landed === "" && !applied && (
              <>
                <button type="button" className="md-branch__btn md-branch__btn--land" disabled={busy} onClick={() => setArmLand(true)}>
                  land onto {(state && state.branch) || diff.base}
                </button>
                <button type="button" className="md-branch__btn" disabled={busy} onClick={() => setArmApply(true)}>
                  bring over as changes
                </button>
              </>
            )}
            <button type="button" className="md-branch__btn" disabled={busy} onClick={() => setArmed(true)}>
              switch to it
            </button>
          </>
        )}
      </div>
      {/* THE COMMITS — a lane is one piece of work, and this is that work's name. Shown the way
          a ::commit block shows its message, because landing means accepting exactly this. */}
      {diff && diff.commits && diff.commits.length > 0 && (
        <ul className="md-branch__commits">
          {diff.commits.map((c) => (
            <li key={c.hash} className="md-branch__commit">
              <span className="md-branch__hash">{c.hash}</span> {c.subject}
            </li>
          ))}
        </ul>
      )}
      {onIt && <div className="md-branch__note">your working tree is on this branch</div>}
      {landed && <div className="md-branch__note">landed onto {landed} — the commit is yours now; the lane branch is safe to delete</div>}
      {applied && (
        <div className="md-branch__note">
          the changes are sitting uncommitted on {(state && state.branch) || diff.base} — review file by file, commit your way.
          Your commit replaces the lane's, so its branch will still read "not merged" — that warning is yours to override.
        </div>
      )}
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
