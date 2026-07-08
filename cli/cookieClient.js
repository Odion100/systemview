const axios = require("axios").default;
const FormData = require("form-data");
const path = require("path");
const { headersFor, captureCookie } = require("./manifestHeaders");

// HTTP client for the SystemLynx CLI. Per request it attaches the manifest's headers for
// the target origin (auth tokens, cookies, any scheme — see manifestHeaders.js) and folds
// any Set-Cookie response back into that store. `extraHeaders` (e.g. --header flags) win on
// conflict. Cookies + tokens now live in the manifest; there is no separate cookie jar.

function createCookieHttpClient(extraHeaders = {}) {
  return {
    request: async ({ method = "get", url, body: data, headers }) => {
      method = method.toLowerCase();
      // Manifest headers are the base/default; caller-set headers (systemlynx setHeaders, i.e. the
      // CLI `--header` flag) and constructor extraHeaders override them by name. (Matches the upload
      // path below — the request path previously had these flipped, letting the manifest win over
      // an explicit --header.)
      headers = { ...headersFor(url), ...headers, ...extraHeaders };
      try {
        const res = await axios({ url, method, headers, data });
        captureCookie(url, res.headers["set-cookie"]);
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
      const allHeaders = {
        ...headersFor(url),
        ...headers,
        ...extraHeaders,
        "Content-Type": "multipart/form-data",
      };
      try {
        const res = await axios.post(url, form, { headers: allHeaders });
        captureCookie(url, res.headers["set-cookie"]);
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

module.exports = { createCookieHttpClient };
