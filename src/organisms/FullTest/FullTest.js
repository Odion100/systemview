import React, { useState, useContext, useEffect } from "react";
import BeforeTest from "../BeforeTest/BeforeTest";
import AfterTest from "../AfterTest/AfterTest";
import MainTest from "../MainTest/MainTest";
import ServiceContext from "../../ServiceContext";
import Test from "./components/Test.class";
import TestController from "./components/TestController.class";

const FullTest = (nsp) => {
  const { ConnectedProject } = useContext(ServiceContext);
  const [testBefore, setTestBefore] = useState([]);
  const [testAfter, setTestAfter] = useState([]);
  const [testMain, setTestMain] = useState([new Test(nsp)]);
  const Tests = [testBefore, testMain, testAfter];
  window.Tests = Tests;
  useEffect(() => {
    setTestBefore([]);
    setTestAfter([]);
    //get connection for the main test and set state
    new Test(nsp).getConnection(ConnectedProject).then((test) => setTestMain([test]));
  }, [nsp.service_id, nsp.module_name, nsp.method_name]);

  return (
    <div>
      <div className="row test-panel__section">
        <BeforeTest
          TestController={new TestController(testBefore, setTestBefore, 0, Tests, ConnectedProject)}
          testData={testBefore}
        />
      </div>
      <div className="row test-panel__section">
        <MainTest
          TestController={new TestController(testMain, setTestMain, 1, Tests, ConnectedProject)}
          testData={testMain}
        />
      </div>
      <div className="row test-panel__section">
        <AfterTest
          TestController={new TestController(testAfter, setTestAfter, 2, Tests, ConnectedProject)}
          testData={testAfter}
        />
      </div>
    </div>
  );
};

export default FullTest;
