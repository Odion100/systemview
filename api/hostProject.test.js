const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const path = require("path");

// RFC-078 §2.8's blocker, turned into a guard. 2026-11-09: the hosted Test service died when a
// module file was saved mid-write, and THREE things were wrong with what happened next — the
// re-host unhosted the folder and closed its own watchers (so the promise in its comment, "fix the
// file and re-host by saving", could never come true), the dead registration stayed in the store
// pointing at a port nothing served (18,000 "Failed to reconnect" lines in one boot log, and the
// hub eventually stopped answering at all), and there was no way to turn folder hosting off
// without editing the registry.
//
// WHAT THIS FILE CAN AND CANNOT REACH, said plainly rather than implied by what is missing. The
// recovery path needs a live hosted service — a real SystemLynx app on a real port registering
// with a real hub — so it is proven by the hub's own boot (the service comes up with the shell now,
// which is the whole observable) and not by this file. The GATE is pure, and the gate is what
// decides whether any of it runs.
const createHostProject = require("./hostProject");

test("the folder-hosting gate reads the environment, and off means off", () => {
  const unit = createHostProject(3000);
  const was = process.env.SYSTEMVIEW_HOST_FOLDERS;
  try {
    // DEFAULT IS ON. The registry is the stated intent; a hub that quietly stopped honouring it is
    // worse than a noisy one, so absence is not an excuse to host nothing.
    delete process.env.SYSTEMVIEW_HOST_FOLDERS;
    assert.equal(unit.hostingOff(), false, "no variable set — hosting is on");
    process.env.SYSTEMVIEW_HOST_FOLDERS = "1";
    assert.equal(unit.hostingOff(), false, "1 is on");
    process.env.SYSTEMVIEW_HOST_FOLDERS = "";
    assert.equal(unit.hostingOff(), false, "an empty value is not a decision — still on");

    for (const v of ["0", "off", "OFF", "false", "False", "no", "NO"]) {
      process.env.SYSTEMVIEW_HOST_FOLDERS = v;
      assert.equal(unit.hostingOff(), true, `${v} turns it off`);
    }

    // AND IT IS READ AT THE MOMENT IT MATTERS, not closed over at require time — a hub booted by a
    // launcher that sets the variable after the module loads still honours it.
    process.env.SYSTEMVIEW_HOST_FOLDERS = "0";
    assert.equal(createHostProject(3000).hostingOff(), true);
    process.env.SYSTEMVIEW_HOST_FOLDERS = "0";
    assert.equal(unit.hostingOff(), true, "the same unit answers the new value, so nothing is cached");
  } finally {
    if (was === undefined) delete process.env.SYSTEMVIEW_HOST_FOLDERS;
    else process.env.SYSTEMVIEW_HOST_FOLDERS = was;
  }
});

test("with hosting off, the boot replay stands nothing up and says what it skipped", async () => {
  const was = process.env.SYSTEMVIEW_HOST_FOLDERS;
  process.env.SYSTEMVIEW_HOST_FOLDERS = "off";
  try {
    // THE REGISTRY IS READ, NOT IGNORED: the count is what makes the skip auditable — "hosting is
    // off" with no number cannot be told from "there was nothing registered".
    const registered = (() => {
      try {
        const r = JSON.parse(fs.readFileSync(path.join(__dirname, "hosted.json"), "utf8"));
        return Array.isArray(r) ? r.length : 0;
      } catch {
        return 0;
      }
    })();
    const r = await createHostProject(3000).rehostAll();
    assert.equal(r.off, true, "the answer says the gate closed it, rather than reporting zero hosted");
    assert.equal(r.hosted, 0, "nothing was stood up");
    assert.equal(r.skipped, registered, "and it counted what it left alone");
  } finally {
    if (was === undefined) delete process.env.SYSTEMVIEW_HOST_FOLDERS;
    else process.env.SYSTEMVIEW_HOST_FOLDERS = was;
  }
});
