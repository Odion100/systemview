const http = require("http");
const { HttpClient } = require("systemlynx");

module.exports = async function appIsRunning(url) {
  try {
    const res = await HttpClient.request({ url });
    return res.SystemLynxService;
  } catch (error) {
    return false;
  }
};
