import React, { useState, useEffect } from "react";
import ExpandableSection from "../../molecules/ExpandableSection/ExpandableSection";
import ValidationInput from "../../molecules/ValidationInput/ValidationInput";
import validation_options from "../../molecules/ValidationInput/ValidationOptions";
import TypeSelector from "../../atoms/TypeSelector/TypeSelector";
import { getErrors } from "../../molecules/ValidationInput/validator";

export default function Evaluations({ test, updateEvaluations }) {
  const { evaluations, errors } = test;
  const [open, setOpen] = useState(false);

  const toggleExpansion = () => {
    setOpen((state) => !state);
  };

  const addValidation = (x) => {
    const { expected_type, type } = evaluations[x];

    evaluations[x].validations.push({
      name: validation_options[expected_type].values[0],
      value:
        expected_type === "number" || (expected_type === "mixed" && type === "number")
          ? 0
          : "",
    });

    evaluations[x].errors = getErrors(evaluations[x]);
    updateEvaluations(evaluations);
  };

  const deleteValidation = (x, y) => {
    evaluations[x].validations.splice(y, 1);
    evaluations[x].errors = getErrors(evaluations[x]);
    updateEvaluations(evaluations);
  };

  const updateValidations = (x, y, p, v) => {
    evaluations[x].validations[y][p] = v;
    evaluations[x].errors = getErrors(evaluations[x]);
    updateEvaluations(evaluations);
  };

  const updateExpectedType = (x, e) => {
    evaluations[x].expected_type = e.target.value;
    evaluations[x].validations = [];
    evaluations[x].errors = getErrors(evaluations[x]);
    updateEvaluations(evaluations);
  };

  useEffect(() => {
    if (test.test_end !== null) {
      updateEvaluations(test.evaluations);
    } else {
      updateEvaluations([]);
    }
  }, [test.test_end]);

  return (
    <div className={`evaluations evaluations--visible-${evaluations.length > 0}`}>
      <ExpandableSection
        open={open}
        toggleExpansion={toggleExpansion}
        title={
          <div className={`evaluations__title evaluations--error-${errors.length > 0}`}>
            <span className="evaluations__namespace">
              {errors.length > 0 ? "Test Failed: " : "Test Passed: "}
            </span>
            <span className={`evaluations__type evaluations--error-${errors.length > 0}`}>
              {errors.length} errors
            </span>
          </div>
        }
      >
        {evaluations.map(
          ({ namespace, type, expected_type, value, errors, validations }, i) => {
            return (
              <EvaluationRow
                key={i}
                namespace={namespace}
                type={type}
                expected_type={expected_type}
                errors={errors}
                validations={validations}
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
  index,
  addValidation,
  deleteValidation,
  updateValidations,
  updateExpectedType,
}) => {
  const calcWidth = (text) => Math.ceil(text.length / 0.1125);
  const [type_width, setWidth] = useState(calcWidth(0));
  const style = { "--type-width": type_width + "px" };
  const [open, setOpen] = useState(false);

  const typeError = !!errors.find(({ name }) => name === "typeError");
  const toggleExpansion = () => {
    setOpen((state) => !state);
  };
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
      open={open}
      toggleExpansion={toggleExpansion}
      title={
        <>
          <div className={`evaluations__title`} style={style}>
            <span
              className={`evaluations__namespace evaluations--error-${errors.length > 0}`}
            >
              {namespace}:{" "}
            </span>

            <TypeSelector
              default_type={expected_type}
              onSelect={onSelect.bind(this, index)}
            />
            <span
              className={`evaluations__type-error-msg 
              evaluations__type-error-msg--${typeError} 
              evaluations--error-${typeError}`}
            >
              (received {type})
            </span>
          </div>
          <input type="checkbox" />
        </>
      }
    >
      <div className="evaluations__row">
        <span
          className={`evaluations__input evaluations__input--visible-${
            expected_type !== "object" &&
            expected_type !== "null" &&
            expected_type !== "undefined"
          }`}
        >
          <div className="evaluations__add-btn-container">
            <span
              className="evaluations__add-validation-btn btn"
              onClick={addValidation.bind(this, index)}
            >
              +
            </span>
          </div>
          <div className="evaluations__validation-container">
            {validations.map(({ name, value }, i) => {
              const isError = !!errors.find(({ name: errName }) => errName === name);
              return (
                <div className="evaluations__validation" key={i}>
                  <ValidationInput
                    className={`evaluations--error-${isError} evaluations__validation__input`}
                    type={expected_type}
                    name={name}
                    value={value}
                    onSelect={updateValidations.bind(this, index, i, "name")}
                    onInputChanged={updateValidations.bind(this, index, i, "value")}
                  />
                  <span
                    className="evaluations__validation__delete-btn btn"
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
