import loadServiceWithHeaders from "./loadService";
import { sendsCredentials, __resetCredentialed } from "../systemClient";

// WHICH ORIGINS MAY RECEIVE A SESSION COOKIE — the rule RFC-013 changed, and until now the only
// rule in this app with that much consequence and no claims at all.
//
// WHY IT MATTERS (gaps/BROWSER_WITHCREDENTIALS_TIED_TO_HEADERS_BREAKS_COOKIE_AUTH): a browser can
// only receive a `Set-Cookie` from a cross-origin response if the request itself carried
// `withCredentials`, so an origin that is not marked can never sign in — every gated call 401s. And
// the other direction is just as absolute: `withCredentials` against a service with wildcard CORS
// (`Access-Control-Allow-Origin: *`) is ILLEGAL and the browser blocks the response, so marking
// everything would break every plain service. The rule has to be exactly right in both directions,
// which is what these claims are for.
//
// `Client.createService` is mocked: this is about the marking decision, not about systemlynx.
jest.mock("systemlynx-client", () => ({
  createClient: () => ({
    createService: () => ({ setHeaders: jest.fn() }),
  }),
}));

const SERVICE = (url) => ({ serviceUrl: url });

describe("a service's origin is credentialed only when it says so", () => {
  beforeEach(() => __resetCredentialed());

  it("a plain service is NOT credentialed — wildcard CORS plus credentials is blocked by the browser", () => {
    loadServiceWithHeaders(SERVICE("https://plain.example:4000/api"), {}, false);
    expect(sendsCredentials("https://plain.example:4000/api")).toBe(false);
  });

  // The pre-RFC-013 rule, kept: a declared header profile still implies a credentialed service.
  it("a declared header profile marks it", () => {
    loadServiceWithHeaders(SERVICE("https://gated.example:4100/api"), { "Internal-Access": "jwt" }, undefined);
    expect(sendsCredentials("https://gated.example:4100/api")).toBe(true);
  });

  // RFC-013, and the whole point of the gap: a cookie-authenticated service declares NO headers, so
  // the header rule can never mark it. The flag is the only signal it has.
  it("`credentials: true` marks a service that declares NO headers — the cookie-only case", () => {
    loadServiceWithHeaders(SERVICE("https://cookies.example:4200/api"), {}, true);
    expect(sendsCredentials("https://cookies.example:4200/api")).toBe(true);
  });

  it("the marking is per ORIGIN, so every path on that host is covered by one load", () => {
    loadServiceWithHeaders(SERVICE("https://api.example:4300/bu/api/profiles"), {}, true);
    expect(sendsCredentials("https://api.example:4300/anything/else")).toBe(true);
  });

  // A credentialed origin must not leak across port or scheme — those are different origins to the
  // browser, and marking by host would send a cookie somewhere it was never granted.
  it("a different port or scheme is a DIFFERENT origin and stays unmarked", () => {
    loadServiceWithHeaders(SERVICE("https://api.example:4400/api"), {}, true);
    expect(sendsCredentials("https://api.example:4401/api")).toBe(false);
    expect(sendsCredentials("http://api.example:4400/api")).toBe(false);
  });

  it("an unparseable or missing URL answers false instead of throwing", () => {
    expect(sendsCredentials("not a url")).toBe(false);
    expect(sendsCredentials(undefined)).toBe(false);
    expect(() => loadServiceWithHeaders(SERVICE(undefined), {}, true)).not.toThrow();
  });

  it("marking one service does not credential another project's origin", () => {
    loadServiceWithHeaders(SERVICE("https://mine.example:4500/api"), {}, true);
    loadServiceWithHeaders(SERVICE("https://theirs.example:4600/api"), {}, false);
    expect(sendsCredentials("https://mine.example:4500/api")).toBe(true);
    expect(sendsCredentials("https://theirs.example:4600/api")).toBe(false);
  });

  // A folder registered with the browser is not a service at all (RFC-047) — it must never reach
  // the client or mark an origin.
  it("a host-backed folder never marks anything", () => {
    const folder = { __hostFiles: { projectCode: "p", root: "/tmp/p" }, serviceUrl: "https://nope.example/api" };
    const svc = loadServiceWithHeaders(folder, {}, true);
    expect(svc.Plugin).toBeDefined();
    expect(sendsCredentials("https://nope.example/api")).toBe(false);
  });
});
