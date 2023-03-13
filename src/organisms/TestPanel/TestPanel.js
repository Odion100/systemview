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
import Title from "../../atoms/Title/Title";
import { CurrentTest } from "../../atoms/StatusIndicator/StatusIndicator";

const FullTest = ({ serviceId, moduleName, methodName }) => {
  const namespace = { serviceId, moduleName, methodName };
  const { connectedServices } = useContext(ServiceContext);
  const serviceData = connectedServices.find(
    (service) => service.serviceId === serviceId
  );
  const { Plugin } = serviceData
    ? Client.createService(serviceData.system.connectionData)
    : {};
  const [Before, setTestBefore] = useState([]);
  const [After, setTestAfter] = useState([]);
  const [Main, setTestMain] = useState([new Test({ namespace, shouldValidate: true })]);
  const eventNamespace = { serviceId, moduleName, methodName: "on" };
  const [Events, setEventTest] = useState([]);
  const FullTest = [Before, Main, Events, After];
  const [savedTests, setSavedTests] = useState([]);
  const [saveResponse, setMessage] = useState({ message: "", error: false });
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
    const tests = await runFullTest();
    setFullTest(tests);
  };
  const setFullTest = ([Before, Main, Events, After]) => {
    setTestMain([...Main]);
    setTestBefore([...Before]);
    setEventTest([...Events]);
    setTestAfter([...After]);
  };
  const clearMessage = () => setMessage({ error: false, message: "" });
  const save = async () => {
    const { error, message } = await saveTests();

    if (!error) {
      resetTests();
      fetchTests();
    }

    setMessage({ error, message });
    setTimeout(clearMessage, 4000);
  };

  const fetchTests = async () => {
    try {
      if (Plugin) {
        const results = await Plugin.getTests(namespace);
        setSavedTests(results);
      }
    } catch (error) {
      return [];
    }
  };
  const resetTests = () => {
    setTestBefore([]);
    setTestAfter([]);
    setEventTest([]);
    //get connection for the main test and set state
    const test = new Test({ namespace, shouldValidate: true }).getConnection(
      connectedServices
    );
    setTestMain([test]);
  };

  useEffect(() => {
    resetTests();
    fetchTests();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [serviceId, moduleName, methodName, connectedServices]);

  return (
    <section className="test-panel">
      <div className="container">
        <div className="row">
          <Title text="Scratch Pad" />
          {typeof Main[0].index === "number" && (
            <CurrentTest name={`Saved Test ${1 + Main[0].index}`} onClick={resetTests} />
          )}
        </div>
        <div>
          <span className="row test__buttons">
            <span
              className={`test-panel__error-message test-panel__error-message--hide-${!saveResponse.message} test-panel__error-message--error-${
                saveResponse.error
              } `}
            >
              <span>{saveResponse.message}</span>
              <span onClick={clearMessage} className="test-panel__clear-error btn">
                ×
              </span>
            </span>

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
            <EventsTest
              TestController={EventCtrl}
              TestSection={Events}
              namespace={eventNamespace}
              FullTest={FullTest}
            />
          </div>

          <div className="row test-panel__section">
            <BeforeTest TestController={BeforeCtrl} TestSection={Before} />
          </div>
          <div className="row test-panel__section">
            <MainTest TestController={MainCtrl} TestSection={Main} />
          </div>

          <div className="row test-panel__section">
            <AfterTest TestController={AfterCtrl} TestSection={After} />
          </div>

          <div className="row test-panel__section">
            <SavedTests
              savedTests={savedTests}
              connectedServices={connectedServices}
              setFullTest={setFullTest}
              Plugin={Plugin}
              fetchTests={fetchTests}
            />
          </div>
        </div>
      </div>
      <div className="scroll-buffer"></div>
    </section>
  );
};

export default FullTest;
