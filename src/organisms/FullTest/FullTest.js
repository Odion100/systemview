import React, { useState, useContext, useEffect } from "react";
import BeforeTest from "./BeforeTest/BeforeTest";
import AfterTest from "./AfterTest/AfterTest";
import MainTest from "./MainTest/MainTest";
import EventsTest from "./EventsTest/EventsTest";
import ServiceContext from "../../ServiceContext";
import Test from "./components/Test.class";
import TestController from "./components/TestController.class";
import "./styles.scss";
import RunTestIcon from "../../atoms/RunTestIcon";
import SaveIcon from "../../atoms/SaveIcon/SaveIcon";
import SavedTests from "../SavedTests/SavedTests";
import { Client } from "systemlynx";

const FullTest = (namespace) => {
  const { serviceId, moduleName } = namespace;
  const { connectedServices } = useContext(ServiceContext);
  const serviceData = connectedServices.find(
    (service) => service.serviceId === serviceId
  );
  const { SystemView: SystemViewPlugin } = serviceData
    ? Client.createService(serviceData.system.connectionData)
    : {};
  const [Before, setTestBefore] = useState([]);
  const [After, setTestAfter] = useState([]);
  const [Main, setTestMain] = useState([new Test({ namespace, validate: true })]);
  const eventNamespace = { serviceId, moduleName, methodName: "on" };
  const [Events, setEventTest] = useState([new Test({ namespace: eventNamespace })]);

  const Tests = [Before, Main, Events, After];
  window.Tests = Tests;
  const testCtrl = (testData, setState, section, Tests) =>
    new TestController({
      testData,
      setState,
      section,
      Tests,
      connectedServices,
    });
  const MainCtrl = testCtrl(Main, setTestMain, 1, Tests);
  const BeforeCtrl = testCtrl(Before, setTestBefore, 0, Tests);
  const EventCtrl = testCtrl(Events, setEventTest, 2, Tests);
  const AfterCtrl = testCtrl(After, setTestAfter, 3, Tests);

  const updateAllTest = ([Before, Main, Events, After]) => {
    setTestMain([...Main]);
    setTestBefore([...Before]);
    setEventTest([...Events]);
    setTestAfter([...After]);
  };
  const { runFullTest, saveTests } = MainCtrl;
  const [savedTests, setSavedTests] = useState([]);
  const fetchTests = async () => {
    try {
      if (SystemViewPlugin) {
        const results = await SystemViewPlugin.getTests(namespace);
        setSavedTests(results);
      }
    } catch (error) {
      return [];
    }
  };
  useEffect(() => {
    setTestBefore([]);
    setTestAfter([]);
    setEventTest([]);
    //get connection for the main test and set state
    const test = new Test({ namespace, validate: true }).getConnection(connectedServices);
    setTestMain([test]);
    fetchTests(SystemViewPlugin);

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [namespace, connectedServices, SystemViewPlugin]);

  return (
    <div>
      <span className="row test__buttons">
        <span>
          <span className="btn" onClick={runFullTest.bind({}, updateAllTest)}>
            <RunTestIcon />
          </span>
          <span className="btn" onClick={saveTests}>
            <SaveIcon />
          </span>
        </span>
      </span>

      <div className="row test-panel__section">
        <BeforeTest TestController={BeforeCtrl} testData={Before} />
      </div>
      <div className="row test-panel__section">
        <MainTest TestController={MainCtrl} testData={Main} />
      </div>
      <div className="row test-panel__section">
        <EventsTest
          TestController={EventCtrl}
          testData={Events}
          namespace={eventNamespace}
          Tests={Tests}
        />
      </div>
      <div className="row test-panel__section">
        <AfterTest TestController={AfterCtrl} testData={After} />
      </div>

      <div className="row test-panel__section">
        <SavedTests savedTests={savedTests} />
      </div>
    </div>
  );
};

export default FullTest;
