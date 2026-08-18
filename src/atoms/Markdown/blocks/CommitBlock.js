import React, { useContext, useEffect, useRef, useState } from "react";
import ServiceContext from "../../../ServiceContext";
import loadServiceWithHeaders from "../../../utils/loadService";
import { useMarkdownScope, useMarkdownWrite } from "../context";
import { canGit, hasPlugin, pickHost } from "../../../utils/pluginHost";

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
  const { editable, setAttr } = useMarkdownWrite();
  const { connectedServices = [] } = useContext(ServiceContext);
  const projectCode = attrs.project || scope.projectCode;
  // Same host rule as the file embeds: this project's plugin, never a stranger's repo. Committing
  // into the wrong repository is not a mistake worth being clever about.
  //
  // WITHIN the project though, the named service only gets the job if its plugin can actually do
  // git — siblings share a working directory, so a sibling on a newer plugin commits the same repo.
  // Otherwise the block draws fine and dies on the button with `stageFiles is not a function`.
  const mine = connectedServices.filter((s) => s.projectCode === projectCode && hasPlugin(s));
  const named = mine.find((s) => s.serviceId === (attrs.service || scope.serviceId));
  const host = (named && canGit(named) && named) || pickHost(mine) || named || null;

  const [message, setMessage] = useState(label || attrs.message || "");
  // The message reads as TEXT until you click into it — his note: "editable but doesn't look
  // editable by default, you click into it".
  const [typing, setTyping] = useState(false);
  const [state, setState] = useState(null);
  const [tab, setTab] = useState("changes");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState("");
  // TWO-STEP, his call: the first click arms, the second runs — same shape the destructive items
  // in the nav's row menus use.
  const [armed, setArmed] = useState("");
  // Everything git said, newest last — the log tab is a transcript, not a status line.
  const [output, setOutput] = useState([]);
  const sha = attrs.sha || "";
  const msgRef = useRef(null);

  const svc = () =>
    loadServiceWithHeaders(host.system.connectionData, host.headers, host.credentials);

  const load = async () => {
    if (!host) return;
    try {
      if (!svc().Plugin.gitState) throw new Error("no gitState");
      setState(await svc().Plugin.gitState());
      setError("");
    } catch {
      setState(null);
      setError("this project's plugin doesn't have version control yet");
    }
  };

  useEffect(() => {
    load();
    // Staging happens in terminals we don't own — a button describing a tree that moved an hour ago
    // is worse than no button.
    const onFocus = () => load();
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [host && host.serviceId]);

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
        if (editable) {
          setAttr(line, "sha", res.sha);
          setAttr(line, "ts", String(Date.now()));
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
  const rest = (state && state.unstaged) || [];
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
  const canCommit = editable && !!state && state.repo && staged.length > 0 && !!message.trim();
  const canPush = !!state && state.repo && state.ahead > 0;

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
      <span className={`md-commit__path${f.status === "deleted" ? " md-commit__path--gone" : ""}`}>
        {f.path}
      </span>
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

  return (
    <div className={`md-commit${sha ? " md-commit--done" : ""}`}>
      <div className="md-commit__head">
        <span className="md-commit__kind">commit</span>
        {state && state.repo && (
          <span className="md-commit__branch">
            {state.branch}
            {state.ahead > 0 && <span className="md-commit__ahead">↑{state.ahead}</span>}
            {state.behind > 0 && <span className="md-commit__behind">↓{state.behind}</span>}
          </span>
        )}
        <span className="md-commit__tabs">
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
        </span>
        <span className="md-commit__scope">{host ? host.projectCode : projectCode || ""}</span>
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
            className={`md-commit__message${message ? "" : " md-commit__message--empty"}`}
            role={sha ? undefined : "button"}
            title={sha ? "" : "Click to edit — it's your commit message"}
            onClick={() => !sha && setTyping(true)}
          >
            {message || "commit message"}
          </div>
        )}
        <span className="md-commit__msgacts">
          {sha ? (
            <span className="md-commit__stamp">
              <code>{sha}</code>
            </span>
          ) : (
            <button
              type="button"
              className={`md-commit__btn md-commit__btn--commit${armed === "commit" ? " is-armed" : ""}`}
              disabled={!canCommit || !!busy}
              onClick={() => run("commit")}
              title={
                !editable
                  ? "Read-only here — the sha would have nowhere to be written"
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
      {tab === "changes" ? (
        <div className="md-commit__body" ref={bodyRef} style={{ height }}>
          {!host ? (
            <div className="md-commit__none">
              no live service with file access{projectCode ? ` in ${projectCode}` : ""} — connect
              one, or name it with {"{project=…}"}
            </div>
          ) : !state ? (
            <div className="md-commit__none">{error || "reading git…"}</div>
          ) : !state.repo ? (
            <div className="md-commit__none">not a git repository</div>
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
              return state.log.map((c, i) => (
                <div
                  key={c.sha}
                  className={`md-commit__logrow${isUnpushed(c, i) ? " md-commit__logrow--unpushed" : ""}`}
                  title={isUnpushed(c, i) ? `${c.subject} — not pushed` : c.subject}
                >
                  <code className="md-commit__logsha">{c.sha}</code>
                  <span className="md-commit__logsubj">{c.subject}</span>
                  <span className="md-commit__logwhen">{c.when}</span>
                </div>
              ));
            })()
          ) : output.length ? null : (
            <div className="md-commit__none">no commits yet</div>
          )}
        </div>
      )}

      {edge(1, "bottom")}
    </div>
  );
};

export default CommitBlock;
