const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const path = require("path");
const Chats = require("./Chats");

// THE KICK HAD NO SECOND HALF.
//
// `kick()` has written the bounced identity and a timestamp into a `kicked` map since it was built,
// under a comment promising that "rejoins are refused for KICK_TTL" and that this is "the bouncer
// power that lets visiting etiquette be 'stay freely' instead of hedging". **Nothing ever read
// either one.** `KICK_TTL` appeared in two comments and its own declaration; `kicked` appeared at
// its declaration and three times inside `kick()` writing to it. So a kicked identity could speak
// again in the next second, and the etiquette rested on a constant.
//
// These pin the half that was missing. The room's write is absorbed by a stub `chatFor`, so no test
// here touches `.systemview/chats` — `append` hands the record to the project's own module and
// mirrors it in memory when one exists.
const stub = () => ({ chatAppend: async () => {} });
const chats = () => Chats({ chatFor: () => stub() });

test("a kicked identity is bounced, and the answer says for how long", () => {
  const C = chats();
  assert.strictEqual(C.kickedOut("p", "room", "visitor"), null, "nobody is bounced to begin with");
  C.kick("p", "room", { identity: "visitor" });
  const out = C.kickedOut("p", "room", "visitor");
  assert.ok(out, "the kick is now readable — this is the half that did not exist");
  assert.strictEqual(out.identity, "visitor");
  assert.ok(out.remaining > 14 * 60 * 1000 && out.remaining <= 15 * 60 * 1000, `remaining was ${out.remaining}`);
  assert.ok(out.until > Date.now(), "and when it ends, so a refusal can say WHEN rather than just no");
});

test("the bounce is per room and per identity, never a project-wide ban", () => {
  const C = chats();
  C.kick("p", "room", { identity: "visitor" });
  assert.ok(C.kickedOut("p", "room", "visitor"));
  assert.strictEqual(C.kickedOut("p", "other-room", "visitor"), null, "a different room is a different door");
  assert.strictEqual(C.kickedOut("p", "room", "somebody-else"), null, "a kick lands on one identity");
  assert.strictEqual(C.kickedOut("other-project", "room", "visitor"), null, "and in one project");
});

test("a bounced identity does not ARRIVE — speaking cannot mark it present", () => {
  // "SPEAKING IS ARRIVING" is the architecture, so the arrival door is where a kicked visitor would
  // otherwise walk straight back in. The caller refuses the message outright; this is the belt
  // beside it, so no second caller can mark a kicked visitor present by accident.
  const C = chats();
  assert.strictEqual(C.enterBySpeaking("p", "room", "visitor"), true);
  assert.strictEqual(C.hasEntered("p", "room", "visitor"), true);
  C.kick("p", "room", { identity: "visitor" });
  assert.strictEqual(C.hasEntered("p", "room", "visitor"), false, "the kick takes the prior entry with it");
  assert.strictEqual(C.enterBySpeaking("p", "room", "visitor"), false, "and speaking does not put it back");
  assert.strictEqual(C.hasEntered("p", "room", "visitor"), false);
});

test("the cooldown LAPSES, and lapses on read so the map cannot only grow", () => {
  // A kick is a cooldown, not a ban. Without this the entry would sit there forever and nothing
  // would ever say the bounce had ended.
  const C = chats();
  C.kick("p", "room", { identity: "visitor" });
  const real = Date.now;
  try {
    Date.now = () => real() + 15 * 60 * 1000 + 1;
    assert.strictEqual(C.kickedOut("p", "room", "visitor"), null, "fifteen minutes on, the door is open again");
    assert.strictEqual(C.enterBySpeaking("p", "room", "visitor"), true, "and speaking arrives again");
  } finally {
    Date.now = real;
  }
  assert.strictEqual(C.kickedOut("p", "room", "visitor"), null, "and the entry is GONE, not merely ignored");
});

// THE REFUSAL WITH THE VOICE IS IN `resolveSpeaker`, and it cannot be unit-tested here: requiring
// `api/index.js` stands a hub up. So this asserts the callsite the way `hostFiles.callsites.test.js`
// does — the honest substitute when the module under test cannot be imported.
test("resolveSpeaker consults the bounce and THROWS, rather than declining in silence", () => {
  const src = fs.readFileSync(path.join(__dirname, "index.js"), "utf8");
  const fn = src.slice(src.indexOf("function resolveSpeaker("));
  const body = fn.slice(0, fn.indexOf("\n}\n") + 2);
  assert.ok(body.includes("Chats.kickedOut("), "the gate has to be asked, or the kick is decoration again");
  assert.match(body, /throw new Error\(\s*\n?\s*`"\$\{as\}" was kicked/, "a refusal that is swallowed is the fault this fixes");
  assert.ok(body.includes("bounced.remaining"), "and it says WHEN, because a refusal with no way forward is a wall");
  // ORDER MATTERS: the bounce is checked BEFORE entry is marked, or a kicked identity is recorded
  // as present on its way to being refused.
  assert.ok(
    body.indexOf("Chats.kickedOut(") < body.indexOf("Chats.enterBySpeaking("),
    "the bounce is read before arrival is marked",
  );
});
