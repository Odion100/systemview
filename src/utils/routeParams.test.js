import fs from "fs";
import path from "path";
import { paramsOf, ROUTE_PATTERNS } from "./routeParams";

// THE LEFT WALL MOVED ABOVE THE <Switch> so that switching between Code and Agents stops
// unmounting it — nine thousand lines of codebase card, conversation and git panel that used to be
// torn down and rebuilt on every switch, taking whatever was half-typed with it.
//
// The cost of that move is that `useParams()` stops answering: a component above the Switch is in
// the Router and in no Route. These claims are the replacement, and they matter more than they
// look — a wall that survives the switch and comes back scoped to NOTHING is worse than the
// remount, because it looks like it worked.

test("reads all four params off a full /specs path", () => {
  expect(paramsOf("/specs/systemview-test/TestService/Math/add")).toEqual({
    projectCode: "systemview-test",
    serviceId: "TestService",
    moduleName: "Math",
    methodName: "add",
  });
});

test("a bare project is the common case and answers with the rest undefined", () => {
  expect(paramsOf("/specs/systemview-test")).toEqual({
    projectCode: "systemview-test",
    serviceId: undefined,
    moduleName: undefined,
    methodName: undefined,
  });
});

// The Agents page is the other half of the switch this whole change exists for.
test("the agents and context routes carry the project too", () => {
  expect(paramsOf("/context/systemview-test").projectCode).toBe("systemview-test");
  expect(paramsOf("/agents/buAPI").projectCode).toBe("buAPI");
  expect(paramsOf("/reports/autobot").projectCode).toBe("autobot");
});

// A QUERY STRING IS NOT PART OF THE PATHNAME, but `?tab=dash` is on screen constantly and a helper
// that choked on it would scope the wall to nothing exactly when he is using tabs.
test("a trailing segment-less path and the bare routes do not invent a project", () => {
  expect(paramsOf("/specs").projectCode).toBeUndefined();
  expect(paramsOf("/context").projectCode).toBeUndefined();
  expect(paramsOf("/")).toEqual({
    projectCode: undefined, serviceId: undefined, moduleName: undefined, methodName: undefined,
  });
  expect(paramsOf("")).toEqual({
    projectCode: undefined, serviceId: undefined, moduleName: undefined, methodName: undefined,
  });
  expect(paramsOf(undefined).projectCode).toBeUndefined();
});

// /specs is the only non-exact route in App.js, so deeper paths under it still resolve; the others
// are exact and a deeper path under them must NOT be read as that route.
test("/specs matches deeply, the one-segment routes do not", () => {
  expect(paramsOf("/specs/p/S/M/m/extra").projectCode).toBe("p");
  expect(paramsOf("/context/p/and/more").projectCode).toBeUndefined();
});

// THE LIST CANNOT DRIFT FROM THE ROUTER. A second copy of the route patterns that falls behind
// App.js scopes the wall to the wrong project and nothing says so — the failure is silent and
// looks like a stale project picker. So the source is the authority: every `path=` App.js routes
// on must appear here, and nothing here may name a route that does not exist.
test("the patterns are exactly the routes App.js declares", () => {
  const src = fs.readFileSync(path.join(__dirname, "..", "App.js"), "utf8");
  const declared = [...src.matchAll(/<Route path="([^"]+)"/g)].map((m) => m[1]).sort();
  expect([...ROUTE_PATTERNS].sort()).toEqual(declared);
});
