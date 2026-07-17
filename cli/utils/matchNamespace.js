// Central namespace matcher for the CLI. Every resolver/filter (resolveNamespace, resolveTarget, and
// the test/logs/list filters) matches through here so the case-sensitivity mode lives in ONE place.
//
// The mode is a sticky, UI-persisted setting (api/Settings.js). cli/index.js loads it once at command
// start via setCaseSensitive(); the process is short-lived and single-command, so module state is fine.
// Default is case-INSENSITIVE — you opt INTO case sensitivity with --case-sensitive / -cs / --cs.

let caseSensitive = false;

function setCaseSensitive(on) {
  caseSensitive = !!on;
}

function isCaseSensitive() {
  return caseSensitive;
}

// Substring match honoring the current mode.
function matchNamespace(haystack, needle) {
  if (!needle) return true;
  const h = String(haystack);
  const n = String(needle);
  return caseSensitive ? h.includes(n) : h.toLowerCase().includes(n.toLowerCase());
}

// Equality honoring the current mode (for exact projectCode matches).
function nsEquals(a, b) {
  const x = String(a);
  const y = String(b);
  return caseSensitive ? x === y : x.toLowerCase() === y.toLowerCase();
}

module.exports = { matchNamespace, nsEquals, setCaseSensitive, isCaseSensitive };
