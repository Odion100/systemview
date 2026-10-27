// systemview-test/support/fixtures.js — A SPEC SAYS WHEN ITS FIXTURES ARE NOT RUNNING.
//
// NOT in methods/: hostProject serves every file in that folder as a module, so a helper there
// would become a callable surface. This is a sibling folder for exactly that reason.
//
// The failure this exists to kill: a spec whose fixture is down throws inside discovery, every
// field comes back `undefined`, and the report blames sixteen assertions for something that
// happened before the first one ran. Nobody reading that output can tell "the behaviour broke" from
// "nothing was listening" — and those are completely different days.
//
// His rule, and it is the right one: these are FIXTURES. A spec must never fall through to whatever
// living service happens to be registered, and it must never pass by luck of what else is up. So the
// precondition is NAMED, asserted, and the answer says what to run.
const { createClient } = require("systemlynx");

const HUB = "http://localhost:3000/systemview/api";

/**
 * Are the named projects registered right now? Answers a shape a spec can assert on, never a throw:
 *   { fixturesRunning: true }  ·  { fixturesRunning: false, missing: [...], why: "…npm run services" }
 */
async function require_(projects = [], { chatOn = [] } = {}) {
  let registry = {};
  try {
    const { SystemView } = await createClient().loadService(HUB);
    registry = (await SystemView.getProjects()) || {};
  } catch (err) {
    return {
      fixturesRunning: false,
      missing: projects,
      why: `the hub at ${HUB} did not answer (${String((err && err.message) || err).slice(0, 80)}) — start it with \`yarn start\``,
    };
  }
  const missing = projects.filter((p) => !Array.isArray(registry[p]) || !registry[p].length);
  // A project can be registered and still not carry the module a spec needs — a mixed project is
  // real (some services run an older plugin), so "present" is not the same question as "can serve
  // this", and conflating them is how `Chat.chatCursor is not a function` reached an assertion.
  const noChat = chatOn.filter(
    (p) =>
      !missing.includes(p) &&
      !(registry[p] || []).some((s) =>
        (((s.system && s.system.connectionData) || {}).modules || []).some((m) => m.name === "SystemViewChat"),
      ),
  );
  if (!missing.length && !noChat.length) return { fixturesRunning: true, missing: [], why: "" };
  const parts = [];
  if (missing.length) parts.push(`not registered: ${missing.join(", ")}`);
  if (noChat.length) parts.push(`registered but serving no SystemViewChat: ${noChat.join(", ")}`);
  return {
    fixturesRunning: false,
    missing: [...missing, ...noChat],
    // THE ANSWER CARRIES THE REMEDY. A precondition that only says "false" makes the next person
    // re-derive what this already knows.
    why: `${parts.join(" · ")} — start the fixtures with \`npm run services\` in the systemview repo`,
  };
}

/** The serving service for a project's chat, or null — chosen by who ANSWERS, not by metadata. */
async function chatService(projectCode) {
  const { SystemView } = await createClient().loadService(HUB);
  const projects = (await SystemView.getProjects()) || {};
  const candidates = (projects[projectCode] || []).filter((s) =>
    (((s.system && s.system.connectionData) || {}).modules || []).some((m) => m.name === "SystemViewChat"),
  );
  // REGISTRATION METADATA IS A SNAPSHOT of what a service HAD when it registered; whether it answers
  // now is a different question, and only the second one matters for a call. Taking the first match
  // on metadata is what made a dead fixture abort the whole method.
  for (const s of candidates) {
    try {
      const client = await createClient().loadService(s.system.connectionData.serviceUrl);
      if (client && client.SystemViewChat) return { serviceId: s.serviceId, client, Chat: client.SystemViewChat };
    } catch {
      /* this one is registered and gone — try the next rather than dying on it */
    }
  }
  return null;
}

module.exports = { required: require_, chatService };
