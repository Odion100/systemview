import React, { useEffect, useRef, useState } from "react";
import { useCapability, useCapabilityState } from "../capabilities";
import { useMarkdownScope, useMarkdownWrite, useDocMembers } from "../context";
import { sendUpdateTo } from "../docSend";
import { gitNotice } from "./gitNotice";

// RFC-033 — `::commit{message="…"}`. A commit message in a report is a line to copy into a
// terminal; this makes it a button.
//
//   ::commit{message="feat(nav): version-control lens"}
//
// THE RULE THIS BLOCK EXISTS UNDER: an agent can WRITE it, only a human can PRESS it.
//
// ONE BLOCK, all of it (his call — no separate `::push`): what's going in, staging and unstaging
// right here rather than somewhere else first, the commit, the push, and a LOG tab so you can flip
// over and watch it land, then come back. Like every input block the result lands back in the
// markdown — `::question` writes `answer=`, `:::approval` writes `verdict=`, this writes `sha=`.

const MARK = {
  modified: "M",
  added: "A",
  deleted: "D",
  renamed: "R",
  untracked: "U",
};

const CommitBlock = ({ label, attrs = {}, line }) => {
  const scope = useMarkdownScope();
  const { docPath = "" } = useDocMembers() || {};
  const { editable, setAttr } = useMarkdownWrite();
  // ADDRESSED BY PROJECT, SERVED BY THE HUB — same as every other file surface. This hunted the
  // project's SERVICES for one whose plugin was new enough to do version control, so on a project
  // with no live service the block loaded nothing and rendered as though there were no changes: an
  // offer to commit an empty tree, on a repo with forty modified files. His catch, and it is the
  // worst kind of wrong — not an error, a confident zero.
  const projectCode = attrs.project || scope.projectCode;
  const host = projectCode ? { projectCode } : null;
  // RFC-053 — VERSION CONTROL IS A CAPABILITY THE HOST GRANTS. Not an import, not a feature flag:
  // a host that doesn't pass `git` never renders a commit button to disable. That is the whole
  // permission model, and it is the same seam that makes this block portable.
  const git = useCapability("git");
  const gitGrant = useCapabilityState("git");
  const [message, setMessage] = useState(label || attrs.message || "");
  const [typing, setTyping] = useState(false);
  const [state, setState] = useState(null);
  const [tab, setTab] = useState("changes");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState("");
  const [armed, setArmed] = useState("");
  const [output, setOutput] = useState([]);
  // The sha the document remembers, or — on a surface with no document (the chat) — the one this
  // block just produced. Without the local half the commit succeeded and the block still offered to
  // do it again, with no receipt anywhere on screen.
  const [localSha, setLocalSha] = useState("");
  const sha = attrs.sha || localSha || "";
  // A LOG ROW OPENS. His line, 2026-10-03: *"a commit log row looks like it should expand to the
  // whole commit — file list and diff — and does not."* It looked like it should because it is a
  // row of a commit, and nothing happened when you pressed it.
  //
  // Nothing new was needed to answer it: `showCommit` has been in the hub the whole time, exposed,
  // wired through `hostFiles`, and already used by CodebaseNav — the chat's block simply never
  // knocked. Same pattern as that caller on purpose, including the in-flight marker: an empty
  // drawer while it loads reads as "this commit touched nothing", which is a lie with a delay on it.
  const [openSha, setOpenSha] = useState("");
  const [commits, setCommits] = useState({});
  const msgRef = useRef(null);

  const svc = () => ({ Plugin: git(host.projectCode) });

  const openCommit = async (at) => {
    if (openSha === at) return setOpenSha("");
    setOpenSha(at);
    if (commits[at]) return;
    setCommits((m) => ({ ...m, [at]: { loading: true } }));
    try {
      const api = svc().Plugin;
      const info = api.showCommit
        ? await api.showCommit(at)
        : { ok: false, error: "this host cannot read a single commit" };
      setCommits((m) => ({ ...m, [at]: info }));
    } catch (e) {
      setCommits((m) => ({ ...m, [at]: { ok: false, error: (e && e.message) || "could not read that commit" } }));
    }
  };

  // ONCE IT HAS A SHA, THIS BLOCK IS A RECORD OF THAT COMMIT — frozen, not live.
  //
  // His design: *"a commit block could easily turn into a commit record… it needs to remain as a
  // record on that commit. So if you make an offer and then I commit it, then later on I go back,
  // that offer will be on the new changes."* That last sentence is a bug description and it was
  // true: the changes tab rendered `gitState()`'s staged/unstaged/untracked on every render, so a
  // commit block in a document from last week showed THIS MORNING's working tree. The receipt said
  // one thing and the file list underneath it said another, about different moments, with nothing
  // on screen admitting it.
  //
  // So the posture turns on `sha` and nothing else. No sha: an offer, live, because a thing you
  // are about to do is about the tree as it is now. Sha: the record of that commit, read back from
  // git, because what a commit contains cannot change. Same block, same chrome, same tabs — the
  // press is what moves it from one to the other, and `sha=` landing in the document is what makes
  // that survive a reload.
  //
  // `commitRecord` OR `showCommit`, whichever this hub has. The service client is a proxy built
  // from the hub's manifest at page load, so a window that booted before a method existed will
  // never see it however many times the hub restarts. Asking for the better door and taking the
  // older one is how a block stays usable in a window nobody has reloaded.
  const [record, setRecord] = useState(null);
  const [recErr, setRecErr] = useState("");
  // WHICH LOG ROW THIS RECORD IS. Set by pressing the sha; the row scrolls itself into view and
  // wears a mark until he presses something else, because a jump that lands you in a list without
  // saying where is a jump you have to re-do by eye.
  // A RECORD ARRIVES MINIMIZED. Several of them sit in one chat — an agent commits four times
  // against one plan and drops a record each time — so the default cannot be a block that fills
  // the column. *"It needs to be able to sit there without showing a lot of information and
  // expand… it needs to be minimisable to where it has the commit header and just a little bit
  // underneath with the six back and the ID."* Minimized is the head and one thin line; the
  // subject, the tabs and the files are one press away.
  // AN OFFER IS NEVER MINIMIZED — it is a thing you are about to do, and hiding the message and
  // the file list behind a chevron would be hiding the two things you must read before pressing.
  const [mini, setMini] = useState(!!sha);
  // AN OFFER THAT BECOMES A RECORD MINIMIZES ITSELF. `useState(!!sha)` is read once, at mount —
  // and at mount an offer has no sha, so a block that was pressed stayed wide open afterwards
  // with its whole file list still showing. The press is the moment the detail stops being
  // needed: he read it to decide, he decided, and what he wants left behind is the one-line
  // receipt. *"I just see a record."*
  // IT ONLY FIRES ON THE TRANSITION, never on every render — otherwise opening a record would
  // slam shut under his hand the next time anything else in the block changed.
  const wasSha = useRef(sha);
  useEffect(() => {
    if (sha && !wasSha.current) setMini(true);
    wasSha.current = sha;
  }, [sha]);
  const [focusSha, setFocusSha] = useState("");
  const focusRow = useRef(null);
  useEffect(() => {
    if (!focusSha || tab !== "log" || !focusRow.current) return;
    focusRow.current.scrollIntoView({ block: "center" });
  }, [focusSha, tab]);
  useEffect(() => {
    let dead = false;
    setRecord(null);
    setRecErr("");
    if (!sha || !host || !git) return undefined;
    // REPORTING IS OFF. `blockFailure.js` and its claims stand, and the mechanism is sound in
    // pieces — but switched on against the live chat it woke him three times for things he had
    // not done: a path that pointed at nothing, a headline calling a chat a document, and a
    // reload re-reporting every broken block on the page. The behaviour that never did any of
    // that is this one: render the failure, tell nobody.
    //
    // What it needs before it comes back is not another fix, it is EVIDENCE: a reload that
    // provably sends nothing, checked against the page as it actually behaves rather than
    // against a unit test of my own assumptions. Until then the quiet version is the correct
    // version, because a mechanism that cries wolf on a refresh is worse than one that says
    // nothing — the render already says it to whoever is looking.
    const fail = (why) => setRecErr(why);
    (async () => {
      try {
        const api = svc().Plugin;
        const read = api.commitRecord || api.showCommit;
        if (!read) return setRecErr("this hub cannot read a commit");
        const r = await read.call(api, sha);
        if (dead) return;
        // A FAILED READ IS AN ANSWER AND MUST SAY SO. Swallowing it left `record` null forever,
        // and null renders as "reading…" — so a sha that no longer exists read as permanently
        // loading, which is the worst shape a failure can take: it never resolves, so nobody can
        // tell a dead commit from a slow one. Rewriting history is not exotic here; stripping a
        // trailer off ten commits changed 96 shas in one command, and every record block in the
        // chat pointing at an old one landed on this branch at once.
        if (r && r.ok === false) fail(r.error || "no commit by that name in this repo");
        // `depthKnown` SEPARATES "at the head" FROM "this hub cannot say". `behind` arrives only
        // from the newer door, and only once the hub process restarted carrying it — a missing
        // field read as 0 would print "at the head" over a commit six back.
        else if (r) setRecord({ ...r, depthKnown: typeof r.behind === "number" });
        else fail("the hub answered nothing");
      } catch (e) {
        if (!dead) fail((e && e.message) || "could not read that commit");
      }
    })();
    return () => { dead = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sha, host && host.projectCode, !!git]);

  const load = async () => {
    if (!host || !git) return;
    try {
      if (!svc().Plugin.gitState) throw new Error("no gitState");
      setState(await svc().Plugin.gitState());
      setError("");
    } catch (e) {
      setState(null);
      // KEEP WHAT THREW. This used to flatten every cause into "the hub didn't answer" — and the
      // hub had usually answered; it was the project code that was wrong. `gitNotice` decides the
      // sentence from the evidence, and "no gitState" is a different problem from a dropped socket.
      setError(gitNotice(null, e, projectCode).text);
    }
  };

  // The dep read `[host && host.serviceId]` — a field that stopped existing when file hosts became
  // projects, so it was `undefined` forever and the block never re-read on a project change. Keyed
  // on the field that exists. (`sv:git` is what the panel already fires when it stages or commits;
  // this listens to the same one instead of inventing a poll.)
  useEffect(() => {
    load();
    // Staging happens in terminals we don't own — a button describing a tree that moved an hour ago
    // is worse than no button.
    const onFocus = () => load();
    window.addEventListener("focus", onFocus);
    window.addEventListener("sv:git", onFocus);
    return () => {
      window.removeEventListener("focus", onFocus);
      window.removeEventListener("sv:git", onFocus);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [host && host.projectCode]);

  const say = (text) => setOutput((prev) => [...prev, { ts: Date.now(), text }]);

  const stage = async (paths, unstage, busyKey) => {
    setBusy(busyKey || paths[0]);
    setError("");
    try {
      await svc().Plugin.stageFiles({ paths, unstage });
      await load();
    } catch (e) {
      setError((e && e.message) || "staging failed");
    } finally {
      setBusy("");
    }
  };

  const run = async (what) => {
    if (armed !== what) return setArmed(what);
    setArmed("");
    setBusy(what);
    setError("");
    try {
      if (what === "commit") {
        const res = await svc().Plugin.commit({ message: message.trim() });
        setState(res.state);
        say(res.output || `${res.sha} ${res.subject}`);
        // Flip to the log so the result is READ, not just produced.
        setTab("log");
        // The document is the state. Stamped only where the surface can save — on a read-only one
        // the commit still happened, it just has nowhere to be written down.
        setLocalSha(res.sha || "");
        if (editable) {
          setAttr(line, "sha", res.sha);
          setAttr(line, "ts", String(Date.now()));
        }
        // RFC-073 §5 slice 8 — THE RESULT IS ROUTED, NOT RECORDED. `subscribe=` on a result block
        // names who hears the completion event the chat already gets; nothing new is written into
        // the document for it (c55). The host's send door does the routing — the same event, the
        // block's own summary.
        if (attrs.subscribe && res.sha) {
          sendUpdateTo({
            path: docPath || "chat",
            project: projectCode,
            members: String(attrs.subscribe).split(/[|,]/).map((x) => x.trim()).filter(Boolean),
            summary: `committed ${String(res.sha).slice(0, 7)} — ${message.trim()}`,
          }).catch(() => {});
        }
      } else {
        const res = await svc().Plugin.push();
        setState(res.state);
        say(res.pushed ? res.output : res.reason || "nothing to push");
        setTab("log");
      }
    } catch (e) {
      // git's own words — a hook that aborts says why, and that sentence is the useful part.
      const text = (e && e.message) || `${what} failed`;
      setError(text);
      say(text);
      setTab("log");
    } finally {
      setBusy("");
    }
  };

  const staged = (state && state.staged) || [];
  // Untracked files come in their OWN list from the hub (`state.untracked`); `unstaged` is only
  // tracked files with edits. Reading `unstaged` alone dropped every untracked file from the block
  // while the panel beside it still listed them (his catch: "why isn't it showing untracked?").
  const rest = state ? [...(state.unstaged || []), ...(state.untracked || [])] : [];
  // The SAME three groups the version-control panel shows, under the same names — one vocabulary
  // for both surfaces. A staged-and-edited-since file lands in staged AND changes, deliberately.
  const changes = rest.filter((f) => f.status !== "untracked");
  const untracked = rest.filter((f) => f.status === "untracked");

  // RESIZABLE, and the height is remembered the way every other adjustable thing in this markdown
  // remembers — written back into the block as `height=`, same as `::::columns` writes `split=`.
  const [height, setHeight] = useState(() => Number(attrs.height) || 220);
  useEffect(() => {
    setHeight(Number(attrs.height) || 220);
  }, [attrs.height]);
  const bodyRef = useRef(null);
  // EITHER EDGE of the list, not a bar under the whole block — a grip pinned to the bottom of the
  // card is in the one place you can't reach when the card runs off the surface. `dir` is which way
  // the drag counts: the bottom edge grows downward, the top edge grows upward.
  const onResize = (dir) => (e) => {
    e.preventDefault();
    e.stopPropagation();
    const startY = e.clientY;
    const startH = height;
    const at = (y) => Math.max(80, Math.min(700, startH + (y - startY) * dir));
    const move = (ev) => setHeight(at(ev.clientY));
    // Commit ON RELEASE, never per-pixel — a drag must not rewrite the file fifty times.
    const up = (ev) => {
      window.removeEventListener("mousemove", move);
      window.removeEventListener("mouseup", up);
      const v = Math.round(at(ev.clientY));
      setHeight(v);
      if (editable) setAttr(line, "height", String(v));
    };
    window.addEventListener("mousemove", move);
    window.addEventListener("mouseup", up);
  };
  const resetHeight = () => {
    setHeight(220);
    if (editable) setAttr(line, "height", null);
  };
  const edge = (dir, where) => (
    <div
      className={`md-commit__edge md-commit__edge--${where}`}
      role="separator"
      title="Drag either edge to resize — double-click to reset"
      onMouseDown={onResize(dir)}
      onDoubleClick={resetHeight}
    >
      <span className="md-commit__grip" />
    </div>
  );
  // COMMITTING IS AN ACTION, NOT AN EDIT. `editable` gates writing the sha back INTO a document —
  // and a chat message is not a document, so `editable` is false for every block in the chat and
  // the button was permanently disabled there. That is backwards: the commit is the point, the
  // receipt is a nicety. It works everywhere; where there is nothing to write the sha into, the
  // block just keeps the sha in its own state and shows it. (The one earlier block he DID press
  // lived in a report on the TV — a writable document — which is why this never showed up before.)
  const canCommit = !!state && state.repo && staged.length > 0 && !!message.trim();
  // IS THIS RECORD'S COMMIT IN THE LOG WE HOLD. `gitState` returns the last forty; an older
  // record is simply not in it, and a jump to a tab where the row is absent reads as a dead press.
  const inLog = !!sha && !!state && (state.log || []).some((c) => c.sha === sha || String(sha).startsWith(c.sha) || String(c.sha).startsWith(sha));
  // PUSH IS THE BRANCH'S, NOT THE COMMIT'S — the COUNTS are shown on a record (they are true,
  // and labelled as the branch's), but the button is not: pressing it from a block headed by a
  // commit from last week would push whatever the branch holds now, which is not what the header
  // in front of you says. Reading a branch fact is fine; acting on it from here is the trap.
  const canPush = !sha && !!state && state.repo && state.ahead > 0;

  // A group heading that MOVES ITS WHOLE GROUP — the per-file +/− without a stage-all is the panel's
  // controls with a piece missing.
  //
  // ONE STAGE-ALL FOR BOTH UNSTAGED GROUPS, exactly as in the nav (his call, and he had to say it
  // twice because I fixed the panel and left this one alone — the block and the panel are the same
  // controls and must not disagree). Changed and untracked stay SEPARATE to look at; nobody stages
  // one without the other, and two buttons that each say "stage all" while staging half are lying.
  const unstagedAll = [...changes, ...untracked].map((f) => f.path);
  const groupHead = (label, rows, isStaged) => {
    // It rides the first unstaged group that is on screen, so it never disappears when one half is
    // empty.
    const showsAll = isStaged ? rows.length > 0 : label === (changes.length ? "changes" : "untracked");
    return (
      <div className="md-commit__group">
        <span className="md-commit__group-label">
          {label}
          {rows.length ? ` · ${rows.length}` : ""}
        </span>
        {showsAll && (
          <button
            type="button"
            className="md-commit__all"
            disabled={busy === label}
            title={
              isStaged
                ? `Unstage all ${rows.length}`
                : `Stage everything not staged — ${unstagedAll.length} file${unstagedAll.length === 1 ? "" : "s"}, changed and untracked`
            }
            onClick={() => stage(isStaged ? rows.map((f) => f.path) : unstagedAll, isStaged, label)}
          >
            {isStaged ? "unstage all" : "stage all"}
          </button>
        )}
      </div>
    );
  };

  const fileRow = (f, isStaged) => (
    <div key={`${isStaged ? "s" : "u"}:${f.path}`} className="md-commit__row">
      <span className={`md-commit__mark md-commit__mark--${f.status}`} title={f.status}>
        {MARK[f.status] || "M"}
      </span>
      {/* THE PATH OPENS THE FILE — his rule, and it's the tab-strip rule everywhere now: a file
          named on screen opens in its own tab (or focuses the one it has), never navigates you
          away. A deleted file has nothing to open and stays text. Which SIDE it opens on rides
          along, so a staged row shows HEAD→index and an unstaged one HEAD→working — the same
          split the nav's version-control lens sends. */}
      {f.status === "deleted" ? (
        <span className="md-commit__path md-commit__path--gone">{f.path}</span>
      ) : (
        <button
          type="button"
          className="md-commit__path md-commit__path--open"
          title={`Open ${f.path} in a tab`}
          onClick={() =>
            window.dispatchEvent(
              new CustomEvent("sv:openFileInNav", {
                detail: { projectCode, path: f.path, side: isStaged ? "staged" : "unstaged" },
              }),
            )
          }
        >
          {f.path}
        </button>
      )}
      {f.partial && isStaged && (
        <span className="md-commit__partial" title="Staged, then edited again since">
          +edits
        </span>
      )}
      <button
        type="button"
        className="md-commit__act"
        disabled={busy === f.path}
        title={isStaged ? `Unstage ${f.path}` : `Stage ${f.path}`}
        onClick={() => stage([f.path], isStaged)}
      >
        {isStaged ? "−" : "+"}
      </button>
    </div>
  );

  // NO CAPABILITY, NO BUTTON. A disabled commit button is a promise the surface can't keep; a
  // stated absence is a true sentence. Same dead-block styling `::file` already uses for "name a
  // path", because this is the same idea — the document asked for something this surface hasn't got.
  if (!git)
    return (
      <div className="md-embed md-embed--dead">
        ::commit — {gitGrant === "denied"
          ? "committing isn't allowed here"
          : "this surface can't reach version control"}
      </div>
    );

  return (
    // A RECORD MUST NOT LOOK LIKE AN OFFER. *"There's no indication, there's no difference
    // between this looking like a commit and a commit record. There should be."* They do opposite
    // things — one is about to change the tree, one is a thing that already happened and cannot —
    // so sharing a face means the only way to tell them apart is to notice whether a button is
    // there, which is reading an absence.
    <div className={`md-commit${sha ? " md-commit--done md-commit--record" : ""}`}>
      <div className="md-commit__head">
        <span className="md-commit__kind">commit</span>
        {/* THE DESTINATION LEADS (his call): pressing this writes history into a repo you may not
            even be looking at, so which repo it is cannot be a footnote at the far right. It sits
            beside the badge, in the plum the app uses for its own addressing — same identity the
            pane headers wear, so "which project" reads the same everywhere. */}
        <span className="md-commit__scope">{host ? host.projectCode : projectCode || ""}</span>
        {sha && (
          <span className="md-commit__kind" title="a commit that already happened — nothing here changes the tree">
            record
          </span>
        )}
        {/* THE BRANCH AND ITS DISTANCE FROM ORIGIN, on both postures. These are facts about the
            branch RIGHT NOW, never about the commit — and for one build they were removed from
            records on those grounds, which was wrong. They are true, and a record sits on a
            branch like anything else.
            WHAT WAS ACTUALLY BROKEN was that the record's own depth had been given the same class
            name as `↓` behind-origin, so the two rendered into one slot: six records about six
            commits all showed ↑96 ↓96 and nothing else, and the only numbers on the row read as
            the record's own. Once the depth has its own name both can stand, because they are
            visibly two different things. The title says which is which out loud. */}
        {state && state.repo && (
          <span className="md-commit__branch" title={`the branch, as it stands now — not a fact about ${sha ? "this commit" : "what you are about to commit"}`}>
            {state.branch}
            {state.ahead > 0 && <span className="md-commit__ahead" title={`${state.ahead} commits on this branch are not pushed`}>↑{state.ahead}</span>}
            {state.behind > 0 && <span className="md-commit__behind" title={`${state.behind} commits on the remote are not here`}>↓{state.behind}</span>}
          </span>
        )}
        {!mini && <span className="md-commit__tabs">
          <button
            type="button"
            className={`md-commit__tab${tab === "changes" ? " is-on" : ""}`}
            onClick={() => setTab("changes")}
          >
            changes{staged.length ? ` ${staged.length}` : ""}
          </button>
          <button
            type="button"
            className={`md-commit__tab${tab === "log" ? " is-on" : ""}`}
            onClick={() => setTab("log")}
          >
            log
          </button>
        </span>}
        {/* HAND IT TO THE PANEL. The block can run the commit itself, but sometimes the panel is
            where you want to finish it — stage a few more things, read the log, then commit there.
            This carries the message over and opens the box; it never commits anything. */}
        {!sha && (
          <button
            type="button"
            className="md-commit__tonav"
            title="Send this message to the codebase panel's commit box"
            onClick={() => {
              window.dispatchEvent(new CustomEvent("sv:openRegion", { detail: { region: "nav" } }));
              window.dispatchEvent(
                new CustomEvent("sv:commitInNav", {
                  detail: { projectCode: host ? host.projectCode : projectCode, message },
                }),
              );
            }}
          >
            to the panel ⇢
          </button>
        )}
        {/* THE CHEVRON IS ITS OWN CONTROL, IN THE CORNER. It was briefly folded into the `record`
            label, which made one word carry two jobs — naming what this is, and being the button
            — and made a closed record read as a different kind of block rather than this one with
            its body hidden. Last in the head, so it is the same corner every fold here opens from. */}
        {sha && (
          <button
            type="button"
            className="md-commit__fold"
            aria-expanded={!mini}
            title={mini ? "open it" : "minimize it"}
            onClick={() => setMini((v) => !v)}
          >
            {mini ? "▸" : "▾"}
          </button>
        )}
      </div>

      {/* THE MESSAGE ROW — the button sits WITH the message, not on a row of its own underneath.
          A long message WRAPS here (a textarea that grows, not an input that scrolls sideways). */}
      <div className="md-commit__msgrow">
        {typing && !sha ? (
          <textarea
            ref={msgRef}
            className="md-commit__message md-commit__message--editing"
            value={message}
            placeholder="commit message"
            rows={Math.min(6, Math.max(1, Math.ceil(message.length / 52)))}
            autoFocus
            onChange={(e) => setMessage(e.target.value)}
            onBlur={() => setTyping(false)}
            onKeyDown={(e) => {
              if (e.key === "Escape") {
                setArmed("");
                setTyping(false);
              }
            }}
          />
        ) : (
          <div
            className={`md-commit__message${message || (record && record.subject) ? "" : " md-commit__message--empty"}${recErr ? " md-commit__message--gone" : ""}${mini ? " md-commit__message--clamp" : ""}`}
            role={sha ? undefined : "button"}
            title={sha ? "" : "Click to edit — it's your commit message"}
            onClick={() => !sha && setTyping(true)}
          >
            {/* A RECORD SHOWS THE COMMIT'S OWN WORDS, read back from git. `message` is the state
                the OFFER types into, and a record was never typed in — a block pointed at an old
                commit had an empty one and rendered the placeholder, so the thing he opened it to
                read was the one thing missing. git is the source here, not this component. */}
            {sha ? (record ? record.subject : recErr || "reading…") : message || "commit message"}
          </div>
        )}
        <span className="md-commit__msgacts">
          {sha ? (
            <span className="md-commit__stamp">
              {/* HOW FAR BACK IT SITS, beside the sha. *"It should count how far behind it is."*
                  At the tip it says so; behind it, the number — which is also what decides what
                  undoing it would take with it. */}
              {/* `__depth`, NOT `__behind`. `md-commit__behind` was already taken — it is the
                  block's BEHIND-ORIGIN counter, a fact about the branch against its remote.
                  Reusing the name put this exactly where that lives and made the two
                  indistinguishable: he read the push counters and never saw a depth at all. Two
                  different questions, two different names. */}
              {record && record.depthKnown && (
                <span className={`md-commit__depth${record.behind === 0 ? " md-commit__depth--head" : ""}`}>
                  {record.behind === 0 ? "at the head" : `${record.behind} back`}
                </span>
              )}
              {/* THE SHA IS THE DOOR, not a label. Finding where a record sits meant reading the
                  hash, opening the log tab yourself, and scanning forty rows for it — *"go into
                  logs… that one's on top. What about this one? Go into logs."* Pressing it flips
                  to the log and brings that commit's row into view, marked, which is the whole
                  gesture he described.
                  IT SAYS WHEN IT CANNOT. The log is the last forty commits; a record older than
                  that is not in it, and jumping to a tab where the row is absent would read as
                  the press doing nothing. */}
              <button
                type="button"
                className="md-commit__stampsha"
                title={inLog ? "show it in the log" : "older than the last 40 commits — not in this log"}
                onClick={() => { if (inLog) { setTab("log"); setFocusSha(sha); } }}
                disabled={!inLog}
              >
                <code>{sha}</code>
              </button>
            </span>
          ) : (
            <button
              type="button"
              className={`md-commit__btn md-commit__btn--commit${armed === "commit" ? " is-armed" : ""}`}
              disabled={!canCommit || !!busy}
              onClick={() => run("commit")}
              title={
                !state
                  ? "Couldn't read git — the hub didn't answer"
                  : !staged.length
                    ? "Nothing is staged"
                    : !message.trim()
                      ? "A commit needs a message"
                      : "Commits what is staged — click twice"
              }
            >
              {busy === "commit"
                ? "committing…"
                : armed === "commit"
                  ? "confirm"
                  : "Commit"}
            </button>
          )}
          {canPush && (
            <button
              type="button"
              className={`md-commit__btn md-commit__btn--push${armed === "push" ? " is-armed" : ""}`}
              disabled={!!busy}
              onClick={() => run("push")}
              title={`${state.branch} → ${state.upstream || "its upstream"}`}
            >
              {busy === "push" ? "pushing…" : armed === "push" ? "confirm" : `Push ↑${state.ahead}`}
            </button>
          )}
          {armed && (
            <button
              type="button"
              className="md-commit__btn md-commit__btn--cancel"
              onClick={() => setArmed("")}
            >
              cancel
            </button>
          )}
        </span>
      </div>
      {error && <div className="md-commit__error">{error}</div>}

      {edge(-1, "top")}
      {/* CLOSED IS THIS BLOCK WITH ITS BODY HIDDEN — nothing above this line changes. Minimize
          means keep the top section: *"you literally just keep the top section showing, that's
          all. That's what minimize means."* The head and the message row carry the subject, the
          depth and the sha, which is everything that tells one record from another in a column. */}
      {!mini && (
        <>
      {tab === "changes" ? (
        <div className="md-commit__body" ref={bodyRef} style={{ height }}>
          {sha ? (
            // THE COMMIT'S OWN FILES, not the tree's. Nothing here is pressable: a committed file
            // cannot be unstaged, and offering the gesture would be a control that lies.
            !record ? (
              <div className="md-commit__none">reading {sha}…</div>
            ) : (
              <>
                {/* A PLAIN LABEL, not `groupHead` — that one carries a stage-all / unstage-all
                    button, and a committed file has nothing to stage. */}
                <div className="md-commit__group">
                  <span className="md-commit__group-label">
                    in this commit · {record.files.length}
                    {record.added != null ? ` · +${record.added} −${record.removed}` : ""}
                  </span>
                </div>
                {/* EVERY FILE OPENS — IN A TAB, like every other file named on a surface here.
                    It briefly expanded into an accordion inside the block instead, which was a
                    third gesture invented for no reason: *"are you expanding into opening the
                    file instead of just opening the file?"* The offer's rows have always opened
                    a tab; a record's rows do the same thing, and the only difference is WHICH
                    version opens.
                    THE SHA RIDES ALONG, which is the whole point. Without it the tab would show
                    today's working copy under a header naming a commit from last month — the
                    surface testifying. `fsha` carries it to the pane the same way `fside` carries
                    staged-vs-working for the offer. */}
                {record.files.map((f) => (
                  <div key={f.path} className="md-commit__row">
                    {/* A | M | D only where git gave one — the older `showCommit` door does not
                        report it, and defaulting to "M" would quietly call a new file modified. */}
                    <span className="md-commit__mark" title={f.status || ""}>{f.status || "·"}</span>
                    {f.status === "D" ? (
                      // Deleted by this commit — there is nothing at this sha to open.
                      <span className="md-commit__path md-commit__path--gone">{f.path}</span>
                    ) : (
                      <button
                        type="button"
                        className="md-commit__path md-commit__path--open"
                        title={`Open ${f.path} as it stood at ${sha}`}
                        onClick={() =>
                          window.dispatchEvent(
                            new CustomEvent("sv:openFileInNav", {
                              detail: { projectCode, path: f.path, sha },
                            }),
                          )
                        }
                      >
                        {f.path}
                      </button>
                    )}
                    {f.added === null ? (
                      <span className="md-commit__count">binary</span>
                    ) : (
                      <span className="md-commit__count">+{f.added} −{f.removed}</span>
                    )}
                  </div>
                ))}
              </>
            )
          ) : !host ? (
            <div className="md-commit__none">
              no live service with file access{projectCode ? ` in ${projectCode}` : ""} — connect
              one, or name it with {"{project=…}"}
            </div>
          ) : !state ? (
            <div className="md-commit__none">{error || "reading git…"}</div>
          ) : gitNotice(state, null, projectCode) ? (
            // A REFUSAL IS NOT A FACT ABOUT THE REPO. `gitState` returns `{ok:false, error}` for a
            // project it cannot resolve, and this branch read only `state.repo` — so a code that
            // matched nothing rendered as "not a git repository", about a folder nothing had found.
            <div className="md-commit__none">{gitNotice(state, null, projectCode).text}</div>
          ) : (
            <>
              {groupHead("staged", staged, true)}
              {staged.length ? (
                staged.map((f) => fileRow(f, true))
              ) : (
                <div className="md-commit__none">nothing staged — stage something below</div>
              )}
              {changes.length > 0 && (
                <>
                  {groupHead("changes", changes, false)}
                  {changes.map((f) => fileRow(f, false))}
                </>
              )}
              {untracked.length > 0 && (
                <>
                  {groupHead("untracked", untracked, false)}
                  {untracked.map((f) => fileRow(f, false))}
                </>
              )}
            </>
          )}
        </div>
      ) : (
        <div className="md-commit__body md-commit__body--log" style={{ height }}>
          {/* What just happened, then what happened before — git's own words on top, history under. */}
          {output.length > 0 && (
            <pre className="md-commit__out">{output.map((o) => o.text).join("\n\n")}</pre>
          )}
          {state && state.log && state.log.length ? (
            // NOT PUSHED, said here too — the block's log and the panel's log are the same history,
            // and it would be the same question in both. `pushed` is git's own answer where the
            // plugin sends it; without it the top `ahead` rows are the unpushed ones.
            (() => {
              const knows = state.log.some((c) => typeof c.pushed === "boolean");
              const isUnpushed = (c, i) =>
                knows ? !c.pushed : !state.upstream || i < (state.ahead || 0);
              return state.log.map((c, i) => {
                const info = commits[c.sha];
                const open = openSha === c.sha;
                return (
                  <React.Fragment key={c.sha}>
                    <div
                      ref={c.sha === focusSha ? focusRow : null}
                      className={`md-commit__logrow${isUnpushed(c, i) ? " md-commit__logrow--unpushed" : ""}${open ? " md-commit__logrow--open" : ""}${c.sha === focusSha ? " md-commit__logrow--this" : ""}`}
                      title={isUnpushed(c, i) ? `${c.subject} — not pushed` : c.subject}
                      onClick={() => openCommit(c.sha)}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && openCommit(c.sha)}
                    >
                      <code className="md-commit__logsha">{c.sha}</code>
                      {/* A MARK IS NOT A SENTENCE. A highlighted row explains itself only if you
                          watched it arrive; scroll away and back and it is just a coloured row. */}
                      {c.sha === focusSha && <span className="md-commit__logthis">this record</span>}
                      <span className="md-commit__logsubj">{c.subject}</span>
                      <span className="md-commit__logwhen">{c.when}</span>
                      <span className="md-commit__logchev">{open ? "▾" : "▸"}</span>
                    </div>
                    {open && (
                      <div className="md-commit__commit">
                        {info && info.loading ? (
                          <div className="md-commit__none">reading that commit…</div>
                        ) : info && info.ok === false ? (
                          // THE HUB'S OWN WORDS, same rule as gitNotice: a refusal is not a fact
                          // about the commit, and "no files" would be the confident zero again.
                          <div className="md-commit__none">{info.error || "could not read that commit"}</div>
                        ) : info ? (
                          <>
                            {/* THE WHOLE SUBJECT, WRAPPED. The row above clips it with an
                                ellipsis, and his messages run past 200 characters — so expanding
                                to read a commit and still not seeing its message is the drawer
                                failing at the one job it was opened for. CodebaseNav already did
                                this (`__logsubj-full`); the chat's block did not. */}
                            <div className="md-commit__commit-subject">{info.subject}</div>
                            <div className="md-commit__commit-who">
                              {/* `who`, not `author` — showCommit returns who/email/date/when, and
                                  reading the field name wrong rendered an empty author for every
                                  commit. Nothing failed; a line was just blank. */}
                              {info.who}
                              {info.date ? ` · ${info.date}` : ""}
                              {info.parents && info.parents.length > 1 ? " · merge" : ""}
                            </div>
                            {info.body ? <pre className="md-commit__commit-body">{info.body}</pre> : null}
                            {info.files && info.files.length ? (
                              info.files.map((f) => (
                                <div key={f.path} className="md-commit__commit-file">
                                  <span className="md-commit__commit-path">{f.path}</span>
                                  <span className="md-commit__commit-stat">
                                    {f.added === null && f.removed === null ? (
                                      // numstat reports "-" for a binary file. "+0/−0" would say it
                                      // did not change; it says nothing countable changed.
                                      <span className="md-commit__commit-bin">binary</span>
                                    ) : (
                                      <>
                                        <span className="md-commit__commit-add">+{f.added}</span>
                                        <span className="md-commit__commit-del">−{f.removed}</span>
                                      </>
                                    )}
                                  </span>
                                </div>
                              ))
                            ) : (
                              <div className="md-commit__none">no files in this commit</div>
                            )}
                          </>
                        ) : null}
                      </div>
                    )}
                  </React.Fragment>
                );
              });
            })()
          ) : output.length ? null : (
            <div className="md-commit__none">no commits yet</div>
          )}
        </div>
      )}

        </>
      )}

      {edge(1, "bottom")}
    </div>
  );
};

export default CommitBlock;
