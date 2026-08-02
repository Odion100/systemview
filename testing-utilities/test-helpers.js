const moment = require("moment");
const createMockFile = require("./createMockFile");
moment.suppressDeprecationWarnings = true;
const rnb = (min, max) => Math.floor(Math.random() * (max - min + 1) + min);

// A target-value reference — two grammars, both resolved by Argument.getTargetValue (RFC-020):
//   legacy positional — beforeTest.Action1.error   (kept for back-compat; mirrors the UI "Section → Action N" labels)
//   natural path      — test.before[0].results / test.before.signIn.results / test.main[2].results.userId
// The TAIL (nested fields / array indices reaching into the result) is shared by both.
const TV_TAIL = `(?:\\[(?:\\d+)\\]|\\.(?:(?![0-9])[a-zA-Z0-9$_]+(?:\\[(?:\\d+)\\])?))*`;
const TV_LEGACY = `(?:before|main|after)Test\\.Action\\d+\\.(?:error|results)${TV_TAIL}`;
// natural: a `test.` root, then a section (before|main|events|after) OR a named-action name, then a step by
// [index] OR .name, then the field. The head token is any identifier so `test.signIn[1].results` — a named
// action addressed in its OWN local index space — parses alongside `test.before[0].results`.
const TV_NATURAL = `test\\.(?![0-9])[a-zA-Z0-9$_]+(?:\\[\\d+\\]|\\.(?![0-9])[a-zA-Z0-9$_]+)\\.(?:error|results)${TV_TAIL}`;
const TV_BODY = `(?:${TV_LEGACY}|${TV_NATURAL})`;
const isTargetNamespace = (str) => new RegExp(`^${TV_BODY}$`).test(str);
const targetValueFnRegex = new RegExp(`tv\\(${TV_BODY}\\)`, "g");
const isTargetValueFn = (str) => new RegExp(`^tv\\(${TV_BODY}\\)$`).test(str);
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
const mapNamespace = (nsp) => nsp.split(/(?:\.|\[|\])/g).filter((str) => str.trim());

const obj = function ObjectParser(obj) {
  const parser = this || {};
  const parseObject = (keys) =>
    keys.reduce(([placeholder], key) => [placeholder?.[key], placeholder, key], [obj]);

  parser.parse = (keys) => {
    if (Array.isArray(keys)) {
      return parseObject(keys);
    } else if (typeof keys === "string") {
      return parseObject(mapNamespace(keys));
    } else
      throw Error(
        "ObjectParser.parse requires a string namespace or an array of keys a the first parameter."
      );
  };

  parser.get = (keys) => {
    if (Array.isArray(keys)) {
      return parseObject(keys)[0];
    } else if (typeof keys === "string") {
      return parseObject(mapNamespace(keys))[0];
    } else
      throw Error(
        "ObjectParser.get requires a string namespace or an array of keys a the first parameter."
      );
  };

  parser.apply = (keys, newValue) => {
    if (Array.isArray(keys)) {
      const [currentValue, placeholder, key] = parseObject(keys);
      placeholder[key] = newValue;
    } else if (typeof keys === "string") {
      const [currentValue, placeholder, key] = parseObject(mapNamespace(keys));
      placeholder[key] = newValue;
    } else
      throw Error(
        "ObjectParser.apply requires a string namespace or an array of keys a the first parameter."
      );
  };
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

const isFnRegEx = /^\w+\(([^,)]*(,[^,)]*)*)\)$/;
const parseArgs = (str) => str.split(",").map((value) => value.trim());
const isFunction = (str) => isFnRegEx.test(str);
const isDateFunction = (str) => /^[dD]ate\(([^,)]*(,[^,)]*)*)\)$/.test(str);
const isMockFileFunction = (str) => /^mockFile\(([^,)]*(,[^,)]*)*)\)$/.test(str);
// random(n) — n random lowercase-alphanumeric chars (default 8), fresh on EVERY run. Unlike date()/
// mockFile() it's insertable ANYWHERE inside a string — "user_random(6)@test.com" → "user_k3n9x2@test.com"
// — because its whole point is unique usernames/emails in reusable sections and repeated test runs.
const randomTokenRegex = /random\((\d*)\)/g;
const hasRandomToken = (str) => typeof str === "string" && /random\(\d*\)/.test(str);
const randomString = (len) => {
  let out = "";
  while (out.length < len) out += Math.random().toString(36).slice(2);
  return out.slice(0, len);
};
const strFn = (str) => {
  if (hasRandomToken(str))
    return str.replace(randomTokenRegex, (_, n) => randomString(parseInt(n || "8", 10)));
  if (isDateFunction(str)) {
    const [fullStr, args] = str.match(isFnRegEx);
    return moment(args).toJSON();
  }
  if (isMockFileFunction(str)) {
    const [fullStr, args] = str.match(isFnRegEx);
    return createMockFile(args);
  }
  return str;
};

// RFC-020 — the ONE resolver for a target-value reference (an arg targetValue OR an evaluation `tv()`).
// FullTest is the **sections object** `{ before:[…], main:[…], …, <named>:[…] }`. A reference IS an object
// path — `test.seedSum[0].results` → `obj(sections).get("seedSum.0.results")`. No section-index table, no
// tag-gathering: the object's shape is the reference. Two grammars share the one walk:
//   legacy positional — beforeTest.Action1.error → before.0.results   (kept for old saved data)
//   natural / named    — test.<section>[i].results  (section is any key on the object)
const resolveTargetValue = (input, FullTest) => {
  // Legacy positional — map the synthetic labels onto real object keys, then walk.
  if (/^(?:before|main|after)Test\.Action\d+/.test(input)) {
    const [sec, action] = input.split(".");
    const nsp = input
      .replace(sec, { beforeTest: "before", mainTest: "main", Events: "events", afterTest: "after" }[sec])
      .replace(action, parseInt(action.replace("Action", "")) - 1)
      .replace("error", "results");
    return safeValue(obj(FullTest).get(nsp));
  }

  // Natural / named — the reference is the object path. Strip `test.`, turn `[i]` into `.i`, map the
  // `error` field alias to `results`, and let obj() walk the sections object directly.
  const path = input
    .replace(/^test\./, "")
    .replace(/\[(\d+)\]/g, ".$1")
    .split(".")
    .filter(Boolean)
    .map((p) => (p === "error" ? "results" : p))
    .join(".");
  return safeValue(obj(FullTest).get(path));
};

// A reference must resolve to DATA — never a live Test (a step without a `.results` field) or a section
// (an array of Tests). Those carry circular refs and would hang JSON walks / react-json-view.
const isTest = (v) => v && typeof v === "object" && typeof v.runTest === "function";
const safeValue = (v) => {
  if (isTest(v)) return undefined;
  if (Array.isArray(v) && v.some(isTest)) return undefined;
  return v;
};

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
  hasRandomToken,
  strFn,
  getType,
  resolveTargetValue,
};
