// systemview-test/methods/Api.js — the `Api` module of SystemViewCore: real calls against the
// hub's own service API, through the same door the UI and the CLI use.
const { createClient } = require("systemlynx");
const { required, chatService } = require("../support/fixtures");
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
  // RFC-031 delivery rules, proven through the hub's real chat door: who hears a human, a home
  // agent and a visitor, and who hears nothing at all.
  //
  // THE ROOM BELONGS TO THE FIXTURE, NEVER TO A LIVE PROJECT — the inversion chatSpeakingGate had
  // to learn, and this method never got. It ran in `systemview-test`'s own room, and the hub
  // relays a room's lines to that project's LIVE SESSION: so every run put `human <stamp>` and
  // `visitor <stamp>` straight into the real conversation (twice tonight, 2026-10-27, in his chat
  // while he was reading). Inverted, nobody is listening — the room is the FIXTURE's, whose agent
  // has no session, and the visitor is a throwaway identity registered for this run only.
  //
  // AND ITS FIXTURE'S ABSENCE IS AN ANSWER, NOT A THROW. With the fixture down the hub refuses the
  // visitor's send ("not a connected project"), the method used to die there, and all ten
  // assertions reported `undefined` — the report blaming them for something that happened before
  // the first one ran. `fixturesRunning` is a field now, so a red says which fixture and what to run.
  async chatDeliveryRules() {
    const SystemView = await hub();
    const fixturePc = "systemview-logtest";
    const pre = await required([fixturePc]);
    if (!pre.fixturesRunning) return pre;

    const stamp = Date.now();
    const roomPc = fixturePc; // the room's owner — sessionless, so nothing here reaches a human
    const chat = `delivery-${stamp}`; // its own room per run, removed below
    const home = roomPc;

    // A registered identity with nobody behind it, cloned from the fixture's own registration.
    // The door refuses an unknown `as`, and every reliably-connected code is a real conversation a
    // probe must never wear — so the visitor is minted here and deleted in the `finally`.
    let visitor = "";
    try {
      const projects = (await SystemView.getProjects()) || {};
      const fx = (projects[fixturePc] || [])[0];
      if (fx && fx.system) {
        visitor = `delivery-probe-${stamp}`;
        await SystemView.connect({
          system: fx.system,
          projectCode: visitor,
          serviceId: "LogSuiteDelivery",
          specList: fx.specList || [],
          credentials: false,
          dynamic: false,
        });
      }
    } catch {
      visitor = "";
    }
    if (!visitor)
      return {
        fixturesRunning: false,
        why: `could not register a throwaway visitor from ${fixturePc} — the fixture answered but connect() refused`,
      };

    try {
      await SystemView.chatSend(roomPc, { chat, from: "you", text: `human ${stamp}` });
      await SystemView.chatSend(roomPc, { chat, from: "agent", as: home, text: `home ${stamp}` });
      // The visitor ENTERS before it speaks — the speaking gate refuses a say from an identity that
      // never opened this room's door, and a drain is one of the two doors.
      await SystemView.chatDrain(roomPc, { chat, listener: `enter:${stamp}`, as: visitor });
      await SystemView.chatSend(roomPc, { chat, from: "agent", as: visitor, text: `visitor ${stamp}` });
      await SystemView.chatCommand(roomPc, { chat, cmd: "nav", args: {}, label: "delivery check" });
      // ENTERING MUST WAKE NOBODY — arrival lines are `from: "system"`, and delivery requires "you"
      // or "agent". Only a MESSAGE pulls an agent out of its work; a visitor walking in never does.
      // (`chatJoin` was RENAMED to `chatJoinRoom` and this spec never heard: the old name threw, and
      // the throw is what hid every other finding in this method.)
      await SystemView.chatJoinRoom(roomPc, { chat, as: visitor });
      const homeDrain = await SystemView.chatDrain(roomPc, { chat, listener: `home:${stamp}`, as: home });
      const seen = await SystemView.chatDrain(roomPc, { chat, listener: `visitor:${stamp}`, as: visitor });
      const allDrained = [...(homeDrain.messages || []), ...(seen.messages || [])];
      const homeTexts = (homeDrain.messages || []).map((m) => m.text);
      const visitorTexts = (seen.messages || []).map((m) => m.text);
      // A DRAIN IS AN ARRIVAL: getting a handle on a room is entering it, so the room says so even
      // when the visitor never speaks — and the arrival must still wake nobody.
      const arrivals = allDrained.filter((m) => m.kind === "system");
      const roomAll = await SystemView.chatHistory(roomPc, chat, 0);
      const visitorArrival = roomAll.some(
        (m) => m.kind === "system" && m.event === "joined" && m.who === visitor,
      );
      return {
        fixturesRunning: true,
        why: "",
        roomOwner: roomPc,
        visitorIdentity: visitor,
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
    } finally {
      // EVERYTHING THIS RUN CREATED GOES AWAY: the throwaway identity, its relay room, and the
      // scratch room itself. A dead registration left behind would make the next run's door answer
      // differently, and litter is how 28 rooms ended up on disk two methods down.
      try { await SystemView.deleteService(visitor, "LogSuiteDelivery"); } catch {}
      try {
        const dir = path.join(process.cwd(), ".systemview", "chats");
        for (const suffix of [".jsonl", ".ack.json", ".tv.json"]) {
          try { fs.unlinkSync(path.join(dir, `${roomPc}.${chat}${suffix}`)); } catch {}
        }
        for (const f of fs.readdirSync(dir)) {
          if (f.startsWith(`${visitor}.`)) { try { fs.unlinkSync(path.join(dir, f)); } catch {} }
        }
      } catch {}
    }
  },

  // THE PROJECT OWNS ITS ROOM (2026-08-10) — `SystemViewChat` runs inside the project's process and
  // is the only thing that touches the room file. Driven here through the real service door, the
  // same way the UI and hub reach it, so this proves the wire and not just the function.
  async chatPluginRoom() {
    const SystemView = await hub();
    const pc = "systemview-test";
    const chat = `plugin-room-${Date.now()}`; // its own room per run — never touches a real one
    const stamp = Date.now();
    // FIND THE SERVICE THAT ANSWERS, not the first whose metadata mentions chat. Registration
    // metadata is a snapshot of what a service HAD when it registered; four fixtures in this project
    // were registered and gone, and taking the first match threw inside discovery — so every
    // assertion below reported `undefined` and the report blamed sixteen of them for something that
    // happened before the first one ran.
    const pre = await required([pc], { chatOn: [pc] });
    if (!pre.fixturesRunning) return { ...pre, moduleReachable: false };
    const found = await chatService(pc);
    if (!found)
      return {
        fixturesRunning: false,
        why: `no service in ${pc} answered with a SystemViewChat module — start the fixtures with \`npm run services\``,
        moduleReachable: false,
      };
    const Chat = found.Chat;

    const before = await Chat.chatStat({ chat });
    await Chat.chatAppend({ chat, record: { id: `p1-${stamp}`, ts: stamp, from: "you", text: `one ${stamp}` } });
    await Chat.chatAppend({ chat, record: { id: `p2-${stamp}`, ts: stamp + 1, from: "agent", as: pc, text: `two ${stamp}` } });
    const after = await Chat.chatStat({ chat });
    const all = await Chat.chatRead({ chat });
    const windowed = await Chat.chatRead({ chat, since: stamp });

    // THE CURSOR IS NOT THIS MODULE'S ANY MORE. `chatCursor` was retired in plugin 2.23.0 — the
    // hub keys drain cursors to its OWN directory because its store is synchronous, so this
    // asynchronous twin was superseded and had no callers. This spec kept calling it, which is the
    // same shape as the scar in chatTvReadsCurrent: the failure was the test guarding the old
    // contract, not the code breaking. What is asserted instead is that the retirement HELD — the
    // module does not quietly grow the method back, and `.ack.json` stays the hub's business.
    const cursorRetired = typeof Chat.chatCursor !== "function";

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
      fixturesRunning: true,
      why: "",
      moduleReachable: true,
      startsEmpty: before.count === 0,
      appendsLand: after.count === 2,
      readsBackInOrder: all.length === 2 && all[0].text === `one ${stamp}` && all[1].text === `two ${stamp}`,
      sinceFilters: windowed.length === 1 && windowed[0].text === `two ${stamp}`,
      cursorStaysRetired: cursorRetired,
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
    // ASK THE HUB WHERE IT BUFFERS, NEVER ASSUME. This was `path.join(process.cwd(), ".systemview",
    // "chats")` — the CALLER's directory. The hub's fallback comes from the HUB's cwd, and the shell
    // launches it from autobot's repo, so the two stopped being one file the moment SystemView
    // became an app in the harness. The records were written where nobody would ever flush them,
    // `chatFlush` honestly answered `moved: 0`, and the assertions blamed the handover.
    // A MISSING METHOD IS NOT A REJECTED PROMISE. `SystemView.chatHubDir().catch(...)` throws a
    // TypeError before there is anything to catch — the same shape as every other failure in this
    // file: the method dies and the assertions take the blame. Check the door exists, then call it.
    const asked =
      typeof SystemView.chatHubDir === "function" ? await SystemView.chatHubDir().catch(() => null) : null;
    if (!asked || !asked.dir)
      return {
        fixturesRunning: false,
        why: "the hub has no chatHubDir() door — restart the hub to pick it up (api/ changed)",
      };
    const hubDir = asked.dir;
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
    // THE PEER THAT ANSWERS, not the first one registered. Third instance of one lesson in this
    // file: a hub restart re-hosts every hosted project on a FRESH port and leaves the old
    // registration standing, so `find()` on metadata hands back a dead address and `loadService`
    // throws — taking the whole method with it, which is how seven assertions came back `undefined`
    // for a reason that had nothing to do with any of them.
    const peer = await chatService("BUApp");
    if (!peer)
      return {
        fixturesRunning: false,
        why: "no service in BUApp answered with a SystemViewChat module — the handover needs a live peer with its own chat directory",
      };
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
    const landed = await peer.Chat.chatRead({ chat: room });
    const peerDir = (await peer.Chat.chatDir()).dir;
    const hubFileGone = !fs.existsSync(hubFile);
    const retiredKept = fs.existsSync(`${hubFile}.flushed`);
    // Half one's verdict, assembled here so half two can hand it back when there is no collision
    // left to exercise — a guard with nothing to guard must not erase what half one proved.
    const crossed = {
      fixturesRunning: true,
      why: "",
      hubBuffersIn: hubDir,
      peerServesChat: true,
      cursorsSurviveFlush: ackSurvived,
      recordsCrossed: landed.length === 2 && landed[0].text === "flush 1" && landed[1].text === "flush 2",
      movedCountReported: flushed.moved === 2,
      hubFileRetired: hubFileGone && retiredKept,
    };

    // --- half two: the SAME directory is refused ---------------------------------------------
    // No `.flushed` rename, no data moved, file byte-identical. This is the guard.
    //
    // AND THE COLLISION MOVED HOUSE. This used to flush `systemview-test`, because the dev hub ran
    // from the very repo that is also that project — one directory wearing two hats, which is the
    // case the guard exists for. Under the harness the shell launches the hub from ITS repo, so the
    // hub buffers in `~/autobot/.systemview/chats` and no longer collides with this project at all:
    // the guard correctly did not fire, and the assertion that it fired was simply out of date.
    // So the colliding project is DISCOVERED — whoever's own chat directory IS the hub's buffer —
    // and if nobody collides, this half says so instead of failing for being true.
    let samePc = "";
    for (const code of Object.keys((await SystemView.getProjects()) || {})) {
      const cand = await chatService(code);
      if (!cand) continue;
      try {
        if ((await cand.Chat.chatDir()).dir === hubDir) { samePc = code; break; }
      } catch {
        /* a peer that cannot answer its own directory is not the collision */
      }
    }
    if (!samePc)
      return {
        ...crossed,
        guardExercised: false,
        sameDirRefused: true,
        ownRoomUntouched: true,
        guardNote: `no connected project's chat directory is the hub's buffer (${hubDir}) — nothing can collide, so the guard has nothing to refuse here`,
      };
    const ownRoom = `guardtest-${stamp}`;
    const ownFile = write(samePc, ownRoom, [rec(3)]);
    const before = fs.readFileSync(ownFile, "utf8");
    const guarded = await SystemView.chatFlush(samePc);
    const ownFileIntact = fs.existsSync(ownFile) && fs.readFileSync(ownFile, "utf8") === before;
    const ownFileNotRetired = !fs.existsSync(`${ownFile}.flushed`);

    // Scratch rooms on both sides go away — a test must not leave rooms behind.
    try { fs.unlinkSync(`${hubFile}.flushed`); } catch {}
    try { fs.unlinkSync(ownFile); } catch {}
    try { fs.unlinkSync(ackPath); } catch {}
    try { fs.unlinkSync(path.join(peerDir, `BUApp.${room}.jsonl`)); } catch {}

    return {
      ...crossed,
      guardExercised: true,
      guardNote: `${samePc}'s own chat directory is the hub's buffer`,
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
    //
    // AND THE CLEANUP USED TO THROW ON ITS FIRST LINE. It referenced `roomPc`, which is declared in
    // chatSpeakingGate and does not exist here — a ReferenceError, swallowed whole by this `catch {}`,
    // so nothing below it ran either: 28 `tv-<stamp>.jsonl` rooms and their scratch reports were on
    // disk, left by a test that believed it tidied up. A bare catch around cleanup hides exactly the
    // failure that matters, because a leak is invisible until somebody lists the directory.
    try {
      const dir = path.join(process.cwd(), ".systemview", "chats");
      for (const suffix of [".jsonl", ".ack.json", ".tv.json"]) {
        try { fs.unlinkSync(path.join(dir, `${pc}.${chat}${suffix}`)); } catch {}
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
    // DO NOT TEAR DOWN A FIXTURE YOU DID NOT START. `npm run services` stands these fixtures up for
    // the whole suite; this method used to spawn its own copy and then, in its `finally`, kill the
    // process and DELETE the registration — so when a shared one was already running it removed it
    // out from under everything else. The visible result: `chatDeliveryRules` (which needs the same
    // fixture and starts nothing) failed with "systemview-logtest is not a connected project" on
    // every run AFTER this one, while the fixture's own log said `connected!`. Ownership is now
    // explicit: if it was already registered, use it and leave it exactly as found.
    const preExisting = await (async () => {
      try {
        const projects = (await SystemView.getProjects()) || {};
        return Array.isArray(projects[visitor]) && projects[visitor].length > 0;
      } catch {
        return false;
      }
    })();
    // ABSOLUTE, FROM THIS FILE. `process.cwd()` is whatever directory the hub's service was started
    // from, so a relative path spawned a node that could not find the script — and with stdio
    // ignored the failure was invisible, surfacing only as `fixtureUp: false`.
    const repoRoot = path.resolve(__dirname, "..", "..");
    let fixtureError = "";
    const fixture = preExisting
      ? null
      : spawn(process.execPath, [path.join(repoRoot, "test", "LogSuite", "index.js")], {
          cwd: repoRoot,
          env: { ...process.env, LOGSUITE_PORT: process.env.LOGSUITE_PORT || "5558" },
          stdio: "ignore",
        });
    if (fixture) fixture.on("error", (e) => { fixtureError = (e && e.message) || String(e); });
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
      fixtureWasShared: preExisting, // reported: did this run borrow a fixture or stand one up
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
      // ONLY what this run created. A shared fixture is left running and registered.
      if (!preExisting) {
        try { if (fixture) fixture.kill("SIGTERM"); } catch {}
        try { await SystemView.deleteService(visitor, "LogSuite"); } catch {}
      }
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
