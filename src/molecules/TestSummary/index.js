import React, { useEffect, useState } from "react";
import Count from "../../atoms/Count";
import TestCaption from "../TestCaption/TestCaption";
import CHECK from "../../assets/check.svg";
import ERROR from "../../assets/error.svg";
import ARROW from "../../assets/arrow.png";
import "./styles.scss";
import ExpandIcon from "../../atoms/ExpandableIcon/ExpandableIcon";
import { Argument } from "../Args/Args";
import Test from "../../organisms/FullTest/components/Test.class";
import ValidationMessage from "../ValidationInput/ValidationMessages";

const CLASS_NAME = "test-summary";
export default function TestSummary({ testSection = [], section, isTesting }) {
  const [open, setOpen] = useState(false);
  const toggleExpansion = () => {
    setOpen((state) => !state);
  };

  console.log(new Test(testSection[0]));

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
                <Count count={validationCount} stat="validations" />
              </span>
              <span>
                {!errorCount ? (
                  <Count count={errorCount} stat="errors" />
                ) : (
                  <Count count={errorCount} stat="errors" type={"error"} />
                )}
              </span>
            </div>
          }
        />
      </div>
      {open && (
        <div>
          {testSection.map((test, i) => (
            <Action key={i} {...test} />
          ))}
        </div>
      )}
    </section>
  );
}
function Action({
  title,
  errors = [],
  namespace,
  args,
  results,
  test_end,
  response_type,
  totalValidations,
}) {
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
              {!!errors.length && <TestValidations errors={errors} />}
            </>
          )}
          {!!totalValidations.length && (
            <TestValidations errors={totalValidations} isError={false} />
          )}
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
      {args.map(({ input, data_type }, i) => (
        <span key={i} className={`${CLASS_NAME}__parameter`}>
          <Argument value={input} data_type={data_type} />
          {i < args.length - 1 && <span className={`${CLASS_NAME}__comma`}>,</span>}
        </span>
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

function TestValidations({ errors = [], isError = true }) {
  // const color = ;
  const color = isError ? "#f44336" : "#2aa198";
  const [open, setOpen] = useState(isError);
  const toggleExpansion = () => {
    setOpen((state) => !state);
  };
  const title = isError ? " failing validations:" : " total validations:";
  return (
    <div>
      <div className={`${CLASS_NAME}__method ${CLASS_NAME}__validations`}>
        <img className={`${CLASS_NAME}__arrow`} src={ARROW} alt="arrow" />
        <span style={{ color }} className={`${CLASS_NAME}__results`}>
          {errors.length} {title}
        </span>
        <ExpandIcon onClick={toggleExpansion} isOpen={open} color={"#2aa198"} size={10} />
      </div>
      {open && (
        <>
          {errors.map((error, i) => {
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
