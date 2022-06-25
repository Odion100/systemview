import React, { useState, useContext, useEffect } from "react";
import BeforeTest from "../BeforeTest/BeforeTest";
import AfterTest from "../AfterTest/AfterTest";
import MainTest from "../MainTest/MainTest";
import EventsTest from "../EventsTest/EventsTest";
import ServiceContext from "../../ServiceContext";
import Test from "./components/Test.class";
import TestController from "./components/TestController.class";

const FullTest = (nsp) => {
  const { ConnectedProject } = useContext(ServiceContext);
  const [testBefore, setTestBefore] = useState([]);
  const [testAfter, setTestAfter] = useState([]);
  const [eventTest, setEventTest] = useState([]);
  const [testMain, setTestMain] = useState([new Test(nsp)]);
  const Tests = [testBefore, testMain, eventTest, testAfter];
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
        <EventsTest
          TestController={new TestController(eventTest, setEventTest, 2, Tests, ConnectedProject)}
          testData={eventTest}
        />
      </div>
      <div className="row test-panel__section">
        <AfterTest
          TestController={new TestController(testAfter, setTestAfter, 3, Tests, ConnectedProject)}
          testData={testAfter}
        />
      </div>
    </div>
  );
};

export default FullTest;
