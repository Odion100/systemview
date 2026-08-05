const { createClient, App } = require("systemlynx");
const { createCookieHttpClient } = require("../cli/cookieClient");
const { headersFor } = require("../cli/manifestHeaders");
const ConnectedServices = require("./Connections")();
const CLIHistory = require("./CLIHistory")();
const Settings = require("./Settings")();
const Stage = require("./Stage")();
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

function connect({ system, projectCode, serviceId, specList, credentials, dynamic }) {
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
    ConnectedServices.save(service, index);
  } else
    ConnectedServices.save({
      system,
      projectCode,
      serviceId,
      specList,
      credentials: !!credentials,
      dynamic: !!dynamic,
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
  connections.forEach(({ projectCode, serviceId, system, specList, credentials, dynamic }) => {
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
    });
  });
  return projects;
}

function deleteService(projectCode, serviceId) {
  ConnectedServices.deleteService(projectCode, serviceId);
}

function deleteProject(projectCode) {
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
  const svc = services.find((s) => s.system && s.system.connectionData);
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

const shutdown = () => process.exit(0);

module.exports = function launchSystemView(port = 3000) {
  const { server } = App;
  const buildPath = path.resolve(__dirname, "../build");
  const indexPath = path.join(buildPath, "index.html");

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
    })
    .module("CLI", {
      getHistory: CLIHistory.getHistory,
      saveHistory: CLIHistory.saveHistory,
      getSettings: Settings.getSettings,
      saveSettings: Settings.saveSettings,
    })
    .on("ready", () => {
      server.get("*", (req, res) => {
        res.sendFile(indexPath);
      });

      ConnectedServices.refreshConnections();
    });

  return new Promise((resolve) => App.on("ready", resolve));
};
