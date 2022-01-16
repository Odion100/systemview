import React, { useState, useEffect } from "react";
import ExpandableSection from "../../molecules/ExpandableSection/ExpandableSection";
import ValidationInput from "../../molecules/ValidationInput/ValidationInput";
import validation_options from "../../molecules/ValidationInput/ValidationOptions";
import TypeSelector from "../../atoms/TypeSelector/TypeSelector";

import { getErrors } from "../FullTestWrapper/validations";

export default function Evaluations({ test }) {
  console.log(test);
  const [currentEvaluations, updateEvaluations] = useState([]);
  const [errorCount, setErrorCount] = useState(0);
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

  useEffect(() => {
    console.log(test);
    if (test.test_end !== null) {
      updateEvaluations(test.evaluations);
      setErrorCount(test.total_errors);
    } else {
      updateEvaluations([]);
      setErrorCount(0);
    }
  }, [test.test_end]);

  return (
    <div className={`evaluations evaluations--visible-${currentEvaluations.length > 0}`}>
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
}

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

          <TypeSelector default_type={expected_type} onSelect={onSelect.bind(this, index)} />
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
