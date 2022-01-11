import React, { useState, useEffect } from "react";
import Evaluations from "./Evaluations";
import QuickTestSection from "../QuickTestSection/QuickTestSection";
import { validateResults } from "./validations";
import "./styles.scss";

const MainTest = ({
  project_code,
  service_id,
  module_name,
  method_name,
  TestController,
  testData,
}) => {
  const [testResults, setTestResults] = useState({ evaluations: [], totalErrors: 0 });
  const quickTestSubmit = (results, namespace) =>
    setTestResults(validateResults(results, namespace, []));
  const clearTestResults = () => setTestResults({ evaluations: [], totalErrors: 0 });

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
        testData={testData}
        TestController={TestController}
        onReset={clearTestResults}
      >
        <Evaluations evaluations={testResults.evaluations} totalErrors={testResults.totalErrors} />
      </QuickTestSection>
    </section>
  );
};

export default MainTest;
