import React, { useState, useEffect } from "react";
import moment from "moment";
import QuickTestSection from "../QuickTestSection/QuickTestSection";
import ExpandableSection from "../../molecules/ExpandableSection/ExpandableSection";
import ValidationInput from "../../molecules/ValidationInput/ValidationInput";
import validation_options from "../../molecules/ValidationInput/ValidationOptions";
import Selector from "../../atoms/Selector/Selector";
import "./styles.scss";

const FullTestSection = ({ project_code, service_id, module_name, method_name }) => {
  const [testResults, setTestResults] = useState({ evaluations: [], totalErrors: 0 });
  const quickTestSubmit = (results, namespace) =>
    setTestResults(validateResults(results, namespace, []));
  return (
    <section className="current-data-section">
      <QuickTestSection
        project_code={project_code}
        service_id={service_id}
        module_name={module_name}
        method_name={method_name}
        title="Test:"
        open={true}
        onSubmit={quickTestSubmit}
      >
        <Evaluations evaluations={testResults.evaluations} totalErrors={testResults.totalErrors} />
      </QuickTestSection>
    </section>
  );
};

const Evaluations = ({ evaluations, totalErrors }) => {
  const [currentEvaluations, updateEvaluations] = useState(evaluations);
  const [errorCount, setErrorCount] = useState(totalErrors);
  const [state, setState] = useState(true);
  const addValidation = (i) => {
    const { expected_type, type } = currentEvaluations[i];

    currentEvaluations[i].validations.push({
      name: validation_options[expected_type].values[0],
      value:
        expected_type === "number" || (expected_type === "mixed" && type === "number") ? 0 : "",
    });

    updateErrors(currentEvaluations[i]);
    updateEvaluations(currentEvaluations);
    setState(!state);
    console.log(currentEvaluations);
  };
  const deleteValidation = (x, y) => {
    currentEvaluations[x].validations.splice(y, 1);
    updateErrors(currentEvaluations[x]);
    updateEvaluations(currentEvaluations);
    setState(!state);
    console.log(currentEvaluations);
  };
  const updateValidations = (x, y, p, v) => {
    currentEvaluations[x].validations[y][p] = v;
    updateErrors(currentEvaluations[x]);
    updateEvaluations(currentEvaluations);
    setState(!state);
    console.log(currentEvaluations);
  };
  const updateExpectedType = (x, e) => {
    currentEvaluations[x].expected_type = e.target.value;
    currentEvaluations[x].validations = [];
    updateErrors(currentEvaluations[x]);
    updateEvaluations(currentEvaluations);
    setState(!state);
    console.log(currentEvaluations);
  };
  const updateErrors = (evaluation) => {
    evaluation.errors = getErrors(
      evaluation.type,
      evaluation.value,
      evaluation.validations,
      evaluation.expected_type
    );
    const count = currentEvaluations.reduce((a, b) => a + b.errors.count, 0);
    setErrorCount(count);
  };
  useEffect(() => updateEvaluations(evaluations), [evaluations]);

  return (
    <div className={`evaluations evaluations--visible-${evaluations.length > 0}`}>
      <ExpandableSection
        title={
          <div className={`evaluations__title evaluations--error-${errorCount > 0}`}>
            <span className="evaluations__namespace">
              {errorCount > 0 ? "Test Failed: " : "Test Passed: "}
            </span>
            <span className={`evaluations__type evaluations--error-${errorCount > 0}`}>
              {errorCount} errors
            </span>
          </div>
        }
      >
        {currentEvaluations.map(
          ({ namespace, type, expected_type, value, errors, validations }, i) => {
            return (
              <EvaluationRow
                key={i}
                namespace={namespace}
                type={type}
                expected_type={expected_type}
                errors={errors}
                validations={validations}
                value={value}
                index={i}
                addValidation={addValidation}
                deleteValidation={deleteValidation}
                updateValidations={updateValidations}
                updateExpectedType={updateExpectedType}
              />
            );
          }
        )}
      </ExpandableSection>
    </div>
  );
};

const options = [
  "number",
  "date",
  "string",
  "array",
  "boolean",
  "object",
  "null",
  "undefined",
  "mixed",
];
const EvaluationRow = ({
  namespace,
  type,
  expected_type,
  errors,
  validations,
  value,
  index,
  addValidation,
  deleteValidation,
  updateValidations,
  updateExpectedType,
}) => {
  const calcWidth = (text) => Math.ceil(text.length / 0.1125);
  const [type_width, setWidth] = useState(calcWidth(0));
  const style = { "--type-width": type_width + "px" };

  const onSelect = (i, e) => {
    updateExpectedType(i, e);
    setWidth(calcWidth(expected_type));
  };

  useEffect(
    () => setWidth(calcWidth(expected_type)),

    [expected_type, type_width]
  );
  return (
    <ExpandableSection
      title={
        <div className={`evaluations__title`} style={style}>
          <span className={`evaluations__namespace evaluations--error-${errors.count > 0}`}>
            {namespace}:{" "}
          </span>

          <Selector
            className="evaluations__type"
            options={options}
            selected_option={expected_type}
            onSelect={onSelect.bind(this, index)}
          />
          <span
            className={`evaluations__type-error-msg 
            evaluations__type-error-msg--${errors.typeError} 
            evaluations--error-${errors.typeError}`}
          >
            (got {type})
          </span>
        </div>
      }
    >
      <div className="evaluations__row">
        <span
          className={`evaluations__input evaluations__input--visible-${
            expected_type !== "object" && expected_type !== "null" && expected_type !== "undefined"
          }`}
        >
          <div className="evaluations__add-btn-container">
            <span
              className="evaluations__add-validation-btn"
              onClick={addValidation.bind(this, index)}
            >
              +
            </span>
          </div>
          <div className="evaluations__validation-container">
            {validations.map(({ name, value }, i) => {
              return (
                <div className="evaluations__validation" key={i}>
                  <ValidationInput
                    className={`evaluations--error-${errors[name]} evaluations__validation__input`}
                    type={expected_type}
                    name={name}
                    value={value}
                    onSelect={updateValidations.bind(this, index, i, "name")}
                    onInputChanged={updateValidations.bind(this, index, i, "value")}
                  />
                  <span
                    className="evaluations__validation__delete-btn"
                    onClick={deleteValidation.bind(this, index, i)}
                  >
                    x
                  </span>
                </div>
              );
            })}
          </div>
        </span>
      </div>
    </ExpandableSection>
  );
};

const validateResults = (results, namespace, savedEvaluations = []) => {
  const evaluations = [
    { namespace, type: "object", expected_type: "object", validations: [], errors: { count: 0 } },
  ];
  let totalErrors = 0;
  const recursiveEval = (obj, previousNamespace) => {
    const propNames = Object.getOwnPropertyNames(obj);
    propNames.forEach((prop_name) => {
      const currentNamesapce = previousNamespace + "." + prop_name;
      const type = getType(obj[prop_name]);
      const value = obj[prop_name];

      const i = savedEvaluations.findIndex((val) => (val.namespace = currentNamesapce));
      const savedEval = i !== -1 ? savedEvaluations.splice(i, 1) : {};
      const validations = savedEval.validations || [];
      const expected_type = savedEval.type || type;
      const errors = getErrors(type, value, validations, expected_type);

      totalErrors += errors.count;
      evaluations.push({
        namespace: currentNamesapce,
        type,
        expected_type,
        value,
        errors,
        validations,
      });
      if (type === "object") recursiveEval(obj[prop_name], currentNamesapce);
      if (type === "array") recursiveEval(obj[prop_name][0], currentNamesapce + "[0]");
    });
  };
  recursiveEval(results, namespace);
  savedEvaluations.forEach((e) => {
    e.errors = { count: 1, missingNamespace: true };
    evaluations.push(e);
    totalErrors++;
  });

  return { evaluations, totalErrors };
};

const getType = (value) => {
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
};
const getErrors = (type, value, validations, expected_type) => {
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
};
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

export default FullTestSection;
