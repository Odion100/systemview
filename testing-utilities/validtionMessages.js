const moment = require("moment/moment");

const vowels = ["a", "e", "i", "o", "u"];
const isVowel = (str) => vowels.includes((str + "").toLowerCase());
const an = (word) =>
  word + "" === "undefined" ? "" : isVowel((word + "")[0]) ? "an" : "a";

module.exports = function validationMessage({ name, namespace, expected, received }) {
  return errorMessages[name](namespace, expected, received);
};
const errorMessages = {
  typeError: (namespace, expected, received) => {
    const a = isVowel(expected) ? "an" : "a";
    return `Expected ${namespace}to be ${a} ${expected}, received ${received}`;
  },

  lengthEquals: (namespace, expected, received) =>
    `Expected ${namespace} to have a length of ${expected}, received ${received}`,
  maxLength: (namespace, expected, received) =>
    `Expected ${namespace} to have a maximum length of ${expected}, received ${received}`,
  minLength: (namespace, expected, received) =>
    `Expected ${namespace} to have a minimum length of ${expected}, received ${received}`,
  includes: (namespace, expected, received) =>
    `Expected ${namespace} to include the following value: ${expected}, received ${received}`,
  isLike: (namespace, expected, received) =>
    `Expected ${namespace} to be like the following expression: ${expected}, received ${received}`,
  isOneOf: (namespace, expected, received) =>
    `Expected ${namespace} to be one of the following values: ${expected}, received ${received}`,
  strEquals: (namespace, expected, received) =>
    `Expected ${namespace} to equal "${expected}"`,
  numEquals: (namespace, expected, received) =>
    `Expected ${namespace} to equal ${expected}, received ${received}`,
  max: (namespace, expected, received) =>
    `Expected ${namespace} to be less than ${expected}, received ${received}`,
  min: (namespace, expected, received) =>
    `Expected ${namespace} to be greater than ${expected}, received ${received}`,
  boolEquals: (namespace, expected, received) =>
    `Expected ${namespace} to be ${expected.toString()}`,
  dateEquals: (namespace, expected, received) =>
    `Expected ${namespace} to be ${moment(expected).format()}`,
  minDate: (namespace, expected, received) =>
    `Expected ${namespace} to be a date/time later than ${expected}, received ${received}`,
  maxDate: (namespace, expected, received) =>
    `Expected ${namespace} to be a date/time earlier than ${expected}, received ${received}`,
};
