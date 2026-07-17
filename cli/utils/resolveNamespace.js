const { matchNamespace } = require("./matchNamespace");

// Matches `partial` against each full `serviceId.moduleName.methodName` path (substring, honoring the
// case-sensitivity mode — see matchNamespace). Because it matches the JOINED path, dotted partials
// that span segments work ("Posts.add", "Profiles.Posts") and so do bare service / module / method
// names ("Profiles", "signUp"). The one resolver behind test/logs/list/open — see resolveTarget.js.
module.exports = function resolveNamespace(partial, connectedServices) {
  if (!partial || !connectedServices || !connectedServices.length) return [];
  const matches = [];
  for (const { serviceId, system } of connectedServices) {
    const modules = (system && system.connectionData && system.connectionData.modules) || [];
    for (const { name: moduleName, methods = [] } of modules) {
      for (const { fn: methodName } of methods) {
        const full = `${serviceId}.${moduleName}.${methodName}`;
        if (matchNamespace(full, partial)) {
          matches.push({ serviceId, moduleName, methodName });
        }
      }
    }
  }
  return matches;
};
