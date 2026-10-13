// ASK THE HUB WHERE A WRITTEN PATH LIVES. The grammar of what people and agents type is resolved in
// one place — `api/resolvePath.js` — because the hub is the only thing that holds the root map, and a
// second copy in the window would be a second answer to "where is buAPI" that drifts the first time
// a project moves. The shapes it accepts are documented there; this is only the door.
//
// WHY A CHIP NEEDS IT: a reference used to require the project to be known — the `{project=...}`
// attribute, or the document's own scope — so a link an agent wrote in its own grammar rendered
// DEAD. His ruling, 2026-10-05: *"Should I correct them? No. Or should it work? ... those links and
// files, markdown should work."*
//
// RESOLVED ON USE, NOT ON RENDER. A long bubble can carry a dozen chips and a scrollback re-renders
// them constantly; resolving at render time would be a request per chip per paint. The answer is
// only needed the moment somebody opens one, and it is MEMOISED by (path, hint) so opening the same
// reference twice costs one round trip.
const cache = new Map();
const key = (path, hint) => `${hint || ""} ${path}`;

export function cachedResolve(path, hint = "") {
  return cache.get(key(path, hint)) || null;
}

/** -> { resolved, projectCode, path, suffix, reason? } — never throws; a dead hub is a refusal. */
export async function resolveRef(path, hint = "") {
  const p = String(path || "").trim();
  if (!p) return { resolved: false, reason: "no path given" };
  const k = key(p, hint);
  if (cache.has(k)) return cache.get(k);

  let answer;
  try {
    const qs = `path=${encodeURIComponent(p)}${hint ? `&project=${encodeURIComponent(hint)}` : ""}`;
    const res = await fetch(`/sv-resolve?${qs}`);
    const body = await res.json();
    answer =
      body && body.ok
        ? {
            resolved: !!body.resolved,
            projectCode: body.projectCode || "",
            path: body.path || p,
            suffix: body.suffix || "",
            reason: body.reason || "",
            candidates: body.candidates || [],
          }
        : { resolved: false, reason: (body && body.error) || `the hub answered ${res.status}` };
  } catch {
    // A FAILED LOOKUP IS NOT CACHED — the hub restarts (an `api/` change arms only on a restart), and
    // caching "unreachable" would keep every chip dead until the window itself reloaded.
    return { resolved: false, reason: "the hub did not answer" };
  }
  cache.set(k, answer);
  return answer;
}

export const _clearResolveCache = () => cache.clear();
