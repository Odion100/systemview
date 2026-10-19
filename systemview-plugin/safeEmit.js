// THE BACKSTOP: THE OBSERVER MAY NOT KILL THE OBSERVED.
//
// `trace`/`log`/`warn`/`error`/`debug` all ended in a bare `this.emit("log", record)`. The file
// write above each one was wrapped in try/catch; the emit was not — and the emit is the dangerous
// half, because socket.io-parser encodes the record synchronously at the call site. A cycle in it
// raises `RangeError: Maximum call stack size exceeded` INSIDE the host's own request hook, and the
// service dies (gaps/TRACE_EMIT_CRASHES_HOST_ON_CIRCULAR, observed as "once the service throws one
// error, every subsequent call hangs" — it was not hanging, it was dead).
//
// safeClone is layer one and it is where the data is kept useful. This is layer two, and its only
// job is the guarantee: a payload the sanitizer did not anticipate costs ONE TRACE, never the
// process. Defense in depth, because "we thought of every exotic value" is not a thing anyone can
// claim about other people's objects.
//
// IT WARNS ON stderr, NEVER THROUGH THE PLUGIN'S OWN LOG. Reporting a failed emit by emitting would
// be the recursion this file exists to stop. Once per process per level, because a service erroring
// in a loop must not have its stderr flooded by the thing that is supposed to be watching quietly.
const warned = new Set();

function safeEmit(emitter, record, level = "log") {
  try {
    emitter.emit("log", record);
    return true;
  } catch (e) {
    const key = `${level}:${(e && e.name) || "Error"}`;
    if (!warned.has(key)) {
      warned.add(key);
      try {
        // eslint-disable-next-line no-console
        console.error(
          `[systemview] a ${level} trace could not be emitted and was dropped: ${(e && e.message) || e}. ` +
            `The service is unaffected; the record is still in this service's .logs file if it was serializable.`,
        );
      } catch {}
    }
    return false;
  }
}

// For tests and for a host that wants to assert on its own behaviour across runs.
safeEmit.reset = () => warned.clear();

module.exports = { safeEmit };
