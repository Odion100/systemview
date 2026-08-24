const { createClient, App } = require("systemlynx");
const { createCookieHttpClient } = require("../cli/cookieClient");
const { headersFor } = require("../cli/manifestHeaders");
const ConnectedServices = require("./Connections")();
const CLIHistory = require("./CLIHistory")();
const Settings = require("./Settings")();
const Comments = require("./Comments")();
const Stage = require("./Stage")();
// WHERE A PROJECT LIVES ON DISK — one resolver, one precedence, used by everything that needs to
// put a project's data with that project. Order matters: a HOSTED project's directory is known for
// certain from the registry that stood it up; otherwise we take the root its own plugin reports on
// the connection (systemview-plugin ≥ 2.16 — `getConnection()` carries it, and refreshConnections
// re-pulls that, so it arrives on its own). Unknown root = null, and the caller falls back to the
// hub rather than guessing a path.
function projectRoot(projectCode) {
  if (!projectCode) return null;
  // `fs` is not in this module's scope (only `path` is) — and a bare reference here would throw a
  // ReferenceError straight into the catch below, silently answering "root unknown" forever. That
  // exact trap already cost us once on the /sv-bundle route.
  const fs = require("fs");
  try {
    const registry = JSON.parse(fs.readFileSync(path.join(__dirname, "hosted.json"), "utf8"));
    const hit = (Array.isArray(registry) ? registry : []).find((e) => e && e.folder === projectCode);
    if (hit && hit.projectDir) return hit.projectDir;
  } catch {}
  try {
    const conn = ConnectedServices.getAllConnections().find(
      (c) => c.projectCode === projectCode && c.root,
    );
    if (conn) return conn.root;
  } catch {}
  return null;
}
// THE PROJECT SERVES ITS OWN ROOM. `SystemViewChat` lives in the project's process and owns the
// file; the hub holds a warm client per project plus a subscription to its `chat` event. Kept in a
// cache because the store's paths are synchronous: `projectChat()` answers instantly with whatever
// is warm, and warming happens off to the side. A project with no entry (old plugin, unreachable,
// not yet warmed) simply falls back to the hub holding its room — nothing breaks, it just does not
// migrate yet.
const chatClients = new Map(); // projectCode → { Chat, url }
const chatWarming = new Set();
function projectChat(projectCode) {
  const entry = chatClients.get(projectCode);
  return entry ? entry.Chat : null;
}
// WHICH SERVICE SERVES THE ROOM — a project is not one process. It can have four services, and in
// a MIXED project only some of them carry `SystemViewChat` (mid-rollout: one restarted on the new
// plugin, three still running the old one). Taking whichever candidate happened to be first in the
// connections file made the room's location depend on connection order — restart in another order
// and the room appears somewhere else, i.e. history "vanishes". So the pick is deterministic and
// root-anchored: a service whose own root is the project's root wins (its `.systemview/` is the one
// the reports and manifests already use), and ties break on serviceId so the answer is stable
// across restarts. Same project, same room, every time.
// EVERY candidate, best first — not just one. A project can carry the module on several services,
// and picking the alphabetically-first one made the whole room hostage to that service being healthy:
// buAPI advertises SystemViewChat on five, `Basketball` sorts first, and every call into it 500s in
// their own auth middleware — so the hub could never read buAPI's room, never completed the handover,
// and fell back to its own stale copy. The room a human sees should not depend on an alphabet.
function chatServicesFor(projectCode) {
  let candidates = [];
  try {
    candidates = ConnectedServices.getAllConnections().filter(
      (c) =>
        c.projectCode === projectCode &&
        ((c.system && c.system.connectionData && c.system.connectionData.modules) || []).some(
          (m) => m.name === "SystemViewChat",
        ),
    );
  } catch {}
  if (!candidates.length) return [];
  const root = projectRoot(projectCode);
  const byId = (a, b) => String(a.serviceId || "").localeCompare(String(b.serviceId || ""));
  const atRoot = candidates.filter((c) => c.root && root && c.root === root).sort(byId);
  const rest = candidates.filter((c) => !atRoot.includes(c)).sort(byId);
  return [...atRoot, ...rest];
}
// Hand the project everything the hub buffered for it while it could not serve its own room, then
// retire the hub's file. Deduped by id, so a half-finished flush just retries next tick — and a
// room the hub buffered that the project has never heard of still moves, because the rooms come
// from the HUB's directory, not the project's list.
async function flushOutbox(ctx, projectCode, Chat) {
  let moved = 0;
  // SAME-DIRECTORY GUARD. SystemView's own hub runs from the repo that is ALSO the `systemview-test`
  // project, so `.systemview/chats/` is one directory wearing two hats: the hub's fallback and that
  // project's own room. Flushing there would diff a file against itself, move nothing, and then
  // retire the live room to `.flushed` — the conversation would come back empty. The owner states
  // its directory (`chatDir`); if it matches ours there is nothing to hand over.
  try {
    const theirs = await Chat.chatDir();
    if (theirs && theirs.dir && path.resolve(theirs.dir) === path.resolve(Chats.dirFor(projectCode)))
      return 0;
  } catch {
    return 0; // an older plugin can't tell us where it keeps things — don't touch its files
  }
  for (const room of Chats.outboxRooms(projectCode)) {
    try {
      const buffered = Chats.outbox(projectCode, room);
      const theirs = (await Chat.chatRead({ chat: room })) || [];
      const have = new Set(theirs.map((r) => r && r.id));
      const missing = buffered
        .filter((r) => r && r.id && !have.has(r.id))
        .sort((a, b) => a.ts - b.ts);
      for (const record of missing) await Chat.chatAppend({ chat: room, record });
      Chats.retireOutbox(projectCode, room); // only after every record is safely across
      moved += missing.length;
    } catch {
      /* the project blinked mid-flush — the hub file stays put and the next tick retries */
    }
  }
  if (moved) ctx.emit(`chat-presence:${projectCode}`, presenceFor(projectCode));
  return moved;
}
// Warm every connected project's chat, at BOOT. This is the fix for how records got stranded in
// the first place: warming used to start only when something first touched chat (the sweep arms on
// the first send/presence call), so the very first message after a hub restart was always written
// to the hub's fallback file — a fresh outbox created by the restart itself. Warming before anyone
// speaks means the project is already serving its own room by the time the first word arrives.
// Retried on a short ramp because services reconnect asynchronously after the connection probe:
// at ready almost nothing is back yet.
// At boot there is no module context yet — that only arrives when a UI or CLI first calls a chat
// method. So warming emits through a forwarder: no-op until someone shows up, the real module the
// moment one does. (A stub that captured nothing would silently drop the presence push that lands
// right as the first panel opens.)
let chatCtx = null;
const bootCtx = { emit: (...a) => { if (chatCtx) chatCtx.emit(...a); } };
function warmAllChats(ctx) {
  const pass = () => {
    let codes = [];
    try {
      codes = [...new Set(ConnectedServices.getAllConnections().map((c) => c.projectCode))];
    } catch {}
    for (const pc of codes)
      warmProjectChat(ctx, pc)
        .then(() => reconcileProjectChat(ctx, pc))
        .catch(() => {});
  };
  [0, 3000, 10000, 25000].forEach((ms) => setTimeout(pass, ms));
}
// Warm (and re-warm) a project's chat client. Idempotent, and re-runs when the service URL changes
// — a restarted service gets a new port, and a client pinned to the old one is a silent dead end.
async function warmProjectChat(ctx, projectCode) {
  if (chatWarming.has(projectCode)) return;
  const services = chatServicesFor(projectCode);
  if (!services.length) return; // this project's plugin predates the module — the hub keeps its room
  const current = chatClients.get(projectCode);
  // Keep a working client as long as its service is still connected; only re-warm when the one we
  // are on has gone (a restarted service comes back on a new port).
  if (current && services.some((c) => c.system.connectionData.serviceUrl === current.url)) return;
  chatWarming.add(projectCode);
  try {
    for (const service of services) {
      const url = service.system.connectionData.serviceUrl;
      let Chat = null;
      try {
        const client = await createClient(httpClient).loadService(url);
        Chat = client.SystemViewChat;
        if (!Chat) continue;
        // ADVERTISING THE MODULE IS NOT THE SAME AS ANSWERING. Prove it can actually serve before
        // committing the whole project's room to it — a service whose own middleware throws on every
        // call will happily list SystemViewChat and then 500 on everything.
        await Chat.chatDir();
      } catch {
        continue; // this one can't serve — try the next service that carries the module
      }
      // The event is the FAST path; `Chats.absorb` also reconciles by reading since its last known
      // record, so a dropped subscription makes a record late rather than lost.
      Chat.on("chat", ({ chat, record }) => {
        try {
          Chats.absorb(projectCode, chat, record);
          ctx.emit(`chat-updated:${projectCode}`, { chat, record });
          ctx.emit(`chat-presence:${projectCode}`, presenceFor(projectCode));
        } catch {}
      });
      chatClients.set(projectCode, { Chat, url });
      // FLUSH FIRST, then hydrate. Order matters: hydrating first would fill the mirror from a file
      // that is still missing whatever the hub buffered, and the next append would write on top of a
      // short room. Flushing first means the read below is already the whole conversation.
      try {
        await flushOutbox(ctx, projectCode, Chat);
      } catch {}
      // Hydrate the hub's mirror from the project — the file is the truth, so this can only correct
      // the hub. Every room the project holds, not just `main`.
      try {
        const rooms = (await Chat.chatList()) || [Chats.DEFAULT_CHAT];
        for (const room of rooms.length ? rooms : [Chats.DEFAULT_CHAT]) {
          Chats.hydrate(projectCode, room, await Chat.chatRead({ chat: room }));
        }
        ctx.emit(`chat-presence:${projectCode}`, presenceFor(projectCode));
      } catch {}
      return; // warmed
    }
  } finally {
    chatWarming.delete(projectCode);
  }
}

const Chats = require("./Chats")({ chatFor: projectChat });
// The UI server calls services the same way the CLI does: through the manifest-header client,
// so operator-authored headers (e.g. an Origin for a gated dev session — see cli/manifestHeaders.js)
// are attached to every outbound call and every probe. One resolver, shared with the CLI; the UI is
// driven off the same manifest format (RFC-007). Without this the UI cannot reach a gated service.
const httpClient = createCookieHttpClient();
const Client = createClient(httpClient);
const route = "systemview/api";
const host = "localhost";
const express = require("express");
const path = require("path");

const isUrl = (str) =>
  /^(http:\/\/|https:\/\/)?((localhost|\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})|([a-z0-9]+([\-\.]{1}[a-z0-9]+)*\.[a-z]{2,}))(:[0-9]{1,5})?(\/.*)?$/i.test(
    str,
  );

function connect({ system, projectCode, serviceId, specList, credentials, dynamic, hosted }) {
  const { service, index } = ConnectedServices.findService(
    system.connectionData.serviceUrl,
    projectCode,
  );

  if (service) {
    service.system = system;
    service.projectCode = projectCode;
    service.serviceId = serviceId;
    service.specList = specList;
    service.credentials = !!credentials;
    // RFC-021 — project-defined (synthesized) service: no live URL. The flag must survive every
    // rewrite of the entry or refreshConnections would treat it as a dead service and drop it.
    service.dynamic = !!dynamic;
    // RFC-027 — CLI-hosted service: the value is the committed folder (relative to the repo root).
    service.hosted = hosted || false;
    ConnectedServices.save(service, index);
  } else
    ConnectedServices.save({
      system,
      projectCode,
      serviceId,
      specList,
      credentials: !!credentials,
      dynamic: !!dynamic,
      hosted: hosted || false,
    });
}

function updateSpecList(specList, projectCode, serviceId) {
  const { service, index } = ConnectedServices.findService(
    undefined,
    projectCode,
    serviceId,
  );
  if (service) {
    service.specList = specList;
    ConnectedServices.save(service, index);
    this.emit(`spec-list-updated:${projectCode}`, {
      projectCode,
      serviceId,
      specList,
    });
  }
}
function getServices(searchText) {
  if (isUrl(searchText)) {
    // Always (re)pull from the URL — one URL brings in the whole project manifest. Don't short-circuit
    // to a stored entry (the old path relabeled the project "SystemLynx" and skipped the manifest).
    return getConnectionData(searchText);
  } else {
    return ConnectedServices.findProject(searchText);
  }
}

async function getConnectionData(url) {
  try {
    const connectionData = await httpClient.request({ url });
    if (!connectionData || !connectionData.SystemLynxService) return [];
    const svc = Client.createService(connectionData);

    // One URL → the whole project: try the plugin manifest first (every service), then fall back
    // to this single service's connection, then a bare connected-services entry (no plugin).
    try {
      const manifest = await svc.Plugin.getManifest();
      if (manifest && manifest.services && manifest.services.length) {
        const projects = manifest.services.map((s) => ({
          system: s.system,
          projectCode: manifest.projectCode,
          serviceId: s.serviceId,
          specList: s.specList || { tests: [], docs: [] },
          credentials: !!s.credentials,
        }));
        projects.forEach(connect);
        return projects;
      }
    } catch {}

    let project;
    try {
      const connection = await svc.Plugin.getConnection();
      project = {
        system: connection.system,
        projectCode: connection.projectCode,
        serviceId: connection.serviceId,
        specList: connection.specList,
        credentials: !!connection.credentials,
      };
    } catch {
      const routeSegs = (connectionData.route || "").split("/").filter(Boolean);
      const serviceId = [...routeSegs].reverse().find((s) => s.toLowerCase() !== "api") || "Service";
      project = {
        system: { connectionData },
        serviceId,
        projectCode: "connected-services",
        specList: { tests: [], docs: [] },
      };
    }
    connect(project);
    return [project];
  } catch (error) {
    return [];
  }
}
function getProjects() {
  const connections = ConnectedServices.getAllConnections();
  const projects = {};
  connections.forEach(({ projectCode, serviceId, system, specList, credentials, dynamic, hosted, root }) => {
    if (!projects[projectCode]) projects[projectCode] = [];
    projects[projectCode].push({
      serviceId,
      // THE DIRECTORY THIS SERVICE RUNS FROM. It has always been on the connection record and was
      // never handed to the browser — which is why the nav could only tell projects apart by NAME,
      // and why one directory arriving under two names (the plugin's `systemview-test` and the
      // host's folder name `systemview`) drew two cards for one folder. A project is a directory;
      // the UI cannot act on that while the directory is the one field it can't see.
      root: root || null,
      serviceUrl: system.connectionData.serviceUrl,
      connectionData: system.connectionData,
      system,
      specList: specList || { tests: [], docs: [] },
      // Resolved headers for this service's origin (@file already deref'd to values, server-side —
      // the browser has no filesystem). The UI calls svc.setHeaders(headers) after createService so
      // every browser-run test/log/probe carries them. Same manifest.headers store as the CLI.
      headers: headersFor(system.connectionData.serviceUrl),
      // Cookie-credentialed declaration (RFC-013): the service's plugin registered credentials:true,
      // meaning it authenticates via session cookies (no header profile) — the browser must mark its
      // origin credentialed so withCredentials rides from the very first request.
      credentials: !!credentials,
      // RFC-021 — project-defined (synthesized) service: rendered under its CODEBASE in the file
      // lens, not in the SystemLynx services nav.
      dynamic: !!dynamic,
      // RFC-027 — CLI-hosted (a LIVE service the hub runs from the project's committed folder).
      // The value is that folder, relative to the repo root — the UI shows where the config lives
      // and wears the plum indicator off this flag.
      hosted: hosted || false,
    });
  });
  return projects;
}

// RFC-027 — deleting a HOSTED service must actually unhost it (stop the app, remove the manifest
// registration) or the next boot resurrects it. `hostingUnit` is set when the server launches.
let hostingUnit = null;

async function deleteService(projectCode, serviceId) {
  if (hostingUnit) await hostingUnit.unhost(projectCode, serviceId);
  ConnectedServices.deleteService(projectCode, serviceId);
}

async function deleteProject(projectCode) {
  if (hostingUnit) await hostingUnit.unhost(projectCode);
  ConnectedServices.deleteProject(projectCode);
}

// RFC-018 — the AI Window stage. Each mutation ends by broadcasting the new stage over sockets to
// every open UI for that project (`stage-updated:<projectCode>`), reusing the exact push pattern as
// updateSpecList above. `this.emit` is bound to the module by systemlynx. getStage lets a UI
// rehydrate the current stage on mount / reconnect. The stage holds only targets — never file bytes.
function getStage(projectCode) {
  return Stage.get(projectCode);
}
function emitStage(ctx, projectCode, stage) {
  ctx.emit(`stage-updated:${projectCode}`, stage);
  return stage;
}
function assembleStage(projectCode, spec) {
  return emitStage(this, projectCode, Stage.assemble(projectCode, spec || {}));
}
function showTarget(projectCode, pane) {
  return emitStage(this, projectCode, Stage.show(projectCode, pane));
}
function addPane(projectCode, pane) {
  return emitStage(this, projectCode, Stage.addPane(projectCode, pane));
}
function removePane(projectCode, paneId) {
  return emitStage(this, projectCode, Stage.removePane(projectCode, paneId));
}
function clearStage(projectCode) {
  return emitStage(this, projectCode, Stage.clear(projectCode));
}
function setStageLayout(projectCode, layout) {
  return emitStage(this, projectCode, Stage.setLayout(projectCode, layout));
}
function highlightPane(projectCode, paneId, highlight) {
  return emitStage(this, projectCode, Stage.highlight(projectCode, paneId, highlight));
}
function pinPane(projectCode, paneId, pinned) {
  return emitStage(this, projectCode, Stage.pin(projectCode, paneId, pinned));
}
function setPaneSpan(projectCode, paneId, span) {
  return emitStage(this, projectCode, Stage.setSpan(projectCode, paneId, span));
}
function reorderPanes(projectCode, ids) {
  return emitStage(this, projectCode, Stage.reorder(projectCode, ids));
}
// Reverse channel (UI → agent). setSelection is fire-and-forget from the browser; getSelection is what
// the agent reads via the CLI. No broadcast needed — the agent pulls, it doesn't watch.
function setSelection(projectCode, selection) {
  Stage.setSelection(projectCode, selection);
  return { ok: true };
}
function getSelection(projectCode) {
  return Stage.getSelection(projectCode);
}

// RFC-018 saved views — persist the live stage as a reopenable "communication". Storage lives in the
// observed project's `.systemview/views/` (via any of its service plugins, since siblings share a
// cwd), so views travel with the repo. The API orchestrates: it holds the stage, the plugin the disk.
function projectPlugin(projectCode) {
  const services = ConnectedServices.findProject(projectCode) || [];
  // A project can contain services with NO plugin — a codebase entry, or a service that registers
  // without the SystemView module (SystemViewCore). Taking the FIRST service returns a client with no
  // `.Plugin`, so every story/view op fails with "no connected service for project" purely on
  // connection ORDER. Prefer a service that actually exposes the Plugin module.
  const exposesPlugin = (s) =>
    ((s.system && s.system.connectionData && s.system.connectionData.modules) || []).some(
      (m) => m.name === "Plugin",
    );
  const svc =
    services.find((s) => s.system && s.system.connectionData && exposesPlugin(s)) ||
    services.find((s) => s.system && s.system.connectionData);
  if (!svc) return null;
  const client = Client.createService(svc.system.connectionData);
  return client && client.Plugin ? client.Plugin : null;
}
async function saveView(projectCode, name) {
  const Plugin = projectPlugin(projectCode);
  if (!Plugin) throw new Error(`no connected service for project "${projectCode}"`);
  return Plugin.saveView({ name, view: Stage.get(projectCode) });
}
async function openView(projectCode, name) {
  const Plugin = projectPlugin(projectCode);
  if (!Plugin) throw new Error(`no connected service for project "${projectCode}"`);
  const view = await Plugin.getView({ name });
  if (!view) throw new Error(`no saved view "${name}" for "${projectCode}"`);
  return emitStage(this, projectCode, Stage.assemble(projectCode, view));
}
async function listViews(projectCode) {
  const Plugin = projectPlugin(projectCode);
  return Plugin ? (await Plugin.listViews()) || [] : [];
}
async function deleteView(projectCode, name) {
  const Plugin = projectPlugin(projectCode);
  if (!Plugin) throw new Error(`no connected service for project "${projectCode}"`);
  return Plugin.deleteView({ name });
}

// (RFC-018's STORIES machinery lived here until the sweep — the CLI already answered every story verb
// with "stories are retired — write a REPORT instead", the /stories UI was unreachable, and the
// plugin methods these called were retired in systemview-plugin 2.23.0. Old .systemview/stories/
// files are left untouched on disk.)

// RFC-028 — agent presence: the chat front door. One JSONL file per chat serves BOTH transports
// (join = pushed live down a held poll, file = drained at turn boundaries); presence is derived
// from the real connections. Every append broadcasts so the open UI's bubble/panel stays live —
// the same push pattern as the stage above.
// RFC-031 — identities ARE project codes. An `--as` that names another LIVE project is a
// VISITOR speaking as that project; anything else (legacy "claude", no --as at all) canonicalizes
// to the room's own project — you're its home agent. This one function is also the self-loop
// guard's other half: made-up handles can never mint a deliverable third identity.
function canonIdentity(projectCode, as) {
  if (!as || as === projectCode) return projectCode;
  try {
    const known = ConnectedServices.getAllConnections().some((c) => c.projectCode === as);
    return known ? as : projectCode;
  } catch {
    return projectCode;
  }
}
// SPEAKING is gated where READING is open (his catch, 2026-08-09). Two silent failures lived
// here, and the second is the one that bit: (1) a visitor could fire into a room it had never
// entered — the drive-by; (2) an unrecognized `--as` (a legacy handle, a typo) silently BECAME
// the room's own agent, so the message was recorded as the room talking to itself, the self-loop
// guard correctly delivered it to NOBODY, and it still looked sent. Both refuse now, and the
// refusal carries the fix. Reading (join/inbox/presence) keeps canonIdentity's forgiving collapse
// — a bad name there costs nothing but its own cursor.
function resolveSpeaker(projectCode, chat, as) {
  if (!as || as === projectCode) return projectCode; // the room's own agent — file-mode included
  let known = false;
  try {
    known = ConnectedServices.getAllConnections().some((c) => c.projectCode === as);
  } catch {}
  if (!known)
    throw new Error(
      `"${as}" is not a connected project — identities ARE project codes (RFC-031). Speak as your own project (--as <yourProjectCode>), or drop --as to speak as ${projectCode}'s own agent.`,
    );
  // Arriving IS entering. The pre-entry gate was a proof-of-presence built on holds, and holds are
  // what this replaced; the identity check above is the proof that survives. The visit is still
  // recorded, so presence and the "who jumped into whose chat" display stay honest.
  if (!Chats.hasEntered(projectCode, chat || Chats.DEFAULT_CHAT, as))
    Chats.enterBySpeaking(projectCode, chat || Chats.DEFAULT_CHAT, as);
  return as;
}
// Presence with the identity-canon predicate — a "join:claude" cursor is the HOME agent's
// (canonIdentity collapses unknown/self names to the room), so `pending` counts against the
// right cursor everywhere presence is computed.
function presenceFor(pc) {
  return Chats.presence(pc, { isHome: (name) => canonIdentity(pc, name) === pc });
}
// The presence reaper — decay never pushed to open panels before (his catch: "still says you're
// visiting" long after the hold died). The module context is only reachable from method calls,
// so the first chat call arms the interval; UI presence polls guarantee that's within seconds
// of boot. Each sweep event pushes the departure line / ring drop / status clear live.
let chatSweepArmed = false;
function armChatSweep(ctx) {
  chatCtx = ctx; // hand the boot forwarder a real emitter the first time anyone touches chat
  if (chatSweepArmed) return;
  chatSweepArmed = true;
  setInterval(() => {
    let events = [];
    try { events = Chats.sweep(); } catch { return; }
    for (const ev of events) {
      if (ev.record) ctx.emit(`chat-updated:${ev.pc}`, { chat: ev.chat, record: ev.record });
      if (ev.statusCleared) emitStatuses(ctx, ev.pc, ev.chat);
      ctx.emit(`chat-presence:${ev.pc}`, presenceFor(ev.pc));
      if (ev.identity !== ev.pc) ctx.emit(`chat-presence:${ev.identity}`, presenceFor(ev.identity));
    }
    // Same tick: keep every project's chat client warm, and RECONCILE. A subscription is a fast
    // path, never a guarantee — a service restart or a dropped socket kills it silently, and the
    // symptom is the worst kind (everything looks connected, nothing arrives). Re-reading from the
    // last record we hold turns a missed event into a late one instead of a lost one.
    let codes = [];
    try {
      codes = [...new Set(ConnectedServices.getAllConnections().map((c) => c.projectCode))];
    } catch {}
    for (const pc of codes) {
      warmProjectChat(ctx, pc)
        .then(() => reconcileProjectChat(ctx, pc))
        .catch(() => {});
    }
  }, 20000);
}
// Pull anything the event channel missed. Cheap: it asks only for records newer than the newest
// one the hub already holds, and `absorb` drops ids it has seen.
async function reconcileProjectChat(ctx, projectCode) {
  const Chat = projectChat(projectCode);
  if (!Chat) return;
  // Every room, not just `main` — a side room is exactly where a dropped event goes unnoticed
  // longest, because nobody is watching it.
  for (const chat of Chats.chats(projectCode)) {
    if (!Chats.isMirrored(projectCode, chat)) continue;
    try {
      // Push before pulling: anything the project failed to take is still only in the hub's
      // memory, and a hub restart would take it with it.
      const stuck = Chats.unsent(projectCode, chat);
      if (stuck.length) {
        const landed = [];
        for (const record of stuck) {
          await Chat.chatAppend({ chat, record });
          landed.push(record.id);
        }
        Chats.clearUnsent(projectCode, chat, landed);
      }
      const known = Chats.history(projectCode, chat, { limit: 1 });
      const since = known.length ? known[known.length - 1].ts : 0;
      const missed = (await Chat.chatRead({ chat, since })) || [];
      for (const record of missed) {
        if (Chats.absorb(projectCode, chat, record))
          ctx.emit(`chat-updated:${projectCode}`, { chat, record });
      }
      if (missed.length) ctx.emit(`chat-presence:${projectCode}`, presenceFor(projectCode));
      // THE ROOM CAN GET SHORTER. Compaction is something we ASK agents to do — rewrite the room
      // as a summary plus a tail — and it happens by editing the file, not through any method the
      // hub can see. The mirror would have kept serving the pre-compaction length forever (a
      // `since` read finds nothing new, so nothing ever corrected it). A count that dropped below
      // what we hold is the tell; cheap to ask for (`chatStat` ships numbers, not the room).
      const stat = await Chat.chatStat({ chat });
      const held = Chats.count(projectCode, chat);
      if (stat && typeof stat.count === "number" && stat.count < held) {
        Chats.hydrate(projectCode, chat, (await Chat.chatRead({ chat })) || []);
        ctx.emit(`chat-presence:${projectCode}`, presenceFor(projectCode));
      }
    } catch {
      /* still unreachable — everything stays parked and the next tick tries again */
    }
  }
  // A warm project can still acquire an outbox: the hub buffers into its fallback file whenever
  // `chatFor` comes back empty, which includes the whole window before this project first warms.
  try {
    if (Chats.outboxRooms(projectCode).length) await flushOutbox(ctx, projectCode, Chat);
  } catch {}
}
// Cooking lines are per-identity now — every status change pushes the room's FULL set of lines
// (plus the legacy single text/as fields so an older bundle's peek keeps working).
function emitStatuses(ctx, projectCode, chat) {
  const chatName = chat || Chats.DEFAULT_CHAT;
  const p = presenceFor(projectCode)[chatName] || {};
  ctx.emit(`chat-status:${projectCode}`, {
    chat: chatName,
    statuses: p.statuses || [],
    text: p.status || null,
    as: p.statusAs || null,
  });
}
// THE HUB DOES THE VISITING — the one place a subscribed visitor is actually delivered to, lifted
// out of `chatSend` because the room is no longer the only place he speaks. His model, in his words:
// *"when I speak, it just means it should send a visitor message to the other agent."* WHEN, not
// WHERE. No holds, no cursors: the delivery IS the read position, a visitor's own words never come
// back to them (fanout excludes the speaker), and a failed hand-off must never break the send that
// succeeded.
function relayToVisitors(ctx, projectCode, chatName, { text, speaker, record, human }) {
  try {
    Chats.fanout(projectCode, chatName, record || { from: "you" }).forEach((visitor) => {
      try {
        // A VISIT IS ITS OWN RECORD, not a chat line with a prefix glued on. Two corrections from
        // him, one after the other, and the second one is why this is a `kind` and not a `text`:
        //
        //   1. *"that message looks like it's coming from you"* — the relay signed HIS sentence
        //      with this project's agent. Wrong speaker, not wrong formatting.
        //   2. *"it's a completely different message than anything… it's a notification like, yo,
        //      you're subscribed, this message is coming from — it's supposed to be distinct."*
        //
        // And the shape he then named exactly: *"I'm supposed to read it as MY message too — just
        // another one of my messages, but coming from a different room because of subscription."*
        // So a visit carries WHO independently of WHERE. `human: true` means the person said it,
        // and the person is the same person on both ends — the receiving panel draws it as his own
        // turn wearing the room it came from, not as a stranger and not as an agent.
        const relayed = Chats.visit(visitor, Chats.DEFAULT_CHAT, {
          room: projectCode,
          who: human ? null : speaker,
          human,
          text,
        });
        if (relayed && relayed.record)
          ctx.emit(`chat-updated:${visitor}`, { chat: Chats.DEFAULT_CHAT, record: relayed.record });
      } catch {}
    });
  } catch {}
}

// SPEAKING TO THE ATTACHED AGENT IS STILL SPEAKING. His catch, and he was right to doubt it:
// *"Autobot is in your room right now. He's not going to get a notification that I'm talking. I've
// noticed that."* He had. An attached conversation is the SESSION's transcript and deliberately
// writes nothing to the room file — which is correct, and which silently took the fan-out with it,
// because the fan-out lived inside the room write. So visiting worked perfectly room-to-room (proved
// live all day) and did nothing at all in the one place he actually talks to his agent.
// Nothing is written to any room here. This is delivery only: the visitors of this project's chat
// get what he just said, and his session transcript stays the single home of the conversation.
function chatRelay(projectCode, { chat, text } = {}) {
  const body = String(text || "").trim();
  if (!body) return { relayed: 0 };
  const chatName = chat || Chats.DEFAULT_CHAT;
  const to = Chats.fanout(projectCode, chatName, { from: "you" });
  // The attached path is his by definition — this is only ever reached by him typing at his agent.
  relayToVisitors(this, projectCode, chatName, { text: body, human: true, record: { from: "you" } });
  return { relayed: to.length, to };
}

// GIT, SERVED BY THE HUB. It used to come from the plugin; the UI stopped asking the plugin when
// files moved to the shell, and the shell cut its own git verbs the same day — so both halves moved
// and the code panel went silent for every project at once. His words, and they are fair: *"you
// removed git without putting it back."*
//
// The hub is the right home: git is a LOCAL operation on a folder this process runs beside, so there
// is no bridge to be out of step with. `root` is passed by the caller when it knows (the UI knows
// every card's folder) and resolved from the connections registry otherwise.
//
// NO SILENT EMPTY. Every call says whether git RAN — `{ ok: false, error }` — because a provider
// that cannot tell "no changes" from "git did not run" always looks like the panel's fault. That is
// the exact trap this bug hid in for an hour (autobot's line, and they were right about the class).
const { execFile } = require("child_process");
const fsGit = require("fs");
function git(cwd, args) {
  return new Promise((resolve) => {
    execFile("git", args, { cwd, maxBuffer: 20 * 1024 * 1024 }, (err, stdout, stderr) => {
      if (err) return resolve({ ok: false, error: String((stderr || err.message || "").trim()).slice(0, 400), out: "" });
      resolve({ ok: true, out: String(stdout || "") });
    });
  });
}
function rootOf(projectCode, root) {
  const dir = root || projectRoot(projectCode);
  return dir && fsGit.existsSync(dir) ? dir : null;
}
// `git status --porcelain=v1` — two status columns then the path, with renames as "old -> new".
const STATUS_WORDS = { M: "modified", A: "added", D: "deleted", R: "renamed", C: "copied", "?": "untracked", U: "conflicted" };
function parseStatus(out) {
  return String(out || "")
    .split("\n")
    .filter((l) => l.trim())
    .map((line) => {
      const x = line[0];
      const y = line[1];
      let path = line.slice(3).trim();
      if (path.includes(" -> ")) path = path.split(" -> ").pop();
      if (path.startsWith('"') && path.endsWith('"')) path = path.slice(1, -1);
      const code = x !== " " && x !== "?" ? x : y;
      return {
        path,
        // `status` is the key the panel draws from; `change` kept as an alias for anything newer.
        status: STATUS_WORDS[x === "?" ? "?" : code] || "modified",
        change: STATUS_WORDS[x === "?" ? "?" : code] || "modified",
        staged: x !== " " && x !== "?",
        // PARTIAL = staged AND edited again since. The row menu turns on this: a fully staged file
        // offers Unstage and nothing else, a partial one offers both — and without the flag every
        // staged file claimed to be fully staged, which is the one state where a wrong answer costs
        // you work.
        partial: x !== " " && x !== "?" && y !== " ",
        unstaged: y !== " ",
        x,
        y,
      };
    });
}
// EVERY PROJECT'S FOLDER, FROM THE ONE PLACE THAT KNOWS THEM ALL. A card gets its folder from a
// connected SERVICE that happens to report a root — so a project whose services are down, or that
// never had any, ends up with no folder on screen while the registry has known its root the whole
// time. That is why one project sat there with no tree, no git bar and no commit box while the ones
// beside it were fine: not a different code path, just a card that was never told where it lived.
function projectRoots() {
  const out = {};
  try {
    ConnectedServices.getAllConnections().forEach((c) => {
      if (c && c.projectCode && c.root && !out[c.projectCode]) out[c.projectCode] = c.root;
    });
  } catch {
    /* an unreadable registry is an empty answer, not a thrown one */
  }
  return out;
}

// FILES, SERVED BY THE HUB — the same owner as git, which is the entire point. His question, and it
// was the right one to ask: *"is it better for you to use the hub?"* Yes, for one reason that has
// nothing to do with taste: THE HUB KNOWS EVERY PROJECT'S FOLDER. The shell only knows the projects
// that were added through it, so a project that arrived as a service connection had a folder in the
// registry and no folder in the shell — and got no file tree, no git bar, no commit box, while the
// project beside it had all three. Two lists, one of them incomplete, is what made "it works over
// here and not over there" the shape of this entire day.
// One owner, no fallback, no second path.
const path_ = require("path");
const IGNORE_DIRS = new Set([".git", "node_modules", ".next", "dist", "coverage", ".cache", ".DS_Store"]);
function inside(root, rel) {
  // A path is only servable if it resolves INSIDE the project's folder. Not a formality: `rel` comes
  // from a browser, and `../../` is how a file layer becomes a disk layer.
  const abs = path_.resolve(root, rel || ".");
  const base = path_.resolve(root);
  return abs === base || abs.startsWith(base + path_.sep) ? abs : null;
}
async function readFile(projectCode, { path: rel, root } = {}) {
  const cwd = rootOf(projectCode, root);
  if (!cwd) return { ok: false, error: "no folder for this project" };
  const abs = inside(cwd, rel);
  if (!abs) return { ok: false, error: "outside the project folder" };
  try {
    return { ok: true, path: rel, content: fsGit.readFileSync(abs, "utf8") };
  } catch (e) {
    return { ok: false, error: String(e.message || e) };
  }
}
async function writeFile(projectCode, { path: rel, content, root } = {}) {
  const cwd = rootOf(projectCode, root);
  if (!cwd) return { ok: false, error: "no folder for this project" };
  const abs = inside(cwd, rel);
  if (!abs) return { ok: false, error: "outside the project folder" };
  try {
    fsGit.mkdirSync(path_.dirname(abs), { recursive: true });
    fsGit.writeFileSync(abs, String(content == null ? "" : content));
    return { ok: true, path: rel };
  } catch (e) {
    return { ok: false, error: String(e.message || e) };
  }
}
async function deleteFile(projectCode, { path: rel, root } = {}) {
  const cwd = rootOf(projectCode, root);
  if (!cwd) return { ok: false, error: "no folder for this project" };
  const abs = inside(cwd, rel);
  if (!abs || abs === path_.resolve(cwd)) return { ok: false, error: "outside the project folder" };
  try {
    fsGit.rmSync(abs, { recursive: true, force: true });
    return { ok: true, path: rel };
  } catch (e) {
    return { ok: false, error: String(e.message || e) };
  }
}
function walkDir(root, dir, out, cap) {
  let entries = [];
  try {
    entries = fsGit.readdirSync(path_.join(root, dir), { withFileTypes: true });
  } catch {
    return;
  }
  for (const e of entries) {
    if (out.length >= cap) return;
    if (IGNORE_DIRS.has(e.name)) continue;
    const rel = dir ? `${dir}/${e.name}` : e.name;
    if (e.isDirectory()) walkDir(root, rel, out, cap);
    else out.push({ path: rel });
  }
}
async function listFiles(projectCode, { dir, root, max } = {}) {
  const cwd = rootOf(projectCode, root);
  if (!cwd) return { ok: false, error: "no folder for this project", files: [] };
  const start = dir && dir !== "." ? dir : "";
  if (start && !inside(cwd, start)) return { ok: false, error: "outside the project folder", files: [] };
  const cap = Number(max) || 4000;
  const out = [];
  walkDir(cwd, start, out, cap);
  return { ok: true, dir: start, files: out, truncated: out.length >= cap };
}
async function searchFiles(projectCode, { query, max, root } = {}) {
  const cwd = rootOf(projectCode, root);
  if (!cwd) return { ok: false, error: "no folder for this project", results: [] };
  if (!String(query || "").trim()) return { ok: true, results: [] };
  const res = await git(cwd, ["grep", "-n", "-I", "--untracked", "-e", String(query)]);
  // `git grep` exits 1 on "no matches", which is not an error — an empty result is the answer.
  const lines = String(res.out || "").split("\n").filter(Boolean).slice(0, Number(max) || 200);
  return {
    ok: true,
    results: lines.map((l) => {
      const m = /^([^:]+):(\d+):([\s\S]*)$/.exec(l);
      return m ? { path: m[1], line: Number(m[2]), text: m[3] } : { path: l, line: 0, text: "" };
    }),
  };
}

// A SMALL, SHORT CACHE — because the panel polls, and the panel is not alone. Every project card
// polls its own status and state on a timer, and each `gitState` was spawning five git processes
// (branch, upstream, counts, log, rev-list). Six cards on a five-second beat is ~36 git processes
// every five seconds, and the machine feels exactly as you would expect: a stage takes forever and
// nothing looks like it is happening. His words: *"I clicked stage ten minutes ago."*
//
// Reads are cached for a beat and writes clear it, so a stage still shows up instantly — the cache
// only ever collapses the duplicate reads that were racing each other anyway.
// ONE WRITE AT A TIME, PER REPO. Git takes an exclusive index.lock for `add`, `restore`, `commit`;
// two of those at once and the second dies with "Unable to create .git/index.lock". That is not
// hypothetical — he hit it staging while the pollers were mid-read. Reads are cached above; writes
// queue behind each other per folder, which costs nothing and makes the failure impossible.
const gitQueue = new Map();
function serial(cwd, run) {
  const prev = gitQueue.get(cwd) || Promise.resolve();
  const next = prev.then(run, run);
  gitQueue.set(cwd, next.catch(() => {}));
  return next;
}

const gitCache = new Map();
const CACHE_MS = 2500;
const cacheKey = (verb, pc, extra) => `${verb}|${pc}|${extra || ""}`;
function cached(key, run) {
  const hit = gitCache.get(key);
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.p;
  const p = Promise.resolve(run());
  gitCache.set(key, { at: Date.now(), p });
  return p;
}
function bustGit(pc) {
  for (const k of [...gitCache.keys()]) if (k.includes(`|${pc}|`)) gitCache.delete(k);
}

async function gitState(projectCode, opts = {}) {
  return cached(cacheKey("state", projectCode, opts.root), () => gitStateRaw(projectCode, opts));
}
async function gitStateRaw(projectCode, { root } = {}) {
  const cwd = rootOf(projectCode, root);
  if (!cwd) return { repo: false, ok: false, error: "no folder for this project" };
  const inside = await git(cwd, ["rev-parse", "--is-inside-work-tree"]);
  if (!inside.ok || inside.out.trim() !== "true") return { repo: false, ok: true };
  const [branch, upstream, counts] = await Promise.all([
    git(cwd, ["rev-parse", "--abbrev-ref", "HEAD"]),
    git(cwd, ["rev-parse", "--abbrev-ref", "--symbolic-full-name", "@{u}"]),
    git(cwd, ["rev-list", "--left-right", "--count", "HEAD...@{u}"]),
  ]);
  const [ahead, behind] = counts.ok ? counts.out.trim().split(/\s+/).map(Number) : [0, 0];
  // THE LOG RIDES ON gitState — that is where the panel reads it from (`gitState.log`), so a state
  // without it renders "no commits yet" on a repo with thousands. His catch: *"I can't see my git
  // logs like I used to."* Each row needs sha/subject/who/when, and `pushed` so a committed line and
  // a pushed one never look identical — a history you have to verify somewhere else is not a history.
  const up = upstream.ok ? upstream.out.trim() : null;
  const SEP = "\u001f";
  const logRes = await git(cwd, ["log", "-40", `--pretty=format:%h${SEP}%s${SEP}%an${SEP}%ar`]);
  const unpushed = up ? await git(cwd, ["rev-list", `${up}..HEAD`, "--pretty=format:%h", "--no-commit-header"]) : { ok: false, out: "" };
  const ahead_set = new Set(String(unpushed.out || "").split("\n").map((x) => x.trim()).filter(Boolean));
  const log = String(logRes.out || "")
    .split("\n")
    .filter(Boolean)
    .map((line) => {
      const [sha, subject, who, when] = line.split(SEP);
      return { sha, subject, who, when, ...(up ? { pushed: !ahead_set.has(sha) } : {}) };
    });
  // THE FILE LISTS RIDE ON gitState TOO. The commit block reads `state.staged` and
  // `state.unstaged` straight off this object — same as it reads `state.log` — so returning a state
  // without them renders a clean tree on a repo with 41 changes. Exactly the shape of bug the log
  // had an hour ago, and I fixed that one without asking what ELSE this object is expected to
  // carry. It carries everything the version-control surfaces read; that is what it is for.
  const st = await git(cwd, ["status", "--porcelain=v1", "--untracked-files=all"]);
  const rows = st.ok ? parseStatus(st.out) : [];
  return {
    repo: true,
    ok: true,
    root: cwd,
    branch: branch.ok ? branch.out.trim() : null,
    upstream: up,
    ahead: ahead || 0,
    behind: behind || 0,
    log,
    staged: rows.filter((f) => f.staged),
    unstaged: rows.filter((f) => f.unstaged && f.change !== "untracked"),
    untracked: rows.filter((f) => f.change === "untracked"),
    changed: rows,
  };
}
async function changedFiles(projectCode, opts = {}) {
  return cached(cacheKey("changed", projectCode, opts.root), () => changedFilesRaw(projectCode, opts));
}
async function changedFilesRaw(projectCode, { root } = {}) {
  const cwd = rootOf(projectCode, root);
  if (!cwd) return { ok: false, error: "no folder for this project", files: [] };
  const res = await git(cwd, ["status", "--porcelain=v1", "--untracked-files=all"]);
  if (!res.ok) return { ok: false, error: res.error, files: [] };
  return { ok: true, files: parseStatus(res.out) };
}
async function getDiff(projectCode, { path: rel, staged, root } = {}) {
  const cwd = rootOf(projectCode, root);
  if (!cwd) return { ok: false, error: "no folder for this project" };
  // WHAT THE CALLERS ACTUALLY WANT IS CONTENT, NOT A PATCH. Every diff surface in this app —
  // the ::diff block, the stripes in the editor, the file embed — compares the working file against
  // the committed one itself, so it asks for `{ base, index }`: the two OTHER versions of the file.
  // I had this returning a unified `diff` string, which is a perfectly good answer to a question
  // nobody here asks: `g.base` came back undefined, every stripe and every ::diff block drew
  // nothing, and it read as "interactive markdown is broken". A shape mismatch renders exactly like
  // a dead feature.
  //   base  = HEAD's copy      (git show HEAD:<path>)   — null when the file is new
  //   index = the staged copy  (git show :<path>)       — null when nothing is staged
  // The patch text rides along too, for anything that would rather have it.
  if (!rel) {
    const all = await git(cwd, ["diff", ...(staged ? ["--cached"] : []), "--no-color"]);
    return all.ok ? { ok: true, diff: all.out } : { ok: false, error: all.error, diff: "" };
  }
  const [headRes, indexRes, patch] = await Promise.all([
    git(cwd, ["show", `HEAD:${rel}`]),
    git(cwd, ["show", `:${rel}`]),
    git(cwd, ["diff", ...(staged ? ["--cached"] : []), "--no-color", "--", rel]),
  ]);
  const base = headRes.ok ? headRes.out : null;
  const index = indexRes.ok ? indexRes.out : null;
  return {
    ok: true,
    path: rel,
    base,
    // `head` is the same thing under the older name some callers still use.
    head: base,
    index: index != null && index !== base ? index : null,
    diff: patch.ok ? patch.out : "",
  };
}

async function stageFiles(projectCode, { paths, unstage, root } = {}) {
  const cwd = rootOf(projectCode, root);
  if (!cwd) return { ok: false, error: "no folder for this project" };
  const list = (Array.isArray(paths) ? paths : [paths]).filter(Boolean);
  if (!list.length) return { ok: false, error: "nothing to stage" };
  const res = await serial(cwd, () => git(cwd, unstage ? ["restore", "--staged", ...list] : ["add", "--", ...list]));
  bustGit(projectCode); // a write makes every cached read wrong at once
  return res.ok ? { ok: true, changed: list } : { ok: false, error: res.error };
}
// PUSH, HISTORY, SNAPSHOT — the three the callers still needed and I had not written. I moved the
// providers and checked the ones I happened to think of instead of the ones the code actually calls;
// `Plugin.push is not a function` is what that costs, and it surfaced on him pressing a button.
// The list is not a guess: grep every `Plugin.<method>` in the files that now use hostFiles and
// implement exactly that set.
async function push(projectCode, { root } = {}) {
  const cwd = rootOf(projectCode, root);
  if (!cwd) return { ok: false, error: "no folder for this project" };
  const up = await git(cwd, ["rev-parse", "--abbrev-ref", "--symbolic-full-name", "@{u}"]);
  // No upstream is not a failure to hide — it is the one case where push needs to say what it will
  // do (create the branch there) rather than silently doing it.
  const args = up.ok ? ["push"] : ["push", "-u", "origin", "HEAD"];
  const res = await serial(cwd, () => git(cwd, args));
  bustGit(projectCode);
  if (!res.ok) return { ok: false, error: res.error };
  // `pushed` is what the block checks before choosing between a success line and a reason — absent,
  // it fell through to "nothing to push" on a push that had just worked. And `state` is what
  // refreshes the ahead count, which is what decides whether Push is offered at all.
  const state = await gitStateRaw(projectCode, { root });
  return {
    ok: true,
    pushed: true,
    ahead: state.ahead || 0,
    output: String(res.out || "").trim() || "pushed",
    state,
  };
}
// Commits that touched one path — the file's own history, newest first.
async function fileHistory(projectCode, { path: rel, limit, root } = {}) {
  const cwd = rootOf(projectCode, root);
  if (!cwd) return { ok: false, error: "no folder for this project", commits: [] };
  const SEP = "\u001f";
  const res = await git(cwd, [
    "log", `-${Number(limit) || 20}`, `--pretty=format:%h${SEP}%s${SEP}%an${SEP}%ar`, "--", rel || ".",
  ]);
  if (!res.ok) return { ok: false, error: res.error, commits: [] };
  return {
    ok: true,
    commits: String(res.out || "").split("\n").filter(Boolean).map((line) => {
      const [sha, subject, who, when] = line.split(SEP);
      return { sha, subject, who, when };
    }),
  };
}
// One file as it was AT a commit — what the history rows open into.
async function readSnapshot(projectCode, { path: rel, sha, root } = {}) {
  const cwd = rootOf(projectCode, root);
  if (!cwd) return { ok: false, error: "no folder for this project" };
  if (!rel || !sha) return { ok: false, error: "a snapshot needs a path and a sha" };
  const res = await git(cwd, ["show", `${sha}:${rel}`]);
  return res.ok ? { ok: true, path: rel, sha, content: res.out } : { ok: false, error: res.error };
}

async function discardFiles(projectCode, { paths, root } = {}) {
  const cwd = rootOf(projectCode, root);
  if (!cwd) return { ok: false, error: "no folder for this project" };
  const list = (Array.isArray(paths) ? paths : [paths]).filter(Boolean);
  if (!list.length) return { ok: false, error: "nothing to discard" };
  // TRACKED and UNTRACKED are different operations and `restore` only knows the first — an untracked
  // file "discarded" with restore fails, and the panel would report success on a file still sitting
  // there. So each path is asked what it is, and answered accordingly.
  const discarded = [];
  for (const rel of list) {
    const tracked = await git(cwd, ["ls-files", "--error-unmatch", "--", rel]);
    const res = await serial(cwd, () =>
      tracked.ok ? git(cwd, ["restore", "--worktree", "--", rel]) : git(cwd, ["clean", "-f", "--", rel]),
    );
    if (!res.ok) return { ok: false, error: res.error, discarded };
    discarded.push(rel);
  }
  bustGit(projectCode);
  return { ok: true, discarded };
}
async function commit(projectCode, { message, root } = {}) {
  const cwd = rootOf(projectCode, root);
  if (!cwd) return { ok: false, error: "no folder for this project" };
  if (!String(message || "").trim()) return { ok: false, error: "a commit needs a message" };
  const res = await serial(cwd, () => git(cwd, ["commit", "-m", String(message)]));
  return res.ok ? { ok: true, out: res.out } : { ok: false, error: res.error };
}

function chatSend(projectCode, { chat, from = "you", text, view, as, toRoom } = {}) {
  armChatSweep(this);
  const identity = from === "agent" ? resolveSpeaker(projectCode, chat, as) : undefined;
  // Known BEFORE the write, so the record can carry it — see `relayedTo` in Chats.send.
  const goingTo = Chats.fanout(projectCode, chat || Chats.DEFAULT_CHAT, {
    from,
    ...(identity ? { as: identity } : {}),
  });
  const sent = Chats.send(projectCode, chat || Chats.DEFAULT_CHAT, {
    from,
    text,
    view,
    as: identity,
    toRoom,
    relayedTo: goingTo,
  });
  // The wall at the wrong door said no — nothing was written, so nothing is emitted; the refusal
  // travels back to the CLI, which prints the command that actually reaches the visitor.
  if (sent && sent.blocked) return sent;
  const { record } = sent;
  this.emit(`chat-updated:${projectCode}`, { chat: chat || Chats.DEFAULT_CHAT, record });
  // THE HUB DOES THE VISITING. Everyone subscribed to this room gets what was just said, delivered
  // into THEIR conversation as a visitor turn — his model: *"when I speak, it just means it should
  // send a visitor message to the other agent."* No holds, no cursors: the delivery IS the read
  // position. A visitor's own words never come back to them (fanout excludes the speaker), and a
  // failed hand-off must never break the send that succeeded.
  // Speaking subscribes, so the list can move without anyone pressing anything.
  try {
    this.emit(`chat-visitors:${projectCode}`, {
      chat: chat || Chats.DEFAULT_CHAT,
      visitors: Chats.visitors(projectCode, chat || Chats.DEFAULT_CHAT),
    });
  } catch {}
  relayToVisitors(this, projectCode, chat || Chats.DEFAULT_CHAT, {
    text,
    speaker: identity || projectCode,
    human: from === "you",
    record,
  });
  // The store just moved cooking lines around (speaker's line cleared, takers' lines flipped
  // "received", maybe a "waiting on" appeared) — push the whole per-identity set.
  emitStatuses(this, projectCode, chat);
  // …and the queue math changed too (his rule: "there's a queue adding up — I should know"):
  // push presence so the waiting count and read receipts move the moment a message lands,
  // in every mode — not at the next poll.
  this.emit(`chat-presence:${projectCode}`, presenceFor(projectCode));
  return record;
}
// RFC-029 — agent control: a command is a chat record; the push IS the execution channel. The
// UI executes commands only off this live emit — chatHistory renders them as lines, nothing more.
function chatCommand(projectCode, { chat, from, cmd, args, label, say } = {}) {
  const chatName = chat || Chats.DEFAULT_CHAT;
  // RFC-039 — RE-PUSHING A SHOW REPLACES IT, it doesn't stack. Pushing the same report three times
  // left three identical-looking snapshots in the picker with no way to tell which one he had been
  // answering in — and each snapshot carries its OWN click state, so a re-push silently reset his
  // check-offs. Marking the older ones hidden keeps the transcript honest (nothing is deleted from
  // the room) while the picker shows one entry per report, the live one.
  if (cmd === "show" && label) {
    try {
      Chats.history(projectCode, chatName, { limit: 400 })
        .filter((r) => r.cmd === "show" && r.label === label && !r.hidden)
        .forEach((r) => Chats.update(projectCode, chatName, r.id, { hidden: true }));
    } catch {}
  }
  const record = Chats.command(projectCode, chatName, { from, cmd, args, label, say });
  this.emit(`chat-updated:${projectCode}`, { chat: chatName, record });
  return record;
}
// RFC-039 — TAKE ONE OFF THE LIST. His words: "I need to be able to delete shit." A show he is done
// with clutters the picker and, worse, makes the real one ambiguous. This hides the RECORD from the
// collector; it does not remove it from the room, because the transcript is the account of what
// happened and being tired of a show is not a reason to rewrite it. Reversible: `hidden: false`.
function chatHide(projectCode, { chat, id, hidden = true } = {}) {
  const chatName = chat || Chats.DEFAULT_CHAT;
  const res = Chats.update(projectCode, chatName, id, { hidden: !!hidden });
  if (res && res.updated) this.emit(`chat-updated:${projectCode}`, { chat: chatName, tvEdit: id });
  return res;
}
// FORCE THE HANDOVER. The flush otherwise happens on its own — at boot, and on the 20s sweep — but
// "otherwise" is not a thing a test can assert on, and an operator who can see stranded records has
// no reason to wait 20 seconds for them. Returns how many records crossed; 0 when there was nothing
// to move, when the project isn't serving its own room yet, or when its directory IS the hub's.
async function chatFlush(projectCode) {
  const Chat = projectChat(projectCode);
  if (!Chat) {
    await warmProjectChat(this, projectCode);
    if (!projectChat(projectCode)) return { moved: 0, served: false };
  }
  const moved = await flushOutbox(this, projectCode, projectChat(projectCode));
  return { moved, served: true };
}
function chatHistory(projectCode, chat, limit) {
  return Chats.history(projectCode, chat || Chats.DEFAULT_CHAT, { limit });
}
// ---- READING SOMEONE ELSE'S CONVERSATION ----------------------------------------------------
// The catch-up read, through the front door. Agents were doing this by opening each other's room
// FILES off disk — a side door, and exactly how a project once filed a false "data loss" report
// about a file it had no context for. One verb instead, and it answers the three questions an
// agent must have before it speaks into someone's conversation: WHO said each thing, WHEN, and
// whether that project's agent is mid-turn RIGHT NOW (reading half-finished work as settled state
// is how a confident wrong answer gets made).
function chatRead(projectCode, { chat, since = 0, limit = 40 } = {}) {
  const chatName = chat || Chats.DEFAULT_CHAT;
  // `--since` filters, `--limit` caps what survives it — in that order. Reversed (slice a fixed
  // 400 first) the limit silently did nothing and a catch-up read dumped an entire room.
  const cap = Math.max(1, Math.min(200, Number(limit) || 40));
  const all = Chats.history(projectCode, chatName, { limit: 1000 })
    .filter((r) => !r.hidden && (r.ts || 0) > (Number(since) || 0))
    .slice(-cap)
    .map((r) => ({
      ts: r.ts,
      // A VISIT NAMES BOTH HALVES. Who said it and where they said it are two facts, and the
      // reader needs them apart: *"I'm supposed to read it as MY message too — just another one of
      // my messages, but coming from a different room because of subscription."* So the human stays
      // "human" wherever he says it, and `room` carries the elsewhere.
      who: r.visit ? (r.human ? "human" : r.who || r.room) : r.from === "you" ? "human" : r.as || projectCode,
      kind: r.kind || "message",
      ...(r.visit ? { visit: true, room: r.room, human: !!r.human } : {}),
      text: r.kind === "command" ? `${r.cmd} ${r.label || ""}`.trim() : r.text || "",
    }));
  // Mid-turn or not — read off the same per-identity cooking lines the panel draws.
  const p = presenceFor(projectCode)[chatName] || {};
  const working = (p.statuses || []).filter((s) => s && String(s.text || "").trim());
  return {
    project: projectCode,
    chat: chatName,
    messages: all,
    // The two things that stop a reader misreading what they just read.
    working: working.map((s) => ({ who: s.as || projectCode, doing: s.text })),
    visitors: Chats.visitors(projectCode, chatName),
    now: Date.now(), // carry it back as `--since` next time; nothing is stored hub-side
  };
}
// The visitor list: read it, add to it, remove from it. `✕` finally means something real —
// delivery stops — and `＋` lets the human pull an agent into a conversation it never entered.
function chatVisitors(projectCode, chat) {
  return Chats.visitors(projectCode, chat || Chats.DEFAULT_CHAT);
}
function chatAddVisitor(projectCode, { chat, identity } = {}) {
  const chatName = chat || Chats.DEFAULT_CHAT;
  const res = Chats.addVisitor(projectCode, chatName, canonIdentity(projectCode, identity), "human");
  // THE SUBSCRIPTION LIST IS NOT PRESENCE, so a presence event does not refresh it. The panel keeps
  // its own copy from `chatVisitors` and only ever fetched it once, so adding or removing a visitor
  // changed the truth and changed nothing on screen — his catch: *"if I remove systemview from this
  // room right now, nothing updates. The agent icon lies to you about visiting."* It did. Anything
  // that moves the list now says so on its own channel.
  if (res.added) {
    this.emit(`chat-presence:${projectCode}`, presenceFor(projectCode));
    this.emit(`chat-visitors:${projectCode}`, { chat: chatName, visitors: Chats.visitors(projectCode, chatName) });
  }
  return res;
}
function chatRemoveVisitor(projectCode, { chat, identity } = {}) {
  const chatName = chat || Chats.DEFAULT_CHAT;
  const res = Chats.removeVisitor(projectCode, chatName, identity);
  if (res.removed) {
    this.emit(`chat-presence:${projectCode}`, presenceFor(projectCode));
    this.emit(`chat-visitors:${projectCode}`, { chat: chatName, visitors: Chats.visitors(projectCode, chatName) });
  }
  return res;
}
function chatList(projectCode) {
  return Chats.chats(projectCode);
}
function chatJoin(projectCode, { chat, agent, since } = {}) {
  // join() registers the live presence synchronously before parking the hold — push the ring flip
  // to every open panel NOW (the poll only exists to catch silent decay).
  const identity = canonIdentity(projectCode, agent);
  const chatName = chat || Chats.DEFAULT_CHAT;
  // RFC-031 — a VISITOR's arrival gets a system line in the thread (the room announces it; the
  // home agent's ring already tells its own story). Checked BEFORE join() stamps the timestamp.
  if (identity !== projectCode && Chats.isArrival(projectCode, chatName, identity)) {
    const sys = Chats.system(projectCode, chatName, { event: "joined", who: identity });
    this.emit(`chat-updated:${projectCode}`, { chat: chatName, record: sys });
  }
  const held = Chats.join(projectCode, chatName, { identity, since });
  this.emit(`chat-presence:${projectCode}`, presenceFor(projectCode));
  // A visitor's arrival also changes ITS OWN bot's story ("visiting <room>") — tell that room too.
  if (identity !== projectCode) this.emit(`chat-presence:${identity}`, presenceFor(identity));
  return held;
}
function chatStatus(projectCode, { chat, text, as } = {}) {
  // A cooking line is speech too — his catch that logtest "was cooking" in a room it wasn't in.
  const identity = resolveSpeaker(projectCode, chat, as);
  const r = Chats.setStatus(projectCode, chat || Chats.DEFAULT_CHAT, text, identity);
  emitStatuses(this, projectCode, chat);
  return r;
}
function chatDrain(projectCode, { chat, listener, as, history } = {}) {
  const identity = canonIdentity(projectCode, as);
  const chatName = chat || Chats.DEFAULT_CHAT;
  // GETTING A HANDLE ON A ROOM IS ARRIVING IN IT (his rule). Draining is how a file-mode agent
  // takes the conversation — it reads the history and can then speak — so it is an arrival exactly
  // like a join, and it gets the same line. Without this a visitor could read the whole room and
  // the first thing he ever saw was its message: "sometimes I see you jump inside the chat but it
  // doesn't show that you jumped in, it just shows your message."
  //
  // NOT join()'s arrival test. That one asks liveSeen ("holding the line right now"), which a drain
  // never stamps — so it would answer "new arrival" on EVERY drain and turn a file-mode agent's
  // normal loop into a stream of joined-lines. The right question for a drain is the entered ledger:
  // has this identity opened this room's door recently. Each drain re-stamps it, so a loop that
  // keeps draining announces once and then stays quiet. Checked BEFORE drain() stamps it.
  if (identity !== projectCode && !Chats.hasEntered(projectCode, chatName, identity)) {
    const sys = Chats.system(projectCode, chatName, { event: "joined", who: identity });
    this.emit(`chat-updated:${projectCode}`, { chat: chatName, record: sys });
  }
  const res = Chats.drain(projectCode, chatName, { listener, identity, history });
  this.emit(`chat-presence:${projectCode}`, presenceFor(projectCode));
  // A "waiting on <pc>" line may have just flipped to "received" (turn-boundary pickup) —
  // push the current lines so the human sees the handoff.
  if ((res.messages || []).length && identity === projectCode)
    emitStatuses(this, projectCode, chat);
  return res;
}
function chatLeave(projectCode, { chat, agent } = {}) {
  const identity = canonIdentity(projectCode, agent);
  const chatName = chat || Chats.DEFAULT_CHAT;
  // The departure line — only for a visitor who was actually here (checked before leave() wipes it).
  if (identity !== projectCode && Chats.isPresent(projectCode, chatName, identity)) {
    const sys = Chats.system(projectCode, chatName, { event: "left", who: identity });
    this.emit(`chat-updated:${projectCode}`, { chat: chatName, record: sys });
  }
  const res = Chats.leave(projectCode, chatName, { identity });
  emitStatuses(this, projectCode, chatName); // the leaver's cooking line just ended
  this.emit(`chat-presence:${projectCode}`, presenceFor(projectCode));
  if (identity !== projectCode) this.emit(`chat-presence:${identity}`, presenceFor(identity));
  return res;
}
function chatPresence(projectCode) {
  armChatSweep(this);
  return presenceFor(projectCode);
}
// THE TV's persistent state (his flow: clicks are SILENT — no chat echo per interaction — and
// he announces when he's done; so the clicked-up show text must live somewhere an agent can
// read). One JSON per room beside the chat file; survives hub restarts and reloads.
// It rides the SAME directory as the room (Chats.dirFor) — so when a project's chat moves into the
// project, its TV state moves with it instead of being orphaned in the hub.
const tvStateFile = (pc, chat) =>
  path.join(
    Chats.dirFor(pc),
    `${String(pc).replace(/[^a-zA-Z0-9._-]/g, "_")}.${String(chat || Chats.DEFAULT_CHAT).replace(/[^a-zA-Z0-9._-]/g, "_")}.tv.json`,
  );
// ONE ENTRY PER SHOW, not one per room. This file used to hold a single clicked-up show, so
// answering on one report and then opening another OVERWROTE the first — his answers on the earlier
// report were simply gone, silently, and the only tell was that the report looked unanswered. He
// hit it within minutes of having two reports up: "I've responded on both TV reports", and only one
// set of responses still existed. Reports are reachable forever from the links panel, so answers on
// any of them have to survive opening another.
function readTvStore(projectCode, chat) {
  let raw = null;
  try {
    raw = JSON.parse(require("fs").readFileSync(tvStateFile(projectCode, chat), "utf8"));
  } catch {
    return { byShow: {} };
  }
  if (raw && raw.byShow) return raw;
  // Legacy single-show file — keep whatever it held rather than dropping his answers on upgrade.
  return raw && raw.id ? { byShow: { [raw.id]: raw } } : { byShow: {} };
}
// HIS ANSWERS GO INTO THE REPORT'S OWN RECORD (his call). A TV report is a record in the room, so
// clicking an answer edits that record — one place, no second copy of the text. The side-file only
// survives as the fallback for a project whose plugin predates `chatUpdate`; dropping his answers
// on those is not an option, so they keep the old behaviour until they upgrade.
// RFC-050 — ANSWERING A BLOCK IN THE CHAT, and the reason it does two things at once.
//
// On the TV, an input block writes its answer back into the SOURCE FILE — that is what makes an
// answer durable, shared, and readable by an agent later. A chat message has no file behind it, so
// this rewrites the block's attribute inside the RECORD instead. `Chats.update` already edits a
// record in place (it is how `chatHide` works), so the mechanism exists.
//
// And then it says so in plain words. His question, and the only hard part of the whole idea:
// *"you gotta make sure it's something that doesn't burden you guys on how you read the response."*
// An agent should not have to learn a new verb, poll a new store, or parse a block to find out what
// he decided. So the same click posts an ORDINARY message — `answered "hide it entirely"` — which
// every agent already reads through the path it uses for everything else. The record edit is for
// the human scrolling back; the message is for us. Neither one is a burden on the other.
function chatAnswer(projectCode, { chat, id, line, key: attr, value, label } = {}) {
  const chatName = chat || Chats.DEFAULT_CHAT;
  const records = Chats.history(projectCode, chatName, { limit: 400 }) || [];
  const rec = records.find((r) => r.id === id);
  if (!rec) return { updated: false, reason: "no such record" };
  const lines = String(rec.text || "").split("\n");
  const n = Number(line);
  if (!(n >= 1) || n > lines.length) return { updated: false, reason: "no such line" };
  lines[n - 1] = setDirectiveAttr(lines[n - 1], attr, value);
  const res = Chats.update(projectCode, chatName, id, { text: lines.join("\n") });
  if (res && res.updated) {
    this.emit(`chat-updated:${projectCode}`, { chat: chatName, tvEdit: id });
    // THE PLAIN-WORDS HALF. `from: "you"` because he is the one who answered — an agent reading the
    // room must see his decision as his, not as a system note it can ignore.
    const said = value
      ? `answered ${label ? `${label} — ` : ""}"${value}"`
      : `cleared ${label ? `their answer to ${label}` : "an answer"}`;
    const { record } = Chats.send(projectCode, chatName, { from: "you", text: said });
    this.emit(`chat-updated:${projectCode}`, { chat: chatName, record });
    this.emit(`chat-presence:${projectCode}`, presenceFor(projectCode));
  }
  return res;
}
// Set (or drop) one attribute on a directive line, leaving everything else exactly as written. The
// value is quoted whenever it could not survive unquoted — an unquoted attribute stops at the first
// space, which is the bug that ate a `::question` on RFC-049.
function setDirectiveAttr(line, attr, value) {
  const drop = value === null || value === undefined || value === "";
  const quoted = /[\s"|}]/.test(String(value || "")) ? JSON.stringify(String(value)) : String(value);
  const m = String(line).match(/^(.*?)\{([^}]*)\}(\s*)$/);
  if (!m) return drop ? line : `${line}{${attr}=${quoted}}`;
  const [, head, body, tail] = m;
  const without = body
    .replace(new RegExp(`(^|\\s)${attr}=(?:"[^"]*"|[^\\s}]*)`), "")
    .replace(/\s+/g, " ")
    .trim();
  const next = drop ? without : `${without ? `${without} ` : ""}${attr}=${quoted}`;
  return `${head}{${next}}${tail}`;
}
function chatSetTv(projectCode, { chat, state } = {}) {
  if (!state || !state.id) return { ok: false };
  const inPlace = Chats.update(projectCode, chat || Chats.DEFAULT_CHAT, state.id, {
    args: { text: state.text },
  });
  if (inPlace.updated) {
    // The record is the truth now, so any leftover side-file entry for it is a stale duplicate.
    // Removing it also makes the side-file's meaning unambiguous for readers: an entry exists ONLY
    // when that project could not store in place.
    try {
      const fs = require("fs");
      const store = readTvStore(projectCode, chat);
      if (store.byShow[state.id]) {
        delete store.byShow[state.id];
        fs.writeFileSync(tvStateFile(projectCode, chat), JSON.stringify(store, null, 2));
      }
    } catch {}
    this.emit(`chat-updated:${projectCode}`, { chat: chat || Chats.DEFAULT_CHAT, tvEdit: state.id });
    return { ok: true, inPlace: true };
  }
  const fs = require("fs");
  const store = readTvStore(projectCode, chat);
  store.byShow[state.id] = { ...state, ts: Date.now() };
  fs.mkdirSync(path.dirname(tvStateFile(projectCode, chat)), { recursive: true });
  fs.writeFileSync(tvStateFile(projectCode, chat), JSON.stringify(store, null, 2));
  return { ok: true, inPlace: false, why: inPlace.reason };
}
// READ THE TV. The stored state is only written when the human CLICKS something, so reading it
// alone answers "the last show he touched" — not "what is on the TV". An agent that pushed a new
// show and then read it back got the PREVIOUS one, unchanged timestamp and all (found live by
// systemlynx). That is worse than cosmetic: the co-editing rule is read-before-write, so an agent
// doing the right thing merges onto stale text and silently wipes his edit.
//
// So the current show wins, and the stored state is an OVERLAY that only applies to that same show
// — exactly the rule the UI already follows when it restores the TV.
// `show` names which report to read; omitted means whatever is on the TV right now. Answers on an
// older report stay readable — the links panel keeps every report reachable, so an agent has to be
// able to go back and collect a decision he made on one two reports ago.
function chatGetTv(projectCode, { chat, show } = {}) {
  const store = readTvStore(projectCode, chat);
  const current = currentShow(projectCode, chat);
  const target = show
    ? findShow(projectCode, chat, show)
    : current;
  if (!target) {
    // Nothing on the TV (or no such report) — hand back the most recently touched thing we hold.
    const all = Object.values(store.byShow).sort((a, b) => (b.ts || 0) - (a.ts || 0));
    return all[0] || null;
  }
  // The record IS his copy now — answers are written into it. A side-file entry exists only for a
  // project that could not store in place, so it wins only when it's there at all.
  const stored = store.byShow[target.id];
  if (stored) return stored;
  // "Pristine" means nothing has been marked on it — read that off the text itself rather than off
  // a bookkeeping flag, so it stays true no matter which path saved the answers.
  const marked = /\banswer=|\bverdict=|:::reply\{author=you/.test(target.text);
  // An EARLIER version of the same title carrying marks means a re-push landed on top of answers.
  // Say so — silence reads as "he hasn't looked" when in fact we pushed over him.
  const superseded =
    !marked &&
    (Object.values(store.byShow).some((s) => s.label === target.label) ||
      answeredOlderVersion(projectCode, chat, target));
  return {
    id: target.id,
    label: target.label,
    text: target.text,
    // RFC-040 — carry the pointer through. Without this the caller gets a show with no text and no
    // way to find the document, which reads as "nothing on the TV".
    ...(target.args && target.args.report ? { args: target.args } : {}),
    ts: target.ts,
    ...(marked ? {} : { pristine: true }),
    ...(superseded ? { supersededAnswers: true } : {}),
  };
}
// Did an earlier record with this same title carry his marks? With answers stored in the record,
// that is the only way to know a re-push landed on top of them.
function answeredOlderVersion(projectCode, chat, target) {
  const rows = Chats.history(projectCode, chat || Chats.DEFAULT_CHAT, { limit: 0 });
  return rows.some(
    (r) =>
      r &&
      r.kind === "command" &&
      r.cmd === "show" &&
      r.id !== target.id &&
      (r.label || "show") === target.label &&
      /\banswer=|\bverdict=|:::reply\{author=you/.test((r.args && r.args.text) || ""),
  );
}
// Find a report by title (or id) anywhere in the room — newest match wins.
function findShow(projectCode, chat, needle) {
  const rows = Chats.history(projectCode, chat || Chats.DEFAULT_CHAT, { limit: 0 });
  const want = String(needle).toLowerCase();
  for (let i = rows.length - 1; i >= 0; i--) {
    const r = rows[i];
    if (!r || r.kind !== "command" || r.cmd !== "show") continue;
    if (!r.args || !r.args.report) continue; // only documents are reports now (RFC-040)
    if (r.id === needle || String(r.label || "").toLowerCase().includes(want))
      return { id: r.id, label: r.label || "show", text: "", args: r.args, ts: r.ts };
  }
  return null;
}
// The newest show in the room. A show rides the room as a `kind:"command"` record (`cmd:"show"`,
// text in `args.text`), so "what is on the TV" is always answerable from the room itself.
function currentShow(projectCode, chat) {
  const rows = Chats.history(projectCode, chat || Chats.DEFAULT_CHAT, { limit: 0 });
  for (let i = rows.length - 1; i >= 0; i--) {
    const r = rows[i];
    if (r && r.kind === "command" && r.cmd === "show") {
      // RFC-040 — A REPORT IS A DOCUMENT. The hub hands back the POINTER; the caller (UI or CLI)
      // reads the document through that project's own plugin, which is the thing that owns its
      // filesystem. A legacy record that carries text instead of a pointer is NOT a report any more
      // (his call: "I don't need that to be backwards compatible… the old ones shouldn't work") —
      // it is skipped, so the picker and the TV only ever show documents.
      if (r.args && r.args.report)
        return { id: r.id, label: r.label || "show", text: "", args: r.args, ts: r.ts };
      if (r.args && r.args.text) continue; // legacy inline show — not a document, not a report
      return null; // a `--clear` blanks the TV
    }
  }
  return null;
}
// The bouncer — the human kicks an identity out of a room (right-click a roster name). The
// kicked hold answers {kicked} immediately, the room gets its system line, rejoin refused for
// the cooldown.
function chatKick(projectCode, { chat, identity } = {}) {
  if (!identity) throw new Error("chatKick: identity required");
  const chatName = chat || Chats.DEFAULT_CHAT;
  const res = Chats.kick(projectCode, chatName, { identity });
  emitStatuses(this, projectCode, chatName); // the kicked identity's cooking line goes too
  this.emit(`chat-updated:${projectCode}`, { chat: chatName, record: res.record });
  this.emit(`chat-presence:${projectCode}`, presenceFor(projectCode));
  if (identity !== projectCode) this.emit(`chat-presence:${identity}`, presenceFor(identity));
  return res;
}

const shutdown = () => process.exit(0);

module.exports = function launchSystemView(port = 3000) {
  const { server } = App;
  const buildPath = path.resolve(__dirname, "../build");
  const indexPath = path.join(buildPath, "index.html");

  // RFC-027 — the hosting unit, bound to this hub's own URL (hosted services register back through
  // the same connect() door above, via the plugin, like every real service). hostedOp = the UI's
  // configuration hand: rename the service, add/delete/rename modules — file ops on the folder.
  hostingUnit = require("./hostProject")(port);
  const { hostProject, hostedOp } = hostingUnit;

  // Self-updating tabs (his rule: "never suggest page reload to me again") — the client polls
  // this and swaps itself the moment the served bundle changes. Read fresh per request: the hub
  // outlives many builds.
  server.get("/sv-bundle", (req, res) => {
    try {
      const html = require("fs").readFileSync(indexPath, "utf8");
      const m = html.match(/main\.[a-z0-9]+\.js/);
      res.json({ bundle: m ? m[0] : null });
    } catch {
      res.json({ bundle: null });
    }
  });

  // ::image's byte pipe — the hub proxies raw file bytes from the project's OWN plugin (the
  // image lives in the repo; the document carries a locator, same rule as ::file). Approved via
  // a TV verdict, fittingly.
  // BYTES STRAIGHT OFF DISK, ADDRESSED BY PROJECT. The route below proxies through a project's
  // PLUGIN, which is why an image stopped rendering the moment files left the plugin: no plugin, no
  // bytes, broken image — on a file sitting in a folder the hub can read. Images, PDFs, anything
  // that is not text needs BYTES, not `readFile`'s utf8, so it gets its own door rather than being
  // squeezed through the text one.
  server.get("/sv-file/:pc", (req, res) => {
    try {
      const rel = String(req.query.path || "");
      const cwd = rootOf(req.params.pc, req.query.root);
      if (!cwd) return res.status(404).send("no folder for this project");
      const abs = inside(cwd, rel);
      if (!abs || !fsGit.existsSync(abs)) return res.status(404).send("not found");
      const ext = path_.extname(abs).toLowerCase().slice(1);
      const MIME = {
        png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", gif: "image/gif", webp: "image/webp",
        svg: "image/svg+xml", ico: "image/x-icon", bmp: "image/bmp", avif: "image/avif",
        pdf: "application/pdf", mp4: "video/mp4", webm: "video/webm", mp3: "audio/mpeg", wav: "audio/wav",
      };
      res.set("Content-Type", MIME[ext] || "application/octet-stream");
      res.set("Cache-Control", "private, max-age=30");
      res.send(fsGit.readFileSync(abs));
    } catch (e) {
      res.status(404).send(String((e && e.message) || "not found"));
    }
  });

  server.get("/sv-raw/:pc/:sid", async (req, res) => {
    try {
      const { service } = ConnectedServices.findService(null, req.params.pc, req.params.sid);
      if (!service) return res.status(404).send("service not connected");
      // A FRESH client per request — the shared Client caches each service's method stubs at
      // first load, so a service that gained readFileRaw after a restart kept 404ing through
      // the stale stub map (found live: rebooted fixtures still "not a function" via the cache).
      const { Plugin } = await createClient(httpClient).loadService(service.system.connectionData.serviceUrl);
      const file = await Plugin.readFileRaw({ path: String(req.query.path || "") });
      res.set("Content-Type", file.mime || "application/octet-stream");
      res.set("Cache-Control", "private, max-age=30");
      res.send(Buffer.from(file.base64, "base64"));
    } catch (e) {
      res.status(404).send(String((e && e.message) || "not found"));
    }
  });

  // INDEX.HTML IS NEVER CACHED. Every asset under it is content-hashed and can be cached forever,
  // but the one file that NAMES those hashes must be fetched fresh or the tab keeps booting the old
  // bundle from disk cache. That is what broke self-updating tabs: the tab correctly noticed a new
  // build, reloaded, got its cached index.html back, and came up on the same old bundle — with the
  // loop-guard now set, so it would not try again. He ended up refreshing by hand for a rule that
  // exists precisely so he never has to.
  server.use(
    express.static(buildPath, {
      setHeaders: (res, filePath) => {
        if (/index\.html$/.test(filePath)) res.setHeader("Cache-Control", "no-store");
      },
    }),
  );

  App.startService({
    route,
    port,
    host,
    staticRouting: true,
  })
    .module("SystemView", {
      connect,
      hostProject,
      hostedOp,
      getServices,
      getProjects,
      updateSpecList,
      shutdown,
      deleteService,
      deleteProject,
      getStage,
      assembleStage,
      showTarget,
      addPane,
      removePane,
      clearStage,
      setStageLayout,
      highlightPane,
      pinPane,
      setPaneSpan,
      reorderPanes,
      setSelection,
      getSelection,
      saveView,
      openView,
      listViews,
      deleteView,
      chatSend,
      chatRead,
      projectRoots,
      readFile,
      writeFile,
      deleteFile,
      listFiles,
      searchFiles,
      gitState,
      changedFiles,
      getDiff,
      stageFiles,
      discardFiles,
      commit,
      push,
      fileHistory,
      readSnapshot,
      chatRelay,
      chatVisitors,
      chatAddVisitor,
      chatRemoveVisitor,
      chatCommand,
      chatHistory,
      chatList,
      chatFlush,
      chatJoin,
      chatStatus,
      chatDrain,
      chatHide,
      chatLeave,
      chatKick,
      chatSetTv,
      chatAnswer,
      chatGetTv,
      chatPresence,
    })
    .module("CLI", {
      getHistory: CLIHistory.getHistory,
      saveHistory: CLIHistory.saveHistory,
      getSettings: Settings.getSettings,
      saveSettings: Settings.saveSettings,
      // Threads on SystemView's own surfaces (hub, help topics) — see api/Comments.js for why they
      // don't ride a project's plugin the way a document's threads do.
      getComments: Comments.getComments,
      saveComments: Comments.saveComments,
    })
    .on("ready", () => {
      server.get("*", (req, res) => {
        res.setHeader("Cache-Control", "no-store");
        res.sendFile(indexPath);
      });

      // Hosted projects live IN this process — replay the hub's own hosted registry BEFORE the
      // connection probe, so a hub restart resurrects them no matter which repo's CLI hosted
      // them originally (his bug: BUApp vanished on every restart until its CLI reran).
      hostingUnit
        .rehostAll()
        .catch(() => {})
        .finally(() => {
          ConnectedServices.refreshConnections();
          // Projects serve their own rooms before anyone speaks — see warmAllChats.
          warmAllChats(bootCtx);
        });
    });

  return new Promise((resolve) => App.on("ready", resolve));
};
