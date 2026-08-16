const fs = require("fs");
const path = require("path");

// THE ROOM LIVES WITH THE PROJECT (his call, 2026-08-10). A chat room is a project file, exactly
// like that project's reports, docs, manifests and stats — so the project's own process owns it,
// and the hub never opens it. The hub keeps what is genuinely its own: who is connected, who hears
// what, the long-poll, and a buffer for whoever is unreachable.
//
// WHY ITS OWN MODULE, not a few more methods on an existing one:
//   • `Plugin` already mixes OUR methods with the project's (`Object.assign(this, module)`) — it is
//     the conflation we're moving away from, not somewhere to add to.
//   • `SystemView` is runtime observability — logs, stats, cluster. Chat is not that.
// The name is deliberately unmistakable: a bare `Chat`/`Chats` would COLLIDE with a real project
// module (buAPI's Networking service has `Chats` today), and the plugin mounts into every service.
//
// WHY APPEND, not read-modify-write: routing a room through `readFile`/`writeFile` would mean
// shipping the whole file per message, two close messages interleaving (one silently lost), and a
// half-finished write truncating the room. A local append can do none of those things.
module.exports = ({ root, projectCode }) => {
  const chatsDir = () => path.resolve(root, ".systemview", "chats");
  const safe = (s) => String(s || "").replace(/[^a-zA-Z0-9._-]/g, "_");
  // The `<projectCode>.` prefix STAYS even inside the project: two projects can legitimately share
  // one working directory — systemview-test and systemview-logtest both run from this repo — and
  // without it their rooms would write to the same file. It also makes the one-time migration a
  // plain move, since the hub already names files this way.
  const stem = (chat) => `${safe(projectCode)}.${safe(chat || "main")}`;
  const roomFile = (chat) => path.join(chatsDir(), `${stem(chat)}.jsonl`);
  const cursorFile = (chat) => path.join(chatsDir(), `${stem(chat)}.ack.json`);

  const readRecords = (chat) => {
    try {
      return fs
        .readFileSync(roomFile(chat), "utf8")
        .split("\n")
        .filter(Boolean)
        .map((l) => {
          try {
            return JSON.parse(l);
          } catch {
            return null; // one corrupt line must never take the whole room down
          }
        })
        .filter(Boolean);
    } catch {
      return [];
    }
  };

  return function SystemViewChatModule() {
    // Append ONE record. The hub stamps id/ts/from/as before it gets here — this method owns
    // storage, not meaning, so it never invents or rewrites a field.
    // REGULAR functions, never arrows: systemlynx attaches `emit` to the object these are CALLED
    // on, so `this` has to bind at call time. An arrow captures the instance at construction — the
    // methods still work, but `this.emit` is silently missing and the event never fires (found
    // live: append and read passed over the wire while the subscriber heard nothing).
    this.chatAppend = function ({ chat, record } = {}) {
      if (!record) throw new Error("chatAppend needs a record");
      fs.mkdirSync(chatsDir(), { recursive: true });
      fs.appendFileSync(roomFile(chat), JSON.stringify(record) + "\n");
      // The hub subscribes to this exactly as the CLI already subscribes to `log`. It is the fast
      // path only — the hub also reconciles with chatRead, because a dropped subscription must
      // mean a LATE record, never a lost one.
      try {
        this.emit("chat", { chat: chat || "main", record });
      } catch {}
      return record;
    };

    // EDIT ONE RECORD IN PLACE (his call, 2026-08-11: "why can't you find a reference to the exact
    // place and edit it"). A TV report is a record in this room, so his answers on it belong IN that
    // record — not in a second file holding a duplicate copy of the report's text.
    //
    // Append stays the normal path; this is the narrow exception, and it is deliberately a merge of
    // named fields on ONE id rather than a general file rewrite. Written to a temp file and renamed
    // so a crash mid-write cannot leave a half-room behind: the rename is atomic, the reader either
    // sees the old file or the new one.
    this.chatUpdate = function ({ chat, id, patch } = {}) {
      if (!id || !patch) throw new Error("chatUpdate needs an id and a patch");
      const all = readRecords(chat);
      let hit = null;
      const next = all.map((r) => {
        if (r.id !== id) return r;
        hit = { ...r, ...patch, args: patch.args ? { ...(r.args || {}), ...patch.args } : r.args };
        return hit;
      });
      if (!hit) return { updated: false };
      const file = roomFile(chat);
      const tmp = `${file}.tmp`;
      fs.mkdirSync(chatsDir(), { recursive: true });
      fs.writeFileSync(tmp, next.map((r) => JSON.stringify(r)).join("\n") + "\n");
      fs.renameSync(tmp, file);
      return { updated: true, record: hit };
    };

    // Records newer than `since` (a timestamp, so it survives compaction — ids don't).
    this.chatRead = function ({ chat, since = 0, limit } = {}) {
      const all = readRecords(chat).filter((r) => !since || r.ts > since);
      return limit ? all.slice(-limit) : all;
    };

    // Drain cursors live beside the room they belong to, keyed by listener, so an agent's file-mode
    // position travels with the project instead of being stranded in the hub.
    this.chatCursor = function ({ chat, listener = "hooks", ts } = {}) {
      let acks = {};
      try {
        acks = JSON.parse(fs.readFileSync(cursorFile(chat), "utf8"));
      } catch {}
      if (ts == null) return { listener, ts: acks[listener] || 0 };
      acks[listener] = ts;
      fs.mkdirSync(chatsDir(), { recursive: true });
      fs.writeFileSync(cursorFile(chat), JSON.stringify(acks, null, 2));
      return { listener, ts };
    };

    // WHERE this project keeps its rooms. The hub asks before flushing anything it buffered,
    // because the two directories can be the SAME one: SystemView's own dev hub runs from the very
    // repo that is also a connected project, so its fallback path and this project's path resolve
    // to one place. Without this answer a flush there would "hand over" a file to itself and then
    // retire it — the room would read empty. The hub does not guess the path; the owner states it.
    this.chatDir = function () {
      return { dir: chatsDir(), projectCode, root: path.resolve(root) };
    };

    // Which rooms this project holds — the hub asks on connect so it knows what to hydrate.
    this.chatList = function () {
      try {
        const prefix = `${safe(projectCode)}.`;
        return fs
          .readdirSync(chatsDir())
          .filter((f) => f.startsWith(prefix) && f.endsWith(".jsonl") && !f.startsWith("moved-"))
          .map((f) => f.slice(prefix.length, -".jsonl".length));
      } catch {
        return [];
      }
    };

    // Counts without shipping the room — lets the hub show a fullness meter cheaply.
    this.chatStat = function ({ chat } = {}) {
      const records = readRecords(chat);
      return {
        chat: chat || "main",
        count: records.length,
        firstTs: records.length ? records[0].ts : null,
        lastTs: records.length ? records[records.length - 1].ts : null,
      };
    };
  };
};
