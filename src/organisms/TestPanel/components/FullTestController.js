import Test from "./Test.class";
import loadServiceWithHeaders from "../../../utils/loadService";

const LABEL = { before: "Before", main: "Main", events: "Events", after: "After" };

export default function FullTestController({ FullTest, connectedServices } = {}) {
  // RFC-020 — FullTest is `{ sections, order }`. Loop the run-order (a list of section names) and run each
  // section's steps in sequence. No hardcoded `[...Before,...Events,...Main,...After]`. `onStep` (optional)
  // re-renders between steps so the scratchpad shows each step go live.
  this.runFullTest = async (onStep) => {
    const { sections = {}, order = [] } = FullTest || {};
    const flat = order.reduce((all, name) => all.concat(sections[name] || []), []);
    for (let i = 0; i < flat.length; i++) {
      flat[i].running = true;
      if (onStep) onStep();
      await flat[i].runTest();
      flat[i].running = false;
      if (onStep) onStep();
    }
    return FullTest;
  };

  function validateTest({ title, evaluations, shouldValidate }, label, index) {
    if (!title) return { message: `${label}: Action ${index + 1} description is required`, error: true };
    if (shouldValidate && !evaluations.filter((e) => e.save).length)
      return { message: `${label}: Action ${index + 1} validations required`, error: true };
    return { error: false };
  }

  this.saveTests = async (test = FullTest) => {
    const {
      sections = {},
      order = [],
      namedRefs = {},
      title: testTitle,
      namespace: targetNs,
    } = test || {};
    const anchor = (sections.main || [])[0] || Object.values(sections).reduce((a, s) => a.concat(s), [])[0];
    if (!anchor) return { message: "Nothing to save.", error: true };
    // The anchor (Main[0]) still carries the title fallback + the saved slot being edited. The SAVE
    // NAMESPACE is the test's OWN field now (the scratchpad chip) — Main steps are free to point at
    // other methods, as long as one of them matches it (checked below).
    const { title: anchorTitle, index, savedNamespace } = anchor;
    const title = (testTitle && testTitle.trim()) || anchorTitle;
    const namespace = targetNs || anchor.namespace;

    // A test SAVES UNDER a method — its file is `<module>.<method>.json` on the namespace's service.
    // Refuse anything that doesn't point at a real connected method, with a visible reason.
    const { serviceId, moduleName, methodName } = namespace || {};
    if (!serviceId || !moduleName || !methodName)
      return {
        message: "The test's namespace is incomplete — click the namespace chip and pick the service.module.method to save under.",
        error: true,
      };
    const svc = connectedServices.find((s) => s.serviceId === serviceId);
    if (!svc) return { message: `"${serviceId}" is not a connected service.`, error: true };
    const mod = (((svc.system || {}).connectionData || {}).modules || []).find(
      (m) => m.name === moduleName
    );
    if (!mod)
      return { message: `"${moduleName}" is not a module on ${serviceId}.`, error: true };
    if (methodName !== "on" && !(mod.methods || []).some((m) => m.fn === methodName))
      return {
        message: `"${methodName}" is not a method on ${serviceId}.${moduleName} — can't save a test there.`,
        error: true,
      };

    // THE RULE: Main may hold steps on any namespace, but at least ONE must point at the test's overall
    // namespace — otherwise this isn't a test OF that method and it doesn't save.
    const sameNs = (ns) =>
      ns &&
      ns.serviceId === serviceId &&
      ns.moduleName === moduleName &&
      ns.methodName === methodName;
    if (!(sections.main || []).some((t) => sameNs(t.namespace)))
      return {
        message: `Main needs at least one step on ${serviceId}.${moduleName}.${methodName} — the namespace this test saves under.`,
        error: true,
      };

    for (const name of order) {
      const steps = sections[name] || [];
      for (let x = 0; x < steps.length; x++) {
        const res = steps[x] ? validateTest(steps[x], LABEL[name] || name, x) : {};
        if (res.error) return res;
      }
    }

    // Plugin comes from the SAVE-TARGET service directly — not from Main[0]'s connection, which may
    // point at a different service now that Main steps are free-namespace.
    const service = loadServiceWithHeaders(
      svc.system.connectionData,
      svc.headers,
      svc.credentials
    );
    if (!service || !service.Plugin)
      return { message: `Not connected to ${serviceId} — can't save.`, error: true };
    const { Plugin } = service;

    // The saved slot (index) belongs to the FILE the test was loaded from (`module.method`). If Main was
    // retargeted to a different method since edit-load, that index would land in the WRONG file — punching
    // a hole (nulls) if it's shorter. Retargeted ⇒ save as a NEW test under the new namespace.
    const sameFile =
      savedNamespace &&
      savedNamespace.moduleName === moduleName &&
      savedNamespace.methodName === methodName;
    const saveIndex =
      typeof index === "number" && (!savedNamespace || sameFile) ? index : undefined;

    const serializeSection = (steps) =>
      (steps || []).map((t) => {
        const { args, evaluations, namespace, title } = t;
        Object.assign(t, new Test(t)); // reset scope
        return {
          args,
          namespace,
          title,
          savedEvaluations: (evaluations || [])
            .filter((e) => e.save)
            .map(({ namespace, expected_type, validations, save, indexed }) => ({
              namespace,
              expected_type,
              validations,
              save,
              indexed,
            })),
        };
      });

    const payload = {
      title,
      namespace,
      Before: serializeSection(sections.before),
      Main: serializeSection(sections.main),
      Events: serializeSection(sections.events),
      After: serializeSection(sections.after),
    };
    // RFC-020 — named-action sections persist as REFERENCES (`{ use }` — one stored definition, many
    // tests), plus the run-order that places them. Tests with no named sections keep the old shape.
    const namedNames = order.filter((n) => !LABEL[n]);
    if (namedNames.length) {
      payload.sections = {};
      // The section KEY is the instance (seedSum_2); the reference points at the underlying action.
      namedNames.forEach((n) => (payload.sections[n] = { use: namedRefs[n] || n }));
      payload.run = order;
    }
    const testIndex = await Plugin.saveTest(payload, saveIndex);
    return { message: "Test Saved!", error: false, testIndex };
  };
}
