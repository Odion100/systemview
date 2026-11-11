// THE COUNT WAS TWICE THE TRUTH, and these are the two decisions that made it so.
import { listActions, actionKey } from "./actionList";

// The shape `actionsOf` really builds: each action under BOTH its qualified and its bare name,
// pointing at one object.
const bothWays = (serviceId, actions) => {
  const out = {};
  actions.forEach((a) => {
    out[`${serviceId}.${a.name}`] = a;
    if (!out[a.name]) out[a.name] = a;
  });
  return out;
};

describe("listActions — a lookup map read as a list", () => {
  it("answers once per action, however many keys the map holds it under", () => {
    const seed = { name: "seedSum", namespace: { serviceId: "TestService" } };
    const greet = { name: "buildGreeting", namespace: { serviceId: "TestService" } };
    const map = bothWays("TestService", [seed, greet]);
    expect(Object.keys(map)).toHaveLength(4); // the map really does hold four keys
    expect(listActions(map)).toEqual([seed, greet]); // and exactly two actions
  });

  // THE CASE THE DEDUPE MUST NOT EAT. Two services may each hold an action with the same name —
  // the panel already routes an edit or a delete to the owning service for exactly this reason —
  // so deduping by NAME would silently hide one of them. They are two objects; both survive.
  it("keeps two same-named actions from different services", () => {
    const mine = { name: "seedSum", namespace: { serviceId: "TestService" } };
    const theirs = { name: "seedSum", namespace: { serviceId: "Other" } };
    const merged = { ...bothWays("TestService", [mine]), ...bothWays("Other", [theirs]) };
    const list = listActions(merged);
    expect(list).toHaveLength(2);
    expect(list.map((a) => a.namespace.serviceId).sort()).toEqual(["Other", "TestService"]);
  });

  it("an empty or missing map is an empty list, not a throw", () => {
    expect(listActions({})).toEqual([]);
    expect(listActions(null)).toEqual([]);
    expect(listActions()).toEqual([]);
  });
});

describe("actionKey — an action's identity is its service and its name", () => {
  it("tells two same-named actions apart", () => {
    const mine = { name: "seedSum", namespace: { serviceId: "TestService" } };
    const theirs = { name: "seedSum", namespace: { serviceId: "Other" } };
    expect(actionKey(mine)).not.toBe(actionKey(theirs));
  });
  it("is stable for the same action", () => {
    const a = { name: "seedSum", namespace: { serviceId: "TestService" } };
    expect(actionKey(a)).toBe("TestService.seedSum");
    expect(actionKey({ ...a })).toBe(actionKey(a));
  });
  // A KEY THAT THROWS IS WORSE THAN A COLLIDING ONE — it takes the whole list down. An action
  // saved by an older plugin may carry no namespace at all.
  it("survives an action with no namespace", () => {
    expect(actionKey({ name: "loose" })).toBe(".loose");
    expect(actionKey({})).toBe(".");
    expect(actionKey()).toBe(".");
  });
});
