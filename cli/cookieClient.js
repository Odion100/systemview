const axios = require("axios").default;
const FormData = require("form-data");
const fs = require("fs");
const path = require("path");
const { createClient } = require("systemlynx");

const COOKIE_FILE = path.resolve(process.cwd(), "systemview.cookies.json");

function readCookies() {
  try {
    return JSON.parse(fs.readFileSync(COOKIE_FILE, "utf8"));
  } catch {
    return {};
  }
}

function captureCookies(setCookieHeaders) {
  if (!setCookieHeaders || !setCookieHeaders.length) return;
  const existing = readCookies();
  let changed = false;
  setCookieHeaders.forEach((header) => {
    const [pair] = header.split(";");
    const eqIdx = pair.indexOf("=");
    if (eqIdx === -1) return;
    const name = pair.slice(0, eqIdx).trim();
    const value = pair.slice(eqIdx + 1).trim();
    if (name) {
      existing[name] = value;
      changed = true;
    }
  });
  if (changed) fs.writeFileSync(COOKIE_FILE, JSON.stringify(existing, null, 2));
}

function cookieHeader() {
  const cookies = readCookies();
  const pairs = Object.entries(cookies)
    .map(([k, v]) => `${k}=${v}`)
    .join("; ");
  return pairs || null;
}

function createCookieHttpClient(extraHeaders = {}) {
  return {
    request: async ({ method = "get", url, body: data, headers }) => {
      method = method.toLowerCase();
      const cookie = cookieHeader();
      headers = { ...headers, ...extraHeaders };
      if (cookie) headers.Cookie = cookie;
      try {
        const res = await axios({ url, method, headers, data });
        captureCookies(res.headers["set-cookie"]);
        if (res.status >= 400) throw res.data;
        return res.data;
      } catch (error) {
        if (!error.isAxiosError) throw error;
        if (!error.response) throw error;
        if (!error.response.data) throw error;
        throw error.response.data;
      }
    },
    upload: async ({ url, formData, headers }) => {
      const { file, files, __arguments } = formData;
      const form = new FormData();
      if (file) form.append("file", file, path.basename(file.path));
      if (files) files.forEach((f) => form.append("files", f, path.basename(f.path)));
      if (__arguments) form.append("__arguments", JSON.stringify(__arguments));
      const cookie = cookieHeader();
      const allHeaders = {
        ...extraHeaders,
        ...(cookie ? { Cookie: cookie } : {}),
        ...headers,
        "Content-Type": "multipart/form-data",
      };
      try {
        const res = await axios.post(url, form, { headers: allHeaders });
        captureCookies(res.headers["set-cookie"]);
        if (res.status >= 400) throw res.data;
        return res.data;
      } catch (error) {
        if (!error.isAxiosError) throw error;
        if (!error.response) throw error;
        if (!error.response.data) throw error;
        throw error.response.data;
      }
    },
  };
}

module.exports = {
  createCookieHttpClient,
  createCookieClient: (extraHeaders = {}) => createClient(createCookieHttpClient(extraHeaders)),
};
