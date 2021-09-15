import React, { useState } from "react";
import moment from "moment";
import QuickTestSection from "../QuickTestSection/QuickTestSection";
import ExpandableSection from "../../molecules/ExpandableSection/ExpandableSection";
import ValidationInput from "../../molecules/ValidationInput/ValidationInput";
import Selector from "../../atoms/Selector/Selector";
import "./styles.scss";

const FullTestSection = ({ project_code, service_id, module_name, method_name }) => {
  const [testResults, setTestResults] = useState({
    evaluations: [],
    missingProperties: [],
    totalErors: 0,
  });

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
        <Evaluations
          evaluations={testResults.evaluations}
          missingProperties={testResults.missingProperties}
          totalErors={testResults.totalErors}
        />
      </QuickTestSection>
    </section>
  );
};
const options = ["number", "date", "string", "array", "boolean", "object", "undefined", "null"];
const Evaluations = ({ evaluations, missingProperties, totalErors }) => {
  console.log(evaluations);

  return (
    <div className={`evaluations evaluations--visible-${evaluations.length > 0}`}>
      <ExpandableSection
        title={
          <div className={`evaluations__title evaluations--error-${totalErors > 0}`}>
            <span className="evaluations__namespace">
              {totalErors > 0 ? "Test Failed: " : "Test Passed: "}
            </span>
            <span className={`evaluations__type evaluations--error-${totalErors > 0}`}>
              {totalErors} errors
            </span>
          </div>
        }
      >
        {evaluations.map(({ namespace, type, value, errors, validations }, i) => {
          return type !== "object" ? (
            <ExpandableSection
              title={
                <div className={`evaluations__title evaluations--error-${errors.count > 0}`}>
                  <span className="evaluations__namespace">{namespace}: </span>
                  <Selector
                    className="evaluations__type"
                    options={options}
                    selected_option={type}
                  />
                </div>
              }
            >
              <div key={i} className="evaluations__row">
                <span
                  className={`evaluations__input evaluations__input--visible-${type !== "object"}`}
                >
                  {validations.map(({ name, value }, i) => {
                    return (
                      <ValidationInput
                        key={i}
                        className={`evaluations--errors-${errors[name]}`}
                        type={type}
                        name={name}
                        value={value}
                      />
                    );
                  })}
                </span>
              </div>
            </ExpandableSection>
          ) : (
            <ExpandableSection
              title={
                <div className="evaluations__title">
                  <span className="evaluations__namespace">{namespace}: </span>
                  <span className="evaluations__type">{type}</span>
                </div>
              }
              lock={true}
            ></ExpandableSection>
          );
        })}
      </ExpandableSection>
    </div>
  );
};

const validateResults = (results, namespace, savedEvaluations = []) => {
  const evaluations = [{ namespace, type: "object" }];
  let totalErors = 0;
  const recursiveEval = (obj, previousNamespace) => {
    const propNames = Object.getOwnPropertyNames(obj);
    propNames.forEach((prop_name) => {
      const currentNamesapce = previousNamespace + "." + prop_name;
      const type = getType(obj[prop_name]);
      const value = obj[prop_name];

      const i = savedEvaluations.findIndex((val) => (val.namespace = currentNamesapce));
      const savedEval = i !== -1 ? savedEvaluations.splice(i, 1) : {};
      const validations = savedEval.validations || [];
      const errors = getErrors(type, value, validations, savedEval.type || type);
      totalErors += errors.count;
      evaluations.push({ namespace: currentNamesapce, type, value, errors, validations });
      if (type === "object") recursiveEval(obj[prop_name], currentNamesapce);
      if (type === "array") recursiveEval(obj[prop_name][0], currentNamesapce + "[0]");
    });
  };
  recursiveEval(results, namespace);
  savedEvaluations.forEach((e) => {
    e.errors = { count: 1, missingNamespace: true };
    evaluations.push(e);
    totalErors++;
  });

  return { evaluations, totalErors };
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
  if (type !== expected_type) return { count: 1, typeError: true };

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
    default:
      return { count: 0 };
  }
};
const validateLength = (item, validations) => {
  const errors = { count: 0 };
  validations.forEach(({ name, value }) => {
    if (name === "lengthEquals") {
      errors.lengthEquals = item.length !== value;
      if (errors.length) errors.count++;
    }
    if (name === "maxLength") {
      errors.maxLength = item.length > value;
      if (errors.maxLength) errors.count++;
    }
    if (name === "minLength") {
      errors.minLength = item.length < value;
      if (errors.minLength) errors.count++;
    }
  });

  return errors;
};
const validateNumber = (num, validations) => {
  const errors = { count: 0 };
  validations.forEach(({ name, value }) => {
    if (name === "equals") {
      errors.equals = num !== value;
      if (errors.length) errors.count++;
    }
    if (name === "maxLength") {
      errors.max = num > value;
      if (errors.max) errors.count++;
    }
    if (name === "min") {
      errors.min = num < value;
      if (errors.min) errors.count++;
    }
    if (name === "isOneOf") {
      errors.isOneOf = value.includes(num);
      if (errors.isOneOf) errors.count++;
    }
  });

  return errors;
};
const validateArray = (arr, validations) => {
  const errors = validateLength(arr, validations);
  validations.forEach(({ name, value }) => {
    if (name === "includes") {
      errors.includes = !value.includes.every((val) => arr.includes(val));
      if (errors.includes) errors.count++;
    }
  });

  return errors;
};
const validateString = (str, validations) => {
  const errors = validateLength(str, validations);
  validations.forEach(({ name, value }) => {
    if (name === "equals") {
      errors.equals = str !== value;
      if (errors.equals) errors.count++;
    }
    if (name === "isLike") {
      errors.isLike = !str.match(value);
      if (errors.isLike) errors.count++;
    }
    if (name === "isOneOf") {
      errors.isOneOf = !value.isOneOf.includes(str);
      if (errors.isOneOf) errors.count++;
    }
  });

  return errors;
};
const validateBoolean = (bool, validations) => {
  const errors = { count: 0 };
  validations.forEach(({ name, value }) => {
    if ((name === "equals") === true) {
      errors.equals = bool !== value;
      if (errors.equals) errors.count++;
    }
  });

  return errors;
};

const validateDate = (datetime, validations) => {
  const errors = { count: 0 };
  validations.forEach(({ name, value }) => {
    if (name === "dateEquals") {
      errors.dateEquals = !moment(datetime).isSame(value);
      if (errors.length) errors.count++;
    }
    if (name === "maxDate") {
      errors.maxDate = moment(datetime).isAfter(value);
      if (errors.maxDate) errors.count++;
    }
    if (name === "minDate") {
      errors.minDate = moment(datetime).isBefore2(value);
      if (errors.minDate) errors.count++;
    }
  });

  return errors;
};

export default FullTestSection;
