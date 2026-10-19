// A TRACE PAYLOAD IS SOMEBODY ELSE'S LIVE OBJECT — clone it safely or take their service down.
//
// THE CRASH THIS REPLACES (gaps/TRACE_EMIT_CRASHES_HOST_ON_CIRCULAR): `redactClone` was
//
//     if (!paths.length || data == null) return data;      // no redact config → the RAW object
//     const clone = JSON.parse(JSON.stringify(data));      // redact config → THROWS on a cycle
//
// so with the default config it handed a live object straight to `this.emit("log", record)`, and
// socket.io-parser's `hasBinary` walked it at encode time. For the single most common object in a
// Mongoose app — a `Query`, which buAPI's middleware puts in `req.arguments[0]` — the walk hits
//
//     query → mongooseCollection → collection → s → db → s → topology → s → sessionPool → topology
//
// and the process dies with `RangeError: Maximum call stack size exceeded`. It only fires on the
// ERROR path (the error trace is the one carrying `req.arguments`), so it stays invisible until
// something is already going wrong and then removes the ability to observe OR serve. With redact
// paths configured it was the other failure: `Converting circular structure to JSON`, thrown
// synchronously inside the host's own hook.
//
// The rule this file exists to keep: **losing a trace is acceptable, losing the service is not** —
// and a degraded trace beats a placeholder, so this preserves as much readable shape as it can
// rather than giving up at the first exotic value.
//
// WHAT IT DOES, in the order the decisions happen:
//   1. `toJSON` first. A value with a toJSON contract has already said how it wants to be read —
//      a Mongoose document renders as its plain form, and a caller who taught `Query.prototype`
//      a toJSON (buAPI did) is honored rather than second-guessed.
//   2. Cycles become a marker naming where the back-reference pointed: `[Circular ~.arguments[0]]`.
//      A reader can see WHAT repeated, which a bare "[Circular]" cannot say.
//   3. Non-JSON leaves become short, honest strings — `[Function name]`, `[Buffer 1.2kB]`,
//      `[Socket]` — instead of `{}`, which is what JSON.stringify silently turns them into.
//   4. Bounds: depth and node count. The topology above is both deep and wide; a trace is a
//      breadcrumb, not a heap dump, and an unbounded walk on the error path is its own outage.
//
// It ALWAYS clones. Passing the caller's object through "because there was nothing to redact" is
// what made the default configuration the dangerous one.

const MAX_DEPTH = 8;
const MAX_NODES = 2000;
const MAX_STRING = 4000;

const kindOf = (v) => Object.prototype.toString.call(v).slice(8, -1);

const bytes = (n) => (n < 1024 ? `${n}B` : `${(n / 1024).toFixed(1)}kB`);

// The leaf renderers. Each one answers "what would a human want to see here", given that the real
// thing cannot cross a socket.
function leafOf(v) {
  if (typeof v === "function") return `[Function ${v.name || "anonymous"}]`;
  if (typeof v === "symbol") return `[Symbol ${String(v.description || "")}]`;
  if (typeof v === "bigint") return `${v.toString()}n`;
  if (typeof v === "string") return v.length > MAX_STRING ? `${v.slice(0, MAX_STRING)}… [${v.length} chars]` : v;
  if (typeof v === "number" && !Number.isFinite(v)) return String(v); // Infinity/NaN are not JSON
  return v;
}

function safeClone(data, { redact = [], depth = MAX_DEPTH, maxNodes = MAX_NODES } = {}) {
  let nodes = 0;
  const seen = new Map(); // object → the path where it was first met, so a cycle can name it

  const walk = (v, at, level) => {
    if (v === null || typeof v !== "object") return leafOf(v);
    if (nodes++ > maxNodes) return "[Truncated — trace node budget]";

    // A BUFFER HAS ITS OWN toJSON AND IT IS THE WRONG ANSWER HERE — it expands to
    // `{type:"Buffer", data:[104,101,...]}`, so a 1MB upload became a million-element array in a
    // breadcrumb. Checked before the contract below, which is otherwise honoured first. (Caught by
    // this file's own claims, not by reading it.)
    if (typeof Buffer !== "undefined" && Buffer.isBuffer && Buffer.isBuffer(v)) return `[Buffer ${bytes(v.length)}]`;

    // 1 · the value's own contract wins
    if (typeof v.toJSON === "function") {
      let out;
      try {
        out = v.toJSON();
      } catch {
        return `[Unserializable ${kindOf(v)}]`; // a throwing toJSON is still not allowed to throw here
      }
      // A toJSON that returns itself (or another object) still has to be walked — but never with
      // the same `at`, or a self-returning toJSON would read as a cycle with itself.
      return out && typeof out === "object" ? walk(out, at, level) : leafOf(out);
    }

    const kind = kindOf(v);
    if (kind === "Date") return v.toISOString();
    if (kind === "RegExp") return String(v);
    if (kind === "Error") return { name: v.name, message: v.message };
    if (kind === "Map") return `[Map ${v.size}]`;
    if (kind === "Set") return `[Set ${v.size}]`;

    // 2 · a back-reference names where it pointed
    if (seen.has(v)) return `[Circular ~${seen.get(v)}]`;
    if (level >= depth) return `[Depth limit ${kind === "Array" ? "array" : kind}]`;
    seen.set(v, at);

    let out;
    if (Array.isArray(v)) {
      out = v.map((item, i) => walk(item, `${at}[${i}]`, level + 1));
    } else {
      out = {};
      // Own enumerable keys only. A getter that throws must not take the process with it, which is
      // exactly the class of value this whole file is about.
      for (const k of Object.keys(v)) {
        let item;
        try {
          item = v[k];
        } catch (e) {
          out[k] = `[Threw on read: ${(e && e.message) || "?"}]`;
          continue;
        }
        out[k] = walk(item, `${at}.${k}`, level + 1);
      }
      // Something with no own enumerable keys and an interesting class is more useful named than
      // rendered as `{}` — a socket, a stream, a class instance hiding its state behind getters.
      //
      // THE NAME COMES FROM THE CONSTRUCTOR, NOT FROM Object.prototype.toString: a class instance
      // reports `[object Object]`, so keying off that printed `{}` for every socket and stream.
      // (Also caught by this file's claims.)
      if (!Object.keys(out).length) {
        const ctor = (v.constructor && v.constructor.name) || "";
        if (kind !== "Object") out = `[${kind}]`;
        else if (ctor && ctor !== "Object") out = `[${ctor}]`;
      }
    }
    // Leaving the path open would make a sibling that reuses the same object read as a CYCLE, which
    // it is not — only an ancestor is a cycle.
    seen.delete(v);
    return out;
  };

  const cloned = walk(data, "", 0);

  // 3 · redaction, applied to the clone exactly as before — the paths are the host's config and
  // their semantics (dots and [i]) must not change under it.
  if (redact.length && cloned && typeof cloned === "object") {
    redact.forEach((p) => {
      const keys = String(p)
        .replace(/\[(\w+)\]/g, ".$1")
        .split(".")
        .filter(Boolean);
      let node = cloned;
      for (let i = 0; i < keys.length - 1; i++) {
        if (node == null) return;
        node = node[keys[i]];
      }
      if (node != null && keys.length) node[keys[keys.length - 1]] = "[REDACTED]";
    });
  }
  return cloned;
}

module.exports = { safeClone, MAX_DEPTH, MAX_NODES };
