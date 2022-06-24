import moment from "moment";

export function validateResults(results, namespace, savedEvaluations = []) {
  const evaluations = [
    { namespace, type: "object", expected_type: "object", validations: [], errors: { count: 0 } },
  ];
  let totalErrors = 0;
  const getEvaluation = (value, prop_name, currentNamespace) => {
    const type = getType(value);
    const i = savedEvaluations.findIndex((val) => val.namespace === currentNamespace);
    const savedEval = i !== -1 ? savedEvaluations.splice(i, 1) : {};
    const validations = savedEval.validations || [];
    const expected_type = savedEval.type || type;
    const errors = getErrors(type, value, validations, expected_type);
    totalErrors += errors.count;
    return {
      namespace: currentNamespace,
      type,
      expected_type,
      value,
      errors,
      validations,
    };
  };
  const recursiveEval = (obj, previousNamespace) => {
    const propNames = Object.getOwnPropertyNames(obj);
    propNames.forEach((prop_name) => {
      const currentNamespace = previousNamespace + "." + prop_name;

      const evaluation = getEvaluation(obj[prop_name], prop_name, currentNamespace);

      evaluations.push(evaluation);

      if (evaluation.type === "object") recursiveEval(obj[prop_name], currentNamespace);
      else if (evaluation.type === "array") {
        const listType = getType(obj[prop_name][0]);
        if (listType === "object") {
          evaluations.push({
            namespace: currentNamespace + "[0]",
            type: listType,
            expected_type: listType,
            validations: [],
            errors: { count: 0 },
          });
          recursiveEval(obj[prop_name][0], currentNamespace + "[0]");
        } else {
          const evaluation = getEvaluation(obj[prop_name][0], 0, currentNamespace + "[0]");
          evaluations.push(evaluation);
        }
      }
    });
  };
  recursiveEval(results, namespace);
  savedEvaluations.forEach((e) => {
    e.errors = { count: 1, missingNamespace: true };
    evaluations.push(e);
    totalErrors++;
  });

  return { evaluations, totalErrors };
}

export function getErrors(type, value, validations, expected_type) {
  if (type !== expected_type && expected_type !== "mixed") return { count: 1, typeError: true };
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
      if (expected_type !== "mixed") {
        //all validation failed
        const errors = { count: 0 };
        validations.forEach(({ name }) => {
          errors[name] = true;
          errors.count++;
        });
        return errors;
      } else return { count: 0 };
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

const validateLength = (item, validations) => {
  const errors = { count: 0 };
  validations.forEach(({ name, value }) => {
    if (name === "lengthEquals") {
      errors[name] = item.length !== value;
      if (errors[name]) errors.count++;
    }
    if (name === "maxLength") {
      errors[name] = item.length > value;
      if (errors[name]) errors.count++;
    }
    if (name === "minLength") {
      errors[name] = item.length < value;
      if (errors[name]) errors.count++;
    }
  });

  return errors;
};

const validateNumber = (num, validations) => {
  const errors = { count: 0 };
  validations.forEach(({ name, value }) => {
    if (name === "numEquals") {
      errors[name] = num !== value;
      if (errors[name]) errors.count++;
    }
    if (name === "max") {
      errors[name] = num > value;
      if (errors[name]) errors.count++;
    }
    if (name === "min") {
      errors[name] = num < value;
      if (errors[name]) errors.count++;
    }
    if (name === "isOneOf") {
      value += "";
      if (value) {
        errors[name] = !value
          .split(",")
          .map((v) => parseInt(v))
          .includes(num);
        if (errors[name]) errors.count++;
      }
    }
  });

  return errors;
};

const validateArray = (arr, validations) => {
  const errors = validateLength(arr, validations);
  validations.forEach(({ name, value }) => {
    if (name === "includes") {
      errors[name] = arr.includes(value);
      if (errors[name]) errors.count++;
    }
  });

  return errors;
};

const validateString = (str, validations) => {
  const errors = validateLength(str, validations);
  validations.forEach(({ name, value }) => {
    if (name === "strEquals") {
      errors[name] = str !== value;
      if (errors[name]) errors.count++;
    }
    if (name === "isLike") {
      const regex = new RegExp(value, "gi");
      errors[name] = !str.match(regex);
      if (errors[name]) errors.count++;
    }
    if (name === "isOneOf") {
      if (value) {
        errors[name] = !value
          .split(",")
          .map((v) => v.trim())
          .includes(str);
        if (errors[name]) errors.count++;
      }
    }
  });

  return errors;
};

const validateBoolean = (bool, validations) => {
  const errors = { count: 0 };
  validations.forEach(({ name, value }) => {
    if ((name === "boolEquals") === true) {
      errors[name] = bool !== value;
      if (errors[name]) errors.count++;
    }
  });

  return errors;
};

const validateDate = (datetime, validations) => {
  const errors = { count: 0 };
  validations.forEach(({ name, value }) => {
    if (name === "dateEquals") {
      errors[name] = !moment(datetime).isSame(value);
      if (errors[name]) errors.count++;
    }
    if (name === "maxDate") {
      errors[name] = moment(datetime).isAfter(value);
      if (errors[name]) errors.count++;
    }
    if (name === "minDate") {
      errors[name] = moment(datetime).isBefore(value);
      if (errors[name]) errors.count++;
    }
  });

  return errors;
};
