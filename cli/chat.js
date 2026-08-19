const log = require("./logger");

// RFC-028 — the agent's side of the chat front door. Four verbs, all one-shot friendly:
//
//   join <project>            hold the line — each user message prints as one JSON line the
//                             moment it's sent from the UI; re-arms silently on poll timeouts.
//                             This call HANGS by design (the hanging IS presence). --once exits
//                             after the first message (lets an agent handle one message per call).
//   say <project> "<text>"    the agent's reply into the chat (repeat calls = streamed chunks)
//   status <project> "<text>" the cooking line the user watches while the agent works
//   inbox <project>           file mode: drain pending user messages (prints JSON array) + ack
//                             them + register the listener that draws the outlined bubble.
//
// The agent instructions (agents/chat.md) are the intended reader of every output here.

async function loadHub(Client, uiUrl) {
  const { SystemView } = await Client.loadService(`${uiUrl}/systemview/api`);
  return SystemView;
}

// A refused say/status must READ like a refusal. A service error arrives in several shapes
// depending on how far it got (thrown message, error payload, raw string) — dig out the sentence
// the hub wrote, because that sentence carries the fix.
function cleanErr(err) {
  if (!err) return "unknown error";
  if (typeof err === "string") return err;
  const nested = err.error || err.data || err.body;
  return (
    err.message ||
    (nested && (nested.message || (typeof nested === "string" ? nested : null))) ||
    JSON.stringify(err)
  );
}

module.exports.join = async function join(projectCode, { uiUrl, Client, chat, agent, once = false } = {}) {
  if (!projectCode) {
    log.warn("Usage: systemview join <projectCode> [--chat name] [--once]");
    return 1;
  }
  const SystemView = await loadHub(Client, uiUrl);
  let since = Date.now();
  // Drain anything said before joining so "I said it right before you joined" isn't lost.
  try {
    const pending = await SystemView.chatDrain(projectCode, { chat, listener: `join:${agent || "agent"}`, as: agent });
    (pending.messages || []).forEach((m) => {
      console.log(JSON.stringify(m));
      since = Math.max(since, m.ts);
    });
    if ((pending.messages || []).length && once) return 0;
  } catch {}
  log.info(`joined ${projectCode}${chat ? ` (${chat})` : ""} — holding the line; user messages stream below as JSON`);
  // A deliberate disconnect (Ctrl-C / SIGTERM) says goodbye so the UI's ring drops within one
  // presence poll instead of waiting out the grace window. Best-effort, then exit.
  const goodbye = () => {
    Promise.race([
      SystemView.chatLeave(projectCode, { chat, agent }),
      new Promise((r) => setTimeout(r, 800)),
    ]).finally(() => process.exit(0));
  };
  process.on("SIGINT", goodbye);
  process.on("SIGTERM", goodbye);
  // ZOMBIE GUARD — a STREAMING join left behind by a dead session re-arms forever: the room
  // shows a live ring and swallows messages with nobody home (found live: a `systemview join
  // systemlynx` from a closed agent session lied for an hour). A streaming join with a NON-TTY
  // stdin is harness-spawned — when that stdin ends (the session behind it is gone), say goodbye
  // and exit honestly. A real terminal (TTY) is never watched, and `--once` wake-holds with
  // piped/null stdin exit on their message anyway — both stay untouched.
  if (!once && !process.stdin.isTTY) {
    try {
      process.stdin.resume();
      process.stdin.on("end", () => {
        log.info("stdin closed — the session behind this join is gone; leaving the room honestly");
        goodbye();
      });
      process.stdin.on("error", () => {});
    } catch {}
  }
  // Messages delivered THROUGH the hold must also advance this listener's drain cursor —
  // otherwise the next arm-time drain re-serves them (the "--once replays the last message" bug).
  const ackDelivered = async () => {
    try { await SystemView.chatDrain(projectCode, { chat, listener: `join:${agent || "agent"}`, as: agent }); } catch {}
  };
  // RFC-039 — THE HOLD SURVIVES A HUB THAT BLINKS, AND DIES LOUDLY WHEN IT DOESN'T COME BACK.
  //
  // Each chatJoin parks server-side ~25s; timeouts re-arm silently. What used to happen when the hub
  // RESTARTED, though, was worse than a crash: the call failed, we slept 3s, and retried forever with
  // one warning line — so an agent could sit "in the room" against a hub that had moved on, alive and
  // deaf, while the human thought it was ignoring them. It happened twice in one evening.
  //
  // An agent that is deaf cannot be TOLD it is deaf — only its own process noticing saves it. So the
  // failures are counted, the wait backs off instead of hammering, and once the hub has been gone for
  // GONE_AFTER the hold gives up, says goodbye if it can, and exits NON-ZERO. A wrapper that re-runs
  // it gets a fresh line; a wrapper that doesn't at least stops lying about being present.
  const BACKOFF = [1000, 2000, 4000, 8000, 15000];
  const GONE_AFTER = 90000; // the hub is not blinking any more, it's gone
  let downSince = 0;
  let fails = 0;
  for (;;) {
    let res;
    try {
      res = await SystemView.chatJoin(projectCode, { chat, agent, since });
      if (fails) {
        // Say it out loud: the transcript should show the gap, not skip over it.
        log.info(`line back to ${projectCode} after ${Math.round((Date.now() - downSince) / 1000)}s down`);
        fails = 0;
        downSince = 0;
      }
    } catch (err) {
      if (!downSince) downSince = Date.now();
      const gone = Date.now() - downSince;
      if (gone >= GONE_AFTER) {
        log.error(
          `the hub is gone — ${projectCode}'s line has been down ${Math.round(gone / 1000)}s ` +
            `(${(err && err.message) || err}). Leaving rather than holding a dead line.`,
        );
        try {
          await Promise.race([
            SystemView.chatLeave(projectCode, { chat, agent }),
            new Promise((r) => setTimeout(r, 800)),
          ]);
        } catch {}
        return 2; // not 1 — "the hub went away" is a different answer than "you called it wrong"
      }
      const wait = BACKOFF[Math.min(fails, BACKOFF.length - 1)];
      fails += 1;
      log.warn(
        `join interrupted (${(err && err.message) || err}) — retrying in ${wait / 1000}s ` +
          `[down ${Math.round(gone / 1000)}s of ${GONE_AFTER / 1000}s]`,
      );
      await new Promise((r) => setTimeout(r, wait));
      continue;
    }
    if (res && res.kicked) {
      // The human cleared the room — an answer, not an error, and not a judgment. The hold ends
      // here (joins bounce for a few minutes purely so retry loops don't undo his click).
      log.info(`kicked from ${projectCode} — the human cleared the room; carry on, come back when there's a reason`);
      return 0;
    }
    if (res && res.messages && res.messages.length) {
      res.messages.forEach((m) => {
        console.log(JSON.stringify(m));
        since = Math.max(since, m.ts);
      });
      await ackDelivered();
      if (once) return 0;
    }
  }
};

module.exports.say = async function say(projectCode, text, { uiUrl, Client, chat, agent, file } = {}) {
  if (!projectCode || (!text && !file)) {
    log.warn('Usage: systemview say <projectCode> "<text>" | --file <path.md> [--chat name] [--as <yourProjectCode>]');
    return 1;
  }
  // RFC-039 — `--file`, because every message is otherwise a giant double-quoted shell string:
  // backticks are command substitution, apostrophes fight the quoting, and the safe move is to
  // flatten what you write. `show` has taken a file since RFC-030; there was no reason `say` didn't.
  if (file) {
    try {
      text = require("fs").readFileSync(file, "utf8");
    } catch (e) {
      log.error(`say: couldn't read ${file} — ${e.message}`);
      return 1;
    }
  }
  const SystemView = await loadHub(Client, uiUrl);
  // RFC-031 — `--as` is the project you speak AS (a VISITOR names its own project; omitted =
  // the room's own agent). The hub REFUSES an unknown name or a room you haven't entered, and
  // that refusal has to be loud here: a swallowed say looks identical to a delivered one.
  try {
    await SystemView.chatSend(projectCode, { chat, from: "agent", text, as: agent });
  } catch (err) {
    log.error(cleanErr(err));
    return 1;
  }
  return 0;
};

// RFC-039 — ANSWER WHERE YOU WERE ASKED.
//
//   systemview reply <pc> <thread-id> "…" [--show "<title>"] [--file <path.md>] [--as <pc>]
//
// He replies INSIDE a report's threads. Until now, answering there meant a three-step document
// round-trip — read the show as JSON, splice `:::reply` blocks into the right places, push the whole
// thing back — while answering in the chat was one command. That gap is not a detail: a report he had
// replied in sat unanswered twice in one day, not because anyone decided to ignore it but because the
// wrong surface was four times cheaper. This makes the right one a one-liner.
//
// Read-modify-write of the CURRENT text, so his replies are carried, never overwritten.
module.exports.reply = async function reply(projectCode, threadId, text, { uiUrl, Client, chat, agent, show, file } = {}) {
  if (!projectCode || !threadId || (!text && !file)) {
    log.warn('Usage: systemview reply <projectCode> <thread-id> "<markdown>" | --file <path.md> [--show "<report title>"] [--as <yourPc>]');
    return 1;
  }
  let body = text || "";
  if (file) {
    try {
      body = require("fs").readFileSync(file, "utf8");
    } catch (e) {
      log.error(`reply: couldn't read ${file} — ${e.message}`);
      return 1;
    }
  }
  const SystemView = await loadHub(Client, uiUrl);
  let state = null;
  try {
    state = await SystemView.chatGetTv(projectCode, { chat, show });
  } catch (err) {
    log.error(cleanErr(err));
    return 1;
  }
  if (!state || !state.text) {
    log.warn(
      `nothing on ${projectCode}'s TV${show ? ` matching "${show}"` : ""} — put a show up first:\n` +
        `    systemview show ${projectCode} --file <report.md>`,
    );
    return 1;
  }
  const lines = String(state.text).split("\n");
  const open = lines.findIndex((l) => l.trim() === `::::thread{id=${threadId}}`);
  if (open === -1) {
    // An error that TEACHES: the ids that do exist, not just the one that doesn't.
    const ids = [...String(state.text).matchAll(/::::thread\{id=([^}]+)\}/g)].map((m) => m[1]);
    log.error(
      `no thread "${threadId}" in "${state.label || "the show"}".` +
        (ids.length ? `\n   threads here: ${ids.join(", ")}` : "\n   this show has no threads to answer in."),
    );
    return 1;
  }
  // The thread closes at the first line that is EXACTLY four colons — a reply block inside it ends
  // with three, so this can't be fooled by the replies already there.
  let close = -1;
  for (let i = open + 1; i < lines.length; i++) {
    if (lines[i].trim() === "::::") {
      close = i;
      break;
    }
  }
  if (close === -1) {
    log.error(`thread "${threadId}" is never closed in that show — fix the document before replying into it`);
    return 1;
  }
  const me = agent || projectCode;
  const block = [`:::reply{author=${me} ts=${Date.now()}}`, ...String(body).trim().split("\n"), ":::"];
  const next = [...lines.slice(0, close), ...block, ...lines.slice(close)].join("\n");
  try {
    await SystemView.chatSetTv(projectCode, { chat, state: { ...state, text: next } });
  } catch (err) {
    log.error(cleanErr(err));
    return 1;
  }
  log.info(`replied in ${threadId} on "${state.label || "the show"}"`);
  return 0;
};

module.exports.status = async function status(projectCode, text, { uiUrl, Client, chat, agent } = {}) {
  if (!projectCode) {
    log.warn('Usage: systemview status <projectCode> "<text>" [--chat name] [--as <yourPc>]   (empty text clears)');
    return 1;
  }
  const SystemView = await loadHub(Client, uiUrl);
  // RFC-031 — a visiting identity's cooking renders in its own color, under its name. Same
  // speaking gate as `say`: you can't cook in a room you haven't entered.
  try {
    await SystemView.chatStatus(projectCode, { chat, text: text || null, as: agent });
  } catch (err) {
    log.error(cleanErr(err));
    return 1;
  }
  return 0;
};

// THE TV, READ SIDE. The human answers questions/approvals/threads right on the show and his
// clicks save silently to the room's TV state — which is worthless if the agent can't read them
// back. This was the missing half of that loop (agents/chat.md promised "the hub's chatGetTv"
// with no command behind it, so agents correctly reported they could not see his answers).
module.exports.tv = async function tv(projectCode, { uiUrl, Client, chat, json = false, show } = {}) {
  if (!projectCode) {
    log.warn("Usage: systemview tv <projectCode> [<report title>] [--chat name] [--json]");
    return 1;
  }
  const SystemView = await loadHub(Client, uiUrl);
  let state = null;
  try {
    state = await SystemView.chatGetTv(projectCode, { chat, show });
  } catch (err) {
    log.error(cleanErr(err));
    return 1;
  }
  if (!state || !state.text) {
    log.warn(`nothing on ${projectCode}'s TV${chat ? ` (${chat})` : ""} — put a show up with: systemview show ${projectCode} --text "<markdown>"`);
    return 1;
  }
  if (json) {
    console.log(JSON.stringify(state));
    return 0;
  }
  // The clicked-up text IS the record of his decisions — print it verbatim so answers
  // (answer=…, verdict=…, thread replies) read exactly as they sit in the show.
  console.log("");
  console.log(`  ${state.label || "show"}${state.ts ? `   (last touched ${new Date(state.ts).toLocaleString()})` : ""}`);
  // Say plainly whether these are his answers or just the show as pushed. Silence here is how an
  // agent reads "no verdict yet" as "he hasn't looked" when in fact it re-pushed over his answers.
  if (state.supersededAnswers)
    log.warn("  this show was re-pushed since he last answered — his earlier answers were on the previous version");
  else if (state.pristine) console.log("  (as pushed — nothing clicked on this one yet)");
  console.log("");
  console.log(state.text);
  console.log("");
  return 0;
};

module.exports.inbox = async function inbox(projectCode, { uiUrl, Client, chat, agent, json = true, history = false } = {}) {
  if (!projectCode) {
    log.warn("Usage: systemview inbox <projectCode> [--chat name] [--as <yourProjectCode>] [--history]");
    return 1;
  }
  const SystemView = await loadHub(Client, uiUrl);
  // RFC-031 — a visiting identity gets its own ack cursor; the bare default keeps the "hooks"
  // cursor so existing hook installs never replay history after an upgrade.
  // RFC-039 — a cursor that has never been used starts at NOW, so first contact is quiet instead of
  // a replay of the whole room; `--history` is how you ask for the back-catalog on purpose.
  const res = await SystemView.chatDrain(projectCode, { chat, listener: agent ? `hooks:${agent}` : "hooks", as: agent, history });
  const messages = res.messages || [];
  if (json) console.log(JSON.stringify(messages));
  else messages.forEach((m) => console.log(`[${new Date(m.ts).toISOString()}] ${m.text}`));
  return 0;
};

// RFC-029 — agent control. Three verbs; each is a chat COMMAND record the open UI executes on
// the live push (and renders as a "→ …" receipt line in the thread). Section-first grammar —
// the UI is broken into sections, so the command names what it controls.
//
//   nav <pc> <Service.Module.method>          navigate to a namespace (nav + center + scratchpad follow)
//   nav <pc> center --report <path|name[#La-b]>   open a report, optionally AT a range of its lines
//   nav <pc> center --file <path[#La-b]>      pull up a file in the Code tab
//   any command  --say "…"                    the sentence the bot says while the window moves
//   nav <pc> center --tab <docs|reports|logs> switch the center tab
//   nav <pc> center --topic <help-topic>      open a help topic over the page
//   nav <pc> stats [tab] [--range <r>] [--service <s>]   walk the human to the Stats page
//                                             (tab: state|load|reliability|coverage|change|topology|coupling,
//                                              range: 15m|1h|4h|24h|all)
//   refresh <pc> [docs|reports|nav|stats|all] panes re-read their data — never a page reload
//   act <pc> test <Module.method>             run a saved test IN the UI, watchably
async function sendCommand(projectCode, { uiUrl, Client, chat, agent, cmd, args, label, say, pin }) {
  const SystemView = await loadHub(Client, uiUrl);
  await SystemView.chatCommand(projectCode, { chat, from: agent || "agent", cmd, args, label, say });
  // RFC-039 — `--pin`. The `--say` sentence is EPHEMERAL by design: it rides the trip, it is spoken
  // while the window moves, and then it is gone. That is right for a pointing line ("look here") and
  // a trap the moment real content lands in it — an agent explains something worth keeping and it
  // evaporates with the animation. `--pin` also drops the same sentence into the chat, where it
  // survives. Opt-in: the default stays ephemeral, because most of them should be.
  if (pin && say) {
    try {
      await SystemView.chatSend(projectCode, { chat, from: "agent", text: say, as: agent });
    } catch (err) {
      log.warn(`the trip was sent, but pinning it to the chat failed — ${cleanErr(err)}`);
    }
  }
  return 0;
}


// RFC-029 — nav/highlight VALIDATE namespaces against the LIVE tree before moving anyone.
// Learned live: an unvalidated route push happily walked him to a method that doesn't exist
// ("no such namespace exists" — String/ was a file on disk, never a mounted module). Suffix
// matching at every granularity: "add" / "Math.add" / "TestService.Math.add" all resolve; zero
// hits refuse with what IS there, multiple hits refuse with the list.
async function resolveLiveNs(SystemView, projectCode, nsInput) {
  const projects = await SystemView.getProjects();
  const svcs = projects[projectCode] || [];
  const rows = [];
  for (const svc of svcs) {
    rows.push(svc.serviceId);
    const modules = (svc.system && svc.system.connectionData && svc.system.connectionData.modules) || [];
    for (const m of modules) {
      rows.push(`${svc.serviceId}.${m.name}`);
      for (const f of m.methods || []) rows.push(`${svc.serviceId}.${m.name}.${f.fn}`);
    }
  }
  const want = String(nsInput).toLowerCase().split(/[./]+/).filter(Boolean);
  const hits = rows.filter((full) => {
    const segs = full.toLowerCase().split(".");
    if (want.length > segs.length) return false;
    return segs.slice(segs.length - want.length).join(".") === want.join(".");
  });
  return { hits: [...new Set(hits)], rows };
}

module.exports.nav = async function nav(projectCode, section, target, opts = {}) {
  if (!projectCode) {
    log.warn("Usage: systemview nav <projectCode> <Service.Module.method> | stats [tab] [--range <r>] [--service <s>] | center --report <path> | center --file <path[#La-b]> | center --tab <t> | center --topic <help>   [--say \"what you are showing them\"]");
    return 1;
  }
  const args = {};
  let label = "";
  // Shorthand: a namespace right after the project (`nav <pc> TestService.Math.add`).
  const nsTarget = section && !["center", "nav", "scratchpad", "page", "stats"].includes(section) ? section : target;
  if (section === "stats") {
    // RFC-032 — walk the human to the Stats page (a specific tab / time range / service focus).
    const STATS_TABS = ["state", "load", "reliability", "coverage", "change", "topology", "coupling"];
    const RANGES = ["15m", "1h", "4h", "24h", "all"];
    const stats = {};
    if (target) {
      if (!STATS_TABS.includes(target)) {
        log.error(`no stats tab "${target}" — tabs: ${STATS_TABS.join(", ")}`);
        return 1;
      }
      stats.report = target;
    }
    if (opts.range) {
      if (!RANGES.includes(opts.range)) {
        log.error(`no range "${opts.range}" — ranges: ${RANGES.join(", ")}`);
        return 1;
      }
      stats.range = opts.range;
    }
    if (opts.service) {
      // Same validation principle as namespaces: never send the human to a service that isn't there.
      const SystemView = await loadHub(opts.Client, opts.uiUrl);
      const projects = await SystemView.getProjects();
      const svcIds = (projects[projectCode] || []).map((s) => s.serviceId);
      const hit = svcIds.find((s) => s.toLowerCase() === String(opts.service).toLowerCase());
      if (!hit) {
        log.error(`no service "${opts.service}" in ${projectCode} — services: ${svcIds.join(", ") || "(none)"}`);
        return 1;
      }
      stats.service = hit;
    }
    args.stats = stats;
    label = `opened stats${stats.report ? ` — ${stats.report}` : ""}${stats.range ? `, last ${stats.range === "all" ? "everything" : stats.range}` : ""}${stats.service ? `, focused on ${stats.service}` : ""}`;
  } else if (opts.report) {
    // A REPORT OPENS AT A RANGE TOO. Rendered markdown has no lines, but every block carries the
    // source range it came from, so the same `#L10-20` address works on a document you are only
    // reading — the window points at the blocks the range covers.
    // `#L274-378` and `#L274-L378` both mean the same thing — a split on "#L" left the second L
    // stuck to the number and parsed it as NaN, so the range silently became half a range.
    const rm = String(opts.report).match(/^(.*?)#L(\d+)(?:-L?(\d+))?$/i);
    const rp = rm ? rm[1] : String(opts.report);
    const rl = rm ? `${rm[2]}${rm[3] ? `-${rm[3]}` : ""}` : "";
    args.report = rp;
    if (rm) args.lines = [Number(rm[2]), Number(rm[3] || rm[2])];
    label = `opened report ${rp.split("/").pop()}${rl ? `#L${rl}` : ""}`;
  } else if (opts.file) {
    // Same tolerance as --report: `#L40-70` and `#L40-L70` are the same address.
    const fm = String(opts.file).match(/^(.*?)#L(\d+)(?:-L?(\d+))?$/i);
    const p = fm ? fm[1] : String(opts.file);
    const l = fm ? `${fm[2]}${fm[3] ? `-${fm[3]}` : ""}` : "";
    args.file = p;
    if (fm) args.lines = [Number(fm[2]), Number(fm[3] || fm[2])];
    label = `pulled up ${p}${l ? `#L${l}` : ""}`;
  } else if (opts.tab) {
    args.tab = opts.tab;
    label = `switched to the ${opts.tab} tab`;
  } else if (opts.topic) {
    args.help = opts.topic;
    label = `opened help: ${opts.topic}`;
  } else if (nsTarget) {
    const SystemView = await loadHub(opts.Client, opts.uiUrl);
    const { hits } = await resolveLiveNs(SystemView, projectCode, nsTarget);
    if (!hits.length) {
      log.error(`no live namespace matches "${nsTarget}" in ${projectCode} — nothing sent`);
      return 1;
    }
    if (hits.length > 1) {
      log.error(`"${nsTarget}" is ambiguous:\n${hits.slice(0, 8).map((h) => "    " + h).join("\n")}`);
      return 1;
    }
    args.namespace = hits[0];
    label = `navigated to ${hits[0]}`;
  } else {
    log.warn("nav: nothing to navigate to — give a namespace, `stats [tab]`, or --report/--file/--tab/--topic");
    return 1;
  }
  return sendCommand(projectCode, { ...opts, cmd: "nav", args, label });
};

module.exports.refresh = async function refresh(projectCode, scope, opts = {}) {
  if (!projectCode) {
    log.warn("Usage: systemview refresh <projectCode> [docs|reports|nav|stats|all]");
    return 1;
  }
  const s = ["docs", "reports", "nav", "stats", "all"].includes(scope) ? scope : "all";
  return sendCommand(projectCode, {
    ...opts,
    cmd: "refresh",
    args: { scope: s },
    label: `refreshed ${s === "all" ? "everything" : s}`,
  });
};

module.exports.act = async function act(projectCode, kind, target, opts = {}) {
  if (!projectCode || !["test", "run"].includes(kind) || !target) {
    log.warn('Usage: systemview act <projectCode> test <Module.method|all>  |  act <projectCode> run "<block title>"');
    return 1;
  }
  if (kind === "run") {
    // Press a `:::run` block's play in the OPEN document, by its title.
    return sendCommand(projectCode, {
      ...opts,
      cmd: "act",
      args: { run: target },
      label: `pressed play on "${target}"`,
    });
  }
  return sendCommand(projectCode, {
    ...opts,
    cmd: "act",
    args: { test: target },
    label: target === "all" ? "ran ALL the saved tests" : `ran ${target} in the saved tests`,
  });
};

// RFC-029 — `highlight` is NOT `nav` (his line: "highlight and selection are two different
// commands"): highlight POINTS the tree at a thing — expands to it, marks it, scrolls it into
// view — and touches nothing else; nav actually opens/selects.
module.exports.highlight = async function highlight(projectCode, target, opts = {}) {
  if (!projectCode) {
    log.warn("Usage: systemview highlight <projectCode> <Service.Module.method>  |  highlight <projectCode> --file <path>");
    return 1;
  }
  const args = {};
  let label = "";
  if (opts.file) {
    args.file = String(opts.file).split("#L")[0];
    label = `highlighted ${args.file}`;
  } else if (target) {
    const SystemView = await loadHub(opts.Client, opts.uiUrl);
    const { hits } = await resolveLiveNs(SystemView, projectCode, target);
    if (!hits.length) {
      log.error(`no live namespace matches "${target}" in ${projectCode} — nothing sent`);
      return 1;
    }
    if (hits.length > 1) {
      log.error(`"${target}" is ambiguous:\n${hits.slice(0, 8).map((h) => "    " + h).join("\n")}`);
      return 1;
    }
    args.namespace = hits[0];
    label = `highlighted ${hits[0]}`;
  } else {
    log.warn("highlight: give a namespace or --file <path>");
    return 1;
  }
  return sendCommand(projectCode, { ...opts, cmd: "highlight", args, label });
};

// RFC-030-ish — THE TV. `show` pushes interactive markdown onto the chat's TV surface (the
// Canvas model: one show at a time, every show stays clickable in the thread). Content rides IN
// the command record — that's what makes history/replay free.
module.exports.show = async function show(projectCode, { uiUrl, Client, chat, agent, text, file, clear } = {}) {
  if (!projectCode || (!text && !file && !clear)) {
    log.warn('Usage: systemview show <projectCode> --text "<markdown>" | --file <path.md> | --clear');
    return 1;
  }
  if (clear) {
    return sendCommand(projectCode, { uiUrl, Client, chat, agent, cmd: "show", args: { clear: true }, label: "cleared the TV" });
  }
  let content = text || "";
  let label = "";
  if (file) {
    try {
      content = require("fs").readFileSync(file, "utf8");
    } catch (e) {
      log.error(`show: couldn't read ${file} — ${e.message}`);
      return 1;
    }
  }
  // Label = the first heading if there is one, else the file name, else a text snippet.
  const heading = (content.match(/^#{1,6}\s+(.+)$/m) || [])[1];
  label = heading || (file ? String(file).split("/").pop() : content.trim().slice(0, 48));
  return sendCommand(projectCode, { uiUrl, Client, chat, agent, cmd: "show", args: { text: content }, label });
};
