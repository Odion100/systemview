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
  // RFC-031 delivery rules, proven through the hub's real chat door. Uses a scratch chat
  // ("self-test") so the main room stays clean; texts and drain listeners are run-stamped so
  // every run asserts on its own messages only.
  async chatDeliveryRules() {
    const SystemView = await hub();
    const pc = "systemview-test";
    const chat = "self-test";
    const stamp = Date.now();
    await SystemView.chatSend(pc, { chat, from: "you", text: `human ${stamp}` });
    await SystemView.chatSend(pc, { chat, from: "agent", as: pc, text: `home ${stamp}` });
    await SystemView.chatSend(pc, { chat, from: "agent", as: "systemview-logtest", text: `visitor ${stamp}` });
    await SystemView.chatCommand(pc, { chat, cmd: "nav", args: {}, label: "delivery check" });
    const home = await SystemView.chatDrain(pc, { chat, listener: `home:${stamp}`, as: pc });
    const visitor = await SystemView.chatDrain(pc, { chat, listener: `visitor:${stamp}`, as: "systemview-logtest" });
    const homeTexts = (home.messages || []).map((m) => m.text);
    const visitorTexts = (visitor.messages || []).map((m) => m.text);
    return {
      homeHearsHuman: homeTexts.includes(`human ${stamp}`),
      homeNeverHearsItself: !homeTexts.includes(`home ${stamp}`),
      homeHearsVisitor: homeTexts.includes(`visitor ${stamp}`),
      visitorHearsHuman: visitorTexts.includes(`human ${stamp}`),
      visitorHearsHome: visitorTexts.includes(`home ${stamp}`),
      visitorNeverHearsItself: !visitorTexts.includes(`visitor ${stamp}`),
      nobodyHearsCommands: ![...(home.messages || []), ...(visitor.messages || [])].some(
        (m) => m.kind === "command",
      ),
    };
  },
};
