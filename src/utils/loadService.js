import { Client, markCredentialed } from "../systemClient";
import { HOST_MARK, hostBackedPlugin } from "./hostProject";
import { serviceClient } from "../shared/serviceClient";

// A CLIENT THAT AGREES WITH THE REGISTRY, OR THE BEST ONE AVAILABLE — never an exception.
//
// The shared door THROWS when a rebuild does not reconcile the two surfaces, which is right for a
// probe: one method was asked for and the record is wrong. It is wrong here, because this is called
// from render paths — a file embed, a chart, a run block — and a throw there is a blank area with no
// reason in it. By the time it throws, the rebuild has already happened and been re-cached, so
// asking the client again hands back the REBUILT instance; the real mismatch then arrives as the one
// method failing, where the caller can say which.
function rebuilt(connectionData) {
  try {
    return serviceClient(Client, connectionData, {
      onRebuild: ({ serviceUrl, was, now }) =>
        console.warn(
          `[systemview] rebuilt the client for ${serviceUrl} — it was missing ${was.join(", ")}` +
            (now.length ? `; still missing ${now.join(", ")}` : ""),
        ),
    });
  } catch (err) {
    console.warn(`[systemview] ${(err && err.message) || err}`);
    return Client.createService(connectionData);
  }
}

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
  // THE CLIENT IS REBUILT WHEN IT DISAGREES WITH THE REGISTRY, and this window is exactly the
  // process that needs it: it swaps its own bundle in place rather than reloading, so the client it
  // built on the day it opened is the client it still holds. A service that gains a method after
  // that leaves every block here calling a function that is not there — `o[a] is not a function`,
  // which reads as the service being broken.
  //
  // It never throws, unlike the hub's probe path. This is called from render paths (file embeds,
  // charts, run blocks), so a genuine registry mismatch has to arrive as the method failing where
  // the caller can report it, not as a blank block.
  const service = rebuilt(connectionData);
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
