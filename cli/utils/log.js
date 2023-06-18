const alert = require("cli-alerts");

module.exports = (msg, type = "info", name = "SystemView") => {
  alert({ type, name, msg });
};
