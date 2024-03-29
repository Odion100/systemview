import React, { useEffect, useState } from "react";
import Count from "../../atoms/Count";
import TestCaption from "../TestCaption/TestCaption";
import CHECK from "../../assets/check.svg";
import ERROR from "../../assets/error.svg";
import ARROW from "../../assets/arrow.png";
import LOADING from "../../assets/loading.gif";
import "./styles.scss";
import ExpandIcon from "../../atoms/ExpandableIcon/ExpandableIcon";
import { Argument } from "../Args/Args";
import ValidationMessage from "../ValidationInput/ValidationMessages";

const CLASS_NAME = "test-summary";
export default function TestSummary({ testSection = [], section, isTesting }) {
  const [open, setOpen] = useState(false);
  const toggleExpansion = () => {
    setOpen((state) => !state);
  };

  const validationCount = testSection.reduce((sum, test) => {
    test.totalValidations = test.savedEvaluations.reduce(
      (sum, { type, expected_type, namespace, validations }) => {
        sum.push({
          name: "typeError",
          expected: expected_type,
          received: type,
          namespace,
        });

        return sum.concat(
          validations.map(({ name, value }) => ({ name, expected: value, namespace }))
        );
      },
      []
    );

    return (sum += test.totalValidations.length);
  }, 0);

  const errorCount = testSection.reduce((sum, { errors }) => (sum += errors.length), 0);

  useEffect(() => {
    setOpen(true);
  }, [isTesting]);
  return (
    <section className={`${CLASS_NAME}`}>
      <div className={`${CLASS_NAME}__header`}>
        <ExpandIcon color="#0d8065" isOpen={open} onClick={toggleExpansion} />

        <TestCaption
          caption={
            <div className={`${CLASS_NAME}__caption--${section}`}>
              <span>{section + " Test"}:</span>
              <span>
                <Count count={testSection.length} stat="actions" />
                <Count
                  count={validationCount}
                  stat="validations"
                  type={!!validationCount && "caution"}
                />
              </span>
              <span>
                <Count count={errorCount} stat="errors" type={!!errorCount && "error"} />
              </span>
            </div>
          }
        />
      </div>
      {open && (
        <div>
          {testSection.map((test, i) => (
            <Test key={i} {...test} />
          ))}
        </div>
      )}
    </section>
  );
}
function Test({
  title,
  errors = [],
  namespace,
  args,
  results,
  test_end,
  test_start,
  response_type,
  totalValidations,
}) {
  const filterPassingValidations = (tv) =>
    tv.filter(
      (v) => !errors.find((e) => e.namespace === v.namespace && e.name === v.name)
    );

  const [open, setOpen] = useState(false);
  const toggleExpansion = () => {
    setOpen((state) => !state);
  };

  return (
    <div>
      <div className={`${CLASS_NAME}__actions`}>
        <span className={`${CLASS_NAME}__action-text`}>
          <ExpandIcon color="black" onClick={toggleExpansion} isOpen={open} /> {title}
        </span>
        {!!test_start && !test_end && (
          <img src={LOADING} alt="check" style={{ width: "18px" }} />
        )}
        {/* <img src={LOADING} alt="check" style={{ width: "18px" }} /> */}

        {!!test_end && (
          <>
            {errors.length ? (
              <img src={ERROR} alt="check" style={{ width: "18px" }} />
            ) : (
              <img src={CHECK} alt="check" style={{ width: "18px" }} />
            )}
          </>
        )}
      </div>
      {open && (
        <>
          <TestMethod namespace={namespace} args={args} />
          {!!test_end && (
            <>
              <TestResponse results={results} response_type={response_type} />
              {!!errors.length && (
                <TestValidations title={"failing validations"} validations={errors} />
              )}
            </>
          )}

          <TestValidations
            title={`${!test_end ? "total" : "passing"} validations`}
            validations={filterPassingValidations(totalValidations)}
            isError={false}
          />
        </>
      )}
    </div>
  );
}

function TestMethod({ namespace, args }) {
  const { serviceId, moduleName, methodName } = namespace;
  return (
    <div className={`${CLASS_NAME}__method`}>
      <img className={`${CLASS_NAME}__arrow`} src={ARROW} alt="arrow" />
      <span
        className={`${CLASS_NAME}__namespace`}
      >{`${serviceId}.${moduleName}.${methodName}`}</span>
      <span className={`${CLASS_NAME}__parentheses`}>(</span>
      {args.map(({ data_type, value, targetValues }, i) => (
        <React.Fragment key={i}>
          <span className={`${CLASS_NAME}__parameter`}>
            {!!targetValues.length && "tv:"}
            <Argument value={value()} data_type={data_type} />
          </span>
          {i < args.length - 1 && <span className={`${CLASS_NAME}__comma`}>,</span>}
        </React.Fragment>
      ))}
      <span className={`${CLASS_NAME}__parentheses`}>)</span>
    </div>
  );
}

function TestResponse({ results = mock, response_type = "results" }) {
  return (
    <div className={`${CLASS_NAME}__method`}>
      <img className={`${CLASS_NAME}__arrow`} src={ARROW} alt="arrow" />
      <span className={`${CLASS_NAME}__results`}>{response_type}:</span>
      <Argument value={results} />
    </div>
  );
}

function TestValidations({ validations = [], isError = true, title }) {
  // const color = ;
  const color = isError ? "#f44336" : "#2aa198";
  const [open, setOpen] = useState(isError);
  const toggleExpansion = () => {
    setOpen((state) => !state);
  };

  return (
    <div>
      <div className={`${CLASS_NAME}__method ${CLASS_NAME}__validations`}>
        <img className={`${CLASS_NAME}__arrow`} src={ARROW} alt="arrow" />
        <span style={{ color }} className={`${CLASS_NAME}__results`}>
          {validations.length} {title}:
        </span>
        <ExpandIcon onClick={toggleExpansion} isOpen={open} color={"#2aa198"} size={10} />
      </div>
      {open && (
        <>
          {validations.map((error, i) => {
            return <ValidationMessage key={i} {...error} error={isError} />;
          })}
        </>
      )}
    </div>
  );
}

const mock = {
  host: "localhost",
  route: "/bu/api/basketball",
  port: 4100,
  serviceUrl: "http://localhost:4100/bu/api/basketball",
  namespace: "http://localhost:2923/vRwTJOske",
  SystemLynxService: true,
};
