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

const CHATS_DIR = path.join(process.cwd(), ".systemview", "chats");
const DEFAULT_CHAT = "main";

const safe = (s) => String(s || "").replace(/[^a-zA-Z0-9._-]/g, "_");

// RFC-031 — what reaches an agent IDENTITY: the human's messages (always), plus other agents'
// messages when they carry a speaker (`as`, stamped server-side) that isn't you. Legacy agent
// records have NO `as` and deliver to no agent — that's the self-loop guard: an old CLI's `say`
// can never wake its own author's hold, so the upgrade can't create echo storms in rooms still
// running old holds. Commands never reach any agent (found live in RFC-029: a hold once took
// delivery of its own `kind:"command"` records).
const deliverable = (m, me) =>
  m && m.kind !== "command" && (m.from === "you" || (m.from === "agent" && m.as && m.as !== me));
const chatFile = (pc, chat) => path.join(CHATS_DIR, `${safe(pc)}.${safe(chat)}.jsonl`);
const ackFile = (pc, chat) => path.join(CHATS_DIR, `${safe(pc)}.${safe(chat)}.ack.json`);

// Long-poll grace: the CLI re-arms immediately after each 25s server-side timeout, so a live agent
// is never unseen for more than a few seconds; 75s of silence = it's gone.
const POLL_TIMEOUT = 25000;
const LIVE_GRACE = 75000;
// File listeners check in at turn boundaries — human-paced. Seen within 20min = still listening.
const LISTENER_GRACE = 20 * 60 * 1000;

module.exports = function Chats() {
  let seq = 0;
  const genId = () => `m_${Date.now().toString(36)}_${(++seq).toString(36)}`;

  // key `${pc}|${chat}` for everything in-memory
  const key = (pc, chat) => `${pc}|${chat || DEFAULT_CHAT}`;
  const waiters = new Map(); // key → [{identity, resolve, timer}] — held join polls
  const liveSeen = new Map(); // key → Map(identity → ts) — last join arm PER IDENTITY (RFC-031)
  const listenerSeen = new Map(); // key → { listener, ts } — last inbox drain
  const statusMap = new Map(); // key → { text, ts } — the cooking line

  function readAll(pc, chat) {
    try {
      return fs
        .readFileSync(chatFile(pc, chat), "utf8")
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

  function append(pc, chat, msg) {
    fs.mkdirSync(CHATS_DIR, { recursive: true });
    const record = { id: genId(), ts: Date.now(), ...msg };
    fs.appendFileSync(chatFile(pc, chat), JSON.stringify(record) + "\n");
    return record;
  }

  // Resolve the held join polls this record is DELIVERABLE to (per identity — a speaker's own
  // hold stays parked). Returns how many polls took delivery — a live handoff, which the sender
  // deserves to SEE ("received…" in the panel).
  function push(pc, chat, record) {
    const k = key(pc, chat);
    const held = waiters.get(k) || [];
    const take = held.filter((w) => deliverable(record, w.identity));
    waiters.set(k, held.filter((w) => !take.includes(w)));
    take.forEach(({ resolve, timer }) => {
      clearTimeout(timer);
      resolve({ messages: [record] });
    });
    return take.length;
  }

  return {
    DEFAULT_CHAT,

    // A message from either side. `from` = "you" (UI) | "agent" (CLI say). `as` = the speaking
    // IDENTITY on agent messages (canonicalized to a project code by the api layer — RFC-031).
    // User messages wake every held join poll; agent messages wake the OTHER identities' polls
    // (never the speaker's own — the deliverable rule). When a LIVE agent takes delivery of the
    // human's message, the status flips to "received…" immediately.
    send(pc, chat, { from, text, view, as }) {
      const record = append(pc, chat, {
        from,
        text,
        ...(from === "agent" && as ? { as } : {}),
        ...(view ? { view } : {}),
      });
      const delivered = push(pc, chat, record) > 0;
      if (from !== "agent" && delivered) statusMap.set(key(pc, chat), { text: "received", ts: Date.now() });
      if (from === "agent") statusMap.delete(key(pc, chat)); // a reply ends the cooking line
      return { record, delivered };
    },

    // RFC-029 — a COMMAND from the agent rides the same file (`kind: "command"`). It renders in
    // the thread as a command line; the open UI EXECUTES it only when it arrives on the live push
    // (loading history renders old command lines but never re-executes them — the replay rule).
    command(pc, chat, { from = "agent", cmd, args, label }) {
      return append(pc, chat, { kind: "command", from, cmd, args: args || {}, label: label || "" });
    },

    history(pc, chat, { limit = 200 } = {}) {
      const all = readAll(pc, chat);
      return limit ? all.slice(-limit) : all;
    },

    chats(pc) {
      try {
        const prefix = `${safe(pc)}.`;
        return fs
          .readdirSync(CHATS_DIR)
          .filter((f) => f.startsWith(prefix) && f.endsWith(".jsonl"))
          .map((f) => f.slice(prefix.length, -".jsonl".length));
      } catch {
        return [];
      }
    },

    // RFC-031 — the room announces its own comings and goings (his ask: "you need to SEE
    // systemview-logtest left"). A system record: rides the file like everything else, renders
    // as a subtle centered line, and — because `from` is neither "you" nor "agent" — is never
    // delivered to any agent's hold or inbox.
    system(pc, chat, { event, who }) {
      const text = `${who} ${event === "joined" ? "joined the room" : "left the room"}`;
      return append(pc, chat, { kind: "system", from: "system", event, who, text });
    },

    // Arrival detection for the door above: true when this identity was NOT freshly live (first
    // join, or back after grace decay). Read-only — join() still does the writing.
    isArrival(pc, chat, identity) {
      const seen = liveSeen.get(key(pc, chat));
      const ts = seen && seen.get(identity);
      return !(ts && Date.now() - ts < LIVE_GRACE);
    },

    // Departure detection for leave(): only announce someone who was actually here.
    isPresent(pc, chat, identity) {
      const seen = liveSeen.get(key(pc, chat));
      const ts = seen && seen.get(identity);
      return !!(ts && Date.now() - ts < LIVE_GRACE);
    },

    // JOIN — the held long-poll. `identity` = the project this hold speaks AS (canonicalized by
    // the api layer; identity ≠ pc means a VISITOR — RFC-031). Returns immediately with anything
    // deliverable newer than `since`; otherwise holds until delivery or poll timeout (CLI re-arms).
    join(pc, chat, { identity, since = 0 } = {}) {
      const k = key(pc, chat);
      const me = identity || pc;
      const seen = liveSeen.get(k) || new Map();
      seen.set(me, Date.now());
      liveSeen.set(k, seen);
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
      if (me === pc) statusMap.delete(k); // only the home agent's exit ends the cooking line
      return { ok: true };
    },

    // The cooking line — set by the agent while it works; cleared by its next reply.
    setStatus(pc, chat, text) {
      const k = key(pc, chat);
      if (text) statusMap.set(k, { text, ts: Date.now() });
      else statusMap.delete(k);
      return { ok: true };
    },

    // FILE MODE — drain the SAME file from the acked offset; draining registers the listener.
    // `identity` filters delivery (RFC-031: a file-mode agent hears visitors too, never itself);
    // the ack cursor stays keyed by `listener` so existing hook cursors survive the upgrade.
    drain(pc, chat, { listener = "hooks", identity } = {}) {
      const k = key(pc, chat);
      const me = identity || pc;
      listenerSeen.set(k, { listener, ts: Date.now() });
      let acks = {};
      try { acks = JSON.parse(fs.readFileSync(ackFile(pc, chat), "utf8")); } catch {}
      const sinceTs = acks[listener] || 0;
      const pending = readAll(pc, chat).filter((m) => deliverable(m, me) && m.ts > sinceTs);
      if (pending.length) {
        acks[listener] = pending[pending.length - 1].ts;
        fs.mkdirSync(CHATS_DIR, { recursive: true });
        fs.writeFileSync(ackFile(pc, chat), JSON.stringify(acks, null, 2));
      }
      return { messages: pending };
    },

    // The bubble's truth: live/listener flags decay by silence, never by declaration. RFC-031:
    // `live` = the room's OWN agent holds the line; `agents` = the full roster of identities
    // currently in (home + visitors); `visiting` = rooms this project's agent is off in.
    presence(pc) {
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
            else if (!e.visitors.includes(identity)) e.visitors.push(identity);
          } else if (identity === pc) {
            // This project's agent is live in ANOTHER room — its own bot should show it.
            const e = entry(DEFAULT_CHAT);
            if (!e.visiting.includes(kpc)) e.visiting.push(kpc);
          }
        }
      }
      for (const [k, v] of listenerSeen) {
        const [kpc, chat] = k.split("|");
        if (kpc !== pc) continue;
        if (now - v.ts > LISTENER_GRACE) continue;
        entry(chat).listener = true;
      }
      for (const [k, v] of statusMap) {
        const [kpc, chat] = k.split("|");
        if (kpc !== pc) continue;
        entry(chat).status = v.text;
      }
      return out;
    },
  };
};
