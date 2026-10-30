import React, { useEffect, useRef, useState } from "react";
import { useCapability, useCapabilityState } from "../capabilities";
import { routeResult } from "../docSend";
import { useMarkdownScope, useMarkdownWrite, useDocMembers } from "../context";
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

// ONE RUN, ONE NAME — stable across refreshes, distinct per block: the same command in the same
// place always maps to the same session, so a remount can find a run that is still going. djb2,
// base36, enough to tell blocks apart; collisions would only merge two IDENTICAL commands.
const sessionIdFor = (command, dir) => {
  const s = `${command}|${dir || ""}`;
  let h = 5381;
  for (let i = 0; i < s.length; i += 1) h = ((h << 5) + h + s.charCodeAt(i)) >>> 0;
  return `cmd-${h.toString(36)}`;
};

const fmt = (ms) => {
  const s = Math.round(ms / 1000);
  return s < 60 ? `${s}s` : `${Math.floor(s / 60)}m ${String(s % 60).padStart(2, "0")}s`;
};

// One line for the routed event — what ran and how it ended; the log lines live in the chat's own
// receipt and the session log, never re-said here.
const receiptLine = (title, result = {}) =>
  `${title} — ${result.cancelled ? "cancelled" : result.error ? `failed: ${result.error}` : `exit ${result.code === undefined ? "?" : result.code}`}`;

const CmdBlock = ({ src, attrs = {} }) => {
  const scope = useMarkdownScope();
  const { docPath = "" } = useDocMembers() || {};
  const projectCode = attrs.project || scope.projectCode || "";
  // `dir=` — the MACHINE-ADDRESS form (his call, asked twice: "the project has nothing to do with
  // being able to run cmd"). A folder anywhere on the machine, the way ::file takes `~/…`. The
  // project stays the preferred form in documents — a code survives the repo moving; a path doesn't.
  const dir = attrs.dir || "";
  const shell = useCapability("shell");
  const grant = useCapabilityState("shell");
  // THE CHAT HEARS THE RESULT (his call: "that way you know automatically if it fails"). `tellRun`
  // is OPTIONAL on the write context — the chat implements it, documents don't — so a block pressed
  // in a reply reports to the agent that offered it, and a press while reading pings nobody.
  const { tellRun } = useMarkdownWrite() || {};

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
      // Navigating away lets the VIEW go, never the run (his catch: a page hop killed a build that
      // the refresh case proved could survive). The session keeps running, the strip's terminal
      // list still names it, and the block that remounts adopts it below — so nothing runs with
      // no door back to it. The deliberate stop is the block's own cancel press.
      if (handleRef.current) (handleRef.current.detach || handleRef.current.cancel)();
    };
  }, []);

  // THE REMOUNT FINDS ITS RUN AGAIN. A refresh or a page hop used to leave a running command with
  // no view — the screen session alive on disk, the block back at "nothing ran". On mount, the
  // block asks for its own session by name; a survivor is adopted, its history replayed through
  // the same transcript reader, and the stream continues to the real exit. No survivor = stay
  // cold: a command that finished while nobody watched has no session left, and inventing its
  // result is worse than saying nothing.
  useEffect(() => {
    if (!runner || typeof runner.resume !== "function" || run) return undefined;
    let live = true;
    (async () => {
      const handle = await runner.resume({
        onOutput: (state) =>
          liveRef.current && setRun((prev) => (prev && prev.busy ? { ...prev, ...state } : prev)),
      });
      if (!handle || !live) { if (handle && !live) handle.detach(); return; }
      const at = Date.now(); // the original start is in the session, not here — the clock resumes from now
      const seeded = (typeof handle.state === "function" && handle.state()) || {};
      setRun({ at, busy: true, started: true, text: seeded.text || "", exit: null, error: "", resumed: true });
      handleRef.current = handle;
      handle.done.then((result = {}) => {
        handleRef.current = null;
        if (result.detached) return;
        if (typeof tellRun === "function" && !result.foreign)
          tellRun({
            title,
            exit: result.code === undefined ? null : result.code,
            ms: Date.now() - at,
            started: result.started !== false,
            cancelled: !!result.cancelled,
            error: result.error || "",
          });
        if (!result.foreign)
          routeResult({ subscribe: attrs.subscribe, project: projectCode, docPath, summary: receiptLine(title, result) });
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
    })();
    return () => { live = false; };
    // mount-only on purpose: this is the remount's one look back
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
  // before it offers a button, not after someone presses one. A dir block still hands the project
  // over for session identity; "machine" stands in only when the room names no project at all.
  const sessionId = sessionIdFor(command, dir);
  const runner = shell ? shell(projectCode || (dir ? "machine" : ""), dir || undefined, sessionId) : null;

  const start = () => {
    if (!runner || (run && run.busy)) return;
    const at = Date.now();
    setRun({ at, busy: true, started: false, text: "", exit: null, error: "" });
    const handle = runner.run({
      command,
      onOutput: (state) =>
        liveRef.current && setRun((prev) => (prev && prev.busy ? { ...prev, ...state } : prev)),
    });
    handleRef.current = handle;
    handle.done.then((result = {}) => {
      handleRef.current = null;
      // A detach is the view letting go, not an ending — no receipt, no state write; the run is
      // still going and the next mount picks it back up.
      if (result.detached) return;
      // NEVER the output — the full transcript already lives in the host's session log on disk,
      // and the agent reads it there instead of having it re-said into the conversation.
      if (typeof tellRun === "function")
        tellRun({
          title,
          exit: result.code === undefined ? null : result.code,
          ms: Date.now() - at,
          started: result.started !== false,
          cancelled: !!result.cancelled,
          error: result.error || "",
        });
      routeResult({ subscribe: attrs.subscribe, project: projectCode, docPath, summary: receiptLine(title, result) });
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
            !projectCode && !dir
          ? "this document names no project — add project=<code> or dir=<folder>"
          : `no shell for ${dir || projectCode}`}
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
        {/* WHERE IT WILL RUN is not a badge anymore — the terminal prompt below carries it, once,
            where a shell says it (his call: the prompt made the badge a second copy). */}
        <span className="md-cmd__title">{title}</span>
        <span className="md-cmd__state">{state}</span>
        {busy ? (
          <button type="button" className="md-cmd__btn md-cmd__btn--stop" onClick={stop}>
            stop
          </button>
        ) : (
          <>
            {/* CLEAR — back to the unrun block, output gone (his ask: wipe before running again).
                Only once there is something to wipe; the state honestly returns to "not run". */}
            {run && (
              <button type="button" className="md-cmd__btn md-cmd__btn--quiet" onClick={() => setRun(null)}>
                clear
              </button>
            )}
            <button
              type="button"
              className="md-cmd__btn"
              // A STABLE ADDRESS FOR EVERY COMMAND (his rule for our own application: assign one
              // wherever it makes sense). Every cmd block renders identical classes, so a cue
              // selector took the FIRST one and every other command in a document was
              // unaddressable — a fixture whose whole point is walking eight states could only
              // ever have its first command pressed, which is why a demo quietly rerouted around
              // them instead of pressing them. The command IS the address:
              // `press="[data-cmd*='rfc rejected']"`.
              data-cmd={command}
              title={`Run in ${dir || projectCode || "this project"}`}
              onClick={start}
            >
              {run ? "run again" : "run"}
            </button>
          </>
        )}
      </div>
      {/* THE TERMINAL FACE — his ask: the command should read as a command LINE, not a paragraph
          of code. One dark pane, a prompt naming the folder it runs in, the command after it, and
          the output printing into the SAME pane underneath — the shape of the session it actually
          is. The prompt is CHROME, not content: it lives outside __command (and is unselectable in
          css) so what you read there is still exactly what runs, verbatim. */}
      <div className="md-cmd__term">
        <pre className="md-cmd__line">
          <span className="md-cmd__prompt">{dir || projectCode || "~"} $ </span>
          <span className="md-cmd__command">{command}</span>
        </pre>
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
    </div>
  );
};

export default CmdBlock;
