// Manifest-backed request headers (RFC-010 Phase 1).
//
// Headers live in the manifest, indexed by URL origin. Each value is either a literal
// ("Bearer abc") or a file-pointer ("@./token") that keeps the secret out of the manifest.
// Cookies are just the "Cookie" header — a captured Set-Cookie folds into the same store.
//
// Read on load; written back by `save`, and — when the manifest opts in via the `session`
// policy (`connect ... --save-session`) — by `probe` after it captures a Set-Cookie. This module
// holds the manifest's `headers` in memory for the life of the CLI process (shared across every
// command via Node's module cache), so a cookie captured by one request is re-sent by the next,
// and persistence writes whatever accumulated back to disk for the NEXT process to reuse.

const fs = require("fs");
const path = require("path");

// The manifest file the header store reads AND writes. Defaults to the cwd manifest. `setManifestFile`
// repoints the WHOLE store — load + capture + persist + policy — at an explicit `--manifest <path>`, so
// a session saved under that manifest is also re-attached from it. Without this, the read side (load)
// was locked to cwd while persist honored the flag, so `--manifest` sessions saved but never rode back.
let _manifestFile = path.join(process.cwd(), ".systemview", "session.json");

// { "<origin>": { "Header-Name": "value" | "@file", "Cookie": "a=1; b=2" } }
// This is the ONLY header store — user-authored, indexed by service URL origin. The plugin never
// writes headers; there is no separate project-level default (the old `probeHeaders` is gone).
let headers = null;

// Set when a request captures a Set-Cookie, so `persist()` knows the store changed and only
// rewrites the manifest when there's actually a new session to save.
let _dirty = false;

// The most recent captured cookie, so `--save-session -g` can stamp it as the project-wide session cookie.
let _lastCapturedCookie = null;

// Repoint the store at an explicit manifest (from `--manifest <path>`). Resets the cache so the next
// load() reads the newly-targeted file. Call once, early, before any request/persist. No-op if falsy.
function setManifestFile(file) {
  if (!file) return _manifestFile;
  _manifestFile = path.isAbsolute(file) ? file : path.resolve(process.cwd(), file);
  headers = null;
  return _manifestFile;
}

// One-time, de-duplicated notices surfaced by CLI commands so the user gets confirmation
// that something happened ("using headers for X", "captured cookie for X"). Drained via takeNotices().
const _notified = new Set();
const _notices = [];
function note(key, msg) {
  if (_notified.has(key)) return;
  _notified.add(key);
  _notices.push(msg);
}

function load() {
  // Cache only a NON-empty result. A short-lived CLI process loads once and is done; a long-running
  // UI server, though, may make its first call before the plugin has written the manifest headers —
  // caching that empty read would blind it forever. Re-read until headers actually appear, then cache.
  if (headers && Object.keys(headers).length) return headers;
  headers = {};
  // RFC-017: config-header DEFAULTS now live in the per-service manifest files the plugins wrote
  // (`.systemview/*.manifest.json` → entry.headers). Pull those first, keyed by origin.
  try {
    const { readFolderManifest } = require("./manifestStore");
    const folder = readFolderManifest(path.dirname(_manifestFile));
    if (folder && folder.headers) {
      for (const [origin, bucket] of Object.entries(folder.headers)) headers[origin] = { ...bucket };
    }
  } catch {
    /* no folder / unreadable — no config defaults */
  }
  // The session store (captured cookies + any user-authored headers) WINS over the config defaults.
  try {
    const m = JSON.parse(fs.readFileSync(_manifestFile, "utf8"));
    if (m && m.headers && typeof m.headers === "object") {
      for (const [origin, bucket] of Object.entries(m.headers)) {
        headers[origin] = { ...(headers[origin] || {}), ...bucket };
      }
    }
  } catch {
    /* no session store / unreadable — defaults only */
  }
  return headers;
}

function originOf(url) {
  try {
    return new URL(url).origin;
  } catch {
    return null;
  }
}

// "@path" → file contents (trimmed); anything else returned as-is.
function deref(value) {
  if (typeof value === "string" && value.startsWith("@")) {
    try {
      return fs.readFileSync(path.resolve(process.cwd(), value.slice(1)), "utf8").trim();
    } catch {
      return "";
    }
  }
  return value;
}

// Resolved header name→value pairs for a request URL, matched by origin.
function headersFor(url) {
  const origin = originOf(url);
  load();
  const bucket = headers[origin] || {};
  const out = {};
  for (const [name, raw] of Object.entries(bucket)) {
    const value = deref(raw);
    if (value != null && value !== "") out[name] = value;
  }
  // PURE per-origin. This is what `api/getProjects` feeds the browser to decide which services are
  // credentialed — a plain service MUST read as empty here, or the browser marks it credentialed and
  // sends withCredentials to its wildcard CORS (illegal → blocked). Project-wide cookie sharing (the
  // cross-service ride) lives only in the CLI request path (sessionCookieHeader, used by cookieClient),
  // never in what the browser sees.
  const names = Object.keys(out);
  if (names.length) note("attach:" + origin, `using ${names.length} manifest header(s) for ${origin}`);
  return out;
}

// Project-wide session cookie for the CLI request path ONLY (createCookieHttpClient), never fed to the
// browser. Saved with `--save-session -g` (global): the policy records the project's service origins and
// the captured cookie; here it rides to EXACTLY those origins — deterministic and project-scoped. This
// REPLACES the old "borrow the first Cookie in the store" guess, which leaked a cookie from an unrelated
// deployment (e.g. a localhost test cookie into a remote request).
function sessionCookieHeader(url) {
  const origin = originOf(url);
  load();
  if (headers[origin] && headers[origin].Cookie) return {}; // its own cookie rides via headersFor
  const session = readSessionPolicy();
  if (session.cookie && Array.isArray(session.origins) && session.origins.includes(origin)) {
    return { Cookie: session.cookie };
  }
  return {};
}

// Fold Set-Cookie response headers into the in-memory Cookie header for the url's origin.
function captureCookie(url, setCookieHeaders) {
  if (!setCookieHeaders || !setCookieHeaders.length) return;
  const origin = originOf(url);
  if (!origin) return;
  const store = load();
  if (!store[origin]) store[origin] = {};

  const jar = {};
  const existing = store[origin].Cookie;
  if (typeof existing === "string") {
    existing.split(";").forEach((p) => {
      const i = p.indexOf("=");
      if (i > -1) jar[p.slice(0, i).trim()] = p.slice(i + 1).trim();
    });
  }
  setCookieHeaders.forEach((h) => {
    const [pair] = h.split(";");
    const i = pair.indexOf("=");
    if (i > -1) jar[pair.slice(0, i).trim()] = pair.slice(i + 1).trim();
  });
  store[origin].Cookie = Object.entries(jar)
    .map(([k, v]) => `${k}=${v}`)
    .join("; ");
  _lastCapturedCookie = store[origin].Cookie;
  _dirty = true;
  note("cookie:" + origin, `captured cookie for ${origin}`);
}

// Persist the in-memory header store (captured cookies included) back into the manifest's
// `headers` key, preserving `services`/`projectCode`/etc. THIS is what makes a session survive
// across separate CLI invocations: a `probe` that signed in leaves its cookie for the next one,
// instead of dropping it when the process exits (the old behavior — captured, never saved). Only
// writes when something was captured (`_dirty`) and a manifest file exists to attach to.
function persist(manifestFile = _manifestFile) {
  if (!_dirty) return false;
  const store = load();
  let manifest;
  try {
    manifest = JSON.parse(fs.readFileSync(manifestFile, "utf8"));
  } catch {
    return false; // no manifest (e.g. UI-server-only run) — nothing to attach the session to
  }
  manifest.headers = store;
  // `-g` global session: stamp the just-captured cookie as the project-wide session cookie, so it rides to
  // the recorded origins on later runs (sessionCookieHeader). Only when the policy opted into `origins`.
  if (manifest.session && Array.isArray(manifest.session.origins) && _lastCapturedCookie) {
    manifest.session.cookie = _lastCapturedCookie;
  }
  try {
    fs.mkdirSync(path.dirname(manifestFile), { recursive: true });
    fs.writeFileSync(manifestFile, JSON.stringify(manifest, null, 2));
    _dirty = false;
    note("persist", `saved session to ${path.basename(manifestFile)}`);
    return true;
  } catch {
    return false;
  }
}

// The session-persistence POLICY, read from the manifest's `session` key. This is the opt-in that
// turns cross-process persistence on: a plain `probe` only saves a captured cookie when the manifest
// says so. Set it once with `connect ... --save-session` (see setSessionPolicy). Returns the policy
// object, or `{}` when there's no manifest / no policy — the safe default (probe leaves disk alone).
function readSessionPolicy(manifestFile = _manifestFile) {
  try {
    const m = JSON.parse(fs.readFileSync(manifestFile, "utf8"));
    return m && m.session && typeof m.session === "object" ? m.session : {};
  } catch {
    return {}; // no manifest / unreadable — no policy
  }
}

// Write the session-persistence policy into the manifest's `session` key (merged with any existing
// policy), preserving services/headers/etc. Saving is IMPLIED: if no manifest exists yet, bootstrap a
// minimal one holding just the policy — the rest of the system amends it afterward (`connect --save`
// adds services, `probe` folds in captured cookies). Returns the resulting policy, or null only if the
// write itself fails.
function setSessionPolicy(patch, manifestFile = _manifestFile) {
  let manifest = {};
  try {
    manifest = JSON.parse(fs.readFileSync(manifestFile, "utf8"));
  } catch {
    manifest = {}; // no manifest yet — bootstrap a minimal one
  }
  manifest.session = { ...(manifest.session || {}), ...patch };
  try {
    fs.mkdirSync(path.dirname(manifestFile), { recursive: true });
    fs.writeFileSync(manifestFile, JSON.stringify(manifest, null, 2));
    return manifest.session;
  } catch {
    return null; // write failed (e.g. permissions)
  }
}

// The live headers map — for `save` to persist. (Not dereferenced: @file pointers and
// literals are written back as authored; captured cookies are written as literal values.)
function getHeaders() {
  return load();
}

// Drain the accumulated one-time notices (for a command to print as confirmations).
function takeNotices() {
  return _notices.splice(0, _notices.length);
}

module.exports = { headersFor, sessionCookieHeader, captureCookie, getHeaders, persist, readSessionPolicy, setSessionPolicy, setManifestFile, takeNotices };
