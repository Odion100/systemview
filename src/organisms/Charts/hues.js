// Deterministic module → colour, shared by the Stats page's load columns and the topology graph —
// and now by their `::load` / `::topology` embeds (RFC-025 §4.3). Extracted from
// pages/Reports/Reports.js so the same colours hold wherever either is drawn.
const MAP_HUES = ["#6886ba", "#8e5aa8", "#2e8b74", "#b98a1c", "#c25b78", "#4a7fb5", "#7a9b3e", "#5d6c8a"];
// Deterministic module → hue: alphabetical position over the project's module list, so (a) a module
// keeps its color across views and refreshes, and (b) neighbors get DIFFERENT hues.
const buildHueMap = (methods) => {
  const keys = [...new Set(methods.map((m) => `${m.serviceId}.${m.moduleMethod.split(".")[0]}`))].sort();
  const map = {};
  keys.forEach((k, i) => {
    map[k] = MAP_HUES[i % MAP_HUES.length];
  });
  return map;
};

export { MAP_HUES, buildHueMap };
