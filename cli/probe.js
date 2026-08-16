const fs = require("fs");
const path = require("path");
const { createClient } = require("systemlynx");
const { createCookieHttpClient } = require("./cookieClient");
const { takeNotices, persist, readSessionPolicy, setSessionPolicy, setManifestFile } = require("./manifestHeaders");
const { matchNamespace, nsEquals } = require("./utils/matchNamespace");
const log = require("./logger");

const cookieHttpClient = createCookieHttpClient();
const Client = createClient(cookieHttpClient);

module.exports = async function probe(namespace, argsStr, { json = false, manifest: manifestPath, headers: cliHeaders = {}, uiUrl, saveSession = false, global = false } = {}) {
  if (!namespace) {
    log.error("Usage: systemview probe <ServiceId.Module.method> [args]");
    return 1;
  }

  // `projectCode:` prefix scopes the (fuzzy) resolution to ONE project — needed when the same service is
  // connected under multiple project codes. The namespace after it can be fuzzy: `buAPI-prod:signIn` works,
  // as does the full `buAPI-prod:Profiles.Users.signIn`. No colon → resolve across all connected services.
  const colon = namespace.indexOf(":");
  const scope = colon > -1 ? namespace.slice(0, colon).trim() : null;
  const nsInput = (colon > -1 ? namespace.slice(colon + 1) : namespace).trim();

  let args = [];
  if (argsStr) {
    try {
      const parsed = JSON.parse(argsStr);
      args = Array.isArray(parsed) ? parsed : [parsed];
    } catch {
      args = [argsStr];
    }
  }
  // "$now" anywhere in the args → a fresh ISO timestamp at send time; "$now+1500" / "$now-45000"
  // offsets in ms. Lets interactive-console commands (no shell substitution available) send
  // time-stamped payloads without hand-editing a literal timestamp every run.
  const stampNow = (v) => {
    if (typeof v === "string" && v.startsWith("$now"))
      return new Date(Date.now() + (Number(v.slice(4)) || 0)).toISOString();
    if (Array.isArray(v)) return v.map(stampNow);
    if (v && typeof v === "object")
      return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, stampNow(x)]));
    return v;
  };
  args = stampNow(args);

  // Repoint the WHOLE header store at an explicit --manifest <path> up front — so the cookie is both
  // persisted to AND re-attached from the same manifest (load/capture/persist/policy all share it).
  // No-op without --manifest (stays on the cwd manifest). Must run before any service call below.
  const manifestFile = setManifestFile(manifestPath);

  // Gather candidate services (UI first, then the manifest), each tagged with its projectCode.
  let candidates = [];
  if (uiUrl) {
    try {
      const { SystemView } = await Client.loadService(`${uiUrl}/systemview/api`);
      const projects = await SystemView.getProjects();
      candidates = Object.entries(projects).flatMap(([projectCode, svcs]) => svcs.map((s) => ({ ...s, projectCode })));
    } catch {}
  }
  if (!candidates.length && fs.existsSync(manifestFile)) {
    try {
      const manifest = JSON.parse(fs.readFileSync(manifestFile, "utf8"));
      candidates = (manifest.services || [manifest]).map((s) => ({ ...s, projectCode: s.projectCode || manifest.projectCode }));
    } catch (err) {
      log.error(`Failed to read manifest: ${err.message}`);
      return 1;
    }
  }

  // Fuzzy-match nsInput against every Service.Module.method in the (project-scoped) pool, KEEPING the
  // matched service so we can call it. Must resolve to exactly one method — ambiguity is reported, not guessed.
  const pool = scope ? candidates.filter((s) => nsEquals(s.projectCode, scope)) : candidates;
  let hits = [];
  for (const svc of pool) {
    const modules = (svc.system && svc.system.connectionData && svc.system.connectionData.modules) || [];
    for (const { name: mod, methods = [] } of modules) {
      for (const { fn } of methods) {
        if (matchNamespace(`${svc.serviceId}.${mod}.${fn}`, nsInput)) {
          hits.push({ service: svc, serviceId: svc.serviceId, moduleName: mod, methodName: fn, projectCode: svc.projectCode });
        }
      }
    }
  }

  // EXACT BEATS SUBSTRING. The match is a substring test, so `Test.Plugin.readFile` also "matched"
  // `Test.Plugin.readFileRaw` and asking for a method by its own full name came back ambiguous
  // against its longer sibling — with no spelling that could get you out of it. When something
  // matches exactly, the fuzzy neighbours aren't candidates at all.
  if (hits.length > 1) {
    const want = String(nsInput);
    const exact = hits.filter((h) => {
      const full = `${h.serviceId}.${h.moduleName}.${h.methodName}`;
      return nsEquals(full, want) || nsEquals(full.slice(-(want.length + 1)), `.${want}`);
    });
    if (exact.length) hits = exact;
  }

  if (hits.length === 0) {
    const msg = `No method matching "${nsInput}"${scope ? ` in project "${scope}"` : ""} found`;
    if (json) process.stdout.write(JSON.stringify({ namespace, error: msg }, null, 2) + "\n");
    else log.error(`${msg}. Connect it first with: systemview connect <url>`);
    return 1;
  }
  if (hits.length > 1) {
    const matches = hits.map((h) => `${h.projectCode}:${h.serviceId}.${h.moduleName}.${h.methodName}`);
    const msg = `"${nsInput}" is ambiguous — narrow it with a "projectCode:" prefix or the full Service.Module.method`;
    if (json) process.stdout.write(JSON.stringify({ namespace, error: msg, matches }, null, 2) + "\n");
    else log.error(`"${nsInput}" is ambiguous — matches:\n${matches.slice(0, 8).map((m) => "    " + m).join("\n")}\n  Narrow it: add the "projectCode:" prefix, or use the full Service.Module.method.`);
    return 1;
  }
  const { service, serviceId, moduleName, methodName } = hits[0];

  // `--save-session` (opt-in) persists this call's captured cookie so the next process reuses it. `-g`
  // (--global) makes it PROJECT-WIDE: record THIS project's service origins now, so the cookie is applied
  // to all of them deterministically on later requests — no borrowing the first cookie in the store.
  if (saveSession) {
    const policy = { save: true };
    if (global) {
      policy.origins = [
        ...new Set(
          candidates
            .filter((c) => c.projectCode === service.projectCode)
            .map((c) => { try { return new URL(c.system.connectionData.serviceUrl).origin; } catch { return null; } })
            .filter(Boolean),
        ),
      ];
    }
    setSessionPolicy(policy, manifestFile);
  }

  if (!json) log.info(`${service.projectCode}:${serviceId}.${moduleName}.${methodName}(${argsStr || ""})`);

  try {
    const client = Client.createService(service.system.connectionData);
    if (Object.keys(cliHeaders).length) client.setHeaders(cliHeaders);
    const result = await client[moduleName][methodName](...args);
    // Persist any session captured on this call (e.g. a sign-in's Set-Cookie) so the NEXT probe
    // reuses it — the fix for "captured but never saved," which forced sessions to die per-process.
    // Gated by the manifest's opt-in `session.save` policy (set via `connect ... --save-session`);
    // without it, a read-only or one-off probe leaves the manifest untouched (the safe default).
    if (readSessionPolicy(manifestFile).save) persist(manifestFile);
    if (json) {
      process.stdout.write(JSON.stringify({ serviceId, moduleName, methodName, args, result }, null, 2) + "\n");
    } else {
      log.success("result:");
      console.log(JSON.stringify(result, null, 2));
      takeNotices().forEach((n) => log.info(n));
    }
    return 0;
  } catch (err) {
    if (json) {
      process.stdout.write(JSON.stringify({ serviceId, moduleName, methodName, args, error: err.message }, null, 2) + "\n");
    } else {
      log.error(err.message);
      takeNotices().forEach((n) => log.info(n));
    }
    return 1;
  }
};
