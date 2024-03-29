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
          (, but received {an(received)} {received})
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
    {received && <span> (, but received {received})</span>}
  </div>
);
const maxLength = (namespace, expected, PRETEXT, received) => (
  <div className={`${className}__message`}>
    {PRETEXT} <span className={`${className}__namespace`}>{namespace}</span> to have a
    maximum length of <span className={`${className}__expected`}>{expected}</span>
    {received && <span> (, but received {received})</span>}
  </div>
);
const minLength = (namespace, expected, PRETEXT, received) => (
  <div className={`${className}__message`}>
    {PRETEXT} <span className={`${className}__namespace`}>{namespace}</span> to have a
    minimum length of <span className={`${className}__expected`}>{expected}</span>
    {received && <span> (, but received {received})</span>}
  </div>
);
const includes = (namespace, expected, PRETEXT, received) => (
  <div className={`${className}__message`}>
    {PRETEXT} <span className={`${className}__namespace`}>{namespace}</span> to include
    the following value: <span className={`${className}__expected`}>{expected}</span>
    {received && <span> (, but received {received})</span>}
  </div>
);
const isLike = (namespace, expected, PRETEXT, received) => (
  <div className={`${className}__message`}>
    {PRETEXT} <span className={`${className}__namespace`}>{namespace}</span> to be like
    the following expression: <span className={`${className}__expected`}>{expected}</span>
    {received && <span> (, but received {received})</span>}
  </div>
);
const isOneOf = (namespace, expected, PRETEXT, received) => (
  <div className={`${className}__message`}>
    {PRETEXT} <span className={`${className}__namespace`}>{namespace}</span> to be one of
    the following values: <span className={`${className}__expected`}>{expected}</span>
    {received && <span> (, but received {received})</span>}
  </div>
);
const strEquals = (namespace, expected, PRETEXT, received) => (
  <div className={`${className}__message`}>
    {PRETEXT} <span className={`${className}__namespace`}>{namespace}</span> to equal{" "}
    <span className={`${className}__expected`}>"{expected}"</span>
    {received && <span> (, but received {received})</span>}
  </div>
);
const numEquals = (namespace, expected, PRETEXT, received) => (
  <div className={`${className}__message`}>
    {PRETEXT} <span className={`${className}__namespace`}>{namespace}</span> to equal{" "}
    <span className={`${className}__expected`}>{parseInt(expected)} </span>
    {received && <span> (, but received {received})</span>}
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
        {received && <span> (, but received {received})</span>}
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
        {received && <span> (, but received {received})</span>}
      </span>
    )}
  </div>
);
const boolEquals = (namespace, expected, PRETEXT, received) => (
  <div className={`${className}__message`}>
    {PRETEXT} <span className={`${className}__namespace`}>{namespace}</span> to be{" "}
    {expected.toString()} {received && <span> (, but received {received})</span>}
  </div>
);
const dateEquals = (namespace, expected, PRETEXT) => (
  <div className={`${className}__message`}>
    {PRETEXT} <span className={`${className}__namespace`}>{namespace}</span> to be
    {moment(expected).format("L LTS")}
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
