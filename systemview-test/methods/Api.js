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
    const fs = require("fs");
    const path = require("path");
    const SystemView = await hub();
    const pc = "systemview-test";
    const chat = `tv-${Date.now()}`; // its own room per run — never touches the real TV
    const stamp = Date.now();

    // RFC-040 — A REPORT IS A DOCUMENT, so this fixture pushes what `systemview show` now pushes: a
    // POINTER record naming a file. It used to push `args.text` and assert the hub handed that text
    // back, which stopped being true the day inline shows stopped being reports — the failure was
    // the test guarding the old contract, not the code breaking.
    const name = `tvtest ${stamp}`;
    const slug = name.replace(/[^a-zA-Z0-9._-]+/g, "-");
    const rel = `.systemview/report.${pc}.${slug}.md`;
    const abs = path.join(process.cwd(), rel);
    const pushed = `# one ${stamp}\n\n::question[Pick]{id=q options="a|b"}`;
    const answered = `# one ${stamp}\n\n::question[Pick]{id=q options="a|b" answer=a}`;

    const empty = await SystemView.chatGetTv(pc, { chat });

    fs.writeFileSync(abs, pushed);
    await SystemView.chatCommand(pc, { chat, cmd: "show", args: { report: name, path: rel }, label: name });
    const afterFirst = await SystemView.chatGetTv(pc, { chat });

    // He answers IN THE DOCUMENT — that is where his clicks land now, not in a second copy held by
    // the room. Reading the file back is the whole assertion.
    fs.writeFileSync(abs, answered);
    const clicked = fs.readFileSync(abs, "utf8");

    // The agent re-pushes the same title. A re-push is a SAVE to the same file, so there is no
    // stale second version to lose his answers to — which is why the old `supersededAnswers`
    // warning does not exist any more: it was a symptom of the copy, and the copy is gone.
    fs.writeFileSync(abs, `# two ${stamp}`);
    await SystemView.chatCommand(pc, { chat, cmd: "show", args: { report: name, path: rel }, label: name });
    const afterRepush = await SystemView.chatGetTv(pc, { chat });
    const onDisk = fs.readFileSync(abs, "utf8");

    // Same rule — this test's scratch room, its TV state and its document go away with it.
    try {
      const dir = path.join(process.cwd(), ".systemview", "chats");
      for (const suffix of [".jsonl", ".ack.json", ".tv.json"]) {
        try { fs.unlinkSync(path.join(dir, `${roomPc}.${chat}${suffix}`)); } catch {}
      }
      fs.unlinkSync(abs);
    } catch {}

    return {
      startsEmpty: empty === null,
      // The hub hands back the POINTER; it never reads project files itself.
      readsPushedShow: !!afterFirst && !!afterFirst.args && afterFirst.args.report === name,
      // His answer is in the document, and nothing else holds a copy of it.
      clickedCopyWins: /answer=a/.test(clicked) && (!afterFirst.text || afterFirst.text === ""),
      // A re-push is a save: same file, new content, one version.
      repushWinsOverStaleState: onDisk === `# two ${stamp}` && !!afterRepush && afterRepush.args.report === name,
      // One document means there is no superseded copy to warn about — the warning is gone WITH the
      // thing that caused it, and this asserts that rather than the old flag.
      noStaleCopyToFlag: !!afterRepush && afterRepush.supersededAnswers !== true,
    };
  },
  // THE SPEAKING GATE (2026-08-09) — reading a room is open, speaking into one is not. Two silent
  // failures used to live here: an unrecognized `--as` quietly BECAME the room's own agent (so the
  // message was recorded as the room talking to itself, delivered to nobody, and still looked
  // sent), and a visitor could fire into a room it had never entered. Both must refuse, and the
  // two honest paths — the home agent, and a visitor that entered — must stay open.
  async chatSpeakingGate() {
    const fs = require("fs");
    const path = require("path");
    const SystemView = await hub();
    const pc = "systemview-test";
    // ITS OWN ROOM PER RUN — this suite's probes used to share "self-test", so a visitor one probe
    // entered lingered for every later test, and each of their messages relayed into that project's
    // LIVE session ("driveby" reached two real conversations, 2026-10-18). A throwaway room dies
    // with the run and the chain dies with it.
    const stamp = Date.now();
    const chat = `gate-${stamp}`;
    // THE ROOM BELONGS TO THE FIXTURE, NOT TO THE LIVE PROJECT. A throwaway room was not enough:
    // a visitor speaking in ANY room of `systemview-test` is relayed to that project's live
    // session, so the probe's own line landed in his conversation again ("enters-by-speaking …",
    // 2026-10-18). Inverted, nobody is listening: the room is the fixture project's, whose agent
    // has no session, and the VISITOR identity is this project — which never receives its own
    // message (the self-loop guard), so the probe reaches no human anywhere.
    const roomPc = "systemview-logtest";
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
    // THE TEST STANDS UP ITS OWN VISITOR. Two earlier shapes of this were both wrong: hard-coding
    // `systemview-logtest` (which nothing boots — a hand-started fixture, so the door refused it
    // exactly as it refuses a ghost, and the test failed on its own premise) and then picking
    // whichever project happened to be connected (his ruling, 2026-10-18: *"a test cannot rely on
    // random agents"* — a proof that depends on what else is running proves nothing, and the
    // reliably-connected codes are REAL conversations a probe must never wear).
    //
    // So the fixture is this test's own: `test/LogSuite/index.js` registers under
    // `systemview-logtest` and nothing else uses that code. Started here, waited for, and taken
    // back down in the `finally` below — including its registration, or the next run inherits a
    // dead entry that makes the door's answer depend on history.
    const { spawn } = require("child_process");
    const visitor = "systemview-logtest";
    // ABSOLUTE, FROM THIS FILE. `process.cwd()` is whatever directory the hub's service was started
    // from, so a relative path spawned a node that could not find the script — and with stdio
    // ignored the failure was invisible, surfacing only as `fixtureUp: false`.
    const repoRoot = path.resolve(__dirname, "..", "..");
    let fixtureError = "";
    const fixture = spawn(process.execPath, [path.join(repoRoot, "test", "LogSuite", "index.js")], {
      cwd: repoRoot,
      env: { ...process.env, LOGSUITE_PORT: process.env.LOGSUITE_PORT || "5558" },
      stdio: "ignore",
    });
    fixture.on("error", (e) => { fixtureError = (e && e.message) || String(e); });
    const known = async () => {
      const projects = (await SystemView.getProjects()) || {};
      return Object.keys(projects).includes(visitor);
    };
    let fixtureUp = false;
    let probePc = "";
    for (let i = 0; i < 40 && !fixtureUp; i += 1) {
      // its registration is the readiness signal — not a port probe and not a sleep: the door the
      // test is about reads the connections store, so that is the thing worth waiting for
      await new Promise((r) => setTimeout(r, 250));
      try { fixtureUp = await known(); } catch {}
    }

    // AND THE PROBE GETS ITS OWN IDENTITY — registered, so the door accepts it; sessionless, so
    // nothing it says can reach a human. Draining as THIS PROJECT made systemview-test a visitor
    // of the fixture's room, and `relayToVisitors` then delivered every line of that room into his
    // live conversation ("[in systemview-logtest] gate-home …", 2026-10-18). The fix is not a
    // quieter room, it is an identity with nobody behind it: the fixture's own live service,
    // registered a second time under a throwaway project code that exists for this run only.
    let probeError = "";
    try {
      const projects = (await SystemView.getProjects()) || {};
      const entries = projects[visitor];
      const fx = (Array.isArray(entries) ? entries : [])[0];
      if (!fx || !fx.system) probeError = `no registration to clone for ${visitor}: ${JSON.stringify(entries).slice(0, 160)}`;
      else {
        probePc = `gate-probe-${stamp}`;
        await SystemView.connect({
          system: fx.system,
          projectCode: probePc,
          serviceId: "LogSuiteProbe",
          specList: fx.specList || [],
          credentials: false,
          dynamic: false,
        });
      }
    } catch (e) {
      probePc = "";
      probeError = (e && (e.message || JSON.stringify(e))) || String(e);
    }


    try {
    // 1. An identity that is not a connected project at all — the ONE refusal the door still has.
    const unknown = await refusal(() =>
      SystemView.chatSend(roomPc, { chat, from: "agent", as: `ghost-${stamp}`, text: `ghost ${stamp}` }),
    );
    // 2. ARRIVING IS ENTERING (the design this test used to deny): a known project that never
    //    opened this room's door SPEAKS — it is delivered, and the room records the arrival. The
    //    probe speaks as the log-test fixture, never as a live peer: a probe wearing a real
    //    project's name is a real message in their session.
    const spoke = await refusal(() =>
      SystemView.chatSend(roomPc, { chat, from: "agent", as: probePc, text: `enters-by-speaking ${stamp}` }),
    );
    const history = (await SystemView.chatHistory(roomPc, chat, 0)) || [];
    const delivered = history.some((r) => r && r.text === `enters-by-speaking ${stamp}`);
    // WHAT "ENTERING" ACTUALLY IS HERE, and the earlier version of this test asserted a record the
    // design never writes: `enterBySpeaking` MARKS the identity as entered and writes no line —
    // only a drain or a join announces an arrival, and a drain announces one ONLY for an identity
    // that had not entered recently. So the observable consequence of "speaking is arriving" is
    // precisely this: after speaking, the same identity's drain must produce NO joined line.
    const joinedLines = (rows) =>
      rows.filter(
        (r) => r && (r.from === "system" || r.kind === "system") && String(r.text || r.event || "").includes(probePc),
      ).length;
    const joinedBeforeDrain = joinedLines(history);
    // 3. A status line is speech too — same door, same auto-entry, no ghost-cooking from unknowns.
    const unknownCooking = await refusal(() =>
      SystemView.chatStatus(roomPc, { chat, text: `cooking ${stamp}`, as: `ghost-${stamp}` }),
    );
    // 4. The home agent always speaks in its own room.
    const homeAgent = await refusal(() =>
      SystemView.chatSend(roomPc, { chat, from: "agent", as: roomPc, text: `gate-home ${stamp}` }),
    );
    // 5. Enter-then-speak stays open — a drain is an arrival, and the visitor talks after it.
    await SystemView.chatDrain(roomPc, { chat, listener: `gate:${stamp}`, as: probePc });
    const afterDrain = (await SystemView.chatHistory(roomPc, chat, 0)) || [];
    // the drain found it already entered, so it announced nothing new
    const drainAnnouncedAnyway = joinedLines(afterDrain) > joinedBeforeDrain;
    const enteredVisitor = await refusal(() =>
      SystemView.chatSend(roomPc, { chat, from: "agent", as: probePc, text: `gate-visitor ${stamp}` }),
    );
    // The throwaway room goes away with its run — same rule every chat fixture here follows. Two
    // bugs lived in this one block and both left litter: it deleted `${pc}.…` while the room
    // belongs to the FIXTURE now, and it resolved the directory from `process.cwd()`, which is
    // wherever the hub's service was started. Seven rooms were on disk before this was fixed.
    try {
      const dir = path.join(repoRoot, ".systemview", "chats");
      for (const suffix of [".jsonl", ".ack.json", ".tv.json"]) {
        try { fs.unlinkSync(path.join(dir, `${roomPc}.${chat}${suffix}`)); } catch {}
      }
    } catch {}
    return {
      // the fixture came up and registered — if this is false the two visitor claims below are
      // UNPROVEN, and they say so by failing rather than by going vacuously green
      fixtureUp,
      fixtureError, // why it never registered, when it didn't — silence here was the whole bug
      roomOwner: roomPc,
      probeRegistered: !!probePc,
      probeError, // swallowing this is what made a dead `connect` look like a failing door
      visitorIdentity: probePc, // a registered identity with no session behind it
      delivered,
      drainAnnouncedAnyway,
      unknownIdentityRefused: /not a connected project/.test(unknown || ""),
      // delivered AND marked entered — the mark proven by the drain staying silent afterwards
      speakingEnters: !!probePc && spoke === null && delivered && !drainAnnouncedAnyway,
      unknownCookingRefused: /not a connected project/.test(unknownCooking || ""),
      homeAgentAllowed: homeAgent === null,
      // WITHOUT AN IDENTITY THESE CANNOT BE TRUE. `as: ""` collapses to the room's own agent, so
      // both probes would be ALLOWED and read green while proving nothing about a visitor.
      enteredVisitorAllowed: !!probePc && enteredVisitor === null,
    };
    } finally {
      // THE FIXTURE LEAVES NOTHING BEHIND — the process, then its registration. A dead entry left
      // in the store would make `systemview-logtest` count as "known" on every later run, so the
      // door's own refusal could never be tested again.
      try { fixture.kill("SIGTERM"); } catch {}
      try { await SystemView.deleteService(visitor, "LogSuite"); } catch {}
      if (probePc) {
        try { await SystemView.deleteService(probePc, "LogSuiteProbe"); } catch {}
        // the throwaway identity's own relay room — a visitor gets room files written for it, and
        // those are this run's litter like anything else it created
        try {
          const dir = path.join(repoRoot, ".systemview", "chats");
          for (const f of fs.readdirSync(dir)) if (f.startsWith(`${probePc}.`)) {
            try { fs.unlinkSync(path.join(dir, f)); } catch {}
          }
        } catch {}
      }
    }
  },
};
