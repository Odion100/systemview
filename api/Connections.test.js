const assert = require("node:assert");
const { test } = require("node:test");
const fs = require("fs");
const os = require("os");
const path = require("path");

// THE REGISTRY IS HUB STATE AND IT IS NOW TESTABLE — pinned to a scratch file through the same kind
// of env override the other stores have, so none of this goes near his live `api/connections.json`.
const SCRATCH = path.join(os.tmpdir(), `conns-test-${process.pid}.json`);
process.env.SYSTEMVIEW_CONNECTIONS_FILE = SCRATCH;
const ConnectedServices = require("./Connections");

const entry = (projectCode, serviceId, url, extra = {}) => ({
  projectCode,
  serviceId,
  system: { connectionData: { serviceUrl: url, modules: [] } },
  specList: [],
  credentials: false,
  hosted: false,
  ...extra,
});
const read = () => JSON.parse(fs.readFileSync(SCRATCH, "utf8"));

const fresh = () => {
  fs.writeFileSync(SCRATCH, "[]");
  return new ConnectedServices();
};
process.on("exit", () => { try { fs.rmSync(SCRATCH, { force: true }); } catch {} });

// His `bu1` held two copies of Profiles and two of Networking, identical in every field: `connect`
// reads the store and then writes it, and services boot in parallel, so two registrations that
// arrive together both miss and both append. The write has to converge on its own.
test("saving the same registration twice leaves ONE entry", () => {
  const store = fresh();
  store.save(entry("bu1", "Profiles", "https://x.test:4100/p"));
  store.save(entry("bu1", "Profiles", "https://x.test:4100/p"));
  assert.equal(read().length, 1);
  });

test("a re-registration at a NEW url replaces the old one rather than sitting beside it", () => {
  const store = fresh();
  store.save(entry("bu1", "Profiles", "https://x.test:4100/p"));
  store.save(entry("bu1", "Profiles", "https://x.test:4200/p"));
  const all = read();
  assert.equal(all.length, 1);
  assert.equal(all[0].system.connectionData.serviceUrl, "https://x.test:4200/p");
  });

test("the same url under a DIFFERENT project is a different registration, and both stand", () => {
  const store = fresh();
  store.save(entry("buAPI", "Profiles", "https://x.test:4100/p"));
  store.save(entry("bu1", "Profiles", "https://x.test:4100/p"));
  assert.equal(read().length, 2);
  });

test("refuses a url whose port is literally undefined — by name, not silently", () => {
  const store = fresh();
  assert.throws(() => store.save(entry("bu1", "Mocks", "https://x.test:undefined/m")), /undefined/);
  assert.equal(read().length, 0);
  });

test("refuses a url that does not parse, and keeps accepting a DYNAMIC service with no url at all", () => {
  const store = fresh();
  assert.throws(() => store.save(entry("bu1", "Broken", "not a url")), /does not parse|no host/);
  store.save(entry("bu1", "Synth", "", { dynamic: true }));
  assert.equal(read().length, 1);
  });

// The rules above only govern NEW writes; a store that predates them needs a door, and a janitor
// that tidies quietly is one he can never audit — so it reports what it removed.
test("sweep removes duplicates and dead urls, and says what it dropped", () => {
  fresh();
  const dupe = entry("bu1", "Profiles", "https://x.test:4100/p");
  fs.writeFileSync(SCRATCH, JSON.stringify([dupe, dupe, entry("bu1", "Mocks", "https://x.test:undefined/m")]));
  const res = new ConnectedServices().sweep();
  assert.equal(res.kept, 1);
  assert.deepEqual(res.dropped.map((d) => d.why), [
      "duplicate of an entry already kept",
      "its port is literally undefined — the registering service sent no port",
    ]);
  });

test("sweep writes nothing when the store is already clean", () => {
  const store = fresh();
  store.save(entry("bu1", "Profiles", "https://x.test:4100/p"));
  const before = fs.statSync(SCRATCH).mtimeMs;
  const res = new ConnectedServices().sweep();
  assert.deepEqual(res.dropped, []);
  assert.equal(fs.statSync(SCRATCH).mtimeMs, before);
  });
