const alert = require("cli-alerts");

module.exports = (info) => {
  alert({
    type: `info`,
    name: `SystemView`,
    msg: ``,
  });

  console.log(info);
};
