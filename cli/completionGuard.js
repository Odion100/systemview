// A TRUNCATED RUN MUST NOT READ AS GREEN (gaps/SYSTEMVIEW_HUB_DROPS…, filed by buAPI's agent): the
// hub dying mid-run ended a 226-test sweep at 315 lines with EXIT 0 — no summary, no failure, and
// an agent trusting the code reported a pass that never finished, leaving teardown residue that
// read as regressions in fine code.
//
// The guard: armed when a test run starts, disarmed only by the run's own deliberate exit
// (flushAndExit). Any other path to exit — the hub's socket taking the process down, an early
// return, a swallowed rejection — flips 0 to 1 with one line saying why. Assigning
// `process.exitCode` inside an exit handler is honored; calling process.exit() there is not,
// which is why this sets the code instead.
const completionGuard = { armed: false };
completionGuard.arm = () => { completionGuard.armed = true; };
completionGuard.disarm = () => { completionGuard.armed = false; };

process.on("exit", (code) => {
  if (completionGuard.armed && code === 0) {
    process.stderr.write(
      "run ended before completion — no summary was reached (did the hub drop?); exiting 1 so this cannot read as a pass\n"
    );
    process.exitCode = 1;
  }
});

module.exports = completionGuard;
