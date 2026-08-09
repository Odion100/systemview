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
    const pending = await SystemView.chatDrain(projectCode, { chat, listener: `join:${agent || "agent"}` });
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
      SystemView.chatLeave(projectCode, { chat }),
      new Promise((r) => setTimeout(r, 800)),
    ]).finally(() => process.exit(0));
  };
  process.on("SIGINT", goodbye);
  process.on("SIGTERM", goodbye);
  // Messages delivered THROUGH the hold must also advance this listener's drain cursor —
  // otherwise the next arm-time drain re-serves them (the "--once replays the last message" bug).
  const ackDelivered = async () => {
    try { await SystemView.chatDrain(projectCode, { chat, listener: `join:${agent || "agent"}` }); } catch {}
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

module.exports.say = async function say(projectCode, text, { uiUrl, Client, chat } = {}) {
  if (!projectCode || !text) {
    log.warn('Usage: systemview say <projectCode> "<text>" [--chat name]');
    return 1;
  }
  const SystemView = await loadHub(Client, uiUrl);
  await SystemView.chatSend(projectCode, { chat, from: "agent", text });
  return 0;
};

module.exports.status = async function status(projectCode, text, { uiUrl, Client, chat } = {}) {
  if (!projectCode) {
    log.warn('Usage: systemview status <projectCode> "<text>" [--chat name]   (empty text clears)');
    return 1;
  }
  const SystemView = await loadHub(Client, uiUrl);
  await SystemView.chatStatus(projectCode, { chat, text: text || null });
  return 0;
};

module.exports.inbox = async function inbox(projectCode, { uiUrl, Client, chat, json = true } = {}) {
  if (!projectCode) {
    log.warn("Usage: systemview inbox <projectCode> [--chat name]");
    return 1;
  }
  const SystemView = await loadHub(Client, uiUrl);
  const res = await SystemView.chatDrain(projectCode, { chat, listener: "hooks" });
  const messages = res.messages || [];
  if (json) console.log(JSON.stringify(messages));
  else messages.forEach((m) => console.log(`[${new Date(m.ts).toISOString()}] ${m.text}`));
  return 0;
};
