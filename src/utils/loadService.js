import { Client } from "systemlynx-client";

// Load a service client with its auth headers attached.
//
// The browser has no filesystem, so it can't resolve the manifest's `@file` header pointers — the
// API does that server-side and feeds already-resolved values with each service entry (getProjects).
// Here we just `setHeaders` on the loaded service; systemlynx-client applies them at the service
// level, so every module call (test run, log fetch, probe, docs) carries them. Without this the UI
// cannot reach a gated service. Services are cached by URL in the client, so the headers stick.
export default function loadServiceWithHeaders(connectionData, headers) {
  const service = Client.createService(connectionData);
  if (
    service &&
    typeof service.setHeaders === "function" &&
    headers &&
    Object.keys(headers).length
  ) {
    service.setHeaders(headers);
  }
  return service;
}
