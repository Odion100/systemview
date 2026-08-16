// systemview-test/methods/Api.js — the `Api` module of SystemViewCore: real calls against the
// hub's own service API, through the same door the UI and the CLI use.
const { createClient } = require("systemlynx");
const HUB = "http://localhost:3000/systemview/api";

async function hub() {
  const { SystemView } = await createClient().loadService(HUB);
  return SystemView;
}

module.exports = {
  async getProjects() {
    const SystemView = await hub();
    const projects = await SystemView.getProjects();
    return {
      ok: true,
      projectCount: Object.keys(projects).length,
      projects: Object.keys(projects),
    };
  },
  async getServices({ projectCode = "systemview-test" } = {}) {
    const SystemView = await hub();
    const services = await SystemView.getServices(projectCode);
    return {
      ok: true,
      serviceCount: (services || []).length,
      services: (services || []).map((s) => s.serviceId),
    };
  },
  // RFC-031 delivery rules, proven through the hub's real chat door. Uses a scratch chat
  // ("self-test") so the main room stays clean; texts and drain listeners are run-stamped so
  // every run asserts on its own messages only.
  async chatDeliveryRules() {
    const SystemView = await hub();
    const pc = "systemview-test";
    const chat = "self-test";
    const stamp = Date.now();
    await SystemView.chatSend(pc, { chat, from: "you", text: `human ${stamp}` });
    await SystemView.chatSend(pc, { chat, from: "agent", as: pc, text: `home ${stamp}` });
    // The visitor ENTERS before it speaks — the speaking gate (see chatSpeakingGate below) refuses
    // a say from an identity that never opened this room's door. A drain is one of the two doors.
    await SystemView.chatDrain(pc, { chat, listener: `enter:${stamp}`, as: "systemview-logtest" });
    await SystemView.chatSend(pc, { chat, from: "agent", as: "systemview-logtest", text: `visitor ${stamp}` });
    await SystemView.chatCommand(pc, { chat, cmd: "nav", args: {}, label: "delivery check" });
    // ENTERING a room must wake NOBODY — arrival/departure lines are `from: "system"`, and
    // delivery requires "you" or "agent". Only a MESSAGE pulls an agent out of its work; a visitor
    // walking in never does (his rule: entering is not an interruption).
    await SystemView.chatJoin(pc, { chat, agent: "systemview-logtest", since: Date.now() });
    const home = await SystemView.chatDrain(pc, { chat, listener: `home:${stamp}`, as: pc });
    const visitor = await SystemView.chatDrain(pc, { chat, listener: `visitor:${stamp}`, as: "systemview-logtest" });
    const allDrained = [...(home.messages || []), ...(visitor.messages || [])];
    const homeTexts = (home.messages || []).map((m) => m.text);
    const visitorTexts = (visitor.messages || []).map((m) => m.text);
    // A DRAIN IS AN ARRIVAL (his rule, 2026-08-11): getting a handle on a room is entering it, so
    // the room says so even when the visitor never speaks. Before this, a file-mode agent could read
    // the whole room and the first thing he saw was its message. The arrival must still wake nobody.
    const arrivals = allDrained.filter((m) => m.kind === "system");
    const roomAll = await SystemView.chatHistory(pc, chat, 0);
    const visitorArrival = roomAll.some(
      (m) => m.kind === "system" && m.event === "joined" && m.who === "systemview-logtest",
    );
    return {
      drainAnnouncesArrival: visitorArrival,
      arrivalWakesNobody: arrivals.length === 0,
      homeHearsHuman: homeTexts.includes(`human ${stamp}`),
      homeNeverHearsItself: !homeTexts.includes(`home ${stamp}`),
      homeHearsVisitor: homeTexts.includes(`visitor ${stamp}`),
      visitorHearsHuman: visitorTexts.includes(`human ${stamp}`),
      visitorHearsHome: visitorTexts.includes(`home ${stamp}`),
      visitorNeverHearsItself: !visitorTexts.includes(`visitor ${stamp}`),
      nobodyHearsCommands: !allDrained.some((m) => m.kind === "command"),
      nobodyHearsArrivals: !allDrained.some((m) => m.kind === "system" || m.from === "system"),
    };
  },
  // THE PROJECT OWNS ITS ROOM (2026-08-10) — `SystemViewChat` runs inside the project's process and
  // is the only thing that touches the room file. Driven here through the real service door, the
  // same way the UI and hub reach it, so this proves the wire and not just the function.
  async chatPluginRoom() {
    const SystemView = await hub();
    const pc = "systemview-test";
    const chat = `plugin-room-${Date.now()}`; // its own room per run — never touches a real one
    const stamp = Date.now();
    // Find the service in THIS project that serves chat. A project can be mixed: some services
    // carry the module and some are older processes that do not.
    const projects = await SystemView.getProjects();
    const svc = (projects[pc] || []).find((s) =>
      (((s.system && s.system.connectionData) || {}).modules || []).some(
        (m) => m.name === "SystemViewChat",
      ),
    );
    if (!svc) return { moduleReachable: false };
    const client = await createClient().loadService(svc.system.connectionData.serviceUrl);
    const Chat = client.SystemViewChat;

    const before = await Chat.chatStat({ chat });
    await Chat.chatAppend({ chat, record: { id: `p1-${stamp}`, ts: stamp, from: "you", text: `one ${stamp}` } });
    await Chat.chatAppend({ chat, record: { id: `p2-${stamp}`, ts: stamp + 1, from: "agent", as: pc, text: `two ${stamp}` } });
    const after = await Chat.chatStat({ chat });
    const all = await Chat.chatRead({ chat });
    const windowed = await Chat.chatRead({ chat, since: stamp });

    const cursorStart = await Chat.chatCursor({ chat, listener: `t-${stamp}` });
    await Chat.chatCursor({ chat, listener: `t-${stamp}`, ts: stamp + 1 });
    const cursorAfter = await Chat.chatCursor({ chat, listener: `t-${stamp}` });

    // The room is named `<projectCode>.<chat>` on disk — the guard that stops two projects sharing
    // one working directory (systemview-test and systemview-logtest both run from this repo) from
    // writing into the same room.
    const rooms = await Chat.chatList();

    // CLEAN UP AFTER YOURSELF. Every run of this test used to leave a `plugin-room-<ts>` pair on
    // disk forever — a dozen runs and the chats directory is unreadable, which is exactly how he
    // found it ("I'm over here looking at all these saved files over and over"). A test that
    // creates a room owns deleting it.
    try {
      const dir = (await Chat.chatDir()).dir;
      const fs = require("fs");
      const path = require("path");
      fs.unlinkSync(path.join(dir, `${pc}.${chat}.jsonl`));
      try { fs.unlinkSync(path.join(dir, `${pc}.${chat}.ack.json`)); } catch {}
    } catch {}

    return {
      moduleReachable: true,
      startsEmpty: before.count === 0,
      appendsLand: after.count === 2,
      readsBackInOrder: all.length === 2 && all[0].text === `one ${stamp}` && all[1].text === `two ${stamp}`,
      sinceFilters: windowed.length === 1 && windowed[0].text === `two ${stamp}`,
      cursorStartsAtZero: cursorStart.ts === 0,
      cursorPersists: cursorAfter.ts === stamp + 1,
      roomIsListed: rooms.includes(chat),
    };
  },
  // THE OUTBOX FLUSH (2026-08-10) — a room can only move to the project once the project can serve
  // it, and messages sent before that moment land in the hub's fallback file. They are not lost,
  // they are STRANDED: in the wrong repo, invisible to the agent whose room it is. This test proves
  // both halves of the handover — the records actually cross, AND the case that nearly destroyed a
  // live room is refused.
  //
  // That case: SystemView's dev hub runs from the same repo that is also the `systemview-test`
  // project, so the hub's fallback directory and that project's own chat directory are ONE
  // directory. A flush there would diff a file against itself, move nothing, and then retire the
  // live room to `.flushed` — the conversation would come back empty.
  async chatOutboxFlush() {
    const fs = require("fs");
    const path = require("path");
    const SystemView = await hub();
    const stamp = Date.now();
    const hubDir = path.join(process.cwd(), ".systemview", "chats");
    const write = (pc, room, records) => {
      fs.mkdirSync(hubDir, { recursive: true });
      const file = path.join(hubDir, `${pc}.${room}.jsonl`);
      fs.writeFileSync(file, records.map((r) => JSON.stringify(r)).join("\n") + "\n");
      return file;
    };
    const rec = (n) => ({ id: `flush-${stamp}-${n}`, ts: stamp + n, from: "you", text: `flush ${n}` });

    // --- half one: a DIFFERENT project's outbox crosses -------------------------------------
    // BUApp is a second real project with its own root, serving its own room — the only honest way
    // to exercise a handover, since a flush needs two genuinely different directories.
    const projects = await SystemView.getProjects();
    const other = (projects.BUApp || []).find((s) =>
      (((s.system && s.system.connectionData) || {}).modules || []).some((m) => m.name === "SystemViewChat"),
    );
    if (!other) return { peerServesChat: false };
    const room = `flushtest-${stamp}`;
    const hubFile = write("BUApp", room, [rec(1), rec(2)]);
    // THE CURSORS MUST SURVIVE THE HANDOVER. Retiring them alongside the room looked tidy and was
    // data loss: the hub still keys every drain cursor to its own directory, so a retired ack file
    // is a DELETED cursor, and an empty cursor replays the whole room at the next drain. It hit
    // systemlynx live — 58 records re-served, a full replay of old instructions that reads exactly
    // like new ones. Cursors are timestamps, not file offsets, so the move never invalidated them.
    const ackPath = path.join(hubDir, `BUApp.${room}.ack.json`);
    fs.writeFileSync(ackPath, JSON.stringify({ hooks: stamp }, null, 2));
    const flushed = await SystemView.chatFlush("BUApp");
    const ackSurvived =
      fs.existsSync(ackPath) && JSON.parse(fs.readFileSync(ackPath, "utf8")).hooks === stamp;
    const peer = await createClient().loadService(other.system.connectionData.serviceUrl);
    const landed = await peer.SystemViewChat.chatRead({ chat: room });
    const peerDir = (await peer.SystemViewChat.chatDir()).dir;
    const hubFileGone = !fs.existsSync(hubFile);
    const retiredKept = fs.existsSync(`${hubFile}.flushed`);

    // --- half two: the SAME directory is refused ---------------------------------------------
    // No `.flushed` rename, no data moved, file byte-identical. This is the guard.
    const ownRoom = `guardtest-${stamp}`;
    const ownFile = write("systemview-test", ownRoom, [rec(3)]);
    const before = fs.readFileSync(ownFile, "utf8");
    const guarded = await SystemView.chatFlush("systemview-test");
    const ownFileIntact = fs.existsSync(ownFile) && fs.readFileSync(ownFile, "utf8") === before;
    const ownFileNotRetired = !fs.existsSync(`${ownFile}.flushed`);

    // Scratch rooms on both sides go away — a test must not leave rooms behind.
    try { fs.unlinkSync(`${hubFile}.flushed`); } catch {}
    try { fs.unlinkSync(ownFile); } catch {}
    try { fs.unlinkSync(ackPath); } catch {}
    try { fs.unlinkSync(path.join(peerDir, `BUApp.${room}.jsonl`)); } catch {}

    return {
      peerServesChat: true,
      // The handover moves the ROOM and nothing else — an untouched cursor means no replay.
      cursorsSurviveFlush: ackSurvived,
      // Records the hub buffered are now in the PROJECT's room, intact and in order.
      recordsCrossed: landed.length === 2 && landed[0].text === "flush 1" && landed[1].text === "flush 2",
      movedCountReported: flushed.moved === 2,
      // …and the hub's copy is retired, not deleted, and no longer looks like a room.
      hubFileRetired: hubFileGone && retiredKept,
      // The guard: hub dir === project dir, so nothing moves and nothing is renamed.
      sameDirRefused: guarded.moved === 0,
      ownRoomUntouched: ownFileIntact && ownFileNotRetired,
    };
  },
  // THE TV READ-BACK (2026-08-10) — `chatGetTv` used to return the stored click-state and nothing
  // else. State is only written when the human CLICKS, so an agent that pushed a new show and read
  // it back got the PREVIOUS one, unchanged timestamp and all (found live by systemlynx). The
  // co-editing rule is read-before-write, so a stale read means an agent merges onto old text and
  // silently wipes his edit. The current show must always win.
  async chatTvReadsCurrent() {
    const SystemView = await hub();
    const pc = "systemview-test";
    const chat = `tv-${Date.now()}`; // its own room per run — never touches the real TV
    const stamp = Date.now();

    // A REAL mark, not a made-up sentinel. "Has he answered this?" is now read off the text itself
    // (`answer=` / `verdict=` / a `:::reply{author=you`), which is what the UI actually writes — so
    // a fixture that invents its own marker would pass while proving nothing about real answers.
    const pushed = `# one ${stamp}\n\n::question[Pick]{id=q options="a|b"}`;
    const answered = `# one ${stamp}\n\n::question[Pick]{id=q options="a|b" answer=a}`;

    const empty = await SystemView.chatGetTv(pc, { chat });
    await SystemView.chatCommand(pc, { chat, cmd: "show", args: { text: pushed }, label: `board ${stamp}` });
    const afterFirst = await SystemView.chatGetTv(pc, { chat });

    // He clicks an answer — it is written into the report's own record, and the read reflects it.
    await SystemView.chatSetTv(pc, {
      chat,
      state: { id: afterFirst.id, label: afterFirst.label, text: answered },
    });
    const afterClick = await SystemView.chatGetTv(pc, { chat });

    // The agent re-pushes an edit of the SAME board. The new text must win over his old answers,
    // and he must be TOLD his answers were on the previous version rather than silently losing them.
    await SystemView.chatCommand(pc, { chat, cmd: "show", args: { text: `# two ${stamp}` }, label: `board ${stamp}` });
    const afterRepush = await SystemView.chatGetTv(pc, { chat });

    // Same rule — this test's scratch room and its TV state go away with it.
    try {
      const fs = require("fs");
      const path = require("path");
      const dir = path.join(process.cwd(), ".systemview", "chats");
      for (const suffix of [".jsonl", ".ack.json", ".tv.json"]) {
        try { fs.unlinkSync(path.join(dir, `${pc}.${chat}${suffix}`)); } catch {}
      }
    } catch {}

    return {
      startsEmpty: empty === null,
      readsPushedShow: !!afterFirst && afterFirst.text === pushed && afterFirst.pristine === true,
      // His answer is IN the record now — no second copy of the text anywhere.
      clickedCopyWins: !!afterClick && /answer=a/.test(afterClick.text) && !afterClick.pristine,
      // The actual bug: this used to come back as the CLICKED version of the OLD text.
      repushWinsOverStaleState: !!afterRepush && afterRepush.text === `# two ${stamp}`,
      supersededAnswersFlagged: !!afterRepush && afterRepush.supersededAnswers === true,
    };
  },
  // THE SPEAKING GATE (2026-08-09) — reading a room is open, speaking into one is not. Two silent
  // failures used to live here: an unrecognized `--as` quietly BECAME the room's own agent (so the
  // message was recorded as the room talking to itself, delivered to nobody, and still looked
  // sent), and a visitor could fire into a room it had never entered. Both must refuse, and the
  // two honest paths — the home agent, and a visitor that entered — must stay open.
  async chatSpeakingGate() {
    const SystemView = await hub();
    const pc = "systemview-test";
    const chat = "self-test";
    const stamp = Date.now();
    // A service error crosses the wire in a few shapes; dig out the sentence the hub wrote.
    const msgOf = (err) => {
      if (!err) return "";
      if (typeof err === "string") return err;
      const nested = err.error || err.data || err.body;
      return (
        err.message ||
        (nested && (nested.message || (typeof nested === "string" ? nested : null))) ||
        JSON.stringify(err)
      );
    };
    const refusal = async (fn) => {
      try {
        await fn();
        return null; // went through — no refusal
      } catch (err) {
        return msgOf(err);
      }
    };
    // 1. An identity that is not a connected project at all.
    const unknown = await refusal(() =>
      SystemView.chatSend(pc, { chat, from: "agent", as: `ghost-${stamp}`, text: `ghost ${stamp}` }),
    );
    // 2. A real project that never entered THIS room (buAPI never enters the self-test chat, so
    //    this stays a true drive-by across runs).
    const driveBy = await refusal(() =>
      SystemView.chatSend(pc, { chat, from: "agent", as: "buAPI", text: `driveby ${stamp}` }),
    );
    // 3. A cooking line is speech too — the ghost-cooking bug ("it says they're cooking and
    //    they're not even in the room") is the same gap.
    const driveByCooking = await refusal(() =>
      SystemView.chatStatus(pc, { chat, text: `cooking ${stamp}`, as: "buAPI" }),
    );
    // 4. The home agent always speaks in its own room (file-mode agents hold no line at all).
    const homeAgent = await refusal(() =>
      SystemView.chatSend(pc, { chat, from: "agent", as: pc, text: `gate-home ${stamp}` }),
    );
    // 5. Enter, then speak — the visitor path that must stay open.
    await SystemView.chatDrain(pc, { chat, listener: `gate:${stamp}`, as: "systemview-logtest" });
    const enteredVisitor = await refusal(() =>
      SystemView.chatSend(pc, { chat, from: "agent", as: "systemview-logtest", text: `gate-visitor ${stamp}` }),
    );
    return {
      unknownIdentityRefused: /not a connected project/.test(unknown || ""),
      driveByRefused: /is not in .* room/.test(driveBy || ""),
      cookingDriveByRefused: /is not in .* room/.test(driveByCooking || ""),
      homeAgentAllowed: homeAgent === null,
      enteredVisitorAllowed: enteredVisitor === null,
    };
  },
};
