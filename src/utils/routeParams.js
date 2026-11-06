import { matchPath } from "react-router-dom";

// THE ROUTE'S PARAMS, READ FROM THE PATH RATHER THAN FROM A MATCH YOU ARE INSIDE.
//
// `useParams()` only answers inside the `<Route>` that matched, which is exactly what the left
// wall cannot be: it lives above the `<Switch>` so that switching between Code and Agents stops
// unmounting it. A panel rendered there is in the Router but in no Route, so `useParams()` hands
// it `{}` — the wall would survive the switch and come back attached to no project, which is a
// worse failure than the remount because it looks like it worked.
//
// So the patterns live here, once, and the answer is derived from the pathname. The SAME strings
// App.js routes on — a second list that drifts would scope the wall to the wrong project silently,
// so `ROUTE_PATTERNS` is exported and App.js's routes are pinned to it by test.
export const ROUTE_PATTERNS = [
  "/specs/:projectCode?/:serviceId?/:moduleName?/:methodName?",
  "/reports/:projectCode?",
  "/context/:projectCode?",
  "/agents/:projectCode?",
];

const EMPTY = { projectCode: undefined, serviceId: undefined, moduleName: undefined, methodName: undefined };

// ORDER MATTERS AND IS NOT ALPHABETICAL. `/specs` carries four segments and the rest carry one, so
// the longest pattern is tried first; `exact` is off for `/specs` in App.js and on for the others,
// and matching here mirrors that rather than guessing.
export function paramsOf(pathname) {
  for (const path of ROUTE_PATTERNS) {
    const m = matchPath(pathname || "", { path, exact: path.startsWith("/specs") ? false : true });
    if (m) return { ...EMPTY, ...m.params };
  }
  return { ...EMPTY };
}
