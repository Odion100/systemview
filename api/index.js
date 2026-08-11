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
function chatServiceFor(projectCode) {
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
  if (!candidates.length) return null;
  const root = projectRoot(projectCode);
  const byId = (a, b) => String(a.serviceId || "").localeCompare(String(b.serviceId || ""));
  const atRoot = candidates.filter((c) => c.root && root && c.root === root).sort(byId);
  return (atRoot.length ? atRoot : candidates.slice().sort(byId))[0];
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
  const service = chatServiceFor(projectCode);
  if (!service) return; // this project's plugin predates the module — the hub keeps its room
  const url = service.system.connectionData.serviceUrl;
  const current = chatClients.get(projectCode);
  if (current && current.url === url) return;
  chatWarming.add(projectCode);
  try {
    const client = await createClient(httpClient).loadService(url);
    const Chat = client.SystemViewChat;
    if (!Chat) return;
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
  } catch {
    /* unreachable right now — the hub keeps holding the room and we try again next tick */
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

// The UI's connect-by-URL. Always treats the input as a URL — no isUrl heuristic — so remote hosts
// and long TLDs (.global, .systems, …) that the heuristic mis-rejects still connect. Mirrors the
// CLI's `connect <url>`: probe → pull the whole project manifest.
function connectUrl(url) {
  return getConnectionData(url);
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
async function refreshConnection(searchText) {
  await ConnectedServices.refreshConnections();
  return getServices(searchText);
}

function getProjects() {
  const connections = ConnectedServices.getAllConnections();
  const projects = {};
  connections.forEach(({ projectCode, serviceId, system, specList, credentials, dynamic, hosted }) => {
    if (!projects[projectCode]) projects[projectCode] = [];
    projects[projectCode].push({
      serviceId,
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

// RFC-018 — STORIES. A project has MANY stories (not one live stage), each filed on a namespace with a
// free name — like a method has many tests. Disk (the project plugin) is the source of truth; the API
// read-modify-writes a story and broadcasts `stories-updated:<projectCode>` so every open UI (the tab
// AND the /stories page) refreshes. A pane still carries only a locator — the UI fetches real bytes.
let storySeq = 0;
function genId(prefix) {
  storySeq += 1;
  return `${prefix}_${Date.now().toString(36)}_${storySeq.toString(36)}`;
}
// A story's id (and thus its on-disk filename) is just its NAME, slugified — `RFC-018-work.json`. The
// namespace lives INSIDE the file (a field), not in the filename. Re-saving the same name upserts it.
const slugify = (s) =>
  String(s || "").trim().replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 90) || "untitled";
function storyId(namespace, name) {
  return slugify(name);
}
async function listStories(projectCode) {
  const Plugin = projectPlugin(projectCode);
  return Plugin ? (await Plugin.listStories()) || [] : [];
}
async function emitStories(ctx, projectCode) {
  const list = await listStories(projectCode);
  ctx.emit(`stories-updated:${projectCode}`, list);
  return list;
}
async function getStory(projectCode, id) {
  const Plugin = projectPlugin(projectCode);
  return Plugin ? await Plugin.getStory({ id }) : null;
}
async function createStory(projectCode, meta = {}) {
  const Plugin = projectPlugin(projectCode);
  if (!Plugin) throw new Error(`no connected service for project "${projectCode}"`);
  const namespace = meta.namespace || projectCode;
  const name = meta.name || "Untitled story";
  const story = {
    id: storyId(namespace, name),
    projectCode,
    namespace,
    name,
    layout: meta.layout || "grid",
    panes: [],
  };
  await Plugin.saveStory({ story });
  await emitStories(this, projectCode);
  return story;
}
// Full write (rename / relayout / bulk panes) — the story object round-trips through the client.
async function saveStory(projectCode, story) {
  const Plugin = projectPlugin(projectCode);
  if (!Plugin) throw new Error(`no connected service for project "${projectCode}"`);
  if (!story || !story.id) throw new Error("saveStory: a story with an id is required");
  await Plugin.saveStory({ story });
  await emitStories(this, projectCode);
  return story;
}
async function deleteStory(projectCode, id) {
  const Plugin = projectPlugin(projectCode);
  if (!Plugin) throw new Error(`no connected service for project "${projectCode}"`);
  await Plugin.deleteStory({ id });
  await emitStories(this, projectCode);
  return { id };
}
// Pane ops read the current story, mutate, persist, broadcast. New panes land at the TOP.
async function addStoryPane(projectCode, id, pane) {
  const story = await getStory(projectCode, id);
  if (!story) throw new Error(`no story "${id}" in "${projectCode}"`);
  story.panes = story.panes || [];
  story.panes.unshift({ id: genId("pane"), ...pane });
  return saveStory.call(this, projectCode, story);
}
async function removeStoryPane(projectCode, id, paneId) {
  const story = await getStory(projectCode, id);
  if (!story) return null;
  story.panes = (story.panes || []).filter((p) => p.id !== paneId);
  return saveStory.call(this, projectCode, story);
}
async function setStoryLayout(projectCode, id, layout) {
  const story = await getStory(projectCode, id);
  if (!story) return null;
  story.layout = layout;
  return saveStory.call(this, projectCode, story);
}
async function renameStory(projectCode, id, name) {
  const story = await getStory(projectCode, id);
  if (!story) return null;
  story.name = name;
  return saveStory.call(this, projectCode, story);
}
async function reorderStoryPanes(projectCode, id, ids) {
  const story = await getStory(projectCode, id);
  if (!story) return null;
  const byId = new Map((story.panes || []).map((p) => [p.id, p]));
  const next = (ids || []).map((pid) => byId.get(pid)).filter(Boolean);
  (story.panes || []).forEach((p) => { if (!next.includes(p)) next.push(p); });
  story.panes = next;
  return saveStory.call(this, projectCode, story);
}
async function setStoryPaneSpan(projectCode, id, paneId, span) {
  const story = await getStory(projectCode, id);
  if (!story) return null;
  const pane = (story.panes || []).find((p) => p.id === paneId);
  if (pane) pane.span = span;
  return saveStory.call(this, projectCode, story);
}

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
  if (!Chats.hasEntered(projectCode, chat || Chats.DEFAULT_CHAT, as))
    throw new Error(
      `${as} is not in ${projectCode}'s room — enter before you speak: systemview join ${projectCode} --once --as ${as}`,
    );
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
function chatSend(projectCode, { chat, from = "you", text, view, as } = {}) {
  armChatSweep(this);
  const identity = from === "agent" ? resolveSpeaker(projectCode, chat, as) : undefined;
  const { record, delivered } = Chats.send(projectCode, chat || Chats.DEFAULT_CHAT, { from, text, view, as: identity });
  this.emit(`chat-updated:${projectCode}`, { chat: chat || Chats.DEFAULT_CHAT, record });
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
function chatCommand(projectCode, { chat, from, cmd, args, label } = {}) {
  const record = Chats.command(projectCode, chat || Chats.DEFAULT_CHAT, { from, cmd, args, label });
  this.emit(`chat-updated:${projectCode}`, { chat: chat || Chats.DEFAULT_CHAT, record });
  return record;
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
function chatDrain(projectCode, { chat, listener, as } = {}) {
  const identity = canonIdentity(projectCode, as);
  const res = Chats.drain(projectCode, chat || Chats.DEFAULT_CHAT, { listener, identity });
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
function chatSetTv(projectCode, { chat, state } = {}) {
  const fs = require("fs");
  fs.mkdirSync(path.dirname(tvStateFile(projectCode, chat)), { recursive: true });
  fs.writeFileSync(tvStateFile(projectCode, chat), JSON.stringify({ ...state, ts: Date.now() }, null, 2));
  return { ok: true };
}
function chatGetTv(projectCode, { chat } = {}) {
  try {
    return JSON.parse(require("fs").readFileSync(tvStateFile(projectCode, chat), "utf8"));
  } catch {
    return null;
  }
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

  server.use(express.static(buildPath));

  App.startService({
    route,
    port,
    host,
    staticRouting: true,
  })
    .module("SystemView", {
      connect,
      connectUrl,
      hostProject,
      hostedOp,
      getServices,
      getProjects,
      updateSpecList,
      shutdown,
      refreshConnection,
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
      listStories,
      getStory,
      createStory,
      saveStory,
      deleteStory,
      addStoryPane,
      removeStoryPane,
      setStoryLayout,
      renameStory,
      reorderStoryPanes,
      setStoryPaneSpan,
      chatSend,
      chatCommand,
      chatHistory,
      chatList,
      chatFlush,
      chatJoin,
      chatStatus,
      chatDrain,
      chatLeave,
      chatKick,
      chatSetTv,
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
