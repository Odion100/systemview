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
import FullTestController from "./components/FullTestController";

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
  const FullTest = [Before, Main, Events, After];
  const [savedTests, setSavedTests] = useState([]);
  window.Tests = FullTest;
  const testCtrl = (TestSection, setState, section, FullTest) =>
    new TestController({
      TestSection,
      setState,
      section,
      FullTest,
      connectedServices,
    });
  const MainCtrl = testCtrl(Main, setTestMain, 1, FullTest);
  const BeforeCtrl = testCtrl(Before, setTestBefore, 0, FullTest);
  const EventCtrl = testCtrl(Events, setEventTest, 2, FullTest);
  const AfterCtrl = testCtrl(After, setTestAfter, 3, FullTest);

  const { runFullTest, saveTests } = new FullTestController({
    FullTest,
    connectedServices,
  });

  const runTest = async () => {
    const [Before, Main, Events, After] = await runFullTest();
    setTestMain([...Main]);
    setTestBefore([...Before]);
    setEventTest([...Events]);
    setTestAfter([...After]);
  };
  const save = async () => {
    await saveTests();
    fetchTests();
  };

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
    fetchTests();

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [namespace, connectedServices]);

  return (
    <div>
      <span className="row test__buttons">
        <span>
          <span className="btn" onClick={runTest}>
            <RunTestIcon />
          </span>
          <span className="btn" onClick={save}>
            <SaveIcon />
          </span>
        </span>
      </span>

      <div className="row test-panel__section">
        <BeforeTest TestController={BeforeCtrl} TestSection={Before} />
      </div>
      <div className="row test-panel__section">
        <MainTest TestController={MainCtrl} TestSection={Main} />
      </div>
      <div className="row test-panel__section">
        <EventsTest
          TestController={EventCtrl}
          TestSection={Events}
          namespace={eventNamespace}
          FullTest={FullTest}
        />
      </div>
      <div className="row test-panel__section">
        <AfterTest TestController={AfterCtrl} TestSection={After} />
      </div>

      <div className="row test-panel__section">
        <SavedTests savedTests={savedTests} connectedServices={connectedServices} />
      </div>
    </div>
  );
};

export default FullTest;
