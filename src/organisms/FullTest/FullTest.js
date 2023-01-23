import React, { useState, useContext, useEffect } from "react";
import BeforeTest from "./BeforeTest/BeforeTest";
import AfterTest from "./AfterTest/AfterTest";
import MainTest from "./MainTest/MainTest";
import EventsTest from "./EventsTest/EventsTest";
import ServiceContext from "../../ServiceContext";
import Test from "./components/Test.class";
import TestController from "./components/TestController.class";

const FullTest = (nsp) => {
  const { connectedServices } = useContext(ServiceContext);
  const [testBefore, setTestBefore] = useState([]);
  const [testAfter, setTestAfter] = useState([]);
  const [testMain, setTestMain] = useState([new Test(nsp)]);
  const event_nsp = {
    serviceId: nsp.serviceId,
    moduleName: nsp.moduleName,
    methodName: "on",
  };
  const [eventTest, setEventTest] = useState([new Test(event_nsp)]);
  const Tests = [testBefore, testMain, eventTest, testAfter];
  window.Tests = Tests;
  useEffect(() => {
    setTestBefore([]);
    setTestAfter([]);
    setEventTest([]);
    //get connection for the main test and set state
    new Test(nsp).getConnection(connectedServices).then((test) => setTestMain([test]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nsp.serviceId, nsp.moduleName, nsp.methodName, connectedServices]);

  return (
    <div>
      <div className="row test-panel__section">
        <BeforeTest
          TestController={
            new TestController(testBefore, setTestBefore, 0, Tests, connectedServices)
          }
          testData={testBefore}
        />
      </div>
      <div className="row test-panel__section">
        <MainTest
          TestController={
            new TestController(testMain, setTestMain, 1, Tests, connectedServices)
          }
          testData={testMain}
        />
      </div>
      <div className="row test-panel__section">
        <EventsTest
          TestController={
            new TestController(eventTest, setEventTest, 2, Tests, connectedServices)
          }
          testData={eventTest}
          nsp={event_nsp}
          Tests={Tests}
        />
      </div>
      <div className="row test-panel__section">
        <AfterTest
          TestController={
            new TestController(testAfter, setTestAfter, 3, Tests, connectedServices)
          }
          testData={testAfter}
        />
      </div>
    </div>
  );
};

export default FullTest;
