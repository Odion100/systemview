// One namespace resolver for every markdown block that names something — `:ns[…]` chips and `:::run`
// steps alike. It was two implementations, and they disagreed: the chip searched the whole project
// when a document had no service in scope, the run step didn't, so `Math.combine` linked fine on the
// project doc and then ran against an empty service (silent failure, "connection data" in console).
//
// Segment count decides how much is named; the rest comes from the document's scope:
//   1 → Module   2 → Module.method   3 → Service.Module.method   4 → project.Service.Module.method
export function parseTarget(label, scope = {}) {
  const segs = String(label || "").trim().split(".").filter(Boolean);
  if (!segs.length) return null;
  if (segs.length >= 4) return { projectCode: segs[0], serviceId: segs[1], moduleName: segs[2], methodName: segs.slice(3).join(".") };
  if (segs.length === 3) return { projectCode: scope.projectCode, serviceId: segs[0], moduleName: segs[1], methodName: segs[2] };
  if (segs.length === 2) return { projectCode: scope.projectCode, serviceId: scope.serviceId, moduleName: segs[0], methodName: segs[1] };
  return { projectCode: scope.projectCode, serviceId: scope.serviceId, moduleName: segs[0] };
}

// Resolve against the LIVE connection tree — that's what lets a stale document say so instead of
// lying. A reference with no service in scope (a project-level doc) searches every service in the
// project, so `Math.add` still resolves from the project page. Returns null when nothing answers.
export function resolveNamespace(target, services = []) {
  if (!target) return null;
  const candidates = services.filter(
    (s) =>
      (!target.projectCode || s.projectCode === target.projectCode) &&
      (!target.serviceId || s.serviceId === target.serviceId)
  );
  for (const s of candidates) {
    const modules = (s.system && s.system.connectionData && s.system.connectionData.modules) || [];
    const mod = modules.find((m) => m.name === target.moduleName);
    if (!mod) continue;
    if (!target.methodName) return { projectCode: s.projectCode, serviceId: s.serviceId, moduleName: mod.name };
    const method = (mod.methods || []).find((m) => (m.fn || m.name) === target.methodName);
    if (method)
      return {
        projectCode: s.projectCode,
        serviceId: s.serviceId,
        moduleName: mod.name,
        methodName: method.fn || method.name,
      };
  }
  return null;
}
