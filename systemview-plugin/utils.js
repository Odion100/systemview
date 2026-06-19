const fs = require("fs");
const path = require("path");

function deleteFile(fileName) {
  try {
    console.log(fileName);
    fs.unlinkSync(fileName);
  } catch (err) {
    // console.error(err);
  }
}
function getFile(fileName) {
  try {
    return fs.readFileSync(fileName, "utf8");
  } catch (error) {
    // console.log(error);
  }
}
function ensureDir(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function getName({ serviceId, moduleName, methodName }) {
  if (methodName) return `${moduleName}.${methodName}`;
  else if (moduleName) return moduleName;
  else if (serviceId) return serviceId;
}

function getFilesByNamespace(folder, namespace) {
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
}

function ensureDir(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

const getSpecList = (specs) => {
  ensureDir(`${specs}/docs/`);
  ensureDir(`${specs}/tests/`);
  return {
    docs: fs.readdirSync(`${specs}/docs/`),
    tests: fs.readdirSync(`${specs}/tests/`),
  };
};

module.exports = {
  deleteFile,
  getFile,
  getName,
  getFilesByNamespace,
  getSpecList,
  ensureDir,
};
