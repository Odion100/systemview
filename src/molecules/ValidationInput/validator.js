import moment from "moment";

export function validateResults(results, namespace, savedValidations = []) {
  const evaluations = [];
  let total_errors = 0;

  const getValidations = (value, nsp) => {
    const type = getType(value);
    const i = savedValidations.findIndex((val) => val.namespace === nsp);
    const savedEval = i !== -1 ? savedValidations.splice(i, 1) : {};
    const validations = savedEval.validations || [];
    const expected_type = savedEval.expected_type || type;
    const errors = getErrors(type, value, validations, expected_type);
    total_errors += errors.count;
    return {
      namespace: nsp,
      type,
      expected_type,
      value,
      errors,
      validations,
    };
  };

  (function recursiveEval(data, nsp) {
    const evaluation = getValidations(data, nsp);
    evaluations.push(evaluation);
    if (evaluation.type === "object")
      Object.getOwnPropertyNames(data).forEach((prop) =>
        recursiveEval(data[prop], `${nsp}.${prop}`)
      );
    else if (evaluation.type === "array") recursiveEval(data[0], `${nsp}[0]`);
  })(results, namespace);

  savedValidations.forEach((evaluation) => {
    evaluation.errors = { count: 1, missingNamespace: true };
    evaluations.push(evaluation);
    total_errors++;
  });
  console.log(evaluations);
  return { evaluations, total_errors };
}

export function getErrors(type, value, validations, expected_type) {
  if (type !== expected_type && expected_type !== "mixed")
    return { count: 1, typeError: true };
  const test_type = expected_type !== "mixed" ? expected_type : type;

  switch (test_type) {
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
      if (expected_type !== "mixed")
        //all validation failed
        return validations.reduce(
          (errors, { name }) => {
            errors[name] = true;
            errors.count++;
            return errors;
          },
          { count: 0 }
        );
      else return { count: 0 };
    default:
      return { count: 0 };
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
  validations.reduce(
    (errors, { name, value }) => {
      if (name === "lengthEquals") errors[name] = item.length !== value;
      if (name === "maxLength") errors[name] = item.length > value;
      if (name === "minLength") errors[name] = item.length < value;
      if (errors[name]) errors.count++;
      return errors;
    },
    { count: 0 }
  );

const validateArray = (arr, validations) =>
  validations.reduce((errors, { name, value }) => {
    if (name === "includes") errors[name] = !arr.includes(value);
    if (errors[name]) errors.count++;
    return errors;
  }, validateLength(arr, validations));

const validateString = (str, validations) =>
  validations.reduce((errors, { name, value }) => {
    if (name === "strEquals") errors[name] = str !== value;
    if (name === "isLike") errors[name] = str.match(new RegExp(value, "gi")).length === 0;
    if (name === "isOneOf" && typeof value === "string")
      errors[name] = !value
        .split(",")
        .map((v) => v.trim())
        .includes(str);
    if (errors[name]) errors.count++;
    return errors;
  }, validateLength(str, validations));

const validateNumber = (num, validations) =>
  validations.reduce(
    (errors, { name, value }) => {
      if (name === "numEquals") errors[name] = num !== value;
      if (name === "max") errors[name] = num > value;
      if (name === "min") errors[name] = num < value;
      if (name === "isOneOf" && typeof value === "string")
        errors[name] = !value
          .split(",")
          .map((v) => parseInt(v))
          .includes(num);
      if (errors[name]) errors.count++;
      return errors;
    },
    { count: 0 }
  );

const validateBoolean = (bool, validations) =>
  validations.reduce(
    (errors, { name, value }) => {
      if (name === "boolEquals") errors[name] = bool !== value;
      if (errors[name]) errors.count++;
      return errors;
    },
    { count: 0 }
  );

const validateDate = (datetime, validations) =>
  validations.reduce(
    (errors, { name, value }) => {
      if (name === "dateEquals") errors[name] = !moment(datetime).isSame(value);
      if (name === "maxDate") errors[name] = moment(datetime).isAfter(value);
      if (name === "minDate") errors[name] = moment(datetime).isBefore(value);
      if (errors[name]) errors.count++;
      return errors;
    },
    { count: 0 }
  );
