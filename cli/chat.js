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
  // The hold: each chatJoin call parks server-side ~25s; timeouts re-arm silently. Ctrl-C leaves.
  for (;;) {
    let res;
    try {
      res = await SystemView.chatJoin(projectCode, { chat, agent, since });
    } catch (err) {
      log.warn(`join interrupted (${(err && err.message) || err}) — retrying in 3s`);
      await new Promise((r) => setTimeout(r, 3000));
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

module.exports.say = async function say(projectCode, text, { uiUrl, Client, chat, agent } = {}) {
  if (!projectCode || !text) {
    log.warn('Usage: systemview say <projectCode> "<text>" [--chat name] [--as <yourProjectCode>]');
    return 1;
  }
  const SystemView = await loadHub(Client, uiUrl);
  // RFC-031 — `--as` is the project you speak AS (a VISITOR names its own project; omitted =
  // the room's own agent). The hub canonicalizes: unknown names collapse to the room.
  await SystemView.chatSend(projectCode, { chat, from: "agent", text, as: agent });
  return 0;
};

module.exports.status = async function status(projectCode, text, { uiUrl, Client, chat, agent } = {}) {
  if (!projectCode) {
    log.warn('Usage: systemview status <projectCode> "<text>" [--chat name] [--as <yourPc>]   (empty text clears)');
    return 1;
  }
  const SystemView = await loadHub(Client, uiUrl);
  // RFC-031 — a visiting identity's cooking renders in its own color, under its name.
  await SystemView.chatStatus(projectCode, { chat, text: text || null, as: agent });
  return 0;
};

module.exports.inbox = async function inbox(projectCode, { uiUrl, Client, chat, agent, json = true } = {}) {
  if (!projectCode) {
    log.warn("Usage: systemview inbox <projectCode> [--chat name] [--as <yourProjectCode>]");
    return 1;
  }
  const SystemView = await loadHub(Client, uiUrl);
  // RFC-031 — a visiting identity gets its own ack cursor; the bare default keeps the "hooks"
  // cursor so existing hook installs never replay history after an upgrade.
  const res = await SystemView.chatDrain(projectCode, { chat, listener: agent ? `hooks:${agent}` : "hooks", as: agent });
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
//   nav <pc> center --report <path|name>      open a report on the Stage tab
//   nav <pc> center --file <path[#La-b]>      pull up a file in the Code tab
//   nav <pc> center --tab <docs|reports|logs> switch the center tab
//   nav <pc> center --topic <help-topic>      open a help topic over the page
//   nav <pc> stats [tab] [--range <r>] [--service <s>]   walk the human to the Stats page
//                                             (tab: state|load|reliability|coverage|change|topology|coupling,
//                                              range: 15m|1h|4h|24h|all)
//   refresh <pc> [docs|reports|nav|stats|all] panes re-read their data — never a page reload
//   act <pc> test <Module.method>             run a saved test IN the UI, watchably
async function sendCommand(projectCode, { uiUrl, Client, chat, agent, cmd, args, label }) {
  const SystemView = await loadHub(Client, uiUrl);
  await SystemView.chatCommand(projectCode, { chat, from: agent || "agent", cmd, args, label });
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
    log.warn("Usage: systemview nav <projectCode> <Service.Module.method> | stats [tab] [--range <r>] [--service <s>] | center --report <path> | center --file <path[#La-b]> | center --tab <t> | center --topic <help>");
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
    args.report = opts.report;
    label = `opened report ${opts.report.split("/").pop()}`;
  } else if (opts.file) {
    const [p, l] = String(opts.file).split("#L");
    args.file = p;
    if (l) args.lines = l.split("-").map((n) => parseInt(n, 10));
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
