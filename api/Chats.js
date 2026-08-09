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
  const waiters = new Map(); // key → [{resolve, timer}] — held join polls
  const liveSeen = new Map(); // key → { agent, ts } — last join arm
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

  // Resolve every held join poll for this chat with the new user message. Returns how many polls
  // took delivery — a live handoff, which the sender deserves to SEE ("received…" in the panel).
  function push(pc, chat, record) {
    const k = key(pc, chat);
    const held = waiters.get(k) || [];
    waiters.delete(k);
    held.forEach(({ resolve, timer }) => {
      clearTimeout(timer);
      resolve({ messages: [record] });
    });
    return held.length;
  }

  return {
    DEFAULT_CHAT,

    // A message from either side. `from` = "you" (UI) | "agent" (CLI say). User messages wake the
    // held join polls; agent messages just land + broadcast (the UI subscribes). When a LIVE agent
    // takes delivery, the status flips to "received…" immediately — the sender sees the handoff
    // happen; the agent's own status/reply then replaces/clears it.
    send(pc, chat, { from, text, view }) {
      const record = append(pc, chat, { from, text, ...(view ? { view } : {}) });
      let delivered = false;
      if (from !== "agent") {
        delivered = push(pc, chat, record) > 0;
        if (delivered) statusMap.set(key(pc, chat), { text: "received", ts: Date.now() });
      }
      if (from === "agent") statusMap.delete(key(pc, chat)); // a reply ends the cooking line
      return { record, delivered };
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

    // JOIN — the held long-poll. Returns immediately with any user messages newer than `since`;
    // otherwise holds until one arrives or the poll times out ({ timeout: true }, CLI re-arms).
    join(pc, chat, { agent = "agent", since = 0 } = {}) {
      const k = key(pc, chat);
      liveSeen.set(k, { agent, ts: Date.now() });
      const pending = readAll(pc, chat).filter((m) => m.from !== "agent" && m.ts > since);
      if (pending.length) return Promise.resolve({ messages: pending });
      return new Promise((resolve) => {
        const entry = { resolve, timer: null };
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
    // still decays by silence — the grace window is the honest fallback.)
    leave(pc, chat) {
      liveSeen.delete(key(pc, chat));
      statusMap.delete(key(pc, chat));
      return { ok: true };
    },

    // The cooking line — set by the agent while it works; cleared by its next reply.
    setStatus(pc, chat, text) {
      const k = key(pc, chat);
      if (text) statusMap.set(k, { text, ts: Date.now() });
      else statusMap.delete(k);
      return { ok: true };
    },

    // FILE MODE — drain the SAME file from the acked offset; drainng registers the listener.
    drain(pc, chat, { listener = "hooks" } = {}) {
      const k = key(pc, chat);
      listenerSeen.set(k, { listener, ts: Date.now() });
      let acks = {};
      try { acks = JSON.parse(fs.readFileSync(ackFile(pc, chat), "utf8")); } catch {}
      const sinceTs = acks[listener] || 0;
      const pending = readAll(pc, chat).filter((m) => m.from !== "agent" && m.ts > sinceTs);
      if (pending.length) {
        acks[listener] = pending[pending.length - 1].ts;
        fs.mkdirSync(CHATS_DIR, { recursive: true });
        fs.writeFileSync(ackFile(pc, chat), JSON.stringify(acks, null, 2));
      }
      return { messages: pending };
    },

    // The bubble's truth: live/listener flags decay by silence, never by declaration.
    presence(pc) {
      const now = Date.now();
      const out = {};
      const collect = (map, flag, grace) => {
        for (const [k, v] of map) {
          const [kpc, chat] = k.split("|");
          if (kpc !== pc) continue;
          if (now - v.ts > grace) continue;
          out[chat] = out[chat] || { live: false, listener: false, status: null };
          out[chat][flag] = true;
        }
      };
      collect(liveSeen, "live", LIVE_GRACE);
      collect(listenerSeen, "listener", LISTENER_GRACE);
      for (const [k, v] of statusMap) {
        const [kpc, chat] = k.split("|");
        if (kpc !== pc) continue;
        out[chat] = out[chat] || { live: false, listener: false, status: null };
        out[chat].status = v.text;
      }
      return out;
    },
  };
};
