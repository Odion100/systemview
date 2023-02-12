import moment from "moment/moment";

const vowels = ["a", "e", "i", "o", "u"];
const isVowel = (str) => vowels.includes((str + "").toLowerCase());
const an = (word) =>
  word + "" === "undefined" ? "" : isVowel((word + "")[0]) ? "an" : "a";
const className = "error-message";

export default function ValidationMessage({
  name,
  namespace,
  expected,
  error = true,
  received,
}) {
  const PRETEXT = error ? "Expected" : "Expecting";
  return (
    <div className={`${className}`}>
      {ErrorMessages[name](namespace, expected, PRETEXT, error && received)}
    </div>
  );
}

const typeError = (namespace, expected, pretext, received, amendment) => {
  return (
    <div className={`${className}__message`}>
      {pretext} <span className={`${className}__namespace`}>{namespace}</span> to be{" "}
      {an(expected)} <span className={`${className}__expected`}>{expected} </span>
      {received && (
        <span>
          (received {an(received)} {received})
        </span>
      )}
      {amendment && amendment}
    </div>
  );
};
const lengthEquals = (namespace, expected, PRETEXT, received) => (
  <div className={`${className}__message`}>
    {PRETEXT} <span className={`${className}__namespace`}>{namespace}</span> to have a
    length of <span className={`${className}__expected`}>{expected}</span>
    {received && <span> (received {received})</span>}
  </div>
);
const maxLength = (namespace, expected, PRETEXT, received) => (
  <div className={`${className}__message`}>
    {PRETEXT} <span className={`${className}__namespace`}>{namespace}</span> to have a
    maximum length of <span className={`${className}__expected`}>{expected}</span>
    {received && <span> (received {received})</span>}
  </div>
);
const minLength = (namespace, expected, PRETEXT, received) => (
  <div className={`${className}__message`}>
    {PRETEXT} <span className={`${className}__namespace`}>{namespace}</span> to have a
    minimum length of <span className={`${className}__expected`}>{expected}</span>
    {received && <span> (received {received})</span>}
  </div>
);
const includes = (namespace, expected, PRETEXT) => (
  <div className={`${className}__message`}>
    {PRETEXT} <span className={`${className}__namespace`}>{namespace}</span> to include
    the following value: <span className={`${className}__expected`}>{expected}</span>
  </div>
);
const isLike = (namespace, expected, PRETEXT) => (
  <div className={`${className}__message`}>
    {PRETEXT} <span className={`${className}__namespace`}>{namespace}</span> to be like
    the following expression: <span className={`${className}__expected`}>{expected}</span>
  </div>
);
const isOneOf = (namespace, expected, PRETEXT) => (
  <div className={`${className}__message`}>
    {PRETEXT} <span className={`${className}__namespace`}>{namespace}</span> to be one of
    the following values: <span className={`${className}__expected`}>{expected}</span>
  </div>
);
const strEquals = (namespace, expected, PRETEXT) => (
  <div className={`${className}__message`}>
    {PRETEXT} <span className={`${className}__namespace`}>{namespace}</span> to equal{" "}
    <span className={`${className}__expected`}>"{expected}"</span>
  </div>
);
const numEquals = (namespace, expected, PRETEXT) => (
  <div className={`${className}__message`}>
    {PRETEXT} <span className={`${className}__namespace`}>{namespace}</span> to equal{" "}
    <span className={`${className}__expected`}>{parseInt(expected)}</span>
  </div>
);
const max = (namespace, expected, PRETEXT, received) => (
  <div className={`${className}__message-container`}>
    {typeError(
      namespace,
      "number",
      PRETEXT,
      undefined,
      <span>
        less than <span className={`${className}__expected`}>{expected}</span>
        {received && <span> (received {received})</span>}
      </span>
    )}
  </div>
);
const min = (namespace, expected, PRETEXT, received) => (
  <div className={`${className}__message-container`}>
    {typeError(
      namespace,
      "number",
      PRETEXT,
      undefined,
      <span>
        greater than <span className={`${className}__expected`}>{expected}</span>
        {received && <span> (received {received})</span>}
      </span>
    )}
  </div>
);
const boolEquals = (namespace, expected, PRETEXT) => (
  <div className={`${className}__message`}>
    {PRETEXT} <span className={`${className}__namespace`}>{namespace}</span> to be $
    {expected.toString()}
  </div>
);
const dateEquals = (namespace, expected, PRETEXT) => (
  <div className={`${className}__message`}>
    {PRETEXT} <span className={`${className}__namespace`}>{namespace}</span> to be $
    {moment(expected).format()}
  </div>
);
const minDate = (namespace, expected, PRETEXT) => (
  <div className={`${className}__message`}>
    {PRETEXT} <span className={`${className}__namespace`}>{namespace}</span> to be a
    date/time later than <span className={`${className}__expected`}>{expected}</span>
  </div>
);
const maxDate = (namespace, expected, PRETEXT) => (
  <div className={`${className}__message`}>
    {PRETEXT} <span className={`${className}__namespace`}>{namespace}</span> to be a
    date/time earlier than <span className={`${className}__expected`}>{expected}</span>
  </div>
);
export const ErrorMessages = {
  typeError,
  lengthEquals,
  maxLength,
  minLength,
  includes,
  isLike,
  isOneOf,
  strEquals,
  numEquals,
  max,
  min,
  boolEquals,
  dateEquals,
  minDate,
  maxDate,
};
// export const errorMessages = {
//   typeError= (namespace, expected) => {
//     const a = isVowel(e) ? "an" : "a";
//     return `Expected ${namespace}to be ${a} ${expected}`;
//   },
//   lengthEquals= (namespace, expected) => `Expected ${namespace} to have a length of ${expected}`,
//   maxLength= (namespace, expected) => `Expected ${namespace} to have a maximum length of ${expected}`,
//   minLength= (namespace, expected) => `Expected ${namespace} to have a minimum length of ${expected}`,
//   includes= (namespace, expected) => `Expected ${namespace} to include the following value: ${expected}`,
//   isLike= (namespace, expected) => `Expected ${namespace} to be like the following expression: ${expected}`,
//   isOneOf= (namespace, expected) => `Expected ${namespace} to be one of the following values: ${expected}`,
//   strEquals= (namespace, expected) => `Expected ${namespace} to equal "${expected}"`,
//   numEquals= (namespace, expected) => `Expected ${namespace} to equal ${expected}`,
//   max= (namespace, expected) => `Expected ${namespace} to be less than ${expected}`,
//   min= (namespace, expected) => `Expected ${namespace} to be greater than ${expected}`,
//   boolEquals= (namespace, expected) => `Expected ${namespace} to be ${e.toString()}`,
//   dateEquals= (namespace, expected) => `Expected ${namespace} to be ${moment(e).format()}`,
//   minDate= (namespace, expected) => `Expected ${namespace} to be a date/time later than ${expected}`,
//   maxDate= (namespace, expected) => `Expected ${namespace} to be a date/time earlier than ${expected}`,
// };
