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
};
