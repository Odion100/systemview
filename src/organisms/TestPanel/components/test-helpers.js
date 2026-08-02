import moment from "moment";
import { getType } from "../../../molecules/ValidationInput/validator";
import createMockFile from "./createMockFile";
export const rnb = (min, max) => Math.floor(Math.random() * (max - min + 1) + min);
export const isObjectLike = (value) =>
  ["object", "array", "string"].indexOf(getType(value)) > -1;

// A target-value reference — two grammars, both resolved by resolveTargetValue (RFC-020):
//   legacy positional — beforeTest.Action1.error   (kept for back-compat; mirrors the UI "Section → Action N" labels)
//   natural path      — test.before[0].results / test.before.signIn.results / test.main[2].results.userId
// Mirrors testing-utilities/test-helpers.js (the CLI copy). The natural form is a SUPERSET of the legacy
// one, so every reference that matched before still matches.
const TV_TAIL = `(?:\\[(?:\\d+)\\]|\\.(?:(?![0-9])[a-zA-Z0-9$_]+(?:\\[(?:\\d+)\\])?))*`;
const TV_LEGACY = `(?:before|main|after)Test\\.Action\\d+\\.(?:error|results)${TV_TAIL}`;
// head is any identifier: a section (before|main|events|after) OR a named-action name, so
// `test.signIn[1].results` (a named action in its own local index space) parses alongside sections.
const TV_NATURAL = `test\\.(?![0-9])[a-zA-Z0-9$_]+(?:\\[\\d+\\]|\\.(?![0-9])[a-zA-Z0-9$_]+)\\.(?:error|results)${TV_TAIL}`;
const TV_BODY = `(?:${TV_LEGACY}|${TV_NATURAL})`;
export const isTargetNamespace = (str) => new RegExp(`^${TV_BODY}$`).test(str);
export const targetValueFnRegex = new RegExp(`tv\\(${TV_BODY}\\)`, "g");
export const isTargetValueFn = (str) => new RegExp(`^tv\\(${TV_BODY}\\)$`).test(str);
export const isEqualArrays = (a, b) => a.join(".") === b.join("."); //specifically for arrays of strings
export const isValidNamespace = (str) => /^(?![0-9])[a-zA-Z0-9$_]+$/.test(str); //_id
export const startsWithNameAndArray = (str) => /^\w+(\[\d+\])+/.test(str); //users[0]
export const isNameAndArray = (str) => /^\w+(\[\d+\])+$/.test(str); //users[0]
export const endsWithArrayIndex = (str) => /\w+(\[\d+\])+$/.test(str); //users[0].docs[3]...
export const getLastArrayNamespace = (str) => (str.match(/(\w+(\[\d+\])+)$/) || [str])[0];

export const parseIndex = (nsp) => parseInt((nsp.match(/\[(\d+)\]$/) || [null, "0"])[1]);
export const replaceFirstIndex = (nsp, insert = "0") =>
  nsp.replace(/(\[\d+\])/, `[${insert}]`);
export const replaceLastIndex = (nsp, insert = "0") =>
  nsp.replace(/(\[\d+\])$/, `[${insert}]`);

export const replaceAllIndices = (nsp, insert = "0") =>
  nsp.replace(/(\[\d+\])/g, `[${insert}]`);

export const getArrayNamespaces = (str) =>
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
export const switchArrayIndices = (nsp, replace) => {
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
export const mapNamespace = (nsp) =>
  nsp.split(/(?:\.|\[|\])/g).filter((str) => str.trim());

export const obj = function ObjectParser(obj) {
  const parser = {};

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
  parser.clone = () => JSON.parse(JSON.stringify(obj));

  parser.isEmpty = () => Object.getOwnPropertyNames(obj).length === 0;

  return parser;
};

export const arr = function ArrayParser(arr) {
  const parser = this || {};

  parser.randomIndex = () => rnb(0, arr.length - 1);

  parser.randomItem = () => arr[parser.randomIndex()];
  return parser;
};

const isFnRegEx = /^\w+\(([^,)]*(,[^,)]*)*)\)$/;
const parseArgs = (str) => str.split(",").map((value) => value.trim());
export const isFunction = (str) => isFnRegEx.test(str);
export const isDateFunction = (str) => /^[dD]ate\(([^,)]*(,[^,)]*)*)\)$/.test(str);
const isMockFileFunction = (str) => /^mockFile\(([^,)]*(,[^,)]*)*)\)$/.test(str);
const isMockFilesFunction = (str) => /^mockFiles\(([^,)]*(,[^,)]*)*)\)$/.test(str);

// random(n) — n random lowercase-alphanumeric chars (default 8), fresh on EVERY run. Unlike date()/
// mockFile() it's insertable ANYWHERE inside a string — "user_random(6)@test.com" → "user_k3n9x2@test.com"
// — because its whole point is unique usernames/emails in reusable sections and repeated test runs.
const randomTokenRegex = /random\((\d*)\)/g;
export const hasRandomToken = (str) => typeof str === "string" && /random\(\d*\)/.test(str);
const randomString = (len) => {
  let out = "";
  while (out.length < len) out += Math.random().toString(36).slice(2);
  return out.slice(0, len);
};

export const strFn = (str) => {
  if (hasRandomToken(str))
    return str.replace(randomTokenRegex, (_, n) => randomString(parseInt(n || "8", 10)));
  if (isDateFunction(str)) {
    const [fullStr, args] = str.match(isFnRegEx);
    return moment(!args ? undefined : args).toJSON();
  }
  if (isMockFileFunction(str)) {
    const [fullStr, args] = str.match(isFnRegEx);
    return createMockFile(args);
  }
  if (isMockFilesFunction(str)) {
    const [fullStr, args] = str.match(isFnRegEx);
    return parseArgs(args).map(createMockFile);
  }
  return str;
};

// RFC-020 — the ONE resolver for a target-value reference (an arg targetValue OR an evaluation `tv()`).
// Mirrors testing-utilities/test-helpers.js. FullTest is the **sections object** `{ before, main, …, <named> }`;
// a reference IS an object path — `test.seedSum[0].results` → obj(sections).get("seedSum.0.results"). No
// section-index table, no tag-gathering: the object's shape is the reference.
export const resolveTargetValue = (input, FullTest) => {
  // Legacy positional — map synthetic labels onto real object keys, then walk.
  if (/^(?:before|main|after)Test\.Action\d+/.test(input)) {
    const [sec, action] = input.split(".");
    const nsp = input
      .replace(sec, { beforeTest: "before", mainTest: "main", Events: "events", afterTest: "after" }[sec])
      .replace(action, parseInt(action.replace("Action", "")) - 1)
      .replace("error", "results");
    return safeValue(obj(FullTest).get(nsp));
  }

  // Natural / named — the reference is the object path.
  const path = input
    .replace(/^test\./, "")
    .replace(/\[(\d+)\]/g, ".$1")
    .split(".")
    .filter(Boolean)
    .map((p) => (p === "error" ? "results" : p))
    .join(".");
  return safeValue(obj(FullTest).get(path));
};

// A reference must resolve to DATA. If a path stops at a step (a live Test) or a section (an array of
// Tests) instead of a `.results` field, return undefined — a live Test carries circular refs and would
// hang react-json-view / JSON.stringify when shown as an arg value.
const isTest = (v) => v && typeof v === "object" && typeof v.runTest === "function";
const safeValue = (v) => {
  if (isTest(v)) return undefined;
  if (Array.isArray(v) && v.some(isTest)) return undefined;
  return v;
};

window.moment = moment;
window.strFn = strFn;
