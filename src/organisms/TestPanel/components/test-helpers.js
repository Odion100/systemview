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
// head is any identifier: a section (before|main|events|after) OR a shared-action name, so
// `test.signIn[1].results` (a shared action in its own local index space) parses alongside sections.
// `args` joins `results`/`error` as a reference ROOT: a step's own INPUT is often the thing you
// want to compare against later — "the id I sent must come back" — and without this you had to
// repeat the literal in both places and hope they stayed in sync.
// `test.` IS OPTIONAL, and it always was everywhere except here. `resolveTargetValue` strips a
// leading `test.` before walking, `markdown.md` documents the reference as `tv(steps[0].results.sum)`,
// `RunBlock.js` calls the section name "the reference root" in the same short form, and buAPI's own
// specs are written `tv(seedSum[0].results.sum)`. Only this RECOGNISER required the prefix — so every
// documented example failed `isTargetValueFn`, was never registered as a reference, and reached the
// service as the literal characters "tv(steps[0].results.found)". The resolver could always have
// handled it; nothing ever asked it to.
const TV_NATURAL = `(?:test\\.)?(?![0-9])[a-zA-Z0-9$_]+(?:\\[\\d+\\]|\\.(?![0-9])[a-zA-Z0-9$_]+)\\.(?:error|results|args)${TV_TAIL}`;
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

// THE CALL PARSER — one of them, nesting-aware, and every function matcher below is built on it.
//
// It replaces four regexes that each forbade `)` inside an argument (`[^,)]*`). That restriction
// meant no string function could ever take another as an argument: `date(tv(steps[0].results.at))`
// failed at the MATCHER, so it stayed a literal string and the assertion compared against the
// characters "date(tv(...))". Nobody noticed because nothing had two string functions to compose
// until arithmetic needed a reference as an operand.
const isFnRegEx = /^\w+\(([^,)]*(,[^,)]*)*)\)$/; // kept: `str.match(isFnRegEx)` callers below
export const fnCall = (str) => {
  const m = /^(\w+)\(([\s\S]*)\)$/.exec(String(str == null ? "" : str).trim());
  if (!m) return null;
  return { name: m[1], argsRaw: m[2], args: splitFnArgs(m[2]) };
};
const named = (str, re) => {
  const call = fnCall(str);
  return !!call && re.test(call.name);
};
const parseArgs = (str) => splitFnArgs(str);
export const isFunction = (str) => !!fnCall(str);
export const isDateFunction = (str) => named(str, /^[dD]ate$/);
const isMockFileFunction = (str) => named(str, /^mockFile$/);
const isMockFilesFunction = (str) => named(str, /^mockFiles$/);

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

// MATH, AS A STRING FUNCTION — his framing, and it is the right one: `tv()` is a string function,
// `date()` is a string function, so arithmetic is one more entry in the same registry rather than a
// new expression syntax bolted onto the grammar.
//
// WHY IT IS NEEDED. A reference exists so an assertion stops depending on a constant: "the row count
// equals the claim count" survives the document growing a claim, where `= 22` does not. But the
// moment the relationship is anything other than equality — off by one, half of, the larger of two —
// there is nothing to say, and the author goes back to hard-coding the number the reference was
// introduced to remove.
//
// WHAT IS MAPPED. JavaScript's `Math` has no arithmetic, so the four operations are supplied here and
// the rest is a passthrough to `Math` by name. Arguments may themselves be `tv(...)` references or
// nested calls, which is why they cannot be split on a bare comma.
const MATH_FNS = {
  add: (...n) => n.reduce((a, b) => a + b, 0),
  subtract: (a, ...n) => n.reduce((x, y) => x - y, a),
  multiply: (...n) => n.reduce((a, b) => a * b, 1),
  divide: (a, ...n) => n.reduce((x, y) => x / y, a),
  min: Math.min,
  max: Math.max,
  abs: Math.abs,
  round: Math.round,
  floor: Math.floor,
  ceil: Math.ceil,
};

// SPLIT ON TOP-LEVEL COMMAS ONLY. `add(tv(steps[0].results.found), -1)` has a comma inside no
// argument and parens inside one, so `String.split(",")` tears the reference in half. (RunBlock's
// `splitArgs` does the same job for a method's positional arguments in the run grammar — same
// algorithm, different grammar, and worth collapsing into one if a third caller ever appears.)
export const splitFnArgs = (text) => {
  const out = [];
  let depth = 0, quote = null, buf = "";
  for (let i = 0; i < String(text).length; i++) {
    const c = String(text)[i];
    if (quote) { buf += c; if (c === quote && String(text)[i - 1] !== "\\") quote = null; continue; }
    if (c === '"' || c === "'") { quote = c; buf += c; continue; }
    if (c === "(" || c === "[" || c === "{") depth++;
    if (c === ")" || c === "]" || c === "}") depth--;
    if (c === "," && depth === 0) { out.push(buf.trim()); buf = ""; continue; }
    buf += c;
  }
  if (buf.trim()) out.push(buf.trim());
  return out;
};

const mathCall = (str) => {
  const call = fnCall(str);
  if (!call || !MATH_FNS[call.name]) return null;
  return { fn: MATH_FNS[call.name], ...call };
};
export const isMathFunction = (str) => !!mathCall(str);

// Evaluate a math call whose arguments are numbers, or nested math calls. A non-numeric argument
// makes the whole thing UNRESOLVABLE and returns null rather than NaN — NaN compares unequal to
// everything, which would read as a genuine assertion failure instead of a broken expression.
export const evalMathFn = (str) => {
  const call = mathCall(str);
  if (!call) return null;
  const nums = call.args.map((a) => {
    const nested = evalMathFn(a);
    if (nested !== null) return nested;
    const n = Number(a);
    return Number.isFinite(n) ? n : null;
  });
  if (nums.some((n) => n === null)) return null;
  const out = call.fn(...nums);
  return Number.isFinite(out) ? out : null;
};

// REFERENCES FIRST, THEN THE FUNCTIONS — one sequence, and it was a branch.
//
// `tv()` is a string function meant to be written INSIDE a string (the `targetValues` form on an
// argument is the other way to say the same thing — a reference dropped in directly, unwrapped). So
// a value can be a function whose operand is a reference: `add(tv(steps[1].results.total), 1)`.
// References did already resolve first — `parseTargetValues` registers each embedded match — but the
// resolver was an if/else-if/else, so a value that took the reference branch never reached `strFn`
// and the function never got its second pass.
//
// WHAT YOU SEE WHEN IT DOES NOT EVALUATE, and this is the part worth getting right: the
// POST-SUBSTITUTION form. If the reference resolved to `"hello world"` the failure reads
// `add("hello world", 1)` — which says the reference resolved and is pointing at the wrong field.
// Leaving the original `add(tv(…), 1)` hides that it resolved at all, and letting it become `NaN`
// hides both. (His: *"you'd want to see that the target value you set up is not resolving to what
// you set it up to — that's more value than seeing the actual target value function."*)
// AN EVALUATION'S VALUE, RESOLVED THE WAY AN ARGUMENT'S ALREADY IS — references in one shot, then
// the functions. No tree walk: `targetValueFnRegex` (twenty lines up, already exported, already used
// by the remap below) collects every embedded `tv(...)` in a single pass, and the only thing that
// genuinely nests is arithmetic, which `evalMathFn` recurses through on its own.
//
// TYPE SURVIVES THE SAME WAY `Argument.class` does it: a value that IS the reference takes the
// resolved value DIRECTLY — so `tv(steps[1].results.total)` stays the number 22 and `numEquals`
// still means something. Only a reference embedded in a larger expression is substituted as text,
// where text is what it has to be.
//
// AND AN UNRESOLVED OPERAND LEAVES THE SUBSTITUTED FORM, not `NaN` and not the original: a failure
// reading `add("hello world", 1)` says the reference resolved and is pointing at the wrong field,
// which is the thing worth seeing. `NaN` hides that it resolved; the original hides what it gave.
export const resolveValueString = (value, resolveOne) => {
  if (typeof value !== "string" || typeof resolveOne !== "function") return value;
  if (isTargetValueFn(value)) {
    const only = resolveOne(value.substring(3, value.length - 1));
    if (only !== undefined) return only;
  }
  const substituted = value.replace(targetValueFnRegex, (match) => {
    const got = resolveOne(match.substring(3, match.length - 1));
    if (got === undefined) return match;
    return typeof got === "string" ? JSON.stringify(got) : String(got);
  });
  return strFn(substituted);
};

export const strFn = (str) => {
  if (hasRandomToken(str))
    return str.replace(randomTokenRegex, (_, n) => randomString(parseInt(n || "8", 10)));
  if (isDateFunction(str)) {
    const { argsRaw } = fnCall(str);
    return moment(!argsRaw ? undefined : argsRaw).toJSON();
  }
  if (isMathFunction(str)) {
    const n = evalMathFn(str);
    // Unresolvable keeps the string AS GIVEN — which, after substitution, shows what the references
    // resolved to: `add("hello world", 1)` rather than `NaN` or the original `add(tv(…), 1)`.
    return n === null ? str : n;
  }
  if (isMockFileFunction(str)) {
    return createMockFile(fnCall(str).argsRaw);
  }
  if (isMockFilesFunction(str)) {
    return parseArgs(fnCall(str).argsRaw).map(createMockFile);
  }
  return str;
};

// RFC-023 — REFERENCES FOLLOW THE STEP. After a drag/duplicate changes step positions, rewrite every
// reference the move displaced: `mapFn(sectionKey, index)` → `{ key, index }` (new position) or null
// (unchanged). Rewrites the structured `targetValues` entry, the visible input text (object property
// strings + embedded `tv(...)`), and evaluation values. Remapped LEGACY refs (beforeTest.ActionN…)
// upgrade to the natural form. BUILDER-ONLY — the saved file carries the rewritten strings, so the
// CLI engine needs no counterpart.
const LEGACY_SECTION_KEYS = { beforeTest: "before", mainTest: "main", afterTest: "after" };
export const remapNamespace = (ns, mapFn) => {
  if (typeof ns !== "string") return null;
  let m = ns.match(/^test\.((?![0-9])[a-zA-Z0-9$_]+)\[(\d+)\](.*)$/);
  if (m) {
    const to = mapFn(m[1], parseInt(m[2], 10));
    return to ? `test.${to.key}[${to.index}]${m[3]}` : null;
  }
  m = ns.match(/^(beforeTest|mainTest|afterTest)\.Action(\d+)(.*)$/);
  if (m) {
    const to = mapFn(LEGACY_SECTION_KEYS[m[1]], parseInt(m[2], 10) - 1);
    return to ? `test.${to.key}[${to.index}]${m[3]}` : null;
  }
  return null;
};

// Replace a reference string wherever it appears inside an arg input (a raw string, an embedded
// occurrence inside a longer string, or any nested object/array property). Prefix overlaps are safe:
// a longer ref sharing a moved step's head rewrites consistently (same head → same replacement).
const replaceRefDeep = (value, oldNs, newNs) => {
  if (typeof value === "string") return value.split(oldNs).join(newNs);
  if (Array.isArray(value)) return value.map((v) => replaceRefDeep(v, oldNs, newNs));
  if (value && typeof value === "object") {
    Object.keys(value).forEach((k) => {
      value[k] = replaceRefDeep(value[k], oldNs, newNs);
    });
    return value;
  }
  return value;
};

export const remapReferences = (FullTest, mapFn) => {
  Object.values(FullTest || {}).forEach((section) => {
    (section || []).forEach((t) => {
      (t.args || []).forEach((argument) => {
        (argument.targetValues || []).forEach((tv) => {
          const next = remapNamespace(tv.target_namespace, mapFn);
          if (next) {
            argument.input = replaceRefDeep(argument.input, tv.target_namespace, next);
            tv.target_namespace = next;
          }
        });
      });
      // Evaluation values may reference sibling steps via tv(...) — rewrite those too.
      (t.evaluations || []).forEach((ev) => {
        (ev.validations || []).forEach((v) => {
          if (typeof v.value === "string") {
            v.value = v.value.replace(targetValueFnRegex, (match) => {
              const next = remapNamespace(match.slice(3, -1), mapFn);
              return next ? `tv(${next})` : match;
            });
          }
        });
      });
    });
  });
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
    // `args.0` IS the argument as far as anyone reading the reference is concerned. `input` is the
    // Argument class's own field name — internal storage, not part of the map — so it's stepped
    // through here instead of being spelled out: `args[0].a`, never `args[0].input.a`.
    .replace(/(^|\.)args\.(\d+)(?!\.input\b)/, "$1args.$2.input")
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
