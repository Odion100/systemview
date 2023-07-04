const runTests = require("./runTests");
const cli = require("./utils/cli");
const openBrowser = require("./openBrowser");
const readline = require("readline");

module.exports = function startLineReader(url) {
  const lineReader = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  const handleInput = (input = "") => {
    const args = input.split(" ").map((s) => s.trim());
    const command = args.shift();
    if (["exit", "q", "shutdown", "stop"].includes(command)) {
      process.exit(0);
    } else if (command === "test") {
      try {
        runTests(url, ...args);
      } catch (error) {
        console.error("Error executing tests:", error.message);
      }
    } else if (command === "help") {
      cli.showHelp(0);
    } else if (command === "open") {
      openBrowser(url, ...args);
    }
    lineReader.prompt();
  };

  lineReader.prompt();
  lineReader.on("line", handleInput);
  lineReader.on("close", () => process.exit(0));
  return lineReader;
};
