// THE FIRST TEST IN cli/ — and the subject is deliberate: this is where SECRETS live.
//
// His card: *"cli/ has zero test files. Not failing — none exist. The window has 59 suites and the
// hub has 6, and the command surface you actually type into has nothing at all."* So the question
// was which piece earns the first one, and the answer is the one whose wrong answers are SILENT:
// `manifestHeaders` resolves per-origin credentials, dereferences `@file` secrets so tokens stay out
// of the manifest, and folds captured Set-Cookies into a session that rides to later processes. Each
// of those failing produces a request that goes out unauthenticated, or a cookie that rides to a
// deployment it was never meant for — never an exception.
//
// NO MOCKING. The module takes an explicit manifest path (`setManifestFile`), so a temp directory is
// the whole fixture. Its state is module-level, so each scenario loads a FRESH copy out of the
// require cache — the same pattern tests/lanes.js uses in autobot for the same reason.
const assert = require("node:assert");
const { test } = require("node:test");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const AT = "http://localhost:4000";
const ELSEWHERE = "https://api.example.com";

// A fresh module against a fresh manifest — the only honest way to test a file that caches on load.
const fresh = (manifest) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "sv-headers-"));
  const file = path.join(dir, ".systemview", "session.json");
  fs.mkdirSync(path.dirname(file), { recursive: true });
  if (manifest !== undefined) fs.writeFileSync(file, JSON.stringify(manifest, null, 2));
  delete require.cache[require.resolve("./manifestHeaders")];
  const mod = require("./manifestHeaders");
  mod.setManifestFile(file);
  return { mod, file, dir, read: () => JSON.parse(fs.readFileSync(file, "utf8")) };
};

test("headers are matched by ORIGIN, and another origin gets none", () => {
  const { mod } = fresh({ headers: { [AT]: { Authorization: "Bearer abc" } } });
  assert.deepEqual(mod.headersFor(`${AT}/svc/api`), { Authorization: "Bearer abc" });
  // THE LEAK THIS PREVENTS: a credential authored for localhost must never ride to a remote host.
  assert.deepEqual(mod.headersFor(`${ELSEWHERE}/svc/api`), {});
  // An unparseable url has no origin, so it has no headers — never the whole store.
  assert.deepEqual(mod.headersFor("not a url"), {});
});

test("an @file pointer is read and trimmed, so the secret is never in the manifest", () => {
  const { mod, dir } = fresh({ headers: { [AT]: { Authorization: "@TOKEN" } } });
  const token = path.join(dir, "token.txt");
  fs.writeFileSync(token, "Bearer from-a-file\n");
  const { mod: m2 } = fresh({ headers: { [AT]: { Authorization: `@${token}` } } });
  assert.deepEqual(m2.headersFor(`${AT}/x`), { Authorization: "Bearer from-a-file" });
  // A POINTER AT NOTHING DROPS THE HEADER rather than sending it empty: an empty Authorization is a
  // request that looks credentialed and is not, which is the hardest failure of the two to read.
  assert.deepEqual(mod.headersFor(`${AT}/x`), {});
});

test("a captured cookie MERGES into the jar instead of replacing it", () => {
  const { mod } = fresh({ headers: { [AT]: { Cookie: "a=1; keep=yes" } } });
  mod.captureCookie(`${AT}/login`, ["a=2; Path=/; HttpOnly", "fresh=9; Path=/"]);
  const jar = mod.getHeaders()[AT].Cookie.split("; ").sort();
  // the same name is overwritten, a new one is added, and everything else survives
  assert.deepEqual(jar, ["a=2", "fresh=9", "keep=yes"]);
  // attributes are not cookies — only the first pair of each Set-Cookie is kept
  assert.ok(!mod.getHeaders()[AT].Cookie.includes("HttpOnly"));
});

test("nothing captured, nothing written — persist only touches disk when it has news", () => {
  const { mod, read } = fresh({ projectCode: "demo", services: [{ serviceId: "S" }], headers: {} });
  assert.equal(mod.persist(), false, "no capture means no write");
  mod.captureCookie(`${AT}/login`, ["sid=1"]);
  assert.equal(mod.persist(), true);
  const after = read();
  assert.equal(after.headers[AT].Cookie, "sid=1");
  // AND IT PRESERVES THE REST OF THE MANIFEST. Writing the whole file is how a session survives
  // across processes; losing `services` while doing it would be the cure killing the patient.
  assert.equal(after.projectCode, "demo");
  assert.deepEqual(after.services, [{ serviceId: "S" }]);
  assert.equal(mod.persist(), false, "and it is clean again afterwards");
});

test("the project-wide session cookie rides ONLY to the origins the policy recorded", () => {
  const { mod } = fresh({ session: { origins: [ELSEWHERE], cookie: "sid=shared" }, headers: {} });
  assert.deepEqual(mod.sessionCookieHeader(`${ELSEWHERE}/svc`), { Cookie: "sid=shared" });
  // THE GUESS THIS REPLACED: borrowing the first Cookie in the store leaked a localhost test cookie
  // into a remote request. An origin the policy never named gets nothing.
  assert.deepEqual(mod.sessionCookieHeader(`${AT}/svc`), {});

  // An origin with its OWN cookie is served by headersFor, so the shared one must not double up.
  const { mod: own } = fresh({
    session: { origins: [AT], cookie: "sid=shared" },
    headers: { [AT]: { Cookie: "sid=mine" } },
  });
  assert.deepEqual(own.sessionCookieHeader(`${AT}/svc`), {});
  assert.deepEqual(own.headersFor(`${AT}/svc`), { Cookie: "sid=mine" });
});

test("the global stamp is the opt-in: no `origins`, no project-wide cookie", () => {
  const opted = fresh({ session: { origins: [AT] }, headers: {} });
  opted.mod.captureCookie(`${AT}/login`, ["sid=7"]);
  opted.mod.persist();
  assert.equal(opted.read().session.cookie, "sid=7", "opted in — the capture becomes the session");

  const plain = fresh({ session: { save: true }, headers: {} });
  plain.mod.captureCookie(`${AT}/login`, ["sid=7"]);
  plain.mod.persist();
  assert.equal(plain.read().session.cookie, undefined, "no origins declared — nothing is stamped");
  assert.equal(plain.read().headers[AT].Cookie, "sid=7", "the per-origin capture still saves");
});

test("the policy is read safely and written by merging — and bootstraps a manifest if there is none", () => {
  const none = fresh(undefined); // no manifest at all
  assert.deepEqual(none.mod.readSessionPolicy(), {}, "no manifest is the safe default: leave disk alone");
  assert.deepEqual(none.mod.setSessionPolicy({ save: true }), { save: true });
  assert.deepEqual(none.read(), { session: { save: true } }, "bootstrapped, holding only the policy");

  const some = fresh({ projectCode: "demo", session: { save: true, origins: [AT] } });
  assert.deepEqual(some.mod.setSessionPolicy({ cookie: "sid=1" }), { save: true, origins: [AT], cookie: "sid=1" });
  assert.equal(some.read().projectCode, "demo", "and the rest of the manifest is untouched");
});
