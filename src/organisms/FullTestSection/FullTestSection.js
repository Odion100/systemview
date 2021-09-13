import React, { useState } from "react";
import moment from "moment";
import QuickTestSection from "../QuickTestSection/QuickTestSection";
import ExpandableSection from "../../molecules/ExpandableSection/ExpandableSection";
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
        <Evaluations savedEvaluations={evals.saved} />
      </QuickTestSection>
    </section>
  );
};

const Evaluations = ({ currentEvaluations, savedEvaluations = [] }) => {
  const validations = [
    { test: "max", against_types: ["number", "date"] },
    { test: "min", against_types: ["number", "date"] },
    { test: "length", against_types: ["string", "array"] },
    { test: "max-lenght", against_types: ["string", "array"] },
    { test: "min-lenght", against_types: ["string", "array"] },
    { test: "includes", against_types: ["array"] },
    { test: "like", against_types: ["string"] },
    { test: "equals", against_types: ["any"] },
  ];

  return (
    <div className={`evaluations evaluations--visible-${savedEvaluations.length > 0}`}>
      <ExpandableSection
        title={
          <div className="evaluations__title">
            <span className="evaluations__namespace">Test Passed: </span>
            <span className="evaluations__type">0 errors</span>
          </div>
        }
      >
        {savedEvaluations.map(
          ({ namespace, type, max, min, length, max_length, min_length, like, equals }, i) => {
            return type !== "object" ? (
              <ExpandableSection
                title={
                  <div className="evaluations__title">
                    <span className="evaluations__namespace">{namespace}: </span>
                    <span className="evaluations__type">{type}</span>
                  </div>
                }
              >
                <div key={i} className="evaluations__row">
                  <span
                    className={`evaluations__input evaluations__input--${
                      type === "number" ? "number" : "string"
                    } evaluations__input--visible-${type !== "array"}`}
                  >
                    should equal: <input type={type === "number" ? "number" : "string"} />
                  </span>
                  <span
                    className={`evaluations__input evaluations__input--number evaluations__input--visible-${
                      type === "number"
                    }`}
                  >
                    should be less than: <input type="number" />
                  </span>
                  <span
                    className={`evaluations__input evaluations__input--number evaluations__input--visible-${
                      type === "number"
                    }`}
                  >
                    should be greater than: <input type="number" />
                  </span>
                  <span
                    className={`evaluations__input evaluations__input--dates evaluations__input--visible-${
                      type === "date"
                    }`}
                  >
                    should have length less than: <input type="string" />
                  </span>
                  <span
                    className={`evaluations__input evaluations__input--dates evaluations__input--visible-${
                      type === "date"
                    }`}
                  >
                    should have length greater than: <input type="string" />
                  </span>
                  <span
                    className={`evaluations__input evaluations__input--string--${
                      type === "string"
                    } evaluations__input--array evaluations__input--visible-${type === "array"}`}
                  >
                    should have length less than: <input type="number" />
                  </span>
                  <span
                    className={`evaluations__input evaluations__input--string--${
                      type === "string"
                    } evaluations__input--array evaluations__input--visible-${type === "array"}`}
                  >
                    should have length greater than: <input type="number" />
                  </span>
                  <span
                    className={`evaluations__input evaluations__input--array evaluations__input--visible-${
                      type === "array"
                    }`}
                  >
                    should include: <input type="string" />
                  </span>
                  <span
                    className={`evaluations__input evaluations__input--string evaluations__input--visible-${
                      type === "string"
                    }`}
                  >
                    should be like': <input type="string" />
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

const getType = (value) => {
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
export default FullTestSection;
