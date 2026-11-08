// WHAT THE TARBALL SHIPS — asserted by packing it, not by reading the allowlist back.
//
// The one rule with teeth: the hub serves the WINDOW out of the package's own folder
// (api/index.js: `buildPath = path.resolve(__dirname, "../build")`), so an npm-installed
// `systemview start` serves the tarball's bundle — `build/` is load-bearing cargo, not CLI
// dead weight, and a "slim" allowlist that cuts it ships a hub that serves nothing. What IS
// dead weight is the source maps: 20 of 47 unpacked megabytes that only devtools ever ask for.
//
// `npm pack --dry-run --json` is the same walk `npm publish` does, which is what makes this a
// claim about the published artifact rather than about package.json's intentions.
const assert = require("node:assert");
const { test } = require("node:test");
const { execFileSync } = require("node:child_process");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "..");
const packed = () => {
  const out = execFileSync("npm", ["pack", "--dry-run", "--json"], {
    cwd: ROOT,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "ignore"],
    timeout: 60000,
  });
  return JSON.parse(out)[0].files.map((f) => f.path);
};

const FILES = packed(); // one pack, several claims — the walk costs ~2s and nothing changes it mid-suite

test("the tarball ships NO source maps — the 20MB only devtools ever asked for", () => {
  const maps = FILES.filter((f) => f.endsWith(".map"));
  assert.deepEqual(maps, [], `maps shipped: ${maps.slice(0, 3).join(", ")}`);
});

test("and the window the hub serves is still whole — build/ is cargo, not dead weight", () => {
  assert.ok(FILES.includes("build/index.html"), "build/index.html is what `systemview start` serves");
  assert.ok(
    FILES.some((f) => /^build\/static\/js\/main\.[a-z0-9]+\.js$/.test(f)),
    "the main bundle ships"
  );
  assert.ok(
    FILES.some((f) => /^build\/static\/css\/main\.[a-z0-9]+\.css$/.test(f)),
    "the stylesheet ships"
  );
});

test("the CLI's own halves ship — the parts a consumer actually runs", () => {
  for (const need of ["cli/index.js", "src/shared/docHash.js"]) {
    assert.ok(FILES.includes(need), `${need} missing from the pack`);
  }
  assert.ok(FILES.some((f) => f.startsWith("api/") && f.endsWith(".js")), "the hub ships");
  assert.ok(FILES.some((f) => f.startsWith("testing-utilities/")), "the spec runner ships");
});
