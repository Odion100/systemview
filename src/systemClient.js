import { createClient } from "systemlynx-client";
import axios from "axios";
import FormData from "form-data";

// SystemView's own browser SystemLynx client. It's the default systemlynx-client HTTP client plus
// `withCredentials: true`, passed into `createClient(...)` — the same pattern the CLI uses with
// `createCookieHttpClient`. This keeps the cookie behavior in SystemView's own source (no edit to the
// systemlynx-client package). `withCredentials` makes the browser send AND receive the session cookie
// cross-origin, so a signed-in identity survives across calls (pairs with credentialed CORS on the
// server, which must reflect the Origin — `*` is illegal with credentials).
function createBrowserHttpClient() {
  const http = {};
  http.request = async ({ method = "get", url, body: data, headers }) => {
    method = method.toLowerCase();
    try {
      const res = await axios({ url, method, headers, data, withCredentials: true });
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
        withCredentials: true,
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
