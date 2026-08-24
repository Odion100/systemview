import { Client, markCredentialed } from "../systemClient";
import { HOST_MARK, hostBackedPlugin } from "./hostProject";

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
  // A FOLDER IS NOT A SERVICE, but every surface asks for one. RFC-047: a project registered with
  // the browser answers here with a Plugin backed by `window.systemview.files` — no HTTP, no
  // SystemLynx, no plugin installed in anything. The marker is set by `hostProjectEntry`, so this
  // can never fire for a real service.
  if (connectionData && connectionData[HOST_MARK])
    return { Plugin: hostBackedPlugin(connectionData[HOST_MARK]) };
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
