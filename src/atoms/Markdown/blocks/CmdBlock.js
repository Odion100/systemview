import React, { useEffect, useRef, useState } from "react";
import { useCapability, useCapabilityState } from "../capabilities";
import { useMarkdownScope } from "../context";
import { parseCommand, summarize, isRunnable } from "./cmdSource";

// `:::cmd{title="…"}` — A COMMAND THE DOCUMENT THAT EXPLAINS IT CAN ALSO RUN.
//
//   :::cmd{title="Rebuild the bundle"}
//   BUILD_PATH=build.next NODE_OPTIONS=--max-old-space-size=4096 ./node_modules/.bin/react-scripts build && rm -rf build && mv build.next build
//   :::
//
// His problem, exactly: some commands get run periodically and have nowhere to live. The build
// incantation is not an npm script — it is a specific invocation with env vars — so today it exists
// as prose in CLAUDE.md that an agent reads and retypes. This makes it a thing you press, in the
// document that already explains it.
//
// WHY NOT `:::run`. `run` is the SystemLynx TEST engine: `Math.add { "a": 2 }`, replayed through
// SavedTestItem. One word covering "call a service method" and "execute a shell command" is a
// definition drifting into two, so this is its own name and shares none of that machinery.
//
// OPT-IN, AND ONLY OPT-IN. A ```bash fence stays a ```bash fence — inert, forever. These documents
// are full of illustrative shell (CLAUDE.md alone shows four commands nobody should be one click
// from running), and the difference between documentation and a button has to be something the
// author typed on purpose. Nothing infers a runnable from a code fence.
//
// PRESS-ONLY. A human presses this. There is no agent-facing verb that runs a `:::cmd` block, the
// same way there is no `systemview commit` behind `::commit` — the absence is the point.
//
// Execution belongs to the host, through the `shell` capability (see `src/utils/hostCommand.js` for
// why it is the terminal seam and not a hub verb). A surface with no shell says so and offers
// nothing to press.

const fmt = (ms) => {
  const s = Math.round(ms / 1000);
  return s < 60 ? `${s}s` : `${Math.floor(s / 60)}m ${String(s % 60).padStart(2, "0")}s`;
};

const CmdBlock = ({ src, attrs = {} }) => {
  const scope = useMarkdownScope();
  const projectCode = attrs.project || scope.projectCode || "";
  const shell = useCapability("shell");
  const grant = useCapabilityState("shell");

  const command = parseCommand(src);
  const title = attrs.title || summarize(command);

  // `null` until it has been pressed — and that is a state the block RENDERS, because "never ran"
  // and "ran and printed nothing" are two different answers and only one of them is fine.
  const [run, setRun] = useState(null); // { at, text, exit, started, error, cancelled, busy }
  // Only to repaint the elapsed clock — the value is never read.
  const [, setTick] = useState(0);
  const handleRef = useRef(null);
  const outRef = useRef(null);
  const liveRef = useRef(true);

  useEffect(() => {
    liveRef.current = true;
    return () => {
      liveRef.current = false;
      // Navigating away does NOT abandon a shell: cancel what this block started, or a build keeps
      // running with nothing left on screen that can stop it.
      if (handleRef.current) handleRef.current.cancel();
    };
  }, []);

  // A long command must not look hung. The transcript streams, and this ticks the elapsed clock even
  // through the silent stretches where a build is thinking and printing nothing.
  useEffect(() => {
    if (!run || !run.busy) return undefined;
    const id = setInterval(() => setTick((n) => n + 1), 1000);
    return () => clearInterval(id);
  }, [run && run.busy]); // eslint-disable-line react-hooks/exhaustive-deps

  // Follow the tail while it runs — but only while the reader is already at the bottom, so scrolling
  // back to read an error isn't yanked away by the next chunk.
  useEffect(() => {
    const el = outRef.current;
    if (!el || !run || !run.busy) return;
    if (el.scrollHeight - el.scrollTop - el.clientHeight < 60) el.scrollTop = el.scrollHeight;
  }, [run && run.text, run && run.busy]); // eslint-disable-line react-hooks/exhaustive-deps

  // Asked at render, not at click: "there is no shell here" is something the block has to SAY
  // before it offers a button, not after someone presses one.
  const runner = shell ? shell(projectCode) : null;

  const start = () => {
    if (!runner || (run && run.busy)) return;
    setRun({ at: Date.now(), busy: true, started: false, text: "", exit: null, error: "" });
    const handle = runner.run({
      command,
      onOutput: (state) =>
        liveRef.current && setRun((prev) => (prev && prev.busy ? { ...prev, ...state } : prev)),
    });
    handleRef.current = handle;
    handle.done.then((result = {}) => {
      handleRef.current = null;
      if (!liveRef.current) return;
      setRun((prev) => ({
        ...(prev || { at: Date.now(), text: "" }),
        busy: false,
        ms: Date.now() - ((prev && prev.at) || Date.now()),
        started: result.started !== false,
        exit: result.code === undefined ? (prev && prev.exit) ?? null : result.code,
        cancelled: !!result.cancelled,
        error: result.error || "",
      }));
    });
  };

  const stop = () => {
    if (!handleRef.current) return;
    // Say it out loud: Ctrl-C is a REQUEST, and the seconds between asking and the shell actually
    // letting go are exactly when a button that still says "stop" looks broken.
    setRun((prev) => (prev ? { ...prev, stopping: true } : prev));
    handleRef.current.cancel();
  };

  // NO CAPABILITY, NO BUTTON — the same rule `::commit` works under. A disabled Run is a promise the
  // surface can't keep; "this surface can't run commands" is a true sentence.
  if (!runner)
    return (
      <div className="md-embed md-embed--dead">
        :::cmd —{" "}
        {grant === "denied"
          ? "running commands isn't allowed here"
          : !shell
          ? "this surface can't run commands"
          : // Three absences, three sentences. A document that never said which project it belongs
            // to is a fixable mistake and must not read as "this app can't do that".
            !projectCode
          ? "this document names no project — add project=<code>"
          : `no shell for ${projectCode}`}
      </div>
    );
  if (!isRunnable(command))
    return <div className="md-embed md-embed--dead">:::cmd — no command in this block</div>;

  const busy = !!(run && run.busy);
  // THREE OUTCOMES, THREE FACES. Zero is the only green, a non-zero exit is red, and a command that
  // never reached the shell is neither — it is its own, dashed, "didn't run".
  const ranOk = !!run && !busy && run.started && run.exit === 0;
  const ranBad = !!run && !busy && run.started && run.exit !== 0 && !run.cancelled;
  const neverRan = !!run && !busy && !run.started;

  const state = busy
    ? `${run.stopping ? "stopping" : "running"} · ${fmt(Date.now() - run.at)}`
    : run && run.cancelled
    ? "stopped"
    : neverRan
    ? "didn't run"
    : ranOk
    ? `exit 0 · ${fmt(run.ms || 0)}`
    : ranBad
    ? `exit ${run.exit == null ? "?" : run.exit} · ${fmt(run.ms || 0)}`
    : "not run";

  return (
    <div
      className={`md-cmd${busy ? " md-cmd--busy" : ""}${ranOk ? " md-cmd--ok" : ""}${
        ranBad ? " md-cmd--fail" : ""
      }${neverRan ? " md-cmd--unrun" : ""}`}
    >
      <div className="md-cmd__head">
        <span className="md-cmd__kind">cmd</span>
        {/* WHERE IT WILL RUN, up front — this presses a key and a process starts somewhere. Which
            repo that is cannot be a footnote, so it sits beside the badge like ::commit's does. */}
        {projectCode && <span className="md-cmd__scope">{projectCode}</span>}
        <span className="md-cmd__title">{title}</span>
        <span className="md-cmd__state">{state}</span>
        {busy ? (
          <button type="button" className="md-cmd__btn md-cmd__btn--stop" onClick={stop}>
            stop
          </button>
        ) : (
          <button
            type="button"
            className="md-cmd__btn"
            title={`Run in ${projectCode || "this project"}`}
            onClick={start}
          >
            {run ? "run again" : "run"}
          </button>
        )}
      </div>
      {/* The command itself, verbatim and always on screen — what you press and what you read are
          the same characters, and that is the whole reason this block exists. */}
      <pre className="md-cmd__command">{command}</pre>
      {run && (
        <div className="md-cmd__out" ref={outRef}>
          {run.error ? <div className="md-cmd__error">{run.error}</div> : null}
          {run.text ? (
            <pre className="md-cmd__text">{run.text}</pre>
          ) : (
            <div className="md-cmd__quiet">
              {busy ? "waiting for output…" : run.started ? "(no output)" : "nothing ran"}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default CmdBlock;
