const fs = require("fs");
const path = require("path");

// RFC-028 — the chat store. ONE JSONL file per project+chat holds the whole conversation in EVERY
// mode (his design call): join mode pushes each append down a held connection the moment it lands;
// file mode drains the same file from an acked offset at the agent's next turn boundary. The file
// is hub-local (`.systemview/chats/` beside connections.json's home) and plain JSONL — open it and
// you see exactly what reaches the agent.
//
// Presence is DERIVED, never declared: "live" = a join long-poll is currently held (or was re-armed
// within its grace window); "listener" = an inbox drain happened recently. The bubble can't lie.

// A room's files belong to ITS OWN project — the same place that project's reports and manifests
// already live. The hub only ever owned connection data; keeping every project's conversation here
// was the mistake (found live: an agent could not compact its own room, or read its own TV answers,
// because both sat in a repo that was not its own). The hub directory stays as the FALLBACK for
// projects whose root we cannot resolve yet, so nothing breaks while they update.
const HUB_CHATS = path.join(process.cwd(), ".systemview", "chats");
const DEFAULT_CHAT = "main";

const safe = (s) => String(s || "").replace(/[^a-zA-Z0-9._-]/g, "_");

// RFC-031 — what reaches an agent IDENTITY: the human's messages (always), plus other agents'
// messages when they carry a speaker (`as`, stamped server-side) that isn't you. Legacy agent
// records have NO `as` and deliver to no agent — that's the self-loop guard: an old CLI's `say`
// can never wake its own author's hold, so the upgrade can't create echo storms in rooms still
// running old holds. Commands never reach any agent (found live in RFC-029: a hold once took
// delivery of its own `kind:"command"` records).
// A VISIT IS DELIVERABLE, and it has to be said explicitly here or it silently is not. His
// correction: *"it's a completely different message than anything… it's not even just a message,
// it's a notification — yo, you're subscribed, this message is coming from…"* So a relay stopped
// being a chat line dressed in a prefix and became its own record kind — and every gate written
// against the two kinds that existed before then has to be told about the third. This is the gate
// that decides whether a waiting agent is handed it at all.
const deliverable = (m, me) =>
  m &&
  m.kind !== "command" &&
  (m.from === "you" || (m.from === "agent" && m.as && m.as !== me));
// Filenames keep the `<projectCode>.` prefix even inside a project: two projects can legitimately
// share one working directory (systemview-test and systemview-logtest both run from this repo), so
// dropping the prefix would collide their rooms. Only the DIRECTORY moves — which also makes the
// migration a plain file move, with no renaming to get wrong.
const chatFile = (dir, pc, chat) => path.join(dir, `${safe(pc)}.${safe(chat)}.jsonl`);
const ackFile = (dir, pc, chat) => path.join(dir, `${safe(pc)}.${safe(chat)}.ack.json`);

// Long-poll heartbeat + grace. The CLI re-arms immediately after every server-side timeout, so
// the poll length IS the idle heartbeat — and the grace must exceed one beat or healthy idle
// agents flicker. His push ("why 35 seconds — more like 5 or none") is right that the old
// numbers were pinned to a lazy 25s beat, so the beat itself came down: 5s polls make a 10s
// grace flicker-free. Why not ZERO: the instant a message delivers, the hold completes — with
// no grace every exchange would flash amber during the second or two even a prompt agent needs
// to re-arm, and amber would stop meaning anything. 10s = amber means "took the work and did
// NOT come back promptly", which is exactly the diagnostic he wants.
const POLL_TIMEOUT = 5000;
// How much of a room a NEVER-SEEN listener is served: enough to catch what was said moments before
// it arrived, far short of the back-catalog it never needed.
const FIRST_CONTACT_WINDOW = 15 * 60 * 1000;
const LIVE_GRACE = 10000;
// File listeners check in at turn boundaries — human-paced. Seen within 20min = still listening.
const LISTENER_GRACE = 20 * 60 * 1000;
// Cooking lines DECAY (his catch: "it still says you're cooking" hours after the fact). Auto
// lines ("received", "waiting on …") die fast — nobody may ever follow up; an agent's own status
// gets longer but still can't outlive a dead agent's silence.
const AUTO_STATUS_TTL = 3 * 60 * 1000;
const STATUS_TTL = 15 * 60 * 1000;
// The KICK cooldown — a kicked identity's joins are refused this long (the human's bouncer
// power; it's what lets the etiquette say "stay freely" instead of hedging).
const KICK_TTL = 15 * 60 * 1000;
// SPEAKING into someone else's room requires having ENTERED it (his catch, 2026-08-09: says fired
// at three rooms nobody had joined looked delivered and reached no one). A visit is held with
// re-armed `--once` joins, so this window must survive the gaps BETWEEN arms and short work
// pauses — a live-grace check would refuse honest visitors mid-cycle. 15min = "you're plausibly
// still in the room"; wander off longer and you announce yourself again by rejoining.
const VISIT_TTL = 15 * 60 * 1000;

// `chatFor(projectCode)` → that project's live `SystemViewChat` module, or null when the project
// is unreachable or predates it. Injected rather than looked up here: the store must not know
// about connections. When it returns null the hub falls back to holding the room itself.
module.exports = function Chats({ chatFor } = {}) {
  let seq = 0;
  const genId = () => `m_${Date.now().toString(36)}_${(++seq).toString(36)}`;

  // THE HUB NEVER WRITES INTO A PROJECT. An earlier pass had this function resolve each project's
  // directory and write there directly — that is the hub reaching past the plugin into a filesystem
  // it does not own, and it was rejected for exactly that reason. A project's room is served by
  // that project's own process (`SystemViewChat`); what the hub keeps here is the FALLBACK for a
  // project it cannot reach — a buffer, never an owner.
  function dirFor() {
    return HUB_CHATS;
  }

  // key `${pc}|${chat}` for everything in-memory
  const key = (pc, chat) => `${pc}|${chat || DEFAULT_CHAT}`;
  const waiters = new Map(); // key → [{identity, resolve, timer}] — held join polls
  const liveSeen = new Map(); // key → Map(identity → ts) — last join arm PER IDENTITY (RFC-031)
  // key → Map(identity → ts) — last time this identity OPENED THIS ROOM'S DOOR, in either mode
  // (a held join OR a file-mode drain). Deliberately separate from liveSeen: liveSeen drives the
  // green ring and must keep meaning "holding RIGHT NOW", while the speaking gate asks the softer
  // question "are you in this room at all". Keeping them apart is what lets a first arm whose
  // backlog dumps (drain path, exits before ever parking a hold) still count as having entered.
  const entered = new Map();
  const kicked = new Map(); // key → Map(identity → ts) — the human bounced them; joins refused for KICK_TTL
  const listenerSeen = new Map(); // key → { listener, ts } — last inbox drain
  // key → Map(identity → { text, ts }) — cooking lines PER IDENTITY (his catch: one shared line
  // was last-writer-wins, so simultaneous cooks erased each other; now every agent in the room
  // narrates on its own line). Home's identity is the pc itself.
  const statusMap = new Map();

  // ---- VISITING, WITHOUT A HOLD ------------------------------------------------------------
  // His model, and it retires the whole join/arm/cursor/drain apparatus: *"if the agents can use
  // the old — they don't even need to use the old hold mechanism to visit, because the hub is the
  // one sending the messages. When I speak, it just means it should send a visitor message to the
  // other agent."*
  //
  // A VISITOR IS A SUBSCRIPTION, not a parked poll. Speaking into a room subscribes you; the human
  // can add or remove anyone (`✕` finally means something: unsubscribe). While subscribed, what is
  // said in this room is DELIVERED into that agent's own conversation — which is why nobody needs a
  // cursor any more: their own transcript is their read position.
  //
  // On disk beside the room, so a hub restart doesn't silently unsubscribe everyone — the failure
  // that would look exactly like "the agents stopped answering".
  const visitorsMap = new Map(); // key → Map(identity → { ts, by })
  // RFC-051 — reply windows: a non-subscriber who told into this room hears its replies for a
  // while, then silence. In-memory on purpose: a window is a courtesy measured in minutes, and a
  // hub restart forgetting one costs a re-tell, not a lost conversation. Subscriptions stay on disk.
  const TELL_WINDOW = 15 * 60 * 1000;
  const tellWindows = new Map(); // key → Map(identity → { ts, count })
  const openWindows = (k) => {
    const w = tellWindows.get(k);
    if (!w) return [];
    const now = Date.now();
    for (const [id, v] of w) if (now - v.ts > TELL_WINDOW) w.delete(id);
    return [...w.keys()];
  };
  const visitorFile = (pc, chat) => path.join(dirFor(pc), `${safe(pc)}.${safe(chat || DEFAULT_CHAT)}.visitors.json`);
  function loadVisitors(pc, chat) {
    const k = key(pc, chat);
    if (visitorsMap.has(k)) return visitorsMap.get(k);
    const m = new Map();
    try {
      const raw = JSON.parse(fs.readFileSync(visitorFile(pc, chat), "utf8"));
      Object.entries(raw || {}).forEach(([id, v]) => m.set(id, v && typeof v === "object" ? v : { ts: 0, by: "agent" }));
    } catch {}
    visitorsMap.set(k, m);
    return m;
  }
  function saveVisitors(pc, chat) {
    const m = loadVisitors(pc, chat);
    try {
      fs.mkdirSync(dirFor(pc), { recursive: true });
      fs.writeFileSync(visitorFile(pc, chat), JSON.stringify(Object.fromEntries(m), null, 2));
    } catch {}
  }

  // THE MIRROR — the hub's in-memory copy of a room the PROJECT owns. Hydrated once from the
  // project, then kept current by its `chat` events. It exists so every synchronous path in this
  // file (presence, delivery, the roster, the gate) keeps working while the file itself lives in
  // the project. It is a cache and never the truth: the file wins, and a hub restart re-hydrates.
  const mirror = new Map(); // key → records[]
  // key → records[] the project was handed but never took (it blinked mid-call). Retried by the
  // reconcile sweep; empty in the normal case.
  const unsent = new Map();

  // Read the hub's OWN file for a room, bypassing the mirror. Two callers: readAll below when the
  // project isn't serving the room, and the outbox flush, whose entire job is to compare what the
  // hub buffered against what the project holds.
  function hubRecords(pc, chat) {
    try {
      return fs
        .readFileSync(chatFile(dirFor(pc), pc, chat), "utf8")
        .split("\n")
        .filter(Boolean)
        .map((l) => {
          try { return JSON.parse(l); } catch { return null; }
        })
        .filter(Boolean);
    } catch {
      return [];
    }
  }

  function readAll(pc, chat) {
    const m = mirror.get(key(pc, chat));
    if (m) return m; // project-owned room — the hub does not open its file
    return hubRecords(pc, chat);
  }

  // Every room the HUB has a file for. Distinct from the project's own `chatList()` — the flush
  // needs rooms that exist only hub-side (buffered before the project could ever serve them).
  function hubRooms(pc) {
    try {
      const prefix = `${safe(pc)}.`;
      return fs
        .readdirSync(dirFor(pc))
        .filter((f) => f.startsWith(prefix) && f.endsWith(".jsonl") && !f.startsWith("moved-"))
        .map((f) => f.slice(prefix.length, -".jsonl".length));
    } catch {
      return [];
    }
  }

  function append(pc, chat, msg) {
    const record = { id: genId(), ts: Date.now(), ...msg };
    // The project owns its room — hand it the record and let its own process append. The mirror
    // takes it immediately so everything synchronous downstream sees it; the echo back through the
    // `chat` event is deduped by id.
    const Chat = chatFor && chatFor(pc);
    if (Chat) {
      const k = key(pc, chat);
      mirror.set(k, [...(mirror.get(k) || []), record]);
      Promise.resolve()
        .then(() => Chat.chatAppend({ chat: chat || DEFAULT_CHAT, record }))
        .catch(() => {
          // The project blinked between "warm client" and "call landed" — restarting, mid-deploy,
          // socket dropped. The record is in the mirror, so the room still READS right, but the
          // project's file does not have it and nothing pulls the other way: reconcile only ever
          // reads FROM the project. So park it, and let the reconcile sweep push it across.
          unsent.set(k, [...(unsent.get(k) || []), record]);
        });
      return record;
    }
    // FALLBACK — no project to hand it to (old plugin, or unreachable). The hub holds the room.
    const dir = dirFor(pc);
    fs.mkdirSync(dir, { recursive: true });
    fs.appendFileSync(chatFile(dir, pc, chat), JSON.stringify(record) + "\n");
    return record;
  }

  // Resolve the held join polls this record is DELIVERABLE to (per identity — a speaker's own
  // hold stays parked). Returns WHICH identities took delivery — each one earns its own
  // "received" cooking line, so the human sees everyone the message landed on.
  function push(pc, chat, record) {
    const k = key(pc, chat);
    const held = waiters.get(k) || [];
    const take = held.filter((w) => deliverable(record, w.identity));
    waiters.set(k, held.filter((w) => !take.includes(w)));
    take.forEach(({ resolve, timer }) => {
      clearTimeout(timer);
      resolve({ messages: [record] });
    });
    return take.map((w) => w.identity);
  }

  // Per-identity cooking-line accessors.
  function statusOf(k) {
    return statusMap.get(k) || new Map();
  }
  function setLine(k, identity, text) {
    const lines = statusOf(k);
    lines.set(identity, { text, ts: Date.now() });
    statusMap.set(k, lines);
  }
  function clearLine(k, identity) {
    const lines = statusMap.get(k);
    if (!lines) return;
    lines.delete(identity);
    if (!lines.size) statusMap.delete(k);
  }
  function markEntered(k, identity) {
    const e = entered.get(k) || new Map();
    e.set(identity, Date.now());
    entered.set(k, e);
  }

  return {
    DEFAULT_CHAT,

    // Fill the mirror from the project that owns the room — called once when the hub warms that
    // project's chat client, and again on reconnect. Replaces wholesale: the project's file is the
    // truth, so a hydrate can only ever correct the hub, never the other way round.
    // Sorted by ts on the way in. The project's file is append-only, so a flushed outbox lands at
    // the end of it even when its records are older than what was already there; sorting here means
    // the room READS in the order it was actually spoken, whatever order the lines got written.
    hydrate(pc, chat, records) {
      const rows = (Array.isArray(records) ? records : []).slice().sort((a, b) => a.ts - b.ts);
      mirror.set(key(pc, chat), rows);
      return { count: rows.length };
    },
    // Is this room served by its project? (The UI meter and the migration both need to know.)
    isMirrored(pc, chat) {
      return mirror.has(key(pc, chat));
    },
    // How many records the hub believes this room has — uncapped, unlike history(), which takes a
    // limit. The divergence check compares this against the project's own count.
    count(pc, chat) {
      return readAll(pc, chat).length;
    },
    // A record that arrived FROM the project — either its `chat` event or the reconcile sweep.
    // Deduped by id, because our own appends echo back through the same event.
    absorb(pc, chat, record) {
      if (!record || !record.id) return null;
      const k = key(pc, chat);
      const records = mirror.get(k) || [];
      if (records.some((r) => r.id === record.id)) return null; // our own echo
      mirror.set(k, [...records, record]);
      push(pc, chat, record); // wake whoever is holding this room
      return record;
    },
    // Exposed so the api layer can put the TV state file in the SAME place as the room it belongs
    // to — one answer to "where does this project's chat live", not two.
    dirFor,

    // EDIT ONE RECORD IN PLACE. His answers on a TV report belong in the report's own record, not
    // in a second file holding a duplicate of its text. Returns false when the project's plugin
    // predates `chatUpdate` — the caller then keeps the old side-file, so an un-upgraded project
    // still saves his answers rather than dropping them.
    update(pc, chat, id, patch) {
      const k = key(pc, chat);
      const records = mirror.get(k);
      const apply = (r) =>
        r.id === id ? { ...r, ...patch, args: patch.args ? { ...(r.args || {}), ...patch.args } : r.args } : r;
      if (records) {
        if (!records.some((r) => r.id === id)) return { updated: false, reason: "no such record" };
        mirror.set(k, records.map(apply));
        const Chat = chatFor && chatFor(pc);
        if (!Chat || typeof Chat.chatUpdate !== "function")
          return { updated: false, reason: "plugin too old" };
        Promise.resolve()
          .then(() => Chat.chatUpdate({ chat: chat || DEFAULT_CHAT, id, patch }))
          .catch(() => {});
        return { updated: true };
      }
      // FALLBACK — the hub holds this room, so it does the rewrite itself. Temp file + rename, so a
      // crash mid-write can never leave a half-room on disk.
      const dir = dirFor(pc);
      const file = chatFile(dir, pc, chat);
      const all = hubRecords(pc, chat);
      if (!all.some((r) => r.id === id)) return { updated: false, reason: "no such record" };
      try {
        fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(`${file}.tmp`, all.map(apply).map((r) => JSON.stringify(r)).join("\n") + "\n");
        fs.renameSync(`${file}.tmp`, file);
        return { updated: true };
      } catch {
        return { updated: false, reason: "write failed" };
      }
    },

    // ---- THE OUTBOX -------------------------------------------------------------------------
    // Every message sent while the hub was holding a room itself lands in the hub's fallback file.
    // The moment that project's own process can serve the room, those records are in the WRONG
    // repo — not lost, but stranded, and invisible to the agent whose room it is. So the handover
    // is a flush, not a cutover: the hub hands the project what it buffered, then retires its file.
    // (Found live: 3 BUApp messages sent in the window between the file move and the client
    // warming — the room read fine in the UI off the mirror, and the project's own file was short.)
    outboxRooms(pc) {
      return hubRooms(pc);
    },
    outbox(pc, chat) {
      return hubRecords(pc, chat);
    },
    // Records a warm project failed to take. Same flush shape as the outbox, different cause.
    unsent(pc, chat) {
      return unsent.get(key(pc, chat)) || [];
    },
    clearUnsent(pc, chat, ids) {
      const k = key(pc, chat);
      const done = new Set(ids || []);
      const left = (unsent.get(k) || []).filter((r) => !done.has(r.id));
      if (left.length) unsent.set(k, left);
      else unsent.delete(k);
      return left.length;
    },
    // Retire, never delete. The flushed file stays on disk under a `.flushed` name so a bad flush
    // is recoverable by hand — chat is the one thing in here we can't regenerate.
    // The suffix goes AFTER `.jsonl`, deliberately: `<stem>.flushed.jsonl` would still match the
    // room scan, so the retired file was picked up as a room named `main.flushed` and flushed
    // again, every pass — six junk rooms in the project and a `.flushed.flushed.flushed…` chain
    // hub-side before it was caught. A retired file must not look like a room.
    retireOutbox(pc, chat) {
      const dir = dirFor(pc);
      const from = chatFile(dir, pc, chat);
      const to = `${from}.flushed`;
      try {
        fs.renameSync(from, to);
      } catch {
        return { retired: false };
      }
      // ONLY THE ROOM MOVES — the ack cursors STAY. An earlier version retired them alongside the
      // room, on the reasoning that "the project keeps its own". It does not: drain() below still
      // keys every cursor to THIS directory, because it is synchronous and the plugin's chatCursor
      // is a call over the wire. So retiring the ack file did not hand the cursors over, it deleted
      // them — and a cursor that comes back empty means the next drain replays the ENTIRE room.
      //
      // Cursors are TIMESTAMPS, not offsets into the file (which is exactly why compaction is safe),
      // so the move never invalidated them in the first place. There was nothing to migrate.
      //
      // Cost of getting this wrong, in systemlynx's words after it hit them: a full replay of old
      // instructions "is indistinguishable from new ones unless you check timestamps". They checked
      // and did not re-execute. A less careful agent would have re-run the whole night.
      return { retired: true, to };
    },

    // A message from either side. `from` = "you" (UI) | "agent" (CLI say). `as` = the speaking
    // IDENTITY on agent messages (canonicalized to a project code by the api layer — RFC-031).
    // User messages wake every held join poll; agent messages wake the OTHER identities' polls
    // (never the speaker's own — the deliverable rule). When a LIVE agent takes delivery of the
    // human's message, the status flips to "received…" immediately.
    send(pc, chat, { from, text, view, as, toRoom, relayedTo }) {
      // THE WALL AT THE WRONG DOOR — his call, verbatim: *"we need a surface that will block
      // that."* The failure it blocks happened live: a visitor spoke into this room, the home
      // agent answered IN ITS OWN ROOM — the natural move — and the reply reached no one, because
      // in the new world a visitor holds no line here. Briefings don't fix instinct; a wall does.
      // If the latest message in the room is a RECENT visitor's and that visitor is not holding a
      // live line, a home-agent say is refused WITH the exact command that reaches them. `toRoom`
      // (CLI `--room`) is the deliberate override: "I really do mean my own room."
      if (from === "agent" && (!as || as === pc) && !toRoom) {
        const REPLY_WINDOW = 15 * 60 * 1000;
        const tail = readAll(pc, chat).filter((r) => !r.kind && String(r.text || "").trim());
        // THE MOST RECENT VISITOR IN THE WINDOW, not merely the last message. Checking only the
        // tail meant one home-agent line in between disarmed the wall completely — reply, then
        // reply again, and the second one sails into the void. A visitor who spoke inside the
        // window is who you are still answering, whatever you said after them.
        const last = [...tail]
          .reverse()
          .find((r) => r.as && r.as !== pc && Date.now() - (r.ts || 0) < REPLY_WINDOW);
        if (last) {
          // SUBSCRIBED IS THE NEW "LISTENING". A visitor on the list gets this room's messages
          // delivered by the hub, so answering here genuinely reaches them — no wall needed. The
          // refusal is only for the case that actually goes nowhere: nobody subscribed, no hold.
          const held = waiters.get(key(pc, chat)) || [];
          // RFC-051: an open reply window counts as listening — the teller earned this answer.
          const listening =
            loadVisitors(pc, chat).has(last.as) ||
            openWindows(key(pc, chat)).includes(last.as) ||
            held.some((w) => w.identity === last.as);
          if (!listening)
            return {
              record: null,
              delivered: false,
              blocked: true,
              visitor: last.as,
              hint: `systemview tell ${last.as} "…" --as ${pc}`,
            };
        }
      }
      const record = append(pc, chat, {
        from,
        text,
        ...(from === "agent" && as ? { as } : {}),
        ...(view ? { view } : {}),
        // WHO THIS WENT OUT TO, ON THE MESSAGE ITSELF. His complaint, and it is the whole point of
        // the app: *"why the fuck am I not seeing it — I have to come to you, talk to you in the
        // chat, and then you come back like 'look, I got this'."* Delivery that only the recipient
        // can confirm is not observable. The subscribers are known at send time, so the record
        // carries them and his own line can say where it went.
        ...(relayedTo && relayedTo.length ? { relayedTo } : {}),
      });
      // SPEAKING NO LONGER SUBSCRIBES — RFC-051, his distinction: *"just because you spoke —
      // there's a distinction between you wanting to subscribe and sometimes you just send people
      // messages."* Speak-auto-subscribe left every one-off sender in the room forever (a briefing
      // to three rooms = three permanent subscriptions), and with no leave verb nobody ever left.
      // A tell from a non-subscriber now opens a REPLY WINDOW instead: this room's replies reach
      // them like a subscriber's for TELL_WINDOW, then it closes. Joining is `join` — deliberate,
      // its own verb, never a side effect of speaking.
      if (from === "agent" && as && as !== pc && !loadVisitors(pc, chat).has(as)) {
        const w = tellWindows.get(key(pc, chat)) || new Map();
        const prev = w.get(as);
        w.set(as, { ts: Date.now(), count: (prev ? prev.count : 0) + 1 });
        tellWindows.set(key(pc, chat), w);
      }
      const takers = push(pc, chat, record);
      // DELIVERED MEANS IT IS IN THEIR ROOM. It used to mean "a long-poll hold happened to be armed
      // at that instant", which is a fact about listening, and listening is the thing we retired —
      // his correction, and it is right: *"this feature has nothing to do with listening, we are no
      // longer needing SystemView to listen, we have a handle, we're in the shell."* A record that
      // is written to the recipient's room HAS arrived; whether anyone was standing there at that
      // millisecond is a separate question and never the sender's. `takers` still says who was
      // standing there, for the cooking lines below — it just no longer defines delivery.
      const delivered = !!record;
      const tookLive = takers.length > 0;
      const k = key(pc, chat);
      // Per-identity cooking (his catch: one shared line meant simultaneous cooks erased each
      // other). An agent's say ends the SPEAKER's own line — the reply is what the cooking
      // promised. Every identity that took live delivery flips ITS line to "received" (work
      // incoming for each of them, visitors included). An agent message nobody-live picks up
      // still cooks honestly on the home line: "waiting on <pc>" until the next wake drains it.
      if (from === "agent") clearLine(k, as || pc);
      takers.forEach((t) => setLine(k, t, "received"));
      // "Waiting on" is a VISITOR's message sitting in an empty room — never the home agent's
      // own reply, and never a clobber of a home line that's already narrating a cook.
      if (from === "agent" && as && as !== pc && !tookLive && !statusOf(k).has(pc))
        setLine(k, pc, `waiting on ${pc}`);
      return { record, delivered, tookLive };
    },

    // ---- THE VISITOR LIST ---------------------------------------------------------------------
    // Who is subscribed to this room right now, newest first. `by` records how they got on the
    // list — "spoke" (subscribed themselves) or "human" (he added them) — because a name he put
    // there by hand should not read the same as one that arrived on its own.
    // A REPLY WINDOW IS PRESENCE AND MUST BE ON THE ROSTER. It shipped invisible: `visitors` read
    // only the subscription file, so an agent hearing this room through a window appeared NOWHERE
    // while receiving every word — and he could not kick what he could not see. His words, and the
    // second time this exact defect has bitten him: *"the fucking problem is it doesn't show that
    // you're in the chat — I can't kick you out, but meanwhile you're getting my chats."*
    // (The first time was the roster lying about holds: "the agent icon lies to you about
    // visiting." Same lesson, new mechanism — anything that RECEIVES must be listed.)
    // `by: "window"` so the UI can draw it as the temporary thing it is; it expires on its own.
    visitors(pc, chat) {
      const subs = [...loadVisitors(pc, chat).entries()]
        .map(([identity, v]) => ({ identity, ts: v.ts || 0, by: v.by || "spoke" }));
      const w = tellWindows.get(key(pc, chat));
      for (const id of openWindows(key(pc, chat)))
        if (!subs.some((x) => x.identity === id))
          subs.push({ identity: id, ts: (w.get(id) || {}).ts || 0, by: "window" });
      return subs.sort((a, b) => b.ts - a.ts);
    },
    addVisitor(pc, chat, identity, by = "human") {
      if (!identity || identity === pc) return { added: false, reason: "not a visitor" };
      const m = loadVisitors(pc, chat);
      // Re-adding refreshes the timestamp but never downgrades a human's pick to "spoke": he put
      // them there on purpose and that fact outlives their next sentence.
      const prev = m.get(identity);
      m.set(identity, { ts: Date.now(), by: prev && prev.by === "human" ? "human" : by });
      saveVisitors(pc, chat);
      return { added: true, identity };
    },
    removeVisitor(pc, chat, identity) {
      const m = loadVisitors(pc, chat);
      const had = m.delete(identity);
      if (had) saveVisitors(pc, chat);
      // CLOSING THE DOOR CLOSES IT. Removing a subscription while leaving an open reply window
      // would keep delivering to someone he just threw out — a kick that does not stop the
      // messages is worse than no kick, because it says the job is done.
      const w = tellWindows.get(key(pc, chat));
      const hadWindow = !!(w && w.delete(identity));
      // Delivery stops; the record does not move. They keep whatever they already received, and
      // they fade to a "spoke" chip on their own — nothing is deleted from anyone's transcript.
      return { removed: had || hadWindow, identity, wasWindow: !had && hadWindow };
    },
    // Everyone this record should be FANNED OUT to: the subscribed visitors, minus whoever said it.
    // The hub does the sending — that is the whole point of the model, and why no agent needs to
    // hold, arm, or drain anything to be present in someone else's conversation.
    fanout(pc, chat, record) {
      const speaker = record && record.as ? record.as : record && record.from === "you" ? null : pc;
      // Subscribers plus open reply windows (RFC-051) — a window rides delivery only; it never
      // appears on the roster, because hearing an answer is not membership.
      const subs = [...loadVisitors(pc, chat).keys()];
      for (const id of openWindows(key(pc, chat))) if (!subs.includes(id)) subs.push(id);
      return subs.filter((v) => v !== speaker);
    },
    // The nudge threshold — the third windowed exchange is a conversation wearing a courtesy;
    // the CLI tells the sender so, and joining stays their decision.
    // A delivery to a windowed teller refreshes their window — "refreshed by each exchange"
    // (RFC-051), so a slow answer doesn't close the door mid-conversation. Count is NOT bumped:
    // the nudge measures the teller's own sends, not what they heard.
    touchWindow(pc, chat, identity) {
      const w = tellWindows.get(key(pc, chat));
      const v = w && w.get(identity);
      if (v && Date.now() - v.ts <= TELL_WINDOW) v.ts = Date.now();
    },
    windowState(pc, chat, identity) {
      const w = tellWindows.get(key(pc, chat));
      const v = w && w.get(identity);
      if (!v || Date.now() - v.ts > TELL_WINDOW) return null;
      return { count: v.count, joined: loadVisitors(pc, chat).has(identity) };
    },

    // RFC-029 — a COMMAND from the agent rides the same file (`kind: "command"`). It renders in
    // the thread as a command line; the open UI EXECUTES it only when it arrives on the live push
    // (loading history renders old command lines but never re-executes them — the replay rule).
    // `say` is the agent's OWN sentence for the trip — what it wants said while the window moves.
    // `label` is what the command did, generated; `say` is what the agent meant by doing it.
    command(pc, chat, { from = "agent", cmd, args, label, say }) {
      return append(pc, chat, { kind: "command", from, cmd, args: args || {}, label: label || "", say: say || "" });
    },

    // A VISIT — the hub delivering, to a SUBSCRIBER, something said in a room they are visiting.
    // Not a message from this room's people: a notification about another room, which is why it is
    // its own kind rather than a `send` with a prefix glued on the front. His words, rejecting the
    // prefix version: *"it's a distinct kind of message… it's a notification like, yo, you're
    // subscribed, this message is coming from — come on, it's supposed to be distinct."*
    //
    // `room` is where it was said. `who` is WHO said it — an agent's identity, or nobody when the
    // speaker was the human, because a person is not an agent identity and pretending otherwise is
    // exactly the bug he caught one round earlier (his sentence arriving signed by my agent).
    // Nothing here subscribes anyone: a visit is delivery, never membership.
    visit(pc, chat, { room, who = null, human = false, text }) {
      const record = append(pc, chat, {
        // NO NEW `kind`. It had one for twenty minutes and that is what stopped waking anyone:
        // consumers skip records whose kind they do not recognise (this file's own reader skips
        // `system`, mine skips `command`), so a brand-new kind is invisible everywhere by default.
        // His read was right and mine was overbuilt — *"it was a stupid easy-ass fix, a reformatting,
        // sending it a different way and rendering it a different way."* It is an ORDINARY message
        // from whoever said it, wearing extra fields that a renderer may use and no consumer has to
        // understand. `visit: true` decorates; it never gates.
        visit: true,
        // IT IS STILL A MESSAGE FROM WHOEVER SAID IT — his exact framing, and the thing I broke by
        // taking "distinct kind" too literally on the first pass: *"I'm supposed to read it as MY
        // message too, just another one of my messages, but coming from a different room because of
        // subscription."* A record whose `from` is neither "you" nor "agent" is invisible to every
        // consumer written before this kind existed — every panel, every hold, every agent's reader
        // — so a "distinct kind" that replaces the author is a message that arrives nowhere. It is
        // BOTH: the ordinary author underneath, and the visit metadata on top for anyone who knows
        // how to draw it. Old readers see his message; new ones see where it came from.
        // THE SHAPE THAT WORKED, WITH THE LABEL FIXED — which is all he ever asked for. It arrived
        // and got answered in this exact form; the single thing wrong with it was that his sentence
        // read as though the agent had written it. So nothing about the transport changes, and the
        // fix lives where the problem was: what the reader SEES.
        from: "agent",
        as: human ? room : who,
        room,
        who: human ? null : who,
        human: !!human,
        // The room is in the text as well as the field, because a reader that predates this kind
        // shows the text and nothing else — and "which room" is the one fact that stops it reading
        // as a sentence from nowhere.
        // WHO SAID IT, IN THE ONE FIELD EVERY READER SHOWS. A peer may or may not know about
        // `human: true`; it will always print the text. So the text says it: this came from the
        // human in that room, not from that room's agent.
        text: human ? `[in ${room} · human] ${text || ""}` : `[in ${room}] ${text || ""}`,
      });
      const takers = push(pc, chat, record);
      takers.forEach((t) => setLine(key(pc, chat), t, "received"));
      return { record, delivered: takers.length > 0 };
    },

    history(pc, chat, { limit = 200 } = {}) {
      const all = readAll(pc, chat);
      return limit ? all.slice(-limit) : all;
    },

    // Rooms this project has, from BOTH sides: the mirror (rooms its own process serves) and the
    // hub's directory (rooms still in fallback, or not yet flushed). Listing only the hub dir was
    // wrong the moment a project started serving itself — its rooms have no hub file to find.
    chats(pc) {
      const prefix = `${pc}|`;
      const mirrored = [...mirror.keys()]
        .filter((k) => k.startsWith(prefix))
        .map((k) => k.slice(prefix.length));
      return [...new Set([...mirrored, ...hubRooms(pc)])];
    },

    // RFC-031 — the room announces its own comings and goings (his ask: "you need to SEE
    // systemview-logtest left"). A system record: rides the file like everything else, renders
    // as a subtle centered line, and — because `from` is neither "you" nor "agent" — is never
    // delivered to any agent's hold or inbox.
    system(pc, chat, { event, who }) {
      const text = `${who} ${
        event === "joined" ? "joined the room" : event === "kicked" ? "was kicked from the room" : "left the room"
      }`;
      return append(pc, chat, { kind: "system", from: "system", event, who, text });
    },

    // Arrival detection for the door above: true when this identity was NOT freshly live (first
    // join, or back after grace decay). Read-only — join() still does the writing.
    isArrival(pc, chat, identity) {
      const seen = liveSeen.get(key(pc, chat));
      const ts = seen && seen.get(identity);
      return !(ts && Date.now() - ts < LIVE_GRACE);
    },

    // "Did this identity ENTER this room?" — the speaking gate's half of presence. isPresent()
    // answers "is it live RIGHT NOW" (one heartbeat); this answers "is it in the room at all",
    // which is what a visitor's right to speak turns on.
    hasEntered(pc, chat, identity) {
      const e = entered.get(key(pc, chat));
      const ts = e && e.get(identity);
      return !!(ts && Date.now() - ts < VISIT_TTL);
    },

    // SPEAKING IS ARRIVING. Entering used to be a separate act you had to perform first, and it
    // existed to prove the visitor was really there — a hold in the room was the proof. With holds
    // gone (a message now goes straight into the other agent's conversation) that gate only stopped
    // visitors from visiting: *"you should be able to jump in other people's conversations
    // directly."* The identity is verified against the real project list at the CLI's front door,
    // which is the proof that actually mattered. Presence still gets marked, so the room shows who
    // walked in — it is recorded BY the visit rather than demanded before it.
    enterBySpeaking(pc, chat, identity) {
      markEntered(key(pc, chat), identity);
    },

    // Departure detection for leave(): only announce someone who was actually here.
    isPresent(pc, chat, identity) {
      const seen = liveSeen.get(key(pc, chat));
      const ts = seen && seen.get(identity);
      return !!(ts && Date.now() - ts < LIVE_GRACE);
    },

    // THE KICK — the human bounces an identity: its held polls resolve {kicked} right now, its
    // presence drops, the room gets a system line, and rejoins are refused for KICK_TTL. This is
    // the bouncer power that lets visiting etiquette be "stay freely" instead of hedging.
    kick(pc, chat, { identity }) {
      const k = key(pc, chat);
      const kmap = kicked.get(k) || new Map();
      kmap.set(identity, Date.now());
      kicked.set(k, kmap);
      const seen = liveSeen.get(k);
      if (seen) {
        seen.delete(identity);
        if (!seen.size) liveSeen.delete(k);
      }
      const held = waiters.get(k) || [];
      const bounced = held.filter((w) => w.identity === identity);
      waiters.set(k, held.filter((w) => w.identity !== identity));
      bounced.forEach(({ resolve, timer }) => {
        clearTimeout(timer);
        resolve({ kicked: true });
      });
      clearLine(k, identity); // a kicked identity's cooking line goes with it
      // …and its right to speak. The bouncer has to actually silence, or a kicked visitor keeps
      // talking for the rest of VISIT_TTL. (leave() deliberately does NOT clear this: goodbye()
      // fires on SIGTERM and would race an arm-first re-arm, and someone who just said goodbye
      // adding one more line isn't the drive-by this gate exists to stop.)
      const ent = entered.get(k);
      if (ent) {
        ent.delete(identity);
        if (!ent.size) entered.delete(k);
      }
      const record = this.system(pc, chat, { event: "kicked", who: identity });
      return { record, hadHold: bounced.length > 0 };
    },

    // JOIN — the held long-poll. `identity` = the project this hold speaks AS (canonicalized by
    // the api layer; identity ≠ pc means a VISITOR — RFC-031). Returns immediately with anything
    // deliverable newer than `since`; otherwise holds until delivery or poll timeout (CLI re-arms).
    join(pc, chat, { identity, since = 0 } = {}) {
      const k = key(pc, chat);
      const me = identity || pc;
      const kickTs = kicked.get(k) && kicked.get(k).get(me);
      if (kickTs && Date.now() - kickTs < KICK_TTL) return Promise.resolve({ kicked: true });
      const seen = liveSeen.get(k) || new Map();
      seen.set(me, Date.now());
      liveSeen.set(k, seen);
      markEntered(k, me);
      const pending = readAll(pc, chat).filter((m) => deliverable(m, me) && m.ts > since);
      if (pending.length) return Promise.resolve({ messages: pending });
      return new Promise((resolve) => {
        const entry = { identity: me, resolve, timer: null };
        entry.timer = setTimeout(() => {
          const held = waiters.get(k) || [];
          waiters.set(k, held.filter((w) => w !== entry));
          resolve({ timeout: true });
        }, POLL_TIMEOUT);
        waiters.set(k, [...(waiters.get(k) || []), entry]);
      });
    },

    // An explicit goodbye — the CLI sends this on SIGINT/SIGTERM so a deliberate disconnect shows
    // in the UI within one presence poll instead of waiting out the grace window. (An abrupt kill
    // still decays by silence — the grace window is the honest fallback.) Per-identity: a visitor
    // jumping out must not take the home agent's presence with it (RFC-031).
    leave(pc, chat, { identity } = {}) {
      const k = key(pc, chat);
      const me = identity || pc;
      const seen = liveSeen.get(k);
      if (seen) {
        seen.delete(me);
        if (!seen.size) liveSeen.delete(k);
      }
      clearLine(k, me); // a deliberate exit ends that identity's own cooking line
      return { ok: true };
    },

    // The cooking line — set by the agent while it works, RE-SET as the work moves (narrated
    // cooking), cleared by its next reply. `as` = the identity cooking; each identity owns its
    // own line (RFC-031: a VISITOR's cooking renders in its plum, with its name).
    setStatus(pc, chat, text, as) {
      const k = key(pc, chat);
      const identity = as || pc;
      if (text) setLine(k, identity, text);
      else clearLine(k, identity);
      return { ok: true };
    },

    // FILE MODE — drain the SAME file from the acked offset; draining registers the listener.
    // `identity` filters delivery (RFC-031: a file-mode agent hears visitors too, never itself);
    // the ack cursor stays keyed by `listener` so existing hook cursors survive the upgrade.
    drain(pc, chat, { listener = "hooks", identity, history = false } = {}) {
      const k = key(pc, chat);
      const me = identity || pc;
      listenerSeen.set(k, { listener, ts: Date.now() });
      markEntered(k, me); // draining a room is entering it — file-mode agents speak too
      let acks = {};
      try { acks = JSON.parse(fs.readFileSync(ackFile(dirFor(pc), pc, chat), "utf8")); } catch {}
      // RFC-039 — A NEW CURSOR IS BORN AT NOW, not at zero. An identity that has never drained used
      // to start from the beginning of the room, so FIRST CONTACT served the entire history as if it
      // were unread traffic — an agent's first act in a room was timestamp-filtering hundreds of
      // stale records to discover that nothing had happened. (Both of the "full replay" reports we
      // chased were first joins under a fresh identity, not a lost cursor.) `history: true` opts into
      // the back-catalog for anyone who actually wants it.
      // RFC-039, corrected by its own test suite. First contact used to start at ZERO — an identity
      // that had never drained was served the entire room as if it were unread, so an agent's first
      // act was timestamp-filtering hundreds of stale records. My first fix started it at NOW, and
      // the suite immediately caught what that costs: "I said it right before you joined" is a real
      // case this system deliberately protects (see join()'s pre-drain), and a brand-new identity
      // heard nothing at all.
      //
      // So first contact starts at WHAT IS STILL WARM: the recent window, not the whole history and
      // not silence. `history: true` still asks for the back-catalog on purpose.
      const firstContact = !(listener in acks);
      const sinceTs = history ? 0 : firstContact ? Date.now() - FIRST_CONTACT_WINDOW : acks[listener] || 0;
      const pending = readAll(pc, chat).filter((m) => deliverable(m, me) && m.ts > sinceTs);
      // The home agent's turn-boundary pickup: a "waiting on <pc>" line flips to "received" the
      // moment its drain collects the queue — the human watches the handoff happen.
      if (pending.length && me === pc) {
        const st = statusOf(k).get(pc);
        if (st && st.text === `waiting on ${pc}`) setLine(k, pc, "received");
      }
      if (pending.length) {
        acks[listener] = pending[pending.length - 1].ts;
        const dir = dirFor(pc);
        fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(ackFile(dir, pc, chat), JSON.stringify(acks, null, 2));
      }
      return { messages: pending };
    },

    // The reaper — run on an interval by the api layer. Expired VISITOR identities get a real
    // "left the room" line (the drop-detection: a silent death is still a visible exit); expired
    // home identities just decay (their ring is their story). Stale cooking lines die by TTL.
    // Returns the events so the caller can push updates to open panels.
    sweep() {
      const now = Date.now();
      const events = [];
      for (const [k, seen] of liveSeen) {
        const [pc, chat] = k.split("|");
        for (const [identity, ts] of seen) {
          if (now - ts <= LIVE_GRACE) continue;
          seen.delete(identity);
          const record =
            identity !== pc ? this.system(pc, chat, { event: "left", who: identity }) : null;
          // A visitor the room just announced as GONE can't keep cooking (his catch: a lingering
          // line for someone the roster shows absent reads as a ghost). Home lines stay — a home
          // agent narrates with its hold down mid-work all the time.
          if (identity !== pc) clearLine(key(pc, chat), identity);
          events.push({ pc, chat, identity, record, statusCleared: identity !== pc });
        }
        if (!seen.size) liveSeen.delete(k);
      }
      for (const [k, lines] of statusMap) {
        const [pc, chat] = k.split("|");
        for (const [identity, v] of lines) {
          const auto = v.text === "received" || v.text.startsWith("waiting on ");
          // A cooking claim needs a living cook (his catch: an idle agent "still cooking"):
          // an identity with NO fresh presence signal — no live stamp, and for the home agent
          // no recent drain either — gets the short TTL even on a self-set line. A present
          // agent's narration keeps the full 15 minutes.
          const seen = liveSeen.get(k);
          const liveFresh = !!(seen && seen.get(identity) && now - seen.get(identity) < LIVE_GRACE);
          const listenerFresh =
            identity === pc &&
            !!(listenerSeen.get(k) && now - listenerSeen.get(k).ts < LISTENER_GRACE);
          const ttl = auto || !(liveFresh || listenerFresh) ? AUTO_STATUS_TTL : STATUS_TTL;
          if (now - v.ts > ttl) {
            lines.delete(identity);
            events.push({ pc, chat, identity, record: null, statusCleared: true });
          }
        }
        if (!lines.size) statusMap.delete(k);
      }
      return events;
    },

    // The bubble's truth: live/listener flags decay by silence, never by declaration. RFC-031:
    // `live` = the room's OWN agent holds the line; `agents` = the full roster of identities
    // currently in (home + visitors); `visiting` = rooms this project's agent is off in.
    presence(pc, opts = {}) {
      // Still holding a line here, right now — the only thing a stale hold may still prove.
      const held = (p, chat, identity) => {
        const seen = liveSeen.get(key(p, chat));
        const ts = seen && seen.get(identity);
        return !!ts && Date.now() - ts <= LIVE_GRACE;
      };
      const now = Date.now();
      const out = {};
      const entry = (chat) =>
        (out[chat] = out[chat] || { live: false, listener: false, status: null, agents: [], visitors: [], visiting: [] });
      for (const [k, seen] of liveSeen) {
        const [kpc, chat] = k.split("|");
        for (const [identity, ts] of seen) {
          if (now - ts > LIVE_GRACE) continue;
          if (kpc === pc) {
            const e = entry(chat);
            if (!e.agents.includes(identity)) e.agents.push(identity);
            if (identity === pc) e.live = true;
            // NOT a visitor. Being seen in a room is presence — `agents` says so, and that is the
            // honest word for it. Visiting is a subscription, and mixing the two is what put two
            // names on systemlynx's strip when its list was empty: a couple of `systemview join`
            // processes still parked in terminals from this morning. His read was exact — *"it's
            // reading recent messages... it's reading the wrong thing."*
          }
          // NOTE: "this agent is visiting elsewhere" used to be derived HERE, from a live hold in
          // another room. See the visitorsMap pass below for why that had to go.
        }
      }
      for (const [k, v] of listenerSeen) {
        const [kpc, chat] = k.split("|");
        if (kpc !== pc) continue;
        if (now - v.ts > LISTENER_GRACE) continue;
        entry(chat).listener = true;
      }
      // VISITING IS THE SUBSCRIPTION LIST, FULL STOP. Above, `visitors` is built from LIVE HOLDS —
      // who was recently seen holding a line in this room. That was the old model and it is the one
      // we retired: in the new one nobody holds anything, the hub sends, and being a visitor means
      // being on the list. So the badge kept claiming someone was visiting after they had been
      // removed, because it was answering a question nobody asks any more — his catch: *"if I remove
      // systemview from this room, nothing updates; the agent icon lies to you about visiting."*
      //
      // A hold is still worth showing (an agent genuinely parked here), so the two are UNIONED
      // rather than one replacing the other — but the list is the authority, and someone taken off
      // it stops being a visitor immediately, whatever any stale hold remembers.
      // VISITING IS THE SUBSCRIPTION LIST, BOTH DIRECTIONS. Who is visiting ME is one pass; where I
      // am visiting is the other, and BOTH used to be read off live holds. That is the retired
      // model — and worse than merely outdated, because a `systemview join` left running in some
      // terminal months ago still counts as a hold, so agents showed a VISITING ring for rooms
      // nobody had subscribed them to and kicking could not clear it. His catch, twice: *"there's
      // nobody in autobot's room but it still shows, and several people still show."*
      //
      // The list is the authority in both directions. A hold may still add someone genuinely parked
      // in this room (union below) — it may not invent a visit that no list agrees with.
      for (const [k] of visitorsMap) {
        const [kpc, chat] = k.split("|");
        const subs = [...loadVisitors(kpc, chat).keys()];
        if (kpc === pc) {
          const e = entry(chat);
          e.subscribed = subs;
          // THE LIST, AND ONLY THE LIST. No union with holds: a hold proved presence under the old
          // model and proves nothing about subscription under this one, so letting it add a name
          // here just re-opens the same lie through a smaller door.
          e.visitors = subs;
        } else if (subs.includes(pc)) {
          // This project is on SOMEONE ELSE'S list — that, and only that, is visiting.
          const e = entry(DEFAULT_CHAT);
          if (!e.visiting.includes(kpc)) e.visiting.push(kpc);
        }
      }
      for (const [k, lines] of statusMap) {
        const [kpc, chat] = k.split("|");
        if (kpc !== pc) continue;
        const e = entry(chat);
        // `statuses` = every identity's live cooking line (home first, then visitors by recency).
        // Legacy `status`/`statusAs` mirror the home line — or the first visitor's — so older
        // bundles and the peek keep a single-line story.
        e.statuses = [...lines.entries()]
          .map(([identity, v]) => ({ as: identity === pc ? null : identity, text: v.text, ts: v.ts }))
          .sort((a, b) => (a.as === null ? -1 : b.as === null ? 1 : a.ts - b.ts));
        const first = e.statuses[0];
        e.status = first ? first.text : null;
        e.statusAs = first ? first.as : null;
      }
      // The fullness meter's feed (his rule: "you guys aren't going to always remember [to
      // compact] so I need to be able to SEE it"): true record count per chat — history loads
      // are capped, so the count must come from the file itself.
      // `pending` (his ask: "how many unread messages you have" while heads-down): deliverable-
      // to-home records newer than the HOME agent's freshest ack cursor — "hooks" is home's,
      // and a `join:<name>` cursor counts as home when opts.isHome says the name canons to it.
      entry(DEFAULT_CHAT);
      const isHome = opts.isHome || ((name) => name === pc);
      for (const chat of Object.keys(out)) {
        const all = readAll(pc, chat);
        out[chat].records = all.length;
        let acks = {};
        try { acks = JSON.parse(fs.readFileSync(ackFile(dirFor(pc), pc, chat), "utf8")); } catch {}
        let maxTs = 0;
        for (const [lk, ts] of Object.entries(acks)) {
          const name = lk === "hooks" ? pc : lk.startsWith("join:") ? lk.slice(5) : null;
          if (name && isHome(name) && ts > maxTs) maxTs = ts;
        }
        out[chat].pending = all.filter((m) => deliverable(m, pc) && m.ts > maxTs).length;
        // Read receipts (his ask: "messages can say read once they're read"): everything at or
        // before this ts has actually been DRAINED by the home agent — not delivered-to-a-hold,
        // collected. The UI marks the human's bubbles off it.
        out[chat].agentSeen = maxTs;
      }
      return out;
    },
  };
};
