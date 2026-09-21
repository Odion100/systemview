const { createClient, App } = require("systemlynx");
const { createCookieHttpClient } = require("../cli/cookieClient");
const { headersFor } = require("../cli/manifestHeaders");
const Drive = require("./drive");
const ReportsLib = require("./reports");
const ConnectedServices = require("./Connections")();
const CLIHistory = require("./CLIHistory")();
// RFC-056 — recent test runs by HANDLE: hub memory, capped, never on disk (his rule).
const RUNS = new Map();
const Settings = require("./Settings")();
const Comments = require("./Comments")();
const Stage = require("./Stage")();
const { shellProjects, shellProjectRoot } = require("./shellProjects");
const termGrants = require("./terminalGrants");
// WHERE A PROJECT LIVES ON DISK — one resolver, one precedence, used by everything that needs to
// put a project's data with that project. Order matters: a HOSTED project's directory is known for
// certain from the registry that stood it up; otherwise we take the root its own plugin reports on
// the connection (systemview-plugin ≥ 2.16 — `getConnection()` carries it, and refreshConnections
// re-pulls that, so it arrives on its own); LAST, the folders the SHELL was given directly through
// `+ Add project`, which no connection and no hosted registry has ever heard of. Unknown root =
// null, and the caller falls back to the hub rather than guessing a path.
//
// THE SHELL'S LIST GOES LAST, and the position is the whole safety argument: it can only answer a
// question the other two already failed, so no project that resolves today can start resolving
// somewhere else tomorrow. It is the ONLY reason a project added through the window had a card, a
// tree and no readable file in it.
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
  return shellProjectRoot(projectCode);
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
      // THE HUB'S ONE CLIENT. `loadService` caches by URL, so a service is loaded once and every
      // later tick gets the same instance — no new sockets, nothing to close. This loop used to
      // build `createClient(...)` per attempt and drop it on a failed proof, and each dropped client
      // kept a socket per module open forever: 10,000+ to one service whose proof 500ed every 20s,
      // until git could not spawn (EBADF). His rule: you only need to load the service; creating
      // and disconnecting connections that were never necessary is the inefficiency itself.
      try {
        const svc = await Client.loadService(url);
        Chat = svc.SystemViewChat;
        // ADVERTISING THE MODULE IS NOT THE SAME AS ANSWERING. Prove it can actually serve before
        // committing the whole project's room to it — a service whose own middleware throws on every
        // call will happily list SystemViewChat and then 500 on everything.
        if (Chat) await Chat.chatDir();
      } catch {
        Chat = null;
      }
      if (!Chat) continue; // this one can't serve — try the next service that carries the module
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
  // EVICT AT THE RE-REGISTRATION MOMENT. The hub is the registry — this is the first place in
  // the universe that knows a service came back, possibly with new methods. Closing the shared
  // Client's cached instance HERE (sockets closed, entry deleted — idempotent on a miss) means
  // no stub map can be stale for longer than this line, and no route ever needs a throwaway
  // client or forceReload to dodge the cache (systemlynx@3.6.1 fixed forceReload's hang, but
  // the eviction pattern makes the hot paths never need it).
  try {
    if (system && system.connectionData && system.connectionData.serviceUrl)
      Client.unloadService(system.connectionData.serviceUrl);
  } catch {}
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
        // RFC-051 — the exchange refreshes a windowed teller's window, so an answer arriving at
        // minute 14 doesn't close the door on their thanks.
        try { Chats.touchWindow(projectCode, chatName, visitor); } catch {}
      } catch {}
    });
  } catch {}
}

// THE ROOM KNOWS WHEN IT IS A CONVERSATION. `say <yourOwnRoom>` while your panel is attached is
// the wrong door — you are IN the chat, your reply IS the message — but the hub could not refuse
// it because attachment lived only in the browser. His call: *"say is misleading... we're in the
// chat."* So the panel now tells the hub: a heartbeat on its existing presence tick, expiring on
// its own (30s) so a closed tab or dead panel never leaves a stale wall up. No unregister needed —
// silence IS detach, the same rule the presence sweep already lives by.
const attachedRooms = new Map(); // pc -> last heartbeat ts
function chatAttached(projectCode, { on = true } = {}) {
  if (on) attachedRooms.set(projectCode, Date.now());
  else attachedRooms.delete(projectCode);
  return { ok: true };
}
const isAttached = (pc) => (attachedRooms.get(pc) || 0) > Date.now() - 30000;

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
// THE SHELL'S FOLDERS ARE IN HERE TOO, at the same precedence `projectRoot` gives them: underneath
// the connections, so a connected project's own root still wins. Without them the CLI's
// `projectPlugin` refuses a project added through the window outright ("no folder known for …"),
// which means an agent cannot write a report into the project the human just added — the same bug
// as the blank file tree, one layer down.
//
// Shell rows are checked against DISK before they are offered. The registry is allowed to name a
// path from another machine (`bu1 -> /root/buAPI` does), and a project that is listed here but
// unreadable by every verb downstream is worse than one that was never listed.
function projectRoots() {
  const out = {};
  try {
    Object.entries(shellProjects()).forEach(([pc, root]) => {
      if (root && fsGit.existsSync(root)) out[pc] = root;
    });
  } catch {
    /* no shell on this machine — the connections below are the whole answer, as before */
  }
  // FIRST CONNECTION WINS, among connections — unchanged. `fromConn` is what keeps that true now
  // that the map is not empty when this loop starts: without it the guard would read "a shell row
  // already claimed this code" as "a connection already did", and the second service on a project
  // would start overwriting the first.
  const fromConn = new Set();
  try {
    ConnectedServices.getAllConnections().forEach((c) => {
      if (c && c.projectCode && c.root && !fromConn.has(c.projectCode)) {
        out[c.projectCode] = c.root;
        fromConn.add(c.projectCode);
      }
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
    else {
      const row = { path: rel };
      // Reports list by TIME ("everyone doesn't even have a time next to it" — scanned, unindexed
      // files carried none). One stat, only for the files whose lists sort by it.
      if (/^\.systemview\/report\..+\.md$/i.test(rel)) {
        try { row.mtime = fsGit.statSync(path_.join(root, rel)).mtimeMs; } catch {}
      }
      // A COMMENT SIDECAR'S SIZE IS HOW THE UI KNOWS IT IS EMPTY. `commentedPathSet` skips sidecars
      // under 40 bytes (`{"threads":[]}` is 20) and falls back to COUNTING one whose size is
      // unreported — and nothing here ever reported it, so a file with every comment deleted still
      // showed the 💬 mark and still matched the comments filter. His catch: "they all say one
      // comment when there's no comments" (2026-09-19).
      if (/^\.systemview\/code-comments\/.+\.json$/i.test(rel)) {
        try { row.size = fsGit.statSync(path_.join(root, rel)).size; } catch {}
      }
      out.push(row);
    }
  }
}
// ONE FOLDER, NOT THE WHOLE REPO. `walkDir` above answers "every file under here", which is the
// right answer for the `.md` scans and the report flows and the WRONG one for a file tree: on a big
// repo (his buAPI/BUApp) the walk hit the 4000 cap and the alphabetical tail — which is where his
// CHANGED files happened to live — was silently cut off, so the git panel could name a file the
// tree could not show. His words: *"We're an IDE. The folder just doesn't have to load every
// existing file — you can wait till the folder is opened to load its tree."*
//
// So: the immediate children of ONE directory, dirs AND files, each saying which it is. Same ignore
// list, same containment check. Sorted here (folders first, then by name) so the tree does not have
// to re-sort what disk handed back in whatever order it felt like.
function listDirShallow(root, dir) {
  let entries = [];
  try {
    entries = fsGit.readdirSync(path_.join(root, dir), { withFileTypes: true });
  } catch {
    return [];
  }
  const out = [];
  for (const e of entries) {
    if (IGNORE_DIRS.has(e.name)) continue;
    const rel = dir ? `${dir}/${e.name}` : e.name;
    const isDir = e.isDirectory();
    const row = { name: e.name, path: rel, dir: isDir };
    if (!isDir && /^\.systemview\/report\..+\.md$/i.test(rel)) {
      try { row.mtime = fsGit.statSync(path_.join(root, rel)).mtimeMs; } catch {}
    }
    // and a comment sidecar carries its size, so an emptied one stops counting as a comment
    if (!isDir && /^\.systemview\/code-comments\/.+\.json$/i.test(rel)) {
      try { row.size = fsGit.statSync(path_.join(root, rel)).size; } catch {}
    }
    out.push(row);
  }
  return out.sort((a, b) => (a.dir === b.dir ? a.name.localeCompare(b.name) : a.dir ? -1 : 1));
}
async function listFiles(projectCode, { dir, root, max, shallow } = {}) {
  const cwd = rootOf(projectCode, root);
  if (!cwd) return { ok: false, error: "no folder for this project", files: [] };
  const start = dir && dir !== "." ? dir : "";
  if (start && !inside(cwd, start)) return { ok: false, error: "outside the project folder", files: [] };
  const cap = Number(max) || 4000;
  // THE SHALLOW ANSWER IS ADDED, NOT SWAPPED IN. Everything that already asks this verb reads
  // `files` and means "recursively"; changing that under them would move the bug rather than fix it.
  if (shallow) {
    const all = listDirShallow(cwd, start);
    const entries = all.slice(0, cap);
    return { ok: true, dir: start, shallow: true, entries, truncated: all.length > cap };
  }
  const out = [];
  walkDir(cwd, start, out, cap);
  return { ok: true, dir: start, files: out, truncated: out.length >= cap };
}
// SEARCHING BY NAME IS A DIFFERENT QUESTION FROM SEARCHING BY CONTENT, and the lazy tree needs the
// first one. The nav's filter box has always matched PATHS — substring, or `*.ext` — against the
// flat list it held; once the tree only holds what has been opened, filtering that list answers
// "what have I loaded that matches", which looks exactly like "what is in this repo that matches"
// and is not it. `git grep` below cannot stand in: it matches file CONTENT, so typing a filename
// finds everything that imports it and possibly not the file itself.
//
// So the walk happens here, on disk, counting MATCHES against the cap rather than files — a repo
// too big to list is not a repo too big to search, and stopping at 4000 scanned files would
// reintroduce the cut-off tail this whole change exists to remove.
function walkMatches(root, dir, query, out, max) {
  let entries = [];
  try {
    entries = fsGit.readdirSync(path_.join(root, dir), { withFileTypes: true });
  } catch {
    return;
  }
  const ext = query.startsWith("*.") ? query.slice(1).toLowerCase() : null;
  for (const e of entries) {
    if (out.length > max) return;
    if (IGNORE_DIRS.has(e.name)) continue;
    const rel = dir ? `${dir}/${e.name}` : e.name;
    if (e.isDirectory()) walkMatches(root, rel, query, out, max);
    else {
      const p = rel.toLowerCase();
      if (ext ? p.endsWith(ext) : p.includes(query)) out.push({ path: rel });
    }
  }
}
async function searchFiles(projectCode, { query, max, root, names } = {}) {
  const cwd = rootOf(projectCode, root);
  if (!cwd) return { ok: false, error: "no folder for this project", results: [] };
  if (!String(query || "").trim()) return { ok: true, results: [], names: !!names };
  if (names) {
    const cap = Number(max) || 500;
    const out = [];
    // One over the cap, so "there are more" is a fact rather than a guess about a full page.
    walkMatches(cwd, "", String(query).toLowerCase(), out, cap);
    return { ok: true, names: true, results: out.slice(0, cap), truncated: out.length > cap };
  }
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

// ONE COMMIT, IN FULL — his ask: the log row shows a truncated subject and nothing else, so a
// message with a body (which is most of ours) is unreadable at the only place you go to read it.
//
// SEPARATE from gitState deliberately. The log carries 40 commits; loading every body and file list
// with it would multiply the payload for data nobody is looking at yet. This is fetched when a row
// is actually opened, once, and cached by the caller.
async function showCommit(projectCode, opts = {}) {
  const cwd = await rootFor(projectCode, opts);
  if (!cwd) return { ok: false, error: "unknown project" };
  const sha = String(opts.sha || "").trim();
  // Anchored, and no dots: a sha is hex, and anything else here is an argument being smuggled into
  // `git show`. `--` would not save us — the value is the REVISION, not a path.
  if (!/^[0-9a-fA-F]{4,40}$/.test(sha)) return { ok: false, error: "bad sha" };
  const SEP = "\u001f";
  const REC = "\u001e";
  const meta = await git(cwd, [
    "show", "--no-patch", "--date=iso",
    `--pretty=format:%H${SEP}%h${SEP}%an${SEP}%ae${SEP}%ad${SEP}%ar${SEP}%P${SEP}%s${SEP}%b${REC}`,
    sha,
  ]);
  if (!meta.ok) return { ok: false, error: meta.err || "no such commit" };
  const [full, short, who, email, date, when, parents, subject, body] =
    String(meta.out || "").split(REC)[0].split(SEP);
  // --numstat, so a row can say +12/−3 per file rather than just naming it. Binary files report
  // "-" for both, which we keep as null rather than coercing to 0 — "unknown" and "no change"
  // are different facts.
  const stat = await git(cwd, ["show", "--numstat", "--format=", sha]);
  const files = String(stat.out || "")
    .split("\n")
    .filter(Boolean)
    .map((line) => {
      const [add, del, path] = line.split("\t");
      return { path, added: add === "-" ? null : +add, removed: del === "-" ? null : +del };
    })
    .filter((f) => f.path);
  return {
    ok: true,
    sha: short, full, who, email, date, when, subject,
    body: (body || "").trim(),
    parents: String(parents || "").trim().split(/\s+/).filter(Boolean),
    files,
    added: files.reduce((n, f) => n + (f.added || 0), 0),
    removed: files.reduce((n, f) => n + (f.removed || 0), 0),
  };
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
// STAGE JUST THESE LINES. The pane rebuilds the index copy of the file with only one hunk's edits
// applied (`stagedContentFor`) and hands the bytes here; the working tree is never touched, only
// the index moves: hash the bytes into the object store, then point the index entry at them. Found
// live: this verb was still routed to the SHELL, which has no such thing, so pressing "+ stage" on
// a hunk failed — and the pane blanked the file to show the error.
async function stageHunk(projectCode, { path: rel, content, root } = {}) {
  const cwd = rootOf(projectCode, root);
  if (!cwd) return { ok: false, error: "no folder for this project" };
  if (!rel || typeof content !== "string") return { ok: false, error: "nothing to stage" };
  const res = await serial(cwd, async () => {
    const hashed = await new Promise((resolve) => {
      const child = execFile("git", ["hash-object", "-w", "--stdin"], { cwd }, (err, stdout, stderr) =>
        resolve(err ? { ok: false, error: String((stderr || err.message || "").trim()).slice(0, 400) } : { ok: true, out: String(stdout || "").trim() }),
      );
      child.stdin.on("error", () => {});
      child.stdin.end(content);
    });
    if (!hashed.ok) return hashed;
    // Keep the entry's mode when it has one (an executable stays executable); a new file is 100644.
    const ls = await git(cwd, ["ls-files", "--stage", "--", rel]);
    const mode = (ls.ok && /^(\d{6}) /.exec(ls.out.trim()) || [])[1] || "100644";
    return git(cwd, ["update-index", "--add", "--cacheinfo", `${mode},${hashed.out},${rel}`]);
  });
  bustGit(projectCode);
  return res.ok ? { ok: true, path: rel } : { ok: false, error: res.error };
}
// PUSH, HISTORY, SNAPSHOT — the three the callers still needed and I had not written. I moved the
// providers and checked the ones I happened to think of instead of the ones the code actually calls;
// `Plugin.push is not a function` is what that costs, and it surfaced on him pressing a button.
// The list is not a guess: grep every `Plugin.<method>` in the files that now use hostFiles and
// implement exactly that set.
// BRANCHES, FOR THE REVIEW SURFACE — an agent's refinement lands on a branch, and the report's
// blocks (and the nav) need three verbs the namespace never had: what branches exist, move the
// working tree between them, and the LIVE diff of a branch against its base — computed at view
// time, never a frozen patch, so it cannot go stale while the report sits open.
async function branches(projectCode, { root } = {}) {
  const cwd = rootOf(projectCode, root);
  if (!cwd) return { ok: false, error: "no folder for this project" };
  const res = await git(cwd, ["for-each-ref", "refs/heads", "--format=%(refname:short)\u001f%(HEAD)\u001f%(committerdate:iso8601)\u001f%(subject)"]);
  if (!res.ok) return { ok: false, error: res.error };
  const rows = res.out.split("\n").filter(Boolean).map((l) => {
    const [name, head, when, subject] = l.split("\u001f");
    return { name, current: head === "*", when, subject: subject || "" };
  });
  return { ok: true, branches: rows };
}

async function switchBranch(projectCode, { name, root } = {}) {
  const cwd = rootOf(projectCode, root);
  if (!cwd) return { ok: false, error: "no folder for this project" };
  if (!String(name || "").trim()) return { ok: false, error: "which branch?" };
  // `git switch` refuses rather than clobbers when local changes collide — that refusal IS the
  // answer we surface; nothing here stashes or forces on the user's behalf.
  const res = await serial(cwd, () => git(cwd, ["switch", String(name)]));
  bustGit(projectCode);
  if (!res.ok) return { ok: false, error: res.error };
  return { ok: true, branch: String(name), state: await gitStateRaw(projectCode, { root }) };
}

async function branchDiff(projectCode, { branch, base, root } = {}) {
  const cwd = rootOf(projectCode, root);
  if (!cwd) return { ok: false, error: "no folder for this project" };
  const b = String(branch || "").trim();
  if (!b) return { ok: false, error: "which branch?" };
  // IS IT EVEN HERE? Asked for a branch this repo does not have, git answers about the RANGE —
  // `fatal: ambiguous argument 'main...lane/corpus-kind': unknown revision or path not in the
  // working tree` — which reads as a broken base and sent two people hunting the wrong bug. The
  // real answer is simpler and the surface should say it: that branch is in another repository.
  const here = await git(cwd, ["rev-parse", "--verify", "--quiet", `refs/heads/${b}`]);
  if (!here.ok) return { ok: false, error: `${projectCode} has no branch named ${b} — it belongs to another repo` };
  // default base: the repo's default branch (origin/HEAD), falling back to main/master
  let bs = String(base || "").trim();
  if (!bs) {
    const dh = await git(cwd, ["symbolic-ref", "refs/remotes/origin/HEAD"]);
    bs = dh.ok ? dh.out.trim().replace("refs/remotes/origin/", "") : "";
    if (!bs) {
      const m = await git(cwd, ["rev-parse", "--verify", "--quiet", "main"]);
      bs = m.ok ? "main" : "master";
    }
  }
  // three dots: what the BRANCH adds since it forked — the review question — not every way the
  // two have since diverged. The commits ride along because a lane is one piece of work: the
  // review has to SHOW the commit the way a ::commit block does, or accepting it is signing
  // something unread (his ask).
  const [stat, patch, log] = await Promise.all([
    git(cwd, ["diff", "--name-status", `${bs}...${b}`]),
    git(cwd, ["diff", `${bs}...${b}`]),
    git(cwd, ["log", "--format=%h%s", `${bs}..${b}`]),
  ]);
  if (!stat.ok) return { ok: false, error: stat.error };
  const files = stat.out.split("\n").filter(Boolean).map((l) => {
    const [status, ...p] = l.split(/\t/);
    return { status, path: p[p.length - 1] };
  });
  const commits = log.ok
    ? log.out.split("\n").filter(Boolean).map((l) => { const [hash, subject] = l.split(""); return { hash, subject: subject || "" }; })
    : [];
  return { ok: true, branch: b, base: bs, files, patch: patch.ok ? patch.out : "", commits };
}

// LAND (his design) — accept a reviewed branch onto the branch you are STANDING ON, without a
// tour of the lane branch: the commits arrive as themselves (fast-forward when possible, a merge
// commit when histories diverged), which is what keeps branchState's merged-check true afterwards
// — a squash would land the content and leave the history claiming unmerged forever. A conflict
// is a REFUSAL: the merge is unwound (`reset --merge`) and the conflict named; nothing is forced
// and nothing is left half-merged for the user to discover.
async function mergeBranch(projectCode, { branch, root } = {}) {
  const cwd = rootOf(projectCode, root);
  if (!cwd) return { ok: false, error: "no folder for this project" };
  const b = String(branch || "").trim();
  if (!b) return { ok: false, error: "which branch?" };
  return serial(cwd, async () => {
    const cur = await git(cwd, ["rev-parse", "--abbrev-ref", "HEAD"]);
    if (cur.ok && cur.out.trim() === b) return { ok: false, error: "you are standing on that branch — land it from the branch it should merge into" };
    const res = await git(cwd, ["merge", "--no-edit", b]);
    bustGit(projectCode);
    if (!res.ok) {
      await git(cwd, ["reset", "--merge"]); // unwind — a refusal leaves the tree as it was
      return { ok: false, error: res.error || "merge refused" };
    }
    return { ok: true, merged: b, into: cur.ok ? cur.out.trim() : "" };
  });
}

// THE JANITOR'S VIEW (RFC-059) — a lane leaves artifacts: a worktree that auto-cleans only when
// unchanged (a lane ALWAYS changes its worktree), a branch that lives until deleted. These two
// verbs are what lets a panel show "what this lane left behind" instead of leaving it to
// archaeology.
async function worktrees(projectCode, { root } = {}) {
  const cwd = rootOf(projectCode, root);
  if (!cwd) return { ok: false, error: "no folder for this project" };
  const res = await git(cwd, ["worktree", "list", "--porcelain"]);
  if (!res.ok) return { ok: false, error: res.error };
  const rows = [];
  let cur = null;
  for (const line of res.out.split("\n")) {
    if (line.startsWith("worktree ")) { cur = { path: line.slice(9), branch: "", main: false }; rows.push(cur); }
    else if (cur && line.startsWith("branch ")) cur.branch = line.slice(7).replace("refs/heads/", "");
    else if (cur && line === "bare") cur.main = true;
  }
  if (rows.length) rows[0].main = true; // the first entry is the repo's own tree
  return { ok: true, worktrees: rows };
}

async function branchState(projectCode, { branch, base, root } = {}) {
  const cwd = rootOf(projectCode, root);
  if (!cwd) return { ok: false, error: "no folder for this project" };
  const b = String(branch || "").trim();
  if (!b) return { ok: false, error: "which branch?" };
  let bs = String(base || "").trim();
  if (!bs) {
    const dh = await git(cwd, ["symbolic-ref", "refs/remotes/origin/HEAD"]);
    bs = dh.ok ? dh.out.trim().replace("refs/remotes/origin/", "") : "main";
  }
  const exists = await git(cwd, ["rev-parse", "--verify", "--quiet", b]);
  if (!exists.ok) return { ok: true, branch: b, exists: false, merged: false };
  // merged = no commits on the branch that the base lacks
  const ahead = await git(cwd, ["rev-list", "--count", `${bs}..${b}`]);
  return { ok: true, branch: b, exists: true, merged: ahead.ok && ahead.out.trim() === "0", base: bs };
}

// THE USER'S CLEANUP (RFC-059 slice 2) — pressed on a lane row after its confirm, never run
// quietly by an agent. Both verbs REFUSE rather than force: a worktree with uncommitted changes
// and an unmerged branch each need `force: true`, which only the confirm that told the user so
// sends. The refusal text is the answer we surface.
// WHICH REPO IS THIS BRANCH IN? A lane row lives in the chat of the project whose session spawned
// it, but the lane's WORK can be in another repo entirely — mine ran in autobot while their rows sat
// in systemview's chat. The run record does not say: its keys are owner/items/source/session, and
// `source: "lane:<branch>"` carries a branch name and nothing else. So every git verb the row
// offered went to the wrong repository, where the three-dot range `main...lane/corpus-kind` is an
// unknown revision — the branch is simply not there (2026-09-20, live).
//
// ASKED OF DISK, NOT OF THE AGENT. The alternative was to have each lane record its project, which
// would fix the next lane and none of the ones already on disk, and would make the row's correctness
// depend on a subagent remembering to say so. A branch either exists in a repo or it does not; that
// is a fact the hub can read. First match wins, and a repo that also has a WORKTREE checked out on
// that branch wins over one that merely has the ref, which is the tie-break that matters for lanes.
// TYPING INTO A TERMINAL HE ALREADY OPENED — RFC pending, built at his ask (2026-09-21).
//
// The point is narrow and it is what makes this safe enough to exist: an agent cannot OPEN a
// terminal here, cannot name a host, cannot authenticate. It can only type into a session a human
// already started and already granted. He is SSH'd into his remote box; the agent inherits that
// keyboard rather than being handed credentials. No terminal, no door.
//
// The transport is `screen`, which the harness already uses for every terminal tab — detached
// sessions named `autobot-<project>_<sessionId>`. `screen -X stuff` sends keystrokes into a running
// session without attaching, so nothing steals his view and his own client keeps working.
//
// THE GATE IS THE FILE (api/terminalGrants.js), not the caller. This module surface is reachable by
// every agent in every room, so a check that lived in the browser would be no check at all.
function screenSessionFor(session) {
  const s = String(session || "").trim();
  if (!s) return null;
  const res = require("child_process").spawnSync("screen", ["-ls"], { encoding: "utf8" });
  const lines = String((res && res.stdout) || "").split("\n");
  const hit = lines.map((l) => (l.match(/^\s*(\d+\.[^\s]+)/) || [])[1]).filter(Boolean)
    .find((name) => name.endsWith(`_${s}`));
  return hit || null;
}

// RUN A COMMAND AND COME BACK WITH THE ANSWER — the shape an agent already knows.
//
// The first cut of this made typing and reading two calls, and I defended the split as something to
// document. His answer: *"I don't want it to be different between them using this and them using a
// terminal."* He is right, and the split was not a fact about terminals — it was a missing wrapper.
// Every agent alive has a Bash tool whose contract is: send a command, get stdout and an exit code.
// Anything else invites the failure this system cares most about — reporting a success nobody
// observed, because the write returned ok and the read never happened.
//
// THE POLLING LIVES HERE. Waiting on the server costs wall-clock; waiting in an agent costs TURNS,
// and a turn is the expensive unit. So this types, watches, and returns once — one call in, output
// and exit code out.
//
// HOW THE ANSWER IS FOUND: the command is wrapped in markers and read back off `screen -X hardcopy`,
// which dumps the visible screen as plain text (no escape codes). The exit marker carries `$?`, so
// the code is the shell's own, not an inference from output. A command that stops to ask something
// never prints its marker — that returns "still running" with what is on screen, the same way a
// Bash tool's timeout does.
//
// STDOUT AND STDERR ARE ONE STREAM. A pty has no second channel; that is the price of a real
// terminal, and what it buys is that things like a build print progress instead of detecting a pipe.
function hardcopyOf(name, withScrollback = false) {
  const os = require("os");
  const cp = require("child_process");
  const out = path.join(os.tmpdir(), `sv-hardcopy-${process.pid}.txt`);
  try { fsGit.unlinkSync(out); } catch {}
  // `-h` TAKES THE SCROLLBACK TOO, and it is not a nicety. Without it `hardcopy` dumps only what is
  // VISIBLE, so a long answer comes back with its top silently cut — a `git status` that scrolled
  // would return as though the files above the fold were not modified. An agent reading that would
  // report something it never saw, which is the one failure this whole surface exists to prevent.
  // TWO DIFFERENT READS, AND THE SECOND ONE IS RARE. Polling asks for the VISIBLE screen, which is
  // where a fresh marker always lands and is a screenful to read; the scrollback (`-h`) is pulled
  // ONCE, on the poll that actually finds the marker, and only then to recover output that scrolled
  // off. The first cut asked for the scrollback every 250ms — thousands of lines re-read hundreds of
  // times to answer "has it finished yet", which costs no tokens and is still stupid work.
  cp.spawnSync("screen", ["-S", name, "-p", "0", "-X", "hardcopy", ...(withScrollback ? ["-h"] : []), out], { encoding: "utf8" });
  try {
    return fsGit.readFileSync(out, "utf8");
  } catch {
    return "";
  } finally {
    try { fsGit.unlinkSync(out); } catch {}
  }
}

async function terminalRun(_projectCode, { session, agent, command, timeoutMs = 120000 } = {}) {
  const s = String(session || "").trim();
  const who = String(agent || "").trim();
  const cmd = String(command || "").trim();
  if (!s) return { ok: false, error: "which terminal?" };
  if (!who) return { ok: false, error: "say which agent is running this — the grant is per agent" };
  if (!cmd) return { ok: false, error: "nothing to run" };
  const granted = termGrants.grantedAgent(s);
  if (!granted) return { ok: false, error: `no agent is allowed to type in ${s} — the toggle on that terminal is off` };
  if (granted !== who) return { ok: false, error: `${s} is granted to ${granted}, not ${who}` };
  const name = screenSessionFor(s);
  if (!name) return { ok: false, error: `no live shell for ${s} — open that terminal first` };

  // WHAT HE WATCHES IS THE COMMAND, NOT THE WRAPPER. The first cut sent the command base64'd inside
  // an eval with begin/end markers — it worked, and what he saw in his own terminal was a broken
  // line of gibberish next to his prompt. He is meant to be able to WATCH an agent work here; a
  // transport that makes the shell unreadable defeats the feature it is serving.
  //
  // So the command goes in verbatim, exactly as a person would type it, and one short line follows
  // it carrying `$?`. His terminal reads normally. The marker is the only thing that is ours, and it
  // is one line at the end.
  //
  // `\\n` IS TWO CHARACTERS HERE, deliberately: it has to reach the shell as a backslash and an n
  // for printf to turn it into a newline. Writing a real newline into the keystrokes is what broke
  // the line across his prompt the first time.
  const tag = `sv${Date.now().toString(36)}`;
  const line = `${cmd}; printf '${tag}:%s\\n' "$?"`;
  const sent = require("child_process").spawnSync("screen", ["-S", name, "-p", "0", "-X", "stuff", `${line}\n`], { encoding: "utf8" });
  if (sent.status !== 0)
    return { ok: false, error: (sent.stderr || "screen refused the keystrokes").trim().slice(0, 200) };

  // READING IT BACK. The marker line is the end; the start is the ECHO of the command itself, which
  // is how a human reads a terminal too — everything between what you typed and the next prompt.
  const ended = `${tag}:`;
  const lastCmdLine = String(cmd).split("\n").pop();
  const deadline = Date.now() + Math.max(1000, Math.min(600000, Number(timeoutMs) || 120000));
  let screenText = "";
  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, 250));
    screenText = hardcopyOf(name);
    // The LAST marker that is not the echo of the line we just sent — the echo contains the tag
    // inside a printf, the real one is a line that STARTS with it.
    let lines = screenText.split("\n");
    let endIdx = -1;
    for (let i = lines.length - 1; i >= 0; i -= 1)
      if (lines[i].startsWith(ended)) { endIdx = i; break; }
    if (endIdx === -1) continue;
    // FOUND IT — now, and only now, re-read WITH the scrollback, so a long answer whose top scrolled
    // off the visible screen comes back whole.
    screenText = hardcopyOf(name, true) || screenText;
    lines = screenText.split("\n");
    endIdx = -1;
    for (let i = lines.length - 1; i >= 0; i -= 1)
      if (lines[i].startsWith(ended)) { endIdx = i; break; }
    if (endIdx === -1) continue;
    const code = parseInt(String(lines[endIdx].slice(ended.length)).trim(), 10);
    // THE START IS THE ECHO'S TAIL, NOT THE COMMAND TEXT. Matching the command was the obvious
    // thing and it broke on his very first real use: a two-line prompt wrapped the echoed line, so
    // no single row contained the whole command and the output came back carrying his prompt. The
    // TAG is in the echo too — and whichever row it lands on when wrapped is the last row before
    // the output begins, which is exactly the anchor we want.
    let startIdx = -1;
    for (let i = endIdx - 1; i >= 0; i -= 1)
      if (lines[i].includes(tag)) { startIdx = i; break; }
    if (startIdx === -1)
      for (let i = endIdx - 1; i >= 0; i -= 1)
        if (lastCmdLine && lines[i].includes(lastCmdLine)) { startIdx = i; break; }
    const output = lines
      .slice(startIdx === -1 ? Math.max(0, endIdx - 40) : startIdx + 1, endIdx)
      .join("\n")
      .replace(/^\n+/, "")
      .replace(/\s+$/, "");
    // A CAP, AND IT SAYS SO. Scrollback can be thousands of lines; silently returning the first
    // 200 would be the same lie in a different direction, so a trimmed answer announces itself.
    const MAX = 20000;
    const trimmed = output.length > MAX
      ? `…[${output.length - MAX} characters trimmed from the start]…\n${output.slice(-MAX)}`
      : output;
    return { ok: true, session: s, agent: who, command: cmd, exit: Number.isFinite(code) ? code : null, output: trimmed };
  }
  // NOT A FAILURE — a command that is still going, or one waiting on an answer. Say which is not
  // knowable from here, so say what IS: it has not finished, and this is what the screen shows.
  return {
    ok: true,
    session: s,
    agent: who,
    command: cmd,
    running: true,
    exit: null,
    output: String(screenText || "").replace(/\s+$/, ""),
    note: "still running — no exit marker yet. It may be working, or waiting for an answer typed into the terminal.",
  };
}

async function terminalGrants() {
  return { ok: true, grants: termGrants.grants() };
}

async function setTerminalGrant(_projectCode, { session, agent, by, on = true } = {}) {
  return termGrants.setGrant({ session, agent, by, on });
}

// WHAT THE AGENT CALLS. It says who it is; the file says who may. A mismatch is a refusal with the
// reason in it, because "nothing happened" is the worst possible answer to a command you believed
// you sent.
async function terminalType(_projectCode, { session, agent, text, enter = true } = {}) {
  const s = String(session || "").trim();
  const who = String(agent || "").trim();
  const body = String(text == null ? "" : text);
  if (!s) return { ok: false, error: "which terminal?" };
  if (!who) return { ok: false, error: "say which agent is typing — the grant is per agent" };
  if (!body) return { ok: false, error: "nothing to type" };
  const granted = termGrants.grantedAgent(s);
  if (!granted) return { ok: false, error: `no agent is allowed to type in ${s} — the toggle on that terminal is off` };
  if (granted !== who) return { ok: false, error: `${s} is granted to ${granted}, not ${who}` };
  const name = screenSessionFor(s);
  if (!name) return { ok: false, error: `no live shell for ${s} — open that terminal first` };
  // `stuff` takes the string verbatim; the newline is what makes it a command rather than a draft,
  // and it is separable because reviewing a line before it runs is a thing he may want.
  // `-p 0` IS NOT OPTIONAL, and leaving it off is a silent success: screen 4.00.03 (the build macOS
  // ships) accepts `-X stuff` without a window selected, exits 0, and delivers the keystrokes
  // nowhere. Verified live — the command reported ok and the file it would have written never
  // appeared. An agent would have every reason to believe it had run.
  const res = require("child_process").spawnSync("screen", ["-S", name, "-p", "0", "-X", "stuff", enter ? `${body}\n` : body], { encoding: "utf8" });
  if (res.status !== 0)
    return { ok: false, error: (res.stderr || "screen refused the keystrokes").trim().slice(0, 200) };
  return { ok: true, session: s, screen: name, agent: who, typed: body, enter: !!enter };
}

async function branchOwner(_projectCode, { branch } = {}) {
  const b = String(branch || "").trim();
  if (!b) return { ok: false, error: "which branch?" };
  const roots = projectRoots();
  let refOnly = null;
  for (const [pc, root] of Object.entries(roots)) {
    const has = await git(root, ["rev-parse", "--verify", "--quiet", `refs/heads/${b}`]);
    if (!has.ok) continue;
    const wt = await git(root, ["worktree", "list", "--porcelain"]);
    if (wt.ok && new RegExp(`^branch refs/heads/${b.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, "m").test(wt.out))
      return { ok: true, projectCode: pc, root, worktree: true };
    if (!refOnly) refOnly = { ok: true, projectCode: pc, root, worktree: false };
  }
  return refOnly || { ok: false, error: `no project here has a branch named ${b}` };
}

async function removeWorktree(projectCode, { path: wt, root, force } = {}) {
  const cwd = rootOf(projectCode, root);
  if (!cwd) return { ok: false, error: "no folder for this project" };
  const p = String(wt || "").trim();
  if (!p) return { ok: false, error: "which worktree?" };
  const args = ["worktree", "remove", ...(force ? ["--force"] : []), p];
  const res = await serial(cwd, () => git(cwd, args));
  bustGit(projectCode);
  if (!res.ok) return { ok: false, error: res.error };
  return { ok: true, removed: p };
}

async function deleteBranch(projectCode, { name, root, force } = {}) {
  const cwd = rootOf(projectCode, root);
  if (!cwd) return { ok: false, error: "no folder for this project" };
  const b = String(name || "").trim();
  if (!b) return { ok: false, error: "which branch?" };
  // -d refuses an unmerged branch; -D is only sent by a confirm that said "not merged" out loud
  const res = await serial(cwd, () => git(cwd, ["branch", force ? "-D" : "-d", b]));
  bustGit(projectCode);
  if (!res.ok) return { ok: false, error: res.error };
  return { ok: true, deleted: b };
}

// BRING OVER AS CHANGES (his ask) — the review-first accept: apply the branch's commits to the
// working tree WITHOUT committing, standing right where you are. The work arrives as uncommitted
// changes — file list, per-file diffs, the user's own commit on top — because on the branch it is
// already committed and there is nothing left to review as changes. Conflict or dirty-tree
// refusals are unwound (`cherry-pick --abort`, then `reset --merge` as the belt-and-braces) and
// surfaced; nothing is half-applied.
async function applyBranch(projectCode, { branch, base, root } = {}) {
  const cwd = rootOf(projectCode, root);
  if (!cwd) return { ok: false, error: "no folder for this project" };
  const b = String(branch || "").trim();
  if (!b) return { ok: false, error: "which branch?" };
  let bs = String(base || "").trim();
  if (!bs) {
    const dh = await git(cwd, ["symbolic-ref", "refs/remotes/origin/HEAD"]);
    bs = dh.ok ? dh.out.trim().replace("refs/remotes/origin/", "") : "main";
  }
  return serial(cwd, async () => {
    const res = await git(cwd, ["cherry-pick", "--no-commit", `${bs}..${b}`]);
    bustGit(projectCode);
    if (!res.ok) {
      await git(cwd, ["cherry-pick", "--abort"]).catch(() => {});
      await git(cwd, ["reset", "--merge"]).catch(() => {});
      return { ok: false, error: res.error || "could not apply the branch's changes" };
    }
    // leave nothing staged-by-surprise: the changes sit in the tree for HIS review and commit
    await git(cwd, ["reset"]);
    return { ok: true, applied: b };
  });
}

// FAST-FORWARD LAND (his ask) — accepting from ON the branch: bring the base up to here without
// checking it out. `git fetch . <branch>:<base>` moves the base ref only when it is a clean
// fast-forward and refuses otherwise ("non-fast-forward") — which is the honest answer: the base
// moved since the fork, go stand on it and land with a real merge.
async function fastForward(projectCode, { branch, to, root } = {}) {
  const cwd = rootOf(projectCode, root);
  if (!cwd) return { ok: false, error: "no folder for this project" };
  const b = String(branch || "").trim();
  const t = String(to || "").trim();
  if (!b || !t) return { ok: false, error: "which branch, onto which?" };
  const res = await serial(cwd, () => git(cwd, ["fetch", ".", `${b}:${t}`]));
  bustGit(projectCode);
  if (!res.ok) return { ok: false, error: res.error || "fast-forward refused" };
  return { ok: true, forwarded: t, to: b };
}

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
  bustGit(projectCode);
  if (!res.ok) return { ok: false, error: res.error };
  // THE SHAPE THE BLOCK READS, not the shape git prints. It does `setState(res.state)` and
  // `say(res.output || sha + " " + subject)` — so a bare `{ ok, out }` receipt makes the block say
  // "undefined undefined", drop its state to null, and lose the Push button (Push needs
  // `state.ahead > 0`). His clues exactly. A commit is not finished when git exits 0; it is
  // finished when the surface that offered it can show what changed.
  const head = await git(cwd, ["log", "-1", "--pretty=format:%h\u001f%s"]);
  const [sha, subject] = String(head.out || "").split("\u001f");
  return {
    ok: true,
    sha: sha || "",
    subject: subject || String(message),
    output: (res.out || "").trim() || `${sha || ""} ${subject || ""}`.trim(),
    state: await gitStateRaw(projectCode, { root }),
  };
}

function chatSend(projectCode, { chat, from = "you", text, view, as } = {}) {
  armChatSweep(this);
  const identity = from === "agent" ? resolveSpeaker(projectCode, chat, as) : undefined;
  // Known BEFORE the write, so the record can carry it — see `relayedTo` in Chats.send.
  const goingTo = Chats.fanout(projectCode, chat || Chats.DEFAULT_CHAT, {
    from,
    ...(identity ? { as: identity } : {}),
  });
  // THE WALL AT THE HOME DOOR. An agent writing into its OWN room while that room is an attached
  // conversation is talking to a file beside the chat instead of in it. The CLI has no verb that
  // can do this any more (message-agent refuses a self-address before the hub is called); this is
  // the hub-side backstop for any other caller. The human is in the conversation, and the reply IS
  // the message.
  if (from === "agent" && identity === projectCode && isAttached(projectCode))
    return {
      blocked: true,
      attachedRoom: true,
      hint: `systemview message-agent <otherProject> "…" --as ${projectCode}`,
    };
  const sent = Chats.send(projectCode, chat || Chats.DEFAULT_CHAT, {
    from,
    text,
    view,
    as: identity,
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
  // RFC-051 — FEED THE AUDIENCE TO THE SPEAKER (his ask: "agents should know if someone is
  // subscribed in the room"). The subscriber list is known right here at send time, so the receipt
  // carries it instead of making the agent run a second command. `windowNudge` rides along when
  // this sender is on their third-or-later windowed exchange: the moment a courtesy becomes a
  // conversation, they are told the verb that makes it one — and joining stays THEIR decision.
  try {
    const chatName2 = chat || Chats.DEFAULT_CHAT;
    const subs = Chats.visitors(projectCode, chatName2).map((v) => v.identity);
    const win = identity && identity !== projectCode ? Chats.windowState(projectCode, chatName2, identity) : null;
    return {
      ...record,
      audience: subs,
      ...(win && !win.joined ? { replyWindow: true, windowNudge: win.count >= 3 } : {}),
    };
  } catch {
    return record;
  }
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
const Reports = { ...ReportsLib.reportsOn({ readFile, writeFile }), replyInto: ReportsLib.replyInto };
const Board = require("./board").boardOn({ readFile, writeFile });
const CodeComments = require("./codeComments").commentsOn({ readFile, writeFile, listFiles });

// WHERE THE FOUR DRIVE METHODS LAND. api/drive.js decides WHAT to send (and refuses, with why);
// this emits it, because the chat state and the socket live here. `say` rides the trip and is
// ephemeral by design — it is spoken while the window moves and then it is gone, which is right for
// a pointing line and a trap the moment real content lands in it. `pin` also drops it in the chat,
// where it survives (RFC-039).
function sendDrive(result, { projectCode, chat, as, say, pin } = {}) {
  if (!result || result.error) return result || { error: "nothing to send" };
  const record = chatCommand.call(this, projectCode, {
    chat,
    from: as || "agent",
    cmd: result.cmd,
    args: result.args,
    label: result.label,
    say,
  });
  if (pin && say) {
    try {
      chatSend.call(this, projectCode, { chat, from: "agent", text: say, as });
    } catch {
      /* the trip was sent; failing to pin it must not fail the trip */
    }
  }
  return { ok: true, label: result.label, ...(record && record.id ? { id: record.id } : {}) };
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
// RFC-051 — THE CONVERSATION VERBS, agent-side. Joining, leaving and kicking were his controls
// only (roster clicks); his call: "agents should have the ability to join, leave, and kick other
// people out of the room too. Not just me." Join is DELIBERATE — the one thing speaking no longer
// does — and kick carries the one authority rule that keeps rooms legible: you run YOUR room's
// list, you carry yourself everywhere, and nobody clears a third room's table.
function chatJoinRoom(projectCode, { chat, as } = {}) {
  const chatName = chat || Chats.DEFAULT_CHAT;
  const identity = resolveSpeaker(projectCode, chatName, as); // same front door as speaking
  if (identity === projectCode) return { ok: false, reason: "your own room — you are already it" };
  const res = Chats.addVisitor(projectCode, chatName, identity, "spoke");
  if (res.added) {
    const sys = Chats.system(projectCode, chatName, { event: "joined", who: identity });
    this.emit(`chat-updated:${projectCode}`, { chat: chatName, record: sys });
    this.emit(`chat-visitors:${projectCode}`, { chat: chatName, visitors: Chats.visitors(projectCode, chatName) });
    this.emit(`chat-presence:${projectCode}`, presenceFor(projectCode));
  }
  return { ok: true, ...res, audience: Chats.visitors(projectCode, chatName).map((v) => v.identity) };
}
function chatLeaveRoom(projectCode, { chat, as } = {}) {
  const chatName = chat || Chats.DEFAULT_CHAT;
  const identity = canonIdentity(projectCode, as);
  if (identity === projectCode) return { ok: false, reason: "your own room — there is no leaving it" };
  const res = Chats.removeVisitor(projectCode, chatName, identity);
  if (res.removed) {
    const sys = Chats.system(projectCode, chatName, { event: "left", who: identity });
    this.emit(`chat-updated:${projectCode}`, { chat: chatName, record: sys });
    this.emit(`chat-visitors:${projectCode}`, { chat: chatName, visitors: Chats.visitors(projectCode, chatName) });
    this.emit(`chat-presence:${projectCode}`, presenceFor(projectCode));
  }
  return { ok: true, ...res };
}
function chatKickAgent(projectCode, { chat, identity, as } = {}) {
  const chatName = chat || Chats.DEFAULT_CHAT;
  const by = canonIdentity(projectCode, as);
  // THE AUTHORITY RULE. Only this room's own agent clears this room's table (the human's kick is
  // chatKick, from the UI, and answers to nobody). A visitor may remove ITSELF — that is leave,
  // and the refusal says so rather than doing it under the wrong name.
  if (by !== projectCode)
    return identity === by
      ? { ok: false, reason: "removing yourself is leave", hint: `systemview leave ${projectCode} --as ${by}` }
      : { ok: false, reason: `only ${projectCode}'s own agent runs ${projectCode}'s list` };
  const res = Chats.removeVisitor(projectCode, chatName, identity);
  if (res.removed) {
    const sys = Chats.system(projectCode, chatName, { event: "kicked", who: identity });
    this.emit(`chat-updated:${projectCode}`, { chat: chatName, record: sys });
    this.emit(`chat-visitors:${projectCode}`, { chat: chatName, visitors: Chats.visitors(projectCode, chatName) });
    this.emit(`chat-presence:${projectCode}`, presenceFor(projectCode));
  }
  return { ok: res.removed, ...res };
}
// THE PLAN METERS, FROM THE THING THAT KNOWS THEM. `/usage` is a Claude Code CLI command, not an
// SDK one — sent through a session it arrives at the model as text (he pressed it twice and watched
// "running…" forever). But the CLI answers it in PRINT mode, non-interactively, in a few seconds:
// `claude -p "/usage" --output-format text`. So the hub runs the CLI on this machine and hands the
// text back. Real numbers, on demand, no workaround — I proposed two before checking whether the
// straight door was open; his call: *"you should check with me if what I'm asking for can be
// accomplished before trying a workaround."* It could.
const usageCache = { ts: 0, text: "" };
function findClaudeCli() {
  const os = require("os");
  const candidates = [
    path.join(os.homedir(), ".claude", "local", "claude"),
    "/usr/local/bin/claude",
    "/opt/homebrew/bin/claude",
    path.join(os.homedir(), "autobot", "node_modules", "@anthropic-ai", "claude-agent-sdk-darwin-arm64", "claude"),
  ];
  try {
    const ext = path.join(os.homedir(), ".vscode", "extensions");
    fsGit.readdirSync(ext).filter((d) => /^anthropic\.claude-code-/.test(d)).sort().reverse()
      .forEach((d) => candidates.push(path.join(ext, d, "resources", "native-binary", "claude")));
  } catch {}
  return candidates.find((c) => fsGit.existsSync(c)) || null;
}
function usageReport({ fresh = false } = {}) {
  return new Promise((resolve) => {
    if (!fresh && usageCache.text && Date.now() - usageCache.ts < 60000) return resolve({ ok: true, text: usageCache.text, ts: usageCache.ts, cached: true });
    const cli = findClaudeCli();
    if (!cli) return resolve({ ok: false, error: "no claude CLI found on this machine" });
    const { spawn } = require("child_process");
    let out = "", err = "";
    // A USAGE POLL IS NOT A CONVERSATION, AND IT WAS LEAVING ONE BEHIND EVERY MINUTE. Spawned with
    // no session id, the CLI mints one per call and writes a six-line transcript into
    // ~/.claude/projects/<cwd-slug>/<uuid>.jsonl — 4,346 of them by 2026-09-20, ~500 a day since
    // August, which is why that folder had thousands of entries nobody could account for. Pinning a
    // FIXED id does not work: the CLI refuses a session id that already exists ("already in use").
    // So: mint the id here, which makes the file's path knowable, and delete it when the child
    // closes. Cwd is pinned to the temp dir for the same reason — the slug is derived from it, and
    // guessing the hub's cwd would make the unlink miss silently.
    const os = require("os");
    const pollId = require("crypto").randomUUID();
    const pollCwd = (() => {
      try {
        return fsGit.realpathSync(os.tmpdir());
      } catch {
        return os.tmpdir();
      }
    })();
    const pollTranscript = path.join(
      os.homedir(), ".claude", "projects", pollCwd.replace(/[^a-zA-Z0-9]/g, "-"), `${pollId}.jsonl`
    );
    const child = spawn(cli, ["-p", "/usage", "--output-format", "text", "--session-id", pollId], { stdio: ["ignore", "pipe", "pipe"], env: { ...process.env }, cwd: pollCwd });
    const timer = setTimeout(() => { try { child.kill("SIGKILL"); } catch {} resolve({ ok: false, error: "the CLI took too long to answer" }); }, 45000);
    child.stdout.on("data", (d) => { out += d; });
    child.stderr.on("data", (d) => { err += d; });
    child.on("error", (e) => { clearTimeout(timer); resolve({ ok: false, error: e.message }); });
    child.on("close", () => {
      clearTimeout(timer);
      try {
        fsGit.unlinkSync(pollTranscript);
      } catch {
        /* never written, or already gone — the poll's answer does not depend on it */
      }
      const text = String(out || "").trim();
      if (!/\d+%/.test(text)) return resolve({ ok: false, error: (err || text || "empty answer").slice(0, 300) });
      usageCache.text = text; usageCache.ts = Date.now();
      resolve({ ok: true, text, ts: usageCache.ts, cached: false });
    });
  });
}
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

// GIT CHANGES ANNOUNCE THEMSELVES. A commit block in one place and the version-control panel in
// another were reading the same repo and disagreeing (his "divergence"): each refreshes only on
// its own action or on window focus, so a change made anywhere else — an agent's `git add` in a
// terminal, a commit from another window — left one of them stale until something poked it. The
// hub watches every known project's `.git/index` and `.git/HEAD`, drops its cache, and tells every
// open window at once; both surfaces re-read from the same truth in the same second.
const fsWatch = require("fs");
const gitWatchers = new Map(); // root → { pc, watchers: [] }
function watchGitRoots() {
  const roots = projectRoots();
  try {
    const registry = JSON.parse(fsWatch.readFileSync(path.join(__dirname, "hosted.json"), "utf8"));
    (Array.isArray(registry) ? registry : []).forEach((e) => {
      if (e && e.folder && e.projectDir && !roots[e.folder]) roots[e.folder] = e.projectDir;
    });
  } catch {}
  for (const [pc, root] of Object.entries(roots)) {
    if (gitWatchers.has(root)) continue;
    const gitDir = path.join(root, ".git");
    if (!fsWatch.existsSync(gitDir)) continue;
    let timer = null;
    const fire = () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        bustGit(pc);
        bootCtx.emit("git-updated", { projectCode: pc });
      }, 300);
    };
    const watchers = [];
    for (const f of ["index", "HEAD", "refs"]) {
      try {
        const target = path.join(gitDir, f);
        if (!fsWatch.existsSync(target)) continue;
        watchers.push(fsWatch.watch(target, { persistent: false }, fire));
      } catch {}
    }
    gitWatchers.set(root, { pc, watchers });
  }
}

module.exports = function launchSystemView(port = 3000) {
  // NOT ARMED. The watcher above fed itself: every window re-read git on the event, `git status`
  // refreshes `.git/index` as it reads, the watcher fired again, and the box hit a load average of
  // 546 within minutes (his: "the app is running incredibly slow"). It stays out until it ignores
  // the reads it causes itself — kept here so the shape is not rebuilt from scratch.
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
      // The stylesheet rides along: a CSS-only build changes nothing in the script hash, and a tab
      // keyed on the script alone sat on stale styles forever (his window, measured).
      const c = html.match(/main\.[a-z0-9]+\.css/);
      res.json({ bundle: m ? m[0] : null, css: c ? c[0] : null });
    } catch {
      res.json({ bundle: null, css: null });
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
      // THE SHARED CLIENT, CACHED. This used to build a throwaway client per request to dodge
      // stale stubs after a service restart — the 10,000-socket incident's shape on the image
      // hot path. The stale-stub problem is now solved at its source: connect() evicts the
      // cached instance the moment a service re-registers, so the cache here is always honest.
      const { Plugin } = await Client.loadService(service.system.connectionData.serviceUrl);
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
      chatAttached,
      chatRead,
      projectRoots,
      readFile,
      writeFile,
      deleteFile,
      listFiles,
      searchFiles,
      gitState,
      branches,
      switchBranch,
      branchDiff,
      worktrees,
      branchOwner,
      terminalGrants,
      setTerminalGrant,
      terminalType,
      terminalRun,
      branchState,
      removeWorktree,
      deleteBranch,
      mergeBranch,
      fastForward,
      applyBranch,
      showCommit,
      changedFiles,
      getDiff,
      stageFiles,
      stageHunk,
      discardFiles,
      commit,
      push,
      fileHistory,
      readSnapshot,
      chatRelay,
      chatVisitors,
      chatAddVisitor,
      chatRemoveVisitor,
      chatJoinRoom,
      chatLeaveRoom,
      chatKickAgent,
      usageReport,
      chatCommand,
      chatHistory,
      chatList,
      chatFlush,
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
      // THE RUN IS A HANDLE, NOT A FILE (his rule: "we have a handle on it and we display it").
      // Results live in hub memory for the process's lifetime, capped — nothing written, nothing
      // to maintain or delete. The chat row fetches by id only when someone opens it.
      getRun: async ({ id } = {}) => (id && RUNS.has(String(id)) ? RUNS.get(String(id)) : { expired: true }),
      // Threads on SystemView's own surfaces (hub, help topics) — see api/Comments.js for why they
      // don't ride a project's plugin the way a document's threads do.
      getComments: Comments.getComments,
      saveComments: Comments.saveComments,
    })
    // THE AGENT FACE — its own module, because the CLI does not get to dictate its shape.
    // These methods used to sit on `.module("CLI")` under `sv*` names, which is what happens when
    // an agent door is grown out of a command surface: a `verb` string dispatching four tools, and
    // a module named after the one caller it is NOT for. Nothing here shells out, and nothing here
    // dials the hub over HTTP — it is the hub. The published CLI keeps its own face; this is the
    // one an in-process MCP calls (RFC-056).
    .module("Agent", {
      // THE TERMINAL, ON THE AGENT MODULE. The MCP server posts ONE argument per call
      // (`{__arguments:[arg]}`), while the SystemView module's verbs take `(projectCode, opts)` —
      // so the same functions are exposed here in the shape the agent door actually speaks. Same
      // implementations, same grant file, no second path to keep in step.
      terminalRun: async (arg = {}) => terminalRun(null, arg),
      terminalType: async (arg = {}) => terminalType(null, arg),
      terminalGrants: async () => terminalGrants(),

      // PROBE — THE HUB'S OWN CAPABILITY (api/probe.js), and the reason it cannot be the CLI's.
      // `require("../cli/probe")` resolves its session store, cookie jar and manifest from
      // process.cwd(); under the hub that is the SystemView repo, so a call to buAPI read
      // SystemView's session, went out anonymous, and did not error. Here the headers are computed
      // per call from the TARGET project's own .systemview and cached nowhere.
      probe: async (arg = {}) => {
        const { probe } = require("./probe");
        return probe(arg, ConnectedServices.getAllConnections() || []);
      },
      // TESTS — THE HUB'S OWN CAPABILITY (api/runTests.js). This used to require("../cli/runTests")
      // in a "collect" mode: the CLI as the implementation, the hub as its caller, resolving services
      // by calling the hub it is already inside. The orchestration that actually matters lives in
      // testing-utilities/ and is composed here; the terminal's assumptions (cwd cookie jar, log
      // lines, an exit code) stay in the terminal where they mean something.
      runTests: async (arg = {}) => {
        const { runTests } = require("./runTests");
        const r = await runTests(arg, ConnectedServices.getAllConnections() || []);
        // hold the result by HANDLE (in memory, capped) so the chat can display it richly on demand
        if (r && Array.isArray(r.tests) && r.tests.length && !r.dryRun) {
          const id = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
          RUNS.set(id, { ...r, ranAt: Date.now() });
          while (RUNS.size > 20) RUNS.delete(RUNS.keys().next().value);
          r.runId = id;
        }
        return r;
      },
      // `dryRun` IS the listing — one capability, not two. The old `listTests` required the CLI's
      // lister for the same answer.
      listTests: async ({ projectCode, namespace } = {}) => {
        const { runTests } = require("./runTests");
        return runTests({ projectCode, namespace, dryRun: true }, ConnectedServices.getAllConnections() || []);
      },
      // Logs and stats, served structured — the internal MCP renders them human-readable.
      getLogs: async ({ projectCode, level, limit = 100, namespace } = {}) => {
        const services = getServices(projectCode) || [];
        const all = [];
        for (const s of services) {
          try {
            const svc = Client.createService(s.system.connectionData);
            let entries = (await svc.SystemView.getLog({ limit })) || [];
            if (level) entries = entries.filter((e) => e.level === level);
            if (namespace)
              entries = entries.filter((e) =>
                `${e.serviceId || ""}.${e.moduleMethod || ""}`.toLowerCase().includes(String(namespace).toLowerCase())
              );
            all.push(...entries.map((e) => ({ ...e, serviceId: e.serviceId || s.serviceId })));
          } catch {}
        }
        all.sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));
        return { projectCode, entries: all.slice(-Math.max(1, Number(limit) || 100)) };
      },
      // STATISTICS — the shared core (api/stats.js). This one was never a terminal program
      // pretending to be a library: under the printing it is arithmetic the page and the agent must
      // agree on, so the math moved to a neutral home and both faces call it. What it stops doing is
      // asking the hub for the project's services over HTTP while running inside the hub.
      stats: async ({ projectCode, service, range } = {}) => {
        const { stats } = require("./stats");
        return stats({ projectCode, service, range }, ConnectedServices.getAllConnections() || [], Client);
      },
      // THE TV — show / tv / reply, on the hub's own file layer (api/reports.js).
      // These three were `require("../cli/chat")`, which read the project's folder by loading the
      // hub over HTTP, asking it for the root, and calling back in through a plugin shim: three
      // hops to reach a path this process already holds. And `show --file` read the file with
      // fs.readFileSync from the CLI's cwd, which under the hub is the SystemView repo — the same
      // class of bug as probe's session. Here a path is project-relative and containment-checked.
      show: async function ({ projectCode, text, reportPath: from, clear, as } = {}) {
        if (!projectCode) return { ok: false, error: "projectCode required" };
        if (clear) {
          sendDrive.call(this, { cmd: "show", args: { clear: true }, label: "cleared the TV" }, { projectCode, as });
          return { ok: true, label: "cleared the TV" };
        }
        let content = text || "";
        if (from) {
          const res = await readFile(projectCode, { path: from });
          if (!res || res.ok === false)
            return { ok: false, error: `could not read ${from} in ${projectCode} — ${(res && res.error) || "no such file"}` };
          content = res.content || "";
        }
        if (!content.trim()) return { ok: false, error: "show: give text or a readable .md path" };
        const label = Reports.labelFor(content, from);
        // A POINTER, AND ONLY A POINTER (RFC-040). If the document cannot be filed the show does not
        // go up — a report that exists in a chat record and nowhere on disk is the drifting copy we
        // deleted the transition path to avoid.
        let path;
        try {
          path = await Reports.write(projectCode, label, content);
        } catch (e) {
          return { ok: false, error: `could not file the report — ${e.message}. A report is a document; there is nowhere else to put it.` };
        }
        sendDrive.call(this, { cmd: "show", args: { report: label, path }, label }, { projectCode, as });
        return { ok: true, label, path };
      },
      tv: async ({ projectCode, show } = {}) => {
        if (!projectCode) return { error: "projectCode required" };
        let state = chatGetTv(projectCode, { show });
        // RFC-040 — the record NAMES a document; read that, because his answers are written into the
        // file, not into the record.
        if (state && !state.text && state.args && state.args.report) {
          const doc = await Reports.read(projectCode, state.args.path || state.args.report);
          if (doc.error)
            return { error: `the show points at "${state.args.report}" and the document could not be read — ${doc.error}` };
          state = { ...state, text: doc.text, report: state.args.report, path: doc.path };
        }
        if (!state || !state.text)
          return { error: `nothing on ${projectCode}'s TV — put one up with show`, reports: await Reports.list(projectCode) };
        return state;
      },
      reply: async function ({ projectCode, report, threadId, text, as } = {}) {
        if (!projectCode || !report || !threadId || !text)
          return { ok: false, error: "reply needs projectCode, report, threadId and text", reports: projectCode ? await Reports.list(projectCode) : [] };
        const doc = await Reports.read(projectCode, report);
        if (doc.error) return { ok: false, ...doc };
        // WHO SIGNS IT. A message gets identity enforced by the room; a reply is written straight
        // into the document, so nothing in the path can refuse it — an unsigned reply silently
        // becomes the room's own agent. Say which it was instead of letting it pass.
        const author = as || projectCode;
        const r = Reports.replyInto(doc.text, threadId, text, author);
        if (r.error) return { ok: false, error: `${r.error} — ${doc.path}`, ...(r.threads ? { threads: r.threads } : {}) };
        const w = await writeFile(projectCode, { path: doc.path, content: r.content });
        if (!w || w.ok === false) return { ok: false, error: (w && w.error) || "could not write the reply" };
        // If a show in the room points at this document, keep its fallback copy in step — otherwise
        // the TV and the file show two versions of one report.
        try {
          const state = chatGetTv(projectCode, { show: doc.name });
          if (state && state.args && state.args.report === doc.name)
            chatSetTv.call(this, projectCode, { state: { id: state.id, label: state.label, text: r.content } });
        } catch {}
        return { ok: true, path: doc.path, threadId, signedAs: author, unsigned: !as };
      },
      // HIS BOARD and HIS CODE COMMENTS (api/board.js, api/comments.js). Both were terminal
      // programs that loaded the hub over HTTP, asked it for the project's root, and then handed
      // themselves a shim forwarding straight back to readFile/writeFile. Inside the hub that shim
      // is the hub. Both keep the rule that mattered: a note or a reply is SIGNED by whoever wrote
      // it, never defaulted — defaulting to the board's owner once stamped a visitor's answer as his.
      board: async ({ projectCode, name, add, replyText, at, as } = {}) =>
        Board({ projectCode, name, add, reply: replyText, at, as: as || null }),
      comments: async ({ projectCode, path, replyText, at, as } = {}) =>
        CodeComments({ projectCode, path, reply: replyText, at, as: as || null }),
      // DRIVING THE WINDOW — FOUR METHODS (api/drive.js), not one door with a verb string.
      // `svDrive` took `verb: "nav" | "refresh" | "act" | "highlight"` and switched on it, so four
      // MCP tools funnelled into one method to fan back out. That is a command line's shape, and it
      // was here because the implementation was `cli/chat.js` — which reached the hub over HTTP to
      // read a registry the hub holds in memory. The validation is the capability; it lives in
      // api/drive.js, pure, and the emit happens here where the chat state is.
      nav: function (arg = {}) {
        return sendDrive.call(this, Drive.nav(arg, ConnectedServices.getAllConnections() || []), arg);
      },
      refresh: function (arg = {}) {
        return sendDrive.call(this, Drive.refresh(arg), arg);
      },
      act: function (arg = {}) {
        return sendDrive.call(this, Drive.act(arg), arg);
      },
      highlight: function (arg = {}) {
        return sendDrive.call(this, Drive.highlight(arg, ConnectedServices.getAllConnections() || []), arg);
      },

      connect: async ({ url } = {}) => {
        // agent-side connect (his t4 call): a URL in, the project's services registered
        const list = await getServices(url);
        const arr = Array.isArray(list) ? list : [];
        return { connected: arr.map((s) => ({ projectCode: s.projectCode, serviceId: s.serviceId })) };
      },
      disconnect: async ({ projectCode, serviceId } = {}) => {
        if (!projectCode) return { ok: false, error: "projectCode required" };
        // never report a disconnect that removed nothing (caught by RFC-056's own verification)
        const svcs = ConnectedServices.findProject(projectCode) || [];
        if (!svcs.length) return { ok: false, error: `no connected project "${projectCode}"` };
        if (serviceId) {
          if (!svcs.some((s) => s.serviceId === serviceId)) return { ok: false, error: `no service "${serviceId}" in ${projectCode}` };
          await deleteService(projectCode, serviceId);
        } else {
          for (const s of svcs) await deleteService(projectCode, s.serviceId);
        }
        return { ok: true };
      },
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
