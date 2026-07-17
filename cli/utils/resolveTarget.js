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

  const byProject = all.filter((s) => nsEquals(s.projectCode, arg));
  if (byProject.length) return { services: byProject };

  if (resolveNamespace(arg, all).length) return { services: all, resolvedNamespace: arg };

  return { services: [] };
};
