const resolveNamespace = require("./resolveNamespace");
const { nsEquals } = require("./matchNamespace");

// The one target resolver shared by `test`, `logs`, and `list`. Turns a single positional arg into
// { services, resolvedNamespace } so no command forces you to type the projectCode first:
//   - no arg                     → every connected service
//   - exact projectCode          → that project's services
//   - arg found in any Service.Module.method path (dotted OK) → ALL services + arg as a namespace
//   - otherwise                  → { services: [] }
// Matching respects the actual namespace (case-sensitive). getProjects returns
// { projectCode: [service...] }; the projectCode is the key, so we fold it back onto each entry
// (downstream code and namespace matching expect it).
module.exports = async function resolveTarget(SystemView, arg) {
  const projects = await SystemView.getProjects();
  const all = Object.entries(projects).flatMap(([projectCode, svcs]) =>
    svcs.map((s) => ({ ...s, projectCode })),
  );

  if (!arg) return { services: all };

  // `projectCode:namespace` — scope the (fuzzy) namespace resolution to ONE project. Necessary because
  // resolveNamespace matches the joined path across ALL services, so the same service connected under two
  // project codes is otherwise ambiguous. The colon pins the project; the namespace after it stays fuzzy
  // ("buAPI-prod:signIn" resolves signIn within buAPI-prod only). `projectCode:` alone → that project.
  const colon = arg.indexOf(":");
  const scope = colon > -1 ? arg.slice(0, colon) : null;
  const ns = colon > -1 ? arg.slice(colon + 1) : arg;
  const pool = scope ? all.filter((s) => nsEquals(s.projectCode, scope)) : all;

  if (scope && !ns) return { services: pool };

  // bare exact projectCode (no colon) still means "that whole project"
  if (!scope) {
    const byProject = all.filter((s) => nsEquals(s.projectCode, arg));
    if (byProject.length) return { services: byProject };
  }

  if (resolveNamespace(ns, pool).length) return { services: pool, resolvedNamespace: ns };

  return { services: [] };
};
