import React, { useState, useEffect } from "react";
import ExpandableSection from "../../molecules/ExpandableSection/ExpandableSection";
import ValidationInput from "../../molecules/ValidationInput/ValidationInput";
import ValidationOptions, {
  inputToTypes,
} from "../../molecules/ValidationInput/ValidationOptions";
import TypeSelector from "../../atoms/TypeSelector/TypeSelector";
import { getErrors, defaultValue } from "../../molecules/ValidationInput/validator";
import Count from "../../atoms/Count";
import { endsWithArrayIndex } from "./components/test-helpers";

const validationCount = (evaluations) =>
  evaluations.reduce((sum, e) => (e.save ? e.validations.length + 1 : 0) + sum, 0);
export default function Evaluations({ test, updateTests }) {
  const { evaluations, errors } = test;
  const [open, setOpen] = useState(false);
  const [saveAll, setSaveAll] = useState(!test.savedEvaluations.length);
  const [totalValidations, setTotalValidations] = useState(
    validationCount(test.evaluations)
  );
  const toggleExpansion = () => {
    setOpen((state) => !state);
  };

  const updateEvaluation = (evaluation) => {
    evaluation.errors = getErrors(evaluation);
    test.addEvaluation(evaluation);
    test.errors = test.getErrors();
    updateTests();
  };

  const addValidation = (x) => {
    const { expected_type } = evaluations[x];
    const input_type = ValidationOptions[expected_type].inputs[0];
    evaluations[x].validations.push({
      name: ValidationOptions[expected_type].values[0],
      value: defaultValue(inputToTypes[input_type]),
    });
    updateEvaluation(evaluations[x]);
    setTotalValidations(validationCount(evaluations));
  };

  const deleteValidation = (x, y) => {
    evaluations[x].validations.splice(y, 1);
    updateEvaluation(evaluations[x]);
    setTotalValidations(validationCount(evaluations));
  };

  const updateValidations = (x, y, p, v) => {
    evaluations[x].validations[y][p] = v;
    updateEvaluation(evaluations[x]);
  };

  const updateExpectedType = (x, e) => {
    evaluations[x].expected_type = e.target.value;
    evaluations[x].validations = [];
    updateEvaluation(evaluations[x]);
  };

  const updateSaveStatus = (x, save) => {
    evaluations[x].save = save;
    updateEvaluation(evaluations[x]);
    setTotalValidations(validationCount(evaluations));
  };

  const toggleAllSaveStatuses = () => {
    setSaveAll(!saveAll);
    test.evaluations = test.evaluations.map((e) => ({ ...e, save: !saveAll }));
    test.errors = test.getErrors();
    updateTests();
    setTotalValidations(validationCount(evaluations));
  };

  useEffect(() => {
    if (test.test_end !== null) {
      updateTests(test.evaluations);
    } else {
      updateTests([]);
    }
    if (test.test_end !== null) setTotalValidations(validationCount(test.evaluations));
  }, [test.evaluations, test.test_end]);

  return (
    <div className={`evaluations evaluations--visible-${evaluations.length > 0}`}>
      <ExpandableSection
        open={open}
        toggleExpansion={toggleExpansion}
        title={
          <>
            <div className={`evaluations__title evaluations--error-${errors.length > 0}`}>
              <span className="evaluations__namespace">
                {errors.length > 0 ? "Test Failed: " : "Test Passed: "}
              </span>
              <span
                className={`evaluations__type evaluations--error-${errors.length > 0}`}
              >
                <Count count={errors.length} type={errors.length && "error"} /> errors
              </span>
              <Count count={totalValidations} />{" "}
              <span className="evaluations__total">Total</span>
            </div>
            <input
              className="evaluations__checkbox"
              type="checkbox"
              checked={saveAll}
              onChange={toggleAllSaveStatuses}
            />
          </>
        }
      >
        {evaluations.map(
          (
            { namespace, type, expected_type, save, errors, validations, indexed, value },
            i
          ) => {
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
                updateSaveStatus={updateSaveStatus}
                updateTests={updateTests}
                save={save}
                test={test}
                indexed={indexed}
                value={value}
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
  updateSaveStatus,
  updateTests,
  save,
  test,
  indexed,
  value,
}) => {
  const calcWidth = (text = "") => Math.ceil(text.length / 0.12);
  const [type_width, setWidth] = useState(calcWidth(0));
  const style = { "--type-width": type_width + "px" };
  const [open, setOpen] = useState(errors.length && validations.length);

  const typeError = !!errors.find(({ name }) => name === "typeError");
  const toggleExpansion = () => {
    setOpen((state) => !state);
  };
  const onSelect = (i, e) => {
    updateExpectedType(i, e);
    setWidth(calcWidth(e.target.value));
  };
  const toggleSave = () => updateSaveStatus(index, !save);
  useEffect(
    () => setWidth(calcWidth(expected_type)),

    [expected_type, type_width]
  );

  useEffect(() => {
    if (errors.length && validations.length) setOpen(true);
  }, [errors]);
  return (
    <ExpandableSection
      open={open}
      toggleExpansion={toggleExpansion}
      title={
        <>
          <div className={`evaluations__title`} style={style}>
            {endsWithArrayIndex(namespace) ? (
              <ArrayNamespace
                updateTests={updateTests}
                namespace={namespace}
                test={test}
                indexed={indexed}
                value={value}
              />
            ) : (
              <span
                className={`evaluations__namespace evaluations--error-${
                  errors.length > 0
                }`}
              >
                {namespace}:{" "}
              </span>
            )}
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
            {!!validations.length && <Count count={validations.length} />}
          </div>
          <input
            className="evaluations__checkbox"
            type="checkbox"
            checked={save}
            onChange={toggleSave}
          />
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

function ArrayNamespace({ namespace, errorCount, updateTests, test, indexed, value }) {
  const [name = "", index = ""] = namespace.split(/(\[\d+\])$/);
  const [open, setOpen] = useState(false);
  const [isIndexed, setIsIndexed] = useState(!!indexed);
  const [testIndex, setIndex] = useState(parseInt(index.substr(1, index.length - 1)));

  const inputChange = (e) => setIndex(parseInt(e.target.value));
  const add = () => {
    // push ensures that the evaluation namespace is add and not overwritten
    test.savedEvaluations.push({
      namespace: `${name}[${testIndex + 1}]`,
      save: true,
      indexed: true,
    });

    if (!indexed)
      //add the current index because the test will only use the one
      //saved index, but we need the current index to stay as well
      test.addSavedIndices(namespace, `${name}[${testIndex}]`);

    test.validate();
    updateTests();
    setOpen(false);
  };
  const show = () => setOpen(true);

  const hide = () => {
    test.removeSavedIndices(namespace);
    if (isIndexed) {
      test.addSavedIndices(namespace, `${name}[${testIndex}]`);
    } else {
      const e = test.evaluations.find((e) => e.namespace === namespace);
      if (e) {
        e.indexed = false;
        e.expected_type = undefined;
        test.addEvaluation(e);
      }
    }
    test.validate();
    updateTests();
    setOpen(false);
  };
  const handleCheck = (e) => setIsIndexed(e.target.checked);

  useEffect(() => setIsIndexed(!!indexed), [indexed]);
  useEffect(() => {
    const [name = "", index = ""] = namespace.split(/(\[\d+\])$/);
    setIndex(parseInt(index.substr(1, index.length - 1)));
  }, [namespace]);

  return (
    <span className={`evaluations__namespace evaluations--error-${errorCount > 0}`}>
      <span>{name}</span>
      {!open ? (
        <span
          onClick={show}
          className={`evaluations__index-button btn evaluations__index-button--indexed-${isIndexed}`}
        >
          {index}
        </span>
      ) : (
        <span className={`evaluations__index-button`}>
          <span className="evaluations__brackets">{"["}</span>
          {isIndexed ? (
            <input
              className="evaluations__index-input"
              type={"number"}
              onChange={inputChange}
              min={0}
              //max={value.length}
              value={testIndex}
            />
          ) : (
            <span className="evaluations__random">random</span>
          )}
          <input
            className="evaluations__index-checkbox"
            checked={isIndexed}
            onChange={handleCheck}
            type={"checkbox"}
          />
          <span onClick={add} className="evaluations__add-index-btn btn">
            +
          </span>
          <span className="evaluations__brackets">{"]"}</span>
          <span onClick={hide} className="evaluations__clear-error btn">
            ×
          </span>
        </span>
      )}
      :{" "}
    </span>
  );
}
