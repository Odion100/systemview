const runTests = require("./runTests");
const cli = require("./utils/cli");

const readline = require("readline");

module.exports = function startLineReader(shutdown) {
  const lineReader = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  const handleInput = (input = "") => {
    const [command, argument] = input.split(" ").map((s) => s.trim());
    if (["exit", "q"].includes(command)) {
      shutdown();
      lineReader.close();
    } else if (command === "test") {
      runTests(argument);
    } else if (command === "help") {
      cli.showHelp(0);
    }
    lineReader.prompt();
  };

  lineReader.prompt();
  lineReader.on("line", handleInput);
  lineReader.on("close", shutdown);
};
