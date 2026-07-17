const express = require("express");

// SameSite=None; Secure is what a real cross-origin session cookie needs so the browser stores AND
// re-sends it on credentialed cross-origin requests. Chrome treats http://localhost as a secure
// context, so `Secure` is honored over http here. (The CLI jar ignores these attributes.)
const SET_COOKIE = "session=test-session-value; HttpOnly; Path=/; SameSite=None; Secure";

// A credentialed CORS server: reflects the request origin (never `*` — illegal with credentials),
// allows credentials, and reflects the requested headers so any manifest-declared custom header passes.
// Handing this to createApp() makes SystemLynx skip its default wildcard (Server.js `!customServer`
// gate). CORS is a per-service concern — a service declares which origins/headers/credentials it accepts.
function credentialedServer() {
  const server = express();
  server.use((req, res, next) => {
    const origin = req.headers.origin;
    if (origin) res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Access-Control-Allow-Credentials", "true");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
    res.setHeader(
      "Access-Control-Allow-Headers",
      req.headers["access-control-request-headers"] || "Content-Type, Authorization, X-Requested-With"
    );
    if (req.method === "OPTIONS") return res.sendStatus(204);
    next();
  });
  return server;
}

const setSessionCookie = (req, res, next) => {
  res.set("Set-Cookie", SET_COOKIE);
  next();
};
const captureCookie = (auth) => (req, res, next) => {
  auth._state._lastCookie = req.headers.cookie || "";
  next();
};

module.exports = { credentialedServer, setSessionCookie, captureCookie, SET_COOKIE };
