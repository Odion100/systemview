import React, { useContext, useEffect, useState } from "react";
import ExpandableSection from "../../molecules/ExpandableSection/ExpandableSection";
import TestPanelCaption from "../../atoms/TestPanelCaption/TestPanelCaption";
import ScratchPad from "../ScratchPad/ScratchPad";
import ServiceContext from "../../ServiceContext";
import { Client } from "tasksjs-react-client";
import "./styles.scss";

const QuickTestSection = ({
  project_code,
  service_id,
  module_name,
  method_name,
  open,
  testData,
  title,
}) => {
  const { TestServices } = useContext(ServiceContext);
  const connections = {};
  connections[project_code] = {};
  const [connected_services, setConnecteServices] = useState(connections);

  useEffect(() => {
    if (TestServices.length > 0) {
      const service = TestServices.find(
        (_service) => _service.project_code === project_code && _service.service_id === service_id
      );
      if (!service) return console.log("service not found");
      if (!Client.loadedServices[service.url])
        Client.loadService(service.url).then((_service) => {
          connected_services[project_code][service_id] = _service;
          setConnecteServices(connected_services);
        });
      else console.log("already loaded");
    }
  }, [project_code, service_id, TestServices]);

  return (
    <section className="quick-test-section">
      <ExpandableSection
        open={open}
        title_color="#0d8065"
        title={<TestPanelCaption text={title} />}
      >
        <ScratchPad
          project_code={project_code}
          service_id={service_id}
          module_name={module_name}
          method_name={method_name}
          testData={testData}
        />
      </ExpandableSection>
    </section>
  );
};

export default QuickTestSection;
