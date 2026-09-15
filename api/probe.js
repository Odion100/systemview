// PROBE, AS A HUB CAPABILITY — not the CLI's probe wearing a hub costume.
//
// The first version of this had the hub `require("../cli/probe")` and call it in a "collect" mode.
// That is wrong, and it was wrong in a way that hid: the CLI's probe is built for a human standing
// in a project directory, so its session store, its cookie jar and its manifest lookup are all
// resolved from `process.cwd()`. Under the hub, cwd is the SystemView repo — so a call to buAPI
// read SystemView's session file and sent headers for the wrong origin. It did not error. It just
// quietly authenticated as nobody.
//
// The deeper reason it cannot be shared: the CLI's header store is a MODULE-LEVEL SINGLETON,
// correct for a process that serves one project and fatal for a hub that serves twenty.
//
// So this is the capability, and the CLI becomes one of its callers. Everything ambient there is an
// argument here: which project, which root, which headers.
const fs = require("fs");
const path = require("path");
const { createClient } = require("systemlynx");
// A pure predicate — the same string match both faces must agree on. Sharing a matcher is not
// sharing an implementation; two copies of "does this namespace match" is how two answers appear.
const { matchNamespace, nsEquals } = require("../cli/utils/matchNamespace");

const Client = createClient();

const originOf = (url) => {
  try {
    return new URL(url).origin;
  } catch {
    return null;
  }
};

// HEADERS COME FROM THE TARGET PROJECT, computed per call, cached nowhere. Two sources, in the
// order the CLI reads them: the per-service manifests the plugins wrote (`entry.headers`), then the
// project's own session store, which wins because it is the live one.
function headersFor(root, serviceUrl) {
  const out = {};
  if (!root) return out;
  const origin = originOf(serviceUrl);
  if (!origin) return out;
  const dir = path.join(root, ".systemview");
  const take = (bag) => {
    if (!bag || typeof bag !== "object") return;
    for (const [key, value] of Object.entries(bag)) {
      if (typeof value !== "string") continue;
      // A "@./file" pointer keeps a secret out of the manifest — resolve it against the project.
      out[key] = value.startsWith("@") ? readPointer(root, value.slice(1)) : value;
    }
  };
  const readPointer = (base, rel) => {
    try {
      return fs.readFileSync(path.resolve(base, rel), "utf8").trim();
    } catch {
      return "";
    }
  };
  try {
    for (const f of fs.readdirSync(dir)) {
      if (!f.endsWith(".manifest.json")) continue;
      const m = JSON.parse(fs.readFileSync(path.join(dir, f), "utf8"));
      for (const entry of Array.isArray(m.services) ? m.services : [m]) {
        const eo = originOf(entry && entry.serviceUrl);
        if (eo && eo === origin) take(entry.headers);
      }
    }
  } catch {
    /* no manifests is an empty answer, not a failure */
  }
  try {
    const session = JSON.parse(fs.readFileSync(path.join(dir, "session.json"), "utf8"));
    take((session && session.headers && session.headers[origin]) || session[origin]);
  } catch {
    /* no session store is an empty answer too */
  }
  return out;
}

// RESOLUTION, AGAINST THE HUB'S OWN REGISTRY. No HTTP call to itself: the hub already holds every
// connection, its project code and its root. `projectCode:` scopes the pool; the namespace after it
// may be fuzzy.
function resolve(namespace, connections, scopeArg) {
  const colon = String(namespace).indexOf(":");
  const scope = scopeArg || (colon > -1 ? String(namespace).slice(0, colon).trim() : null);
  const nsInput = (colon > -1 ? String(namespace).slice(colon + 1) : String(namespace)).trim();
  if (!nsInput) return { error: "namespace required — <ServiceId.Module.method>" };

  const pool = scope ? connections.filter((c) => nsEquals(c.projectCode, scope)) : connections;
  let hits = [];
  for (const svc of pool) {
    const modules = (svc.system && svc.system.connectionData && svc.system.connectionData.modules) || [];
    for (const { name: mod, methods = [] } of modules)
      for (const { fn } of methods)
        if (matchNamespace(`${svc.serviceId}.${mod}.${fn}`, nsInput))
          hits.push({ svc, serviceId: svc.serviceId, moduleName: mod, methodName: fn, projectCode: svc.projectCode });
  }
  // EXACT BEATS SUBSTRING — `Plugin.readFile` must not come back ambiguous against `readFileRaw`,
  // because there is no spelling that would get you out of it.
  if (hits.length > 1) {
    const exact = hits.filter((h) => {
      const full = `${h.serviceId}.${h.moduleName}.${h.methodName}`;
      return nsEquals(full, nsInput) || nsEquals(full.slice(-(nsInput.length + 1)), `.${nsInput}`);
    });
    if (exact.length) hits = exact;
  }
  if (!hits.length)
    return { error: `no method matching "${nsInput}"${scope ? ` in project "${scope}"` : ""} — connect it first` };
  if (hits.length > 1)
    return {
      error: `"${nsInput}" is ambiguous — narrow it with a "projectCode:" prefix or the full Service.Module.method`,
      // The candidates carry WHERE each one lives, so the next call is a choice rather than a retype.
      candidates: hits.map((h) => ({
        namespace: `${h.projectCode}:${h.serviceId}.${h.moduleName}.${h.methodName}`,
        at: h.svc.system.connectionData.serviceUrl,
      })),
    };
  return { hit: hits[0] };
}

// One object, or an array spread positionally — and a JSON string of either, because that is what a
// shell and an MCP parameter both hand over.
function normalizeArgs(args) {
  if (args === undefined || args === null || args === "") return [];
  let v = args;
  if (typeof v === "string") {
    const t = v.trim();
    if (t.startsWith("{") || t.startsWith("[")) {
      try {
        v = JSON.parse(t);
      } catch {
        return [args]; // not JSON after all — one literal string argument
      }
    }
  }
  return Array.isArray(v) ? v : [v];
}

// A DEAD SERVICE DOES NOT THROW AN ERROR — SystemLynx throws an ARRAY of the failed attempts, each
// an AxiosError carrying `code` and `config.url`. `err.message` on the array is undefined, which is
// how this once came back as neither a result nor a failure and rendered as a blank.
function why(err) {
  const first = Array.isArray(err) ? err[0] : err;
  const at = first && first.config && first.config.url ? ` (${first.config.url})` : "";
  if (first && first.message) return `${first.message}${at}`;
  if (first && first.code) return `${first.code} — the service did not answer${at}`;
  if (first && first.name) return `${first.name}${at}`;
  return "the call failed and the error carried no message";
}

// THE CAPABILITY. `connections` and the arg shape come in; nothing is read from the environment.
//
// It READS the target project's session; it never writes one. Capturing a Set-Cookie back into a
// project's store is a deliberate act with a flag behind it (`connect --save-session`), and an agent
// calling a method is not that act.
async function probe({ namespace, args, headers = {}, projectCode = null } = {}, connections = []) {
  if (!namespace) return { error: "namespace required — <ServiceId.Module.method>" };
  const r = resolve(namespace, connections, projectCode);
  if (r.error) return { namespace, error: r.error, ...(r.candidates ? { candidates: r.candidates } : {}) };

  const { svc, serviceId, moduleName, methodName } = r.hit;
  const conn = svc.system.connectionData;
  // ARGS ARRIVE AS A STRING SOMETIMES, and pretending otherwise is a footgun. A shell hands the CLI
  // a string; an MCP `z.any()` parameter is serialized on the way in too — measured: an array sent
  // as `[{...},{...}]` reached here as one string and went out as a single string argument, which
  // the service then rejected. Parse what parses, and treat anything else as one literal argument.
  const list = normalizeArgs(args);
  const sent = { ...headersFor(svc.root, conn.serviceUrl), ...headers };

  // WHAT THE TERMINAL COULD NEVER TELL YOU. The CLI prints the return value and stops, because a
  // terminal is a place to look at one answer. A tool call is a place to hand back everything the
  // system already knows about the call it just made — so the next call does not have to be a
  // guess, and a wrong one explains itself.
  const mod = (conn.modules || []).find((m) => m.name === moduleName) || {};
  const siblings = (mod.methods || []).map((m) => m.fn).filter((fn) => fn !== methodName);
  const verb = ((mod.methods || []).find((m) => m.fn === methodName) || {}).method || null;
  // THE MODULE'S ROUTE IS ALREADY ABSOLUTE FROM THE ROOT in connectionData (`/test/api/Math`),
  // so joining it onto the full serviceUrl doubles the path — it reported
  // `http://host/test/api/test/api/Math` on its very first live call. Absolute routes hang off the
  // ORIGIN; only a relative one is appended.
  const svcBase = String(conn.serviceUrl).replace(/\/+$/, "");
  const at = !mod.route
    ? svcBase
    : String(mod.route).startsWith("/")
    ? `${originOf(conn.serviceUrl) || svcBase}${mod.route}`
    : `${svcBase}/${String(mod.route)}`;
  const auth = Object.keys(sent).some((h) => /^(cookie|authorization)$/i.test(h));

  const where = {
    at: conn.serviceUrl,
    route: at,
    verb,
    // Identity is never implicit. A call that went out anonymous says so, instead of coming back
    // with an authorization error the caller has to reverse-engineer.
    authenticated: auth,
    headers: Object.keys(sent),
    headersFrom: svc.root ? `${svc.root}/.systemview` : null,
    ...(siblings.length ? { siblings: siblings.slice(0, 40) } : {}),
  };

  const base = { projectCode: svc.projectCode, serviceId, moduleName, methodName, args: list, ...where };
  const started = Date.now();
  try {
    const client = Client.createService(conn);
    if (Object.keys(sent).length) client.setHeaders(sent);
    const result = await client[moduleName][methodName](...list);
    return {
      ...base,
      ms: Date.now() - started,
      result: result === undefined ? null : result,
      ...(result === undefined
        ? { warning: "the service returned nothing — it may not be listening on the URL it is registered at" }
        : {}),
    };
  } catch (err) {
    const first = Array.isArray(err) ? err[0] : err;
    const code = (first && first.code) || null;
    return {
      ...base,
      ms: Date.now() - started,
      error: why(err),
      ...(code ? { code } : {}),
      // A REFUSED CONNECTION IS A REGISTRATION PROBLEM, not a mystery. The hub knows the address it
      // dialled; saying it beside the failure is the difference between "it broke" and "this is
      // registered at a port nothing is listening on".
      ...(code === "ECONNREFUSED" || code === "ECONNRESET" || code === "ETIMEDOUT"
        ? { hint: `${serviceId} is registered at ${conn.serviceUrl} and nothing answered there — the service is down, or the registration is stale. Re-register with connect.` }
        : {}),
      ...(!auth ? { hint2: "the call went out with no Cookie or Authorization header — if the method needs a session, that is why" } : {}),
    };
  }
}

module.exports = { probe, resolve, headersFor, why };
