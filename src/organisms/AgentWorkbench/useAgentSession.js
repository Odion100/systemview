import { useCallback, useEffect, useRef, useState } from "react";
import { openAgent, hasAgentHost, listModels, setModel as hostSetModel, setThinking as hostSetThinking, canSetThinking } from "../../utils/hostAgent";
import { foldEvents, foldState, splitLaneEvents } from "./feedRows";
import { laneTicksIn } from "./laneTick";

// ONE SESSION, SUBSCRIBED FROM WHEREVER IT IS BEING WATCHED. A hook rather than a
// component because the chat and the pane need the same stream and must not open two.
//
// THE SESSION OUTLIVES THE VIEW: `dispose()` detaches this subscriber and nothing else, so closing
// a panel never stops an agent, and re-opening replays the host's own history instead of showing an
// empty box — the same rule the terminal learned the hard way.
//
// `enabled` is how a closed panel costs nothing: no host call at all until something is watching.
export default function useAgentSession({ projectCode, sessionId = "agent", gated = false, enabled = true, resume = null, cwd = null } = {}) {
  const [events, setEvents] = useState([]);
  // AUTO-COMPACTION — the live countdown chip state ({secondsLeft, hard, cancellable}), or null when
  // nothing is counting down. Driven by the host's `compaction.pending`/`cancelled`/`fired`.
  const [compactionPending, setCompactionPending] = useState(null);
  const [err, setErr] = useState("");
  const [answered, setAnswered] = useState({});
  const transportRef = useRef(null);
  const hosted = hasAgentHost();

  useEffect(() => {
    if (!hosted || !enabled || !projectCode) return undefined;
    let dead = false;
    let off = null;
    (async () => {
      try {
        const s = await openAgent({ projectCode, sessionId, gated, resume, cwd });
        if (!s) return;
        if (dead) {
          s.transport.dispose();
          return;
        }
        transportRef.current = s.transport;
        setAttached((n) => n + 1);
        setEvents(s.history);
        // AUTO-COMPACTION is a TRANSIENT control signal, not a feed row. `compaction.pending` fires
        // once a second while the countdown runs — appended, it would stack fifteen rows. So it
        // drives the chip's state instead, and `cancelled`/`fired` clear it (the host's own status
        // takes over from `fired` — the /compact it pushed narrates itself).
        off = s.transport.onEvent((ev) => {
          if (ev.kind === "compaction.pending") {
            setCompactionPending({ secondsLeft: ev.secondsLeft, hard: !!ev.hard, cancellable: ev.cancellable !== false });
            return;
          }
          if (ev.kind === "compaction.cancelled" || ev.kind === "compaction.fired") {
            setCompactionPending(null);
            return;
          }
          setEvents((cur) => [...cur, ev]);
        });
        // A VIEW ATTACHING MID-COUNTDOWN must draw the chip already in flight — the engine owns the
        // clock, so the state is there to be asked for.
        if (s.transport.compactionState) {
          s.transport
            .compactionState()
            .then((r) => {
              if (!dead && r && r.ok && r.pending)
                setCompactionPending({ ...r.pending, cancellable: r.pending.cancellable !== false });
            })
            .catch(() => {});
        }
      } catch (e) {
        setErr((e && e.message) || "could not open a session");
      }
    })();
    return () => {
      dead = true;
      if (off) off();
      if (transportRef.current) transportRef.current.dispose();
      transportRef.current = null;
    };
  }, [projectCode, sessionId, gated, hosted, enabled, resume, cwd]);

  // `as` is the VISITOR's project code — another agent reaching into this conversation through the
  // SystemView CLI. It rides the sent text so the session itself knows who spoke (an agent that
  // cannot tell its human from a visiting agent will answer the wrong one), and it rides the echo
  // row so the chat can SHOW who jumped in. His rule for the whole mechanism: identity is never
  // optional, and who is in whose chat is always on screen.
  const send = useCallback((text, as = null, images = []) => {
    const t = transportRef.current;
    // A PICTURE ALONE IS A MESSAGE. The old guard required words, which would have silently
    // swallowed a paste-and-press with nothing typed — the most natural way to send a screenshot.
    const pics = Array.isArray(images) ? images.filter(Boolean) : [];
    if (!t || (!text && !pics.length)) return false;
    t.send(as ? `[${as}]: ${text}` : text, pics);
    // HIS TURN, LOCALLY — because the host does not echo it back. This is also the reason two views
    // of ONE session are not yet the same chat: a message typed in the browser's panel produces no
    // event, so this view never learns he spoke. The fix is the host emitting `user.prompt` on
    // every send; then this echo comes out and both views show the same thing because they are
    // watching the same stream. Marked `local` so it can be deduped against that event when it
    // arrives, rather than showing his sentence twice.
    setEvents((cur) => [
      ...cur,
      {
        kind: "text",
        text,
        // the local echo shows the thumbs immediately — the host's own user.prompt carries the
        // same ones a beat later and replaces this row rather than doubling it
        images: pics.map((im) => ({ name: im.name || "image", mime: im.mime, thumb: im.thumb || "" })),
        ts: Date.now(),
        mine: true,
        local: true,
        as,
      },
    ]);
    return true;
  }, []);

  // THE USER'S WIPE IS AS REAL AS THE AGENT'S — it clears the stored board, not just this view.
  // The host emits whiteboard.updated with empty text, so every watcher clears together.
  const wipeWhiteboard = useCallback(() => {
    const t = transportRef.current;
    if (t && t.wipeWhiteboard) t.wipeWhiteboard();
  }, []);

  // STANDING LANES — a lane row is born from a spawn and dies at cleanup;
  // nothing in between kills it. These rows come from the host's run FILES, not this session's
  // events, so a refresh cannot eat a row whose worktree and branch are still on disk. Refreshed
  // whenever a lane run moves in this session; the rest of the time the files are the truth.
  // EVERY KIND OF ROW, NOT JUST LANES (2026-10-14). His report: *"the job rows disappeared, I didn't
  // delete them."* They had — a job or skill row came only from this session's in-memory events, so
  // a shell restart erased them while lane rows, read off run FILES, stood. `stripRuns` returns all
  // three kinds; `laneRuns` is the fallback for a host that predates it, which still draws the lane
  // rows rather than nothing.
  const [standingRuns, setStandingRuns] = useState([]);
  // THE TRANSPORT ATTACHING IS ITSELF A REASON TO READ.
  //
  // Measured 2026-11-12: `worklist.stripRuns("systemview-test")` answered 64 rows — the session's
  // own plan at 1/5 and two open runs among them — while his band read "nothing in flight · 0 runs
  // 0 jobs 0 lanes". The door was right and the window had never asked it.
  //
  // WHY. The read below fires from an effect whose only triggers are `events.length > 0` and the
  // lane ticks derived from events. On mount the transport is still being awaited, so the first
  // run of that effect finds nothing to call — and `events.length > 0` is a BOOLEAN: on a session
  // that comes back with no history, or comes back quiet after a shell restart, it never changes,
  // so the effect never fires again and the strip stays empty until something unrelated happens.
  //
  // A counter flipped when the transport lands gives the effect a dep that MOVES exactly once,
  // which is the one moment the read was missing.
  const [attached, setAttached] = useState(0);
  const refreshLanes = useCallback(() => {
    const t = transportRef.current;
    const read = t && (t.stripRuns || t.laneRuns);
    if (read) read.call(t).then((rows) => setStandingRuns(Array.isArray(rows) ? rows : [])).catch(() => {});
  }, []);
  // `lane.removed` IS WHY THIS LIST EXISTS. The other three kinds tick when a lane MOVES; nothing
  // ticked when one was removed, so the only reason a row ever disappeared is that his own press
  // called refreshLanes() in the callback below. A lane cleared by an agent — now possible through
  // mcp__systemview__lanes — left a ghost row sitting on a strip whose whole claim is that it reads
  // state rather than being told. The host announces it to every session in the project now, the
  // same way wipeWhiteboard announces an erase, so every watcher drops the row together.
  // WHICH EVENTS MEAN RE-READ — one list, in `laneTick.js`, where it can be claimed. It was an
  // inline reduce here and it filtered a `todo.updated` down to lane sources only, which is how a
  // skill's run stayed invisible until he reloaded the page.
  const laneTicks = laneTicksIn(events);
  useEffect(() => {
    refreshLanes();
  }, [attached, events.length > 0, laneTicks, refreshLanes]);
  // The delete is the user's press, after the row's confirm — this only removes the RECORD; the
  // worktree and branch go through the project's own git verbs before this is called.
  const deleteLaneRun = useCallback(async (id) => {
    const t = transportRef.current;
    if (t && t.deleteLaneRun) await t.deleteLaneRun(id);
    refreshLanes();
  }, [refreshLanes]);

  // MUTE A LIST — his press. Mirrors `deleteLaneRun` exactly, including the refresh: the row's
  // state is read back off the record rather than held optimistically, so a toggle that did not
  // land reads as not having landed.
  const muteRun = useCallback(async (id, muted) => {
    const t = transportRef.current;
    if (t && t.muteRun) await t.muteRun(id, muted);
    refreshLanes();
  }, [refreshLanes]);

  const answer = useCallback((id, allow) => {
    const t = transportRef.current;
    if (t && t.answerPermission) t.answerPermission(id, allow);
    // WHAT HE ALREADY DECIDED. The host does not echo the answer back as an event, so without this
    // the row keeps offering allow/deny after he has clicked one — a control that looks live and
    // does nothing, which is the same class of lie as a mic that isn't listening.
    setAnswered((a) => ({ ...a, [id]: allow }));
    setEvents((cur) => [...cur, { kind: "status", state: allow ? "working" : "ready", ts: Date.now() }]);
  }, []);

  // STOPPING IS AN EVENT, not the absence of one. The host may say nothing at all when a turn is
  // cut short, so without this the fold stays in "working" and the cooking line carries on cycling
  // through its words as if nothing happened — his catch: *"when I stopped you it went to the
  // random cooking messages instead of showing a line that the chat was interrupted."* The feed
  // says what happened, and the state stops working.
  const interrupt = useCallback(() => {
    const t = transportRef.current;
    if (t && t.interrupt) t.interrupt();
    setEvents((cur) => [...cur, { kind: "interrupted", ts: Date.now() }]);
  }, []);

  // COMPACTING IS NOT A MESSAGE. Sent as a plain turn it echoes as though he typed "/compact" into
  // the conversation, and then nothing marks it as different from any other thing being done. This
  // sends the command and says what is happening in its own voice; the host's `compaction` event
  // closes it out with "compacted".
  const compact = useCallback(() => {
    const t = transportRef.current;
    if (!t) return false;
    t.send("/compact");
    setEvents((cur) => [...cur, { kind: "compacting", ts: Date.now() }]);
    return true;
  }, []);

  // A LINE THIS AGENT SAID SOMEWHERE ELSE, shown here. Not sent anywhere — the session is already
  // this agent, so handing it back to the model would be it talking to itself. It exists because a
  // room message from the home agent otherwise has no surface at all once a session is attached.
  // THE MODELS THIS SHELL CAN OFFER, and switching to one. Both are absent on a shell that has not
  // shipped the primitive yet, and absence is answered honestly: no list means the UI draws no
  // switcher, rather than a menu that looks live and does nothing.
  const [models, setModels] = useState([]);
  useEffect(() => {
    let dead = false;
    const t = transportRef.current;
    if (!t) return undefined;
    listModels(t).then((rows) => !dead && setModels(rows));
    return () => {
      dead = true;
    };
  }, [events.length > 0]);
  // Pending until the host says otherwise: `setModel` returns before the switch is observable, and
  // the confirming `session.started` only arrives at the start of the NEXT turn. A chip that flipped
  // on the send would name the wrong model for a whole turn.
  const [switching, setSwitching] = useState(null);
  const switchModel = useCallback(async (value) => {
    const t = transportRef.current;
    if (!t) return false;
    setSwitching(value);
    const ok = await hostSetModel(t, value);
    if (!ok) setSwitching(null);
    return ok;
  }, []);

  // THE THINKING KNOB — same shape as the model switch: a request, and the chip flips on the host's
  // `session.thinking` event rather than on the send. Absent on a shell without the door.
  const [thinkingPending, setThinkingPending] = useState(null);
  const switchThinking = useCallback(async (t) => {
    const tr = transportRef.current;
    if (!tr) return false;
    setThinkingPending(t);
    const ok = await hostSetThinking(tr, t);
    if (!ok) setThinkingPending(null);
    return ok;
  }, []);
  const thinkingSwitchable = canSetThinking(transportRef.current);

  // THE PENDING FLAG DIES WHEN THE HOST CONFIRMS, and only then. The confirming `session.started`
  // carries the new model, so the moment the folded state names it, the switch really happened.
  // the split happens before the folds so a lane's activity can't puppet the owner's cooking
  // line or its meter — the owner's state comes from the owner's events
  const { main, lanes } = splitLaneEvents(events);
  const state = foldState(main);
  useEffect(() => {
    if (!switching) return;
    const now = String(state.model || "");
    if (now && (now === switching || now.includes(switching) || switching.includes(now))) setSwitching(null);
  }, [state.model, switching]);
  useEffect(() => {
    if (!thinkingPending) return;
    const now = state.thinking || {};
    if ((now.display || null) === (thinkingPending.display || null)) setThinkingPending(null);
  }, [state.thinking, thinkingPending]);

  // A MESSAGE TO THE ROOM IS NOT A SENTENCE IN THE SESSION. This pushed a bare settled "text" event,
  // so the panel drew this agent's own room message as ordinary speech — nothing marking it as
  // something that went OUT. That is what systemlynx traced from the other side: a room's own agent
  // has no `as` field (correctly — it IS the room), the forwarder sends it here, and here it lost
  // the last thing that identified it. Odion's words: he sees them appear and sees no record of the
  // message. Now the row knows where it went.
  const showSaid = useCallback((text, room = null) => {
    if (!text) return false;
    setEvents((cur) => [...cur, { kind: "text", text, ts: Date.now(), settled: true, toRoom: room || true }]);
    return true;
  }, []);

  // STOP THE COUNTDOWN — the human's press on the chip. Optimistically clears the chip; the host's
  // `compaction.cancelled` confirms and carries the snooze. Refused by the host on a hard ceiling,
  // where the chip shows no stop to press in the first place.
  const stopCompaction = useCallback(() => {
    const t = transportRef.current;
    if (!t || !t.stopCompaction) return false;
    t.stopCompaction("you");
    setCompactionPending(null);
    return true;
  }, []);

  return {
    hosted,
    live: !!transportRef.current,
    events,
    rows: foldEvents(main),
    lanes,
    state,
    err,
    answered,
    models,
    switchModel,
    switching,
    switchThinking,
    thinkingPending,
    thinkingSwitchable,
    send,
    answer,
    interrupt,
    wipeWhiteboard,
    standingRuns,
    deleteLaneRun,
    muteRun,
    compact,
    showSaid,
    compactionPending,
    stopCompaction,
  };
}
