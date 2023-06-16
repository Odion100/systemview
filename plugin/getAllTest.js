const fs = require("fs");
const path = require("path");

module.exports = function getFilesByNamespace(folder, namespace) {
  const files = fs.readdirSync(folder); // read the contents of the current directory
  const namespacePattern = namespace
    ? new RegExp(`^${namespace}\\..+\\.json$`)
    : /\.json$/;

  return files
    .filter((file) => namespacePattern.test(file))
    .reduce((sum, file) => {
      const filePath = path.join(folder, file);
      const fileContents = fs.readFileSync(filePath, "utf-8");
      const parsedData = JSON.parse(fileContents);

      return sum.concat(parsedData);
    }, []);
};

// no namespace passed, return all files
