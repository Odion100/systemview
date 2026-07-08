const { HttpClient, createClient } = require("systemlynx");
const { createCookieHttpClient } = require("./cookieClient");
const cookieHttpClient = createCookieHttpClient();
const Client = createClient(cookieHttpClient);
const log = require("./logger");
const manifestCommands = require("./manifest");

async function getUiSvc(uiUrl) {
  try {
    const { SystemView } = await Client.loadService(`${uiUrl}/systemview/api`);
    return SystemView;
  } catch {
    return null;
  }
}

async function notifyUi(uiSvc, project) {
  if (!uiSvc) return;
  try {
    await uiSvc.connect(project);
  } catch {}
}

function serviceIdFromRoute(route) {
  const segments = (route || "").split("/").filter(Boolean);
  return [...segments].reverse().find((s) => s.toLowerCase() !== "api") || "Service";
}

function printSummary(entries) {
  console.log("");
  entries.forEach(({ projectCode, serviceId, url }) => {
    log.plain(`  ${projectCode} › ${serviceId}${url ? "  " + url : ""}`);
  });
  console.log("");
}

module.exports = async function connectService(target, { useManifest, save, force, connectedUrls, uiUrl } = {}) {
  const uiSvc = await getUiSvc(uiUrl);

  // connect (no args) — connect to every service stored in UI
  if (!target) {
    if (!uiSvc) {
      log.warn("SystemView UI not running. Start it first or provide a URL.");
      return;
    }
    const projects = await uiSvc.getProjects();
    const all = Object.entries(projects).flatMap(([pc, svcs]) =>
      svcs.map((s) => ({ projectCode: pc, ...s }))
    );
    if (!all.length) {
      log.warn("No services in UI store. Use: systemview connect <url>");
      return;
    }
    log.info(`Connecting to ${all.length} stored service(s)...`);
    const summary = [];
    for (const { projectCode, serviceId, connectionData, serviceUrl } of all) {
      const url = serviceUrl || (connectionData && connectionData.serviceUrl);
      if (!url) continue;
      try {
        if (force) {
          await Client.loadService(url);
        } else {
          Client.createService(connectionData);
        }
        connectedUrls.add(url);
        log.success(`${projectCode} › ${serviceId}`);
        summary.push({ projectCode, serviceId, url });
      } catch (err) {
        log.error(`${serviceId} failed: ${err.message}`);
      }
    }
    printSummary(summary);
    return;
  }

  const isUrl = /^https?:\/\//i.test(target);

  // connect <projectCode> — look up from UI store
  if (!isUrl) {
    if (!uiSvc) {
      log.warn("SystemView UI not running. Cannot look up project by code.");
      return;
    }
    const services = await uiSvc.getServices(target);
    if (!services || !services.length) {
      log.warn(`No services found for project: ${target}`);
      return;
    }
    log.info(`Connecting to ${services.length} service(s) for ${target}...`);
    const summary = [];
    for (const { serviceId, system } of services) {
      const { serviceUrl } = system.connectionData;
      try {
        if (force) {
          await Client.loadService(serviceUrl);
        } else {
          Client.createService(system.connectionData);
        }
        connectedUrls.add(serviceUrl);
        log.success(`${target} › ${serviceId}`);
        summary.push({ projectCode: target, serviceId, url: serviceUrl });
      } catch (err) {
        log.error(`${serviceId} failed: ${err.message}`);
      }
    }
    printSummary(summary);
    return;
  }

  // connect <url> [--manifest]
  log.info(`Connecting to ${target}...`);
  try {
    if (useManifest) {
      const svc = await Client.loadService(target);
      let manifest = null;
      try { manifest = await svc.Plugin.getManifest(); } catch {}
      if (manifest && manifest.services && manifest.services.length) {
        log.info(`Plugin manifest found: ${manifest.projectCode} (${manifest.services.length} service(s))`);
        const summary = [];
        for (const service of manifest.services) {
          try {
            Client.createService(service.system.connectionData);
            connectedUrls.add(service.system.connectionData.serviceUrl);
            await notifyUi(uiSvc, {
              system: service.system,
              projectCode: manifest.projectCode,
              serviceId: service.serviceId,
              specList: service.specList || { tests: [], docs: [] },
            });
            log.success(`${manifest.projectCode} › ${service.serviceId}`);
            summary.push({ projectCode: manifest.projectCode, serviceId: service.serviceId, url: service.system.connectionData.serviceUrl });
          } catch (err) {
            log.error(`${service.serviceId} failed: ${err.message}`);
          }
        }
        printSummary(summary);
        if (save) {
          // --save persists THIS connection to the local manifest. The subject is the connection
          // (the services); the applied headers + captured session cookie tag along via save().
          const services = manifest.services.map((s) => ({
            projectCode: manifest.projectCode,
            serviceId: s.serviceId,
            system: s.system,
            specList: s.specList || { tests: [], docs: [] },
          }));
          manifestCommands.save(services);
        }
      } else {
        log.warn("No plugin manifest found. Storing as connected-services.");
        const connectionData = await HttpClient.request({ url: target });
        const serviceId = serviceIdFromRoute(connectionData.route);
        const project = {
          system: { connectionData },
          projectCode: "connected-services",
          serviceId,
          specList: { tests: [], docs: [] },
        };
        Client.createService(connectionData);
        connectedUrls.add(target);
        await notifyUi(uiSvc, project);
        printSummary([{ projectCode: "connected-services", serviceId, url: target }]);
      }
    } else {
      const connectionData = await HttpClient.request({ url: target });
      if (!connectionData || !connectionData.SystemLynxService) {
        throw new Error("No SystemLynx service found at " + target);
      }
      const serviceId = serviceIdFromRoute(connectionData.route);
      const project = {
        system: { connectionData },
        projectCode: "connected-services",
        serviceId,
        specList: { tests: [], docs: [] },
      };
      Client.createService(connectionData);
      connectedUrls.add(target);
      await notifyUi(uiSvc, project);
      log.success(`connected-services › ${serviceId}`);
      printSummary([{ projectCode: "connected-services", serviceId, url: target }]);
      if (save) {
        manifestCommands.save([
          { projectCode: "connected-services", serviceId, system: { connectionData }, specList: { tests: [], docs: [] } },
        ]);
      }
    }
  } catch (err) {
    log.error(`Connection failed: ${err.message}`);
  }
};
