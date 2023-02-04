import moment from "moment/moment";

const vowels = ["a", "e", "i", "o", "u"];
const isVowel = (str) => vowels.includes(str.toLowerCase());
const equals = (n, e) => `Expected ${n} to equal ${e}`;
export const errorMessages = {
  typeError: (n, e) => {
    const a = isVowel(e) ? "an" : "a";
    return `Expected ${n}to be ${a} ${e}`;
  },
  lengthEquals: (n, e) => `Expected ${n} to have a length of ${e}`,
  maxLength: (n, e) => `Expected ${n} to have a maximum length of ${e}`,
  minLength: (n, e) => `Expected ${n} to have a minimum length of ${e}`,
  includes: (n, e) => `Expected ${n} to include the following value: ${e}`,
  isLike: (n, e) => `Expected ${n} to be like the following expression: ${e}`,
  isOneOf: (n, e) => `Expected ${n} to be one of the following values: ${e}`,
  strEquals: equals,
  numEquals: equals,
  max: (n, e) => `Expected ${n} to be less than ${e}`,
  min: (n, e) => `Expected ${n} to be greater than ${e}`,
  boolEquals: (n, e) => `Expected ${n} to be ${e.toString()}`,
  dateEquals: (n, e) => `Expected ${n} to be ${moment(e).format()}`,
  minDate: (n, e) => `Expected ${n} to be a date/time later than ${e}`,
  maxDate: (n, e) => `Expected ${n} to be a date/time earlier than ${e}`,
};

const className = "error-message";

export default function ValidationMessage({ name, namespace, expected, error = true }) {
  const EXPECTED = error ? "Expected" : "Expecting";
  return (
    <div className={`${className}`}>
      {ErrorMessages[name](namespace, expected, EXPECTED)}
    </div>
  );
}
const isEqual = (n, e, EXPECTED) => (
  <div className={`${className}__message`}>
    {EXPECTED} <span className={`${className}__namespace`}>{n}</span> to equal{" "}
    <span className={`${className}__expected`}>{e}</span>
  </div>
);
export const ErrorMessages = {
  typeError: (n, e, EXPECTED) => {
    const a = isVowel(e) ? "an" : "a";
    return (
      <div className={`${className}__message`}>
        {EXPECTED} <span className={`${className}__namespace`}>{n}</span> to be {a}{" "}
        <span className={`${className}__expected`}>{e}</span>
      </div>
    );
  },
  lengthEquals: (n, e, EXPECTED) => (
    <div className={`${className}__message`}>
      {EXPECTED} <span className={`${className}__namespace`}>{n}</span> to have a length
      of <span className={`${className}__expected`}>{e}</span>
    </div>
  ),
  maxLength: (n, e, EXPECTED) => (
    <div className={`${className}__message`}>
      {EXPECTED} <span className={`${className}__namespace`}>{n}</span> to have a maximum
      length of <span className={`${className}__expected`}>{e}</span>
    </div>
  ),
  minLength: (n, e, EXPECTED) => (
    <div className={`${className}__message`}>
      {EXPECTED} <span className={`${className}__namespace`}>{n}</span> to have a minimum
      length of <span className={`${className}__expected`}>{e}</span>
    </div>
  ),
  includes: (n, e, EXPECTED) => (
    <div className={`${className}__message`}>
      {EXPECTED} <span className={`${className}__namespace`}>{n}</span> to include the
      following value: <span className={`${className}__expected`}>{e}</span>
    </div>
  ),
  isLike: (n, e, EXPECTED) => (
    <div className={`${className}__message`}>
      {EXPECTED} <span className={`${className}__namespace`}>{n}</span> to be like the
      following expression: <span className={`${className}__expected`}>{e}</span>
    </div>
  ),
  isOneOf: (n, e, EXPECTED) => (
    <div className={`${className}__message`}>
      {EXPECTED} <span className={`${className}__namespace`}>{n}</span> to be one of the
      following values: <span className={`${className}__expected`}>{e}</span>
    </div>
  ),
  strEquals: isEqual,
  numEquals: isEqual,
  max: (n, e, EXPECTED) => (
    <div className={`${className}__message`}>
      {EXPECTED} <span className={`${className}__namespace`}>{n}</span> to be less than{" "}
      <span className={`${className}__expected`}>{e}</span>
    </div>
  ),
  min: (n, e, EXPECTED) => (
    <div className={`${className}__message`}>
      {EXPECTED} <span className={`${className}__namespace`}>{n}</span> to be greater than{" "}
      <span className={`${className}__expected`}>{e}</span>
    </div>
  ),
  boolEquals: (n, e, EXPECTED) => (
    <div className={`${className}__message`}>
      {EXPECTED} <span className={`${className}__namespace`}>{n}</span> to be $
      {e.toString()}
    </div>
  ),
  dateEquals: (n, e, EXPECTED) => (
    <div className={`${className}__message`}>
      {EXPECTED} <span className={`${className}__namespace`}>{n}</span> to be $
      {moment(e).format()}
    </div>
  ),
  minDate: (n, e, EXPECTED) => (
    <div className={`${className}__message`}>
      {EXPECTED} <span className={`${className}__namespace`}>{n}</span> to be a date/time
      later than <span className={`${className}__expected`}>{e}</span>
    </div>
  ),
  maxDate: (n, e, EXPECTED) => (
    <div className={`${className}__message`}>
      {EXPECTED} <span className={`${className}__namespace`}>{n}</span> to be a date/time
      earlier than <span className={`${className}__expected`}>{e}</span>
    </div>
  ),
};
