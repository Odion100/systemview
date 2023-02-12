import moment from "moment";

export function validateResults(results, namespace, savedEvaluations = []) {
  const savedEvalClone = [...savedEvaluations];
  const evaluations = [];
  const errorList = [];

  const getValidations = (value, namespace) => {
    const type = getType(value);
    const i = savedEvalClone.findIndex((val) => val.namespace === namespace);
    const savedEval = i > -1 ? savedEvalClone.splice(i, 1)[0] : {};
    const validations = savedEval.validations || [];
    const expected_type = savedEval.expected_type || type;
    const save = !savedEvalClone.length || !!savedEval.save;
    const errors = getErrors({ type, value, validations, expected_type });
    errors.forEach((e) => save && errorList.push({ ...e, namespace }));
    return {
      namespace,
      type,
      expected_type,
      value,
      errors,
      validations,
      save,
    };
  };

  (function recursiveEval(data, namespace) {
    const evaluation = getValidations(data, namespace);
    evaluations.push(evaluation);
    if (evaluation.type === "object") {
      Object.getOwnPropertyNames(data).forEach((prop) => {
        recursiveEval(data[prop], `${namespace}.${prop}`);
      });
    } else if (evaluation.type === "array") {
      recursiveEval(data[0], `${namespace}[0]`);
    }
  })(results, namespace);
  //each remaining evaluation is a potential TypeError: undefined
  savedEvalClone.forEach(({ namespace }) => {
    evaluations.push(getValidations(undefined, namespace));
  });

  return { evaluations, errors: errorList };
}

export function getErrors({ type, value, validations, expected_type }) {
  if (type !== expected_type && expected_type !== "mixed")
    return [{ name: "typeError", expected: expected_type, received: type }];

  switch (type) {
    case "number":
      return validateNumber(value, validations);
    case "date":
      return validateDate(value, validations);
    case "string":
      return validateString(value, validations);
    case "array":
      return validateArray(value, validations);
    case "boolean":
      return validateBoolean(value, validations);
    case "null":
    case "undefined":
    default:
      return [];
  }
}

export function getType(value) {
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

export const defaultValue = (data_type) => {
  switch (data_type) {
    case "string":
      return "";
    case "number":
      return 0;
    case "date":
      return moment().toJSON();
    case "boolean":
      return false;
    case "array":
      return [];
    case "object":
      return {};
    case "null":
      return null;
    case "target":
      return "";
    case "undefined":
    default:
      return undefined;
  }
};

const validateLength = (item, validations) =>
  validations.reduce((errors, { name, value }) => {
    if (name === "lengthEquals" && item.length !== value)
      return errors.concat({ name, expected: value, received: item.length });
    if (name === "maxLength" && item.length > value)
      return errors.concat({ name, expected: value, received: item.length });
    if (name === "minLength" && item.length < value)
      return errors.concat({ name, expected: value, received: item.length });
    return errors;
  }, []);

const validateArray = (arr, validations) =>
  validations.reduce((errors, { name, value }) => {
    if (name === "includes" && !arr.includes(value))
      return errors.concat({ name, expected: value, received: arr });
    return errors;
  }, validateLength(arr, validations));

const validateString = (str, validations) =>
  validations.reduce((errors, { name, value }) => {
    if (name === "strEquals" && str !== value)
      return errors.concat({ name, expected: value, received: str });
    //str.match() returns null when there is no match
    if ((name === "isLike") & !str.match(new RegExp(value, "gi")))
      return errors.concat({ name, expected: value, received: str });
    if (
      name === "isOneOf" &&
      typeof value === "string" &&
      !value
        .split(",")
        .map((v) => v.trim())
        .includes(str)
    )
      return errors.concat({ name, expected: value, received: str });
    return errors;
  }, validateLength(str, validations));

const validateNumber = (num, validations) =>
  validations.reduce((errors, { name, value }) => {
    if (name === "numEquals" && num !== value)
      return errors.concat({ name, expected: value, received: num });
    if (name === "max" && num > value)
      return errors.concat({ name, expected: value, received: num });
    if (name === "min" && num < value)
      return errors.concat({ name, expected: value, received: num });
    if (
      name === "isOneOf" &&
      typeof value === "string" &&
      !value
        .split(",")
        .map((v) => parseInt(v))
        .includes(num)
    )
      return errors.concat({ name, expected: value, received: num });
    return errors;
  }, []);

const validateBoolean = (bool, validations) =>
  validations.reduce((errors, { name, value }) => {
    if (name === "boolEquals" && bool !== value)
      return errors.concat({ name, expected: value, received: bool });
    return errors;
  }, []);

const validateDate = (datetime, validations) =>
  validations.reduce((errors, { name, value }) => {
    if (name === "dateEquals" && !moment(datetime).isSame(value))
      return errors.concat({ name, expected: value, received: datetime });
    if (name === "maxDate" && moment(datetime).isAfter(value))
      return errors.concat({ name, expected: value, received: datetime });
    if (name === "minDate" && moment(datetime).isBefore(value))
      return errors.concat({ name, expected: value, received: datetime });
    return errors;
  }, []);
