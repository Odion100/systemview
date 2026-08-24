import { useCallback, useEffect, useRef, useState } from "react";
import { openAgent, hasAgentHost, listModels, setModel as hostSetModel } from "../../utils/hostAgent";
import { foldEvents, foldState } from "./feedRows";

// RFC-046 — ONE SESSION, SUBSCRIBED FROM WHEREVER IT IS BEING WATCHED. A hook rather than a
// component because the chat and the pane need the same stream and must not open two.
//
// THE SESSION OUTLIVES THE VIEW: `dispose()` detaches this subscriber and nothing else, so closing
// a panel never stops an agent, and re-opening replays the host's own history instead of showing an
// empty box — the same rule the terminal learned the hard way.
//
// `enabled` is how a closed panel costs nothing: no host call at all until something is watching.
export default function useAgentSession({ projectCode, sessionId = "agent", gated = false, enabled = true, resume = null, cwd = null } = {}) {
  const [events, setEvents] = useState([]);
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
        setEvents(s.history);
        off = s.transport.onEvent((ev) => setEvents((cur) => [...cur, ev]));
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
  const send = useCallback((text, as = null) => {
    const t = transportRef.current;
    if (!t || !text) return false;
    t.send(as ? `[${as}]: ${text}` : text);
    // HIS TURN, LOCALLY — because the host does not echo it back. This is also the reason two views
    // of ONE session are not yet the same chat: a message typed in the browser's panel produces no
    // event, so this view never learns he spoke. The fix is the host emitting `user.prompt` on
    // every send; then this echo comes out and both views show the same thing because they are
    // watching the same stream. Marked `local` so it can be deduped against that event when it
    // arrives, rather than showing his sentence twice.
    setEvents((cur) => [...cur, { kind: "text", text, ts: Date.now(), mine: true, local: true, as }]);
    return true;
  }, []);

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

  // THE PENDING FLAG DIES WHEN THE HOST CONFIRMS, and only then. The confirming `session.started`
  // carries the new model, so the moment the folded state names it, the switch really happened.
  const state = foldState(events);
  useEffect(() => {
    if (!switching) return;
    const now = String(state.model || "");
    if (now && (now === switching || now.includes(switching) || switching.includes(now))) setSwitching(null);
  }, [state.model, switching]);

  const showSaid = useCallback((text) => {
    if (!text) return false;
    setEvents((cur) => [...cur, { kind: "text", text, ts: Date.now(), settled: true }]);
    return true;
  }, []);

  return {
    hosted,
    live: !!transportRef.current,
    events,
    rows: foldEvents(events),
    state,
    err,
    answered,
    models,
    switchModel,
    switching,
    send,
    answer,
    interrupt,
    compact,
    showSaid,
  };
}
