import React, { useState } from "react";
import moment from "moment";
import QuickTestSection from "../QuickTestSection/QuickTestSection";
import ExpandableSection from "../../molecules/ExpandableSection/ExpandableSection";
import ValidationInput from "../../molecules/ValidationInput/ValidationInput";
import Selector from "../../atoms/Selector/Selector";
import "./styles.scss";

const FullTestSection = ({ project_code, service_id, module_name, method_name }) => {
  const [evals, setEvals] = useState({ saved: [], current: [] });

  const quickTestSubmit = (results, namespace) => {
    const test = evaluateResults(results, namespace);
    setEvals({ saved: test, current: test });
  };

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
        <Evaluations savedValidations={evals.saved} currentEvaluations={evals.current} />
      </QuickTestSection>
    </section>
  );
};
const options = ["number", "date", "string", "array", "boolean", "object", "undefined"];
const Evaluations = ({ currentEvaluations, savedValidations = [] }) => {
  const [errorCount, setErrorCount] = useState(0);
  const count = 0;
  return (
    <div className={`evaluations evaluations--visible-${savedValidations.length > 0}`}>
      <ExpandableSection
        title={
          <div className="evaluations__title">
            <span className="evaluations__namespace">Test Passed: </span>
            <span className="evaluations__type">0 errors</span>
          </div>
        }
      >
        {savedValidations.map(
          ({ namespace, type, max, min, length, max_length, min_length, like, equals }, i) => {
            //compare the current Evaluation result to the save
            const currentEval = currentEvaluations.find((evaluation) => {
              return evaluation.namespace === namespace;
            });

            return type !== "object" ? (
              <ExpandableSection
                title={
                  <div className="evaluations__title">
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
                    className={`evaluations__input evaluations__input--visible-${
                      type !== "object"
                    }`}
                  >
                    <ValidationInput type={type} /> <ValidationInput type={type} />{" "}
                    <ValidationInput type={type} />
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
          }
        )}
      </ExpandableSection>
    </div>
  );
};

const evaluateResults = (results, namespace) => {
  const evaluations = [{ namespace, type: "object" }];

  const recursiveEval = (obj, previousNamespace) => {
    const propNames = Object.getOwnPropertyNames(obj);
    propNames.forEach((prop_name) => {
      const currentNamesapce = previousNamespace + "." + prop_name;
      const type = getType(obj[prop_name]);
      const value = obj[prop_name];
      evaluations.push({ namespace: currentNamesapce, type, value });
      if (type === "object") recursiveEval(obj[prop_name], currentNamesapce);
      if (type === "array") recursiveEval(obj[prop_name][0], currentNamesapce + "[0]");
    });
  };
  recursiveEval(results, namespace);
  return evaluations;
};

const getType = (value, validations) => {
  switch (true) {
    case typeof value === "object":
      if (!value) return null;
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

const validateLength = (string, validations) => {
  const errors = { count: 0 };
  if (validations.lengthEquals || (validations.lengthEquals = 0)) {
    if (string.length !== validations.lengthEquals) {
      errors.count++;
      errors.lengthEquals = true;
    }
  }
  if (validations.maxLength || (validations.maxLength = 0)) {
    if (string.length > validations.maxLength) {
      errors.count++;
      errors.maxLength = true;
    }
  }
  if (validations.minLength || (validations.minLength = 0)) {
    if (string.length < validations.minLength) {
      errors.count++;
      errors.minLength = true;
    }
  }
  return errors;
};
const validateArray = (array, validations) => {
  const errors = validateLength(array, validations);
  if (validations.includes) {
    const test_passed = validations.includes.every((value) => array.includes(value));
    if (!test_passed) {
      errors.count++;
      errors.includes = true;
    }
  }
};
const validateString = (array, validations) => {
  const errors = validateLength(array, validations);
};

export default FullTestSection;
