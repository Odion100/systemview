const moment = require("moment");
moment.suppressDeprecationWarnings = true;
const rnb = (min, max) => Math.floor(Math.random() * (max - min + 1) + min);

const isTargetNamespace = (str) =>
  /^(?:before|main|after)Test\.Action\d+\.(?:error|results)(?:\.(?![0-9])[a-zA-Z0-9$_]+(?:\[\d\])*)*$/.test(
    str
  );
const targetValueFnRegex =
  /tv\((?:before|main|after)Test\.Action\d+\.(?:error|results)(?:\.(?![0-9])[a-zA-Z0-9$_]+(?:\[\d\])*)*\)/g;
const isTargetValueFn = (str) =>
  /^tv\((?:before|main|after)Test\.Action\d+\.(?:error|results)(?:\.(?![0-9])[a-zA-Z0-9$_]+(?:\[\d\])*)*\)$/.test(
    str
  );
const isEqualArrays = (a, b) => a.join(".") === b.join("."); //specifically for arrays of strings
const isValidNamespace = (str) => /^(?![0-9])[a-zA-Z0-9$_]+$/.test(str); //_id
const startsWithNameAndArray = (str) => /^\w+(\[\d+\])+/.test(str); //users[0]
const isNameAndArray = (str) => /^\w+(\[\d+\])+$/.test(str); //users[0]
const endsWithArrayIndex = (str) => /\w+(\[\d+\])+$/.test(str); //users[0].docs[3]...
const getLastArrayNamespace = (str) => (str.match(/(\w+(\[\d+\])+)$/) || [str])[0];

const parseIndex = (nsp) => parseInt((nsp.match(/\[(\d+)\]$/) || [null, "0"])[1]);
const replaceFirstIndex = (nsp, insert = "0") => nsp.replace(/(\[\d+\])/, `[${insert}]`);
const replaceLastIndex = (nsp, insert = "0") => nsp.replace(/(\[\d+\])$/, `[${insert}]`);

const replaceAllIndices = (nsp, insert = "0") => nsp.replace(/(\[\d+\])/g, `[${insert}]`);

const getArrayNamespaces = (str) =>
  str
    .split(/(\w+(\[\d+\])+)/)
    .filter(isNameAndArray)
    .reduce((sum, nsp) => {
      //split by indexes in case of nested arrays
      const indices = nsp.split(/(\[\d+\])/).filter((n) => n);
      const [name] = indices.splice(0, 1);
      return sum.concat(
        indices.map((index, i) => {
          return name + indices.slice(0, i + 1).join("");
        }, [])
      );
    }, []);
const switchArrayIndices = (nsp, replace) => {
  // normalize nsp and replace nsp
  const n = replaceAllIndices(nsp);
  const r = replaceAllIndices(replace);
  // match the normalized namespaces
  if (n.substr(0, r.length) === r) {
    // create new namespace by concatenating
    const n = nsp.split(".");
    const r = replace.split(".");
    n.splice(...[0, r.length, ...r]);
    return n.join(".");
  } else return nsp;
};

//separate prop names from other prop names and indices (ie. 'test.results[0][0]'...);
const mapNamespace = (nsp) =>
  nsp
    .replace(/(?:\.|\[|\])/g, " ")
    .split(" ")
    .reduce((sum, str) => sum.concat(str.trim() || []), []);

const obj = function ObjectParser(obj) {
  const parser = this || {};
  parser.parse = (map) =>
    map.reduce(([placeholder], key) => [placeholder?.[key], placeholder, key], [obj]);

  parser.valueAt = (map) => parser.parse(map)[0];

  parser.valueAtNsp = (nsp) => parser.valueAt(mapNamespace(nsp));

  parser.parseNsp = (nsp) => parser.parse(mapNamespace(nsp));
  //using JSON to create a deep copy in order to lose refs to original
  parser.clone = () => JSON.parse(JSON.stringify(obj));

  parser.isEmpty = () => Object.getOwnPropertyNames(obj).length === 0;

  return parser;
};

const arr = function ArrayParser(arr) {
  const parser = this || {};

  parser.randomIndex = () => rnb(0, arr.length - 1);

  parser.randomItem = () => arr[parser.randomIndex()];
  return parser;
};

const isFn = /^\w+\(([^,)]*(,[^,)]*)*)\)$/;
const parseArgs = (str) => str.split(",").map((value) => value.trim());
const isFunction = (str) => isFn.test(str);
const isDateFunction = (str) => /^[dD]ate\(([^,)]*(,[^,)]*)*)\)$/.test(str);

const strFn = (str) => {
  if (isDateFunction(str)) {
    const [fullStr, args] = str.match(isFn);
    return moment(args).toJSON();
  }

  return str;
};
function getType(value) {
  switch (true) {
    case typeof value === "object":
      if (!value) return "null";
      else if (Array.isArray(value)) return "array";
      else return "object";
    case typeof value === "string":
      if (moment(value).isValid()) return "date";
      else return "string";
    case typeof value === "number":
      return "number";
    case typeof value === "boolean":
      return "boolean";
    case typeof value === "undefined":
      return "undefined";
    default:
      return "?";
  }
}
const isObjectLike = (value) =>
  ["object", "array", "string"].indexOf(getType(value)) > -1;
module.exports = {
  rnb,
  isObjectLike,
  isTargetNamespace,
  targetValueFnRegex,
  isTargetValueFn,
  isEqualArrays,
  isValidNamespace,
  startsWithNameAndArray,
  isNameAndArray,
  endsWithArrayIndex,
  getLastArrayNamespace,
  parseIndex,
  replaceFirstIndex,
  replaceLastIndex,
  replaceAllIndices,
  getArrayNamespaces,
  switchArrayIndices,
  mapNamespace,
  obj,
  arr,
  isFunction,
  isDateFunction,
  strFn,
  getType,
};
