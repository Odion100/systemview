// Manifest-backed request headers (RFC-010 Phase 1).
//
// Headers live in the manifest, indexed by URL origin. Each value is either a literal
// ("Bearer abc") or a file-pointer ("@./token") that keeps the secret out of the manifest.
// Cookies are just the "Cookie" header — a captured Set-Cookie folds into the same store.
//
// Read on load, written only on `save`. This module holds the manifest's `headers` in
// memory for the life of the CLI process (shared across every command via Node's module
// cache), so a cookie captured by one request is re-sent by the next, and `save` persists
// whatever accumulated.

const fs = require("fs");
const path = require("path");

const MANIFEST_FILE = path.join(process.cwd(), "systemview.manifest.json");

// { "<origin>": { "Header-Name": "value" | "@file", "Cookie": "a=1; b=2" } }
// This is the ONLY header store — user-authored, indexed by service URL origin. The plugin never
// writes headers; there is no separate project-level default (the old `probeHeaders` is gone).
let headers = null;

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
  try {
    const m = JSON.parse(fs.readFileSync(MANIFEST_FILE, "utf8"));
    if (m && m.headers && typeof m.headers === "object") headers = m.headers;
  } catch {
    /* no manifest / unreadable — start empty */
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
  const names = Object.keys(out);
  if (names.length) note("attach:" + origin, `using ${names.length} manifest header(s) for ${origin}`);
  return out;
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
  note("cookie:" + origin, `captured cookie for ${origin}`);
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

module.exports = { headersFor, captureCookie, getHeaders, takeNotices, MANIFEST_FILE };
