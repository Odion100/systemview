import { createClient } from "systemlynx-client";
import axios from "axios";
import FormData from "form-data";

// SystemView's own browser SystemLynx client — the default systemlynx-client HTTP client passed into
// `createClient(...)` (same pattern as the CLI's `createCookieHttpClient`), with `withCredentials`
// decided PER SERVICE, systematically.
//
// The rule (not a heuristic): a service is CREDENTIALED when it declares an auth header profile in the
// manifest (a token, a captured session cookie, etc.). Such a service is set up to accept credentialed
// cross-origin requests (its CORS reflects the origin + allows credentials — `*` is illegal with
// credentials). We turn `withCredentials` ON for those origins so the browser sends/receives the
// session cookie; PLAIN services (no declared headers, default wildcard CORS) stay credential-less so
// they keep working. Origins are marked once, at load time (loadServiceWithHeaders), keyed by origin —
// we never sniff an individual request's headers to guess.
const credentialedOrigins = new Set();

function originOf(url) {
  try {
    return new URL(url).origin;
  } catch {
    return null;
  }
}

// Called by loadServiceWithHeaders when a service is loaded WITH a declared header profile.
export function markCredentialed(url) {
  const origin = originOf(url);
  if (origin) credentialedOrigins.add(origin);
}

function sendsCredentials(url) {
  return credentialedOrigins.has(originOf(url));
}

function createBrowserHttpClient() {
  const http = {};
  http.request = async ({ method = "get", url, body: data, headers }) => {
    method = method.toLowerCase();
    try {
      const res = await axios({ url, method, headers, data, withCredentials: sendsCredentials(url) });
      if (res.status >= 400) throw res.data;
      return res.data;
    } catch (error) {
      if (!error.isAxiosError) throw error;
      if (!error.response) throw error;
      if (!error.response.data) throw error;
      throw error.response.data;
    }
  };
  http.upload = async ({ url, formData, headers }) => {
    const { file, files, __arguments } = formData;
    const form = new FormData();
    if (file) form.append("file", file, file.name);
    if (files) files.forEach((f) => form.append("files", f, f.name));
    if (__arguments) form.append("__arguments", JSON.stringify(__arguments));
    try {
      const res = await axios.post(url, form, {
        headers: { ...headers, "Content-Type": "multipart/form-data" },
        withCredentials: sendsCredentials(url),
      });
      if (res.status >= 400) throw res.data;
      return res.data;
    } catch (error) {
      if (!error.isAxiosError) throw error;
      if (!error.response) throw error;
      if (!error.response.data) throw error;
      throw error.response.data;
    }
  };
  return http;
}

const Client = createClient(createBrowserHttpClient());

export { Client };
export default Client;
