import { Client, markCredentialed } from "../systemClient";

// Load a service client with its auth headers attached.
//
// The browser has no filesystem, so it can't resolve the manifest's `@file` header pointers — the
// API does that server-side and feeds already-resolved values with each service entry (getProjects).
// Here we just `setHeaders` on the loaded service; systemlynx-client applies them at the service
// level, so every module call (test run, log fetch, probe, docs) carries them. Without this the UI
// cannot reach a gated service. Services are cached by URL in the client, so the headers stick.
//
// A non-empty header profile means the service is credentialed (see systemClient) — mark its origin
// so the browser sends `withCredentials` (session cookie) to it. Plain services (no headers) stay
// credential-less so they keep working on the default wildcard CORS.
//
// `credentials` (RFC-013) is the cookie-only declaration: a service that authenticates via session
// cookies declares NO headers, so the header-profile rule can never mark it — its plugin registers
// `credentials: true` instead, and that flag arrives here via getProjects.
export default function loadServiceWithHeaders(connectionData, headers, credentials) {
  const service = Client.createService(connectionData);
  if (
    service &&
    typeof service.setHeaders === "function" &&
    headers &&
    Object.keys(headers).length
  ) {
    service.setHeaders(headers);
    markCredentialed(connectionData.serviceUrl);
  }
  if (credentials) markCredentialed(connectionData.serviceUrl);
  return service;
}
