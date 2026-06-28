module.exports = function resolveNamespace(partial, connectedServices) {
  if (!partial || !connectedServices || !connectedServices.length) return [];
  const matches = [];
  for (const { serviceId, system } of connectedServices) {
    const modules = (system && system.connectionData && system.connectionData.modules) || [];
    for (const { name: moduleName, methods = [] } of modules) {
      for (const { fn: methodName } of methods) {
        const full = `${serviceId}.${moduleName}.${methodName}`;
        if (full.includes(partial)) {
          matches.push({ serviceId, moduleName, methodName });
        }
      }
    }
  }
  return matches;
};
