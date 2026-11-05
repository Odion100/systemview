const moment = require("moment/moment");

const vowels = ["a", "e", "i", "o", "u"];
const isVowel = (str) => vowels.includes((str + "").toLowerCase());
const an = (word) =>
  word + "" === "undefined" ? "" : isVowel((word + "")[0]) ? "an" : "a";

// EVERY ERROR THIS ENGINE EMITS HAS TO PRINT, AND AN UNRECOGNISED ONE HAS TO PRINT TOO.
// `errorMessages[name](...)` with no fallback threw "errorMessages[name] is not a function" for
// `assertedNothing` and `unknownValidation` — two names stepClaims.js emits by design — and the
// throw escaped past the per-test printing to the per-SERVICE catch in cli/runTests.js. So one
// unformattable assertion aborted the whole service's run: no failures listed, no summary, nothing
// for the author to read. A test failure became a lost result, which is the one thing a runner must
// never do.
//
// The fallback is the half that matters more than the two formatters: a name added later becomes a
// legible red instead of taking a suite down, and nothing has to remember to come back here.
module.exports = function validationMessage({ name, namespace, expected, received }) {
  return (errorMessages[name] || asSentence)(namespace, expected, received);
};

// `received` is already an English sentence on the errors that describe an assertion rather than a
// value — shaped that way in stepClaims.js — so it prints as itself, and an unknown name prints
// through the same shape rather than a second, worse one.
const asSentence = (namespace, expected, received) =>
  `${namespace}: ${received}${expected === undefined ? "" : ` (expected ${expected})`}`;

const errorMessages = {
  assertedNothing: asSentence,
  unknownValidation: asSentence,
  typeError: (namespace, expected, received) =>
    `Expected ${namespace} to be ${an(expected)} ${expected}, but received ${an(
      received
    )} ${received}`,
  lengthEquals: (namespace, expected, received) =>
    `Expected ${namespace} to have a length of ${expected}, but received ${received}`,
  maxLength: (namespace, expected, received) =>
    `Expected ${namespace} to have a maximum length of ${expected}, but received ${received}`,
  minLength: (namespace, expected, received) =>
    `Expected ${namespace} to have a minimum length of ${expected}, but received ${received}`,
  includes: (namespace, expected, received) =>
    `Expected ${namespace} to include the following value: ${expected}, but received ${received}`,
  isLike: (namespace, expected, received) =>
    `Expected ${namespace} to be like the following expression: ${expected}, but received ${received}`,
  isOneOf: (namespace, expected, received) =>
    `Expected ${namespace} to be one of the following values: ${expected}, but received ${received}`,
  strEquals: (namespace, expected, received) =>
    `Expected ${namespace} to equal "${expected}" but received "${received}"`,
  numEquals: (namespace, expected, received) =>
    `Expected ${namespace} to equal ${expected}, but received ${received}`,
  max: (namespace, expected, received) =>
    `Expected ${namespace} to be less than ${expected}, but received ${received}`,
  min: (namespace, expected, received) =>
    `Expected ${namespace} to be greater than ${expected}, but received ${received}`,
  boolEquals: (namespace, expected, received) =>
    `Expected ${namespace} to be ${expected}, but received ${received}`,
  dateEquals: (namespace, expected, received) =>
    `Expected ${namespace} to be ${expected}, but received ${received}`,
  minDate: (namespace, expected, received) =>
    `Expected ${namespace} to be a date/time later than ${expected}, but received ${received}`,
  maxDate: (namespace, expected, received) =>
    `Expected ${namespace} to be a date/time earlier than ${expected}, but received ${received}`,
};
