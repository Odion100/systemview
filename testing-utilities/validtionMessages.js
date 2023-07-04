const moment = require("moment/moment");

const vowels = ["a", "e", "i", "o", "u"];
const isVowel = (str) => vowels.includes((str + "").toLowerCase());
const an = (word) =>
  word + "" === "undefined" ? "" : isVowel((word + "")[0]) ? "an" : "a";

module.exports = function validationMessage({ name, namespace, expected, received }) {
  return errorMessages[name](namespace, expected, received);
};
const errorMessages = {
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
