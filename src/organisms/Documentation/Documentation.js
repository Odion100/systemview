import React, { useState, useContext, useEffect } from "react";
import "./styles.scss";
import DescriptionBox from "../../atoms/DescriptionBox/DescriptionBox";
import EditBox from "../../molecules/EditBox/EditBox";
import Title from "../../atoms/Title/Title";
import Markdown from "../../atoms/Markdown/Markdown";
import ServiceContext from "../../ServiceContext";
import { Client } from "systemlynx-client";

export default function Documentation({
  projectCode,
  serviceId,
  moduleName,
  methodName,
}) {
  const { connectedServices } = useContext(ServiceContext);

  const service = connectedServices.find(
    (service) => service.serviceId === serviceId && service.projectCode === projectCode
  );
  const { Plugin } = service ? Client.createService(service.system.connectionData) : {};

  const [doc, setDocument] = useState({
    documentation: "",
    namespace: { serviceId, moduleName, methodName },
  });

  const fetchDocument = async (Plugin) => {
    setDocument({
      documentation: "",
      namespace: { serviceId, moduleName, methodName },
    });
    try {
      if (Plugin) {
        const results = await Plugin.getDoc({
          serviceId,
          moduleName,
          methodName,
        });
        setDocument(results);
      }
    } catch (error) {
      console.error(error);
    }
  };

  useEffect(() => {
    fetchDocument(Plugin);
  }, [methodName, moduleName, serviceId, Plugin]);

  useEffect(() => {
    // if (Plugin) Plugin.on(`reconnect`, fetchDocument.bind({}, Plugin));
  }, [Plugin]);
  return (
    <section className="documentation">
      <div className="documentation-view">
        <div className="row">
          <DocTitle
            serviceId={serviceId}
            moduleName={moduleName}
            methodName={methodName}
          />
        </div>
        <div className="row documentation-view__data-table">
          <DocDescription doc={doc} setDocument={setDocument} Plugin={Plugin} />
        </div>
      </div>
    </section>
  );
}

const DocTitle = ({ serviceId, moduleName, methodName, variable_name = "..." }) => {
  return (
    <Title
      style={{ marginBottom: "5px" }}
      text={
        <span className="documentation-view__title">
          {methodName && moduleName && serviceId ? (
            <>
              {`${serviceId}.${moduleName}.${methodName}`}
              <span className="documentation-view__parentheses">(</span>
              <span className="documentation-view__parameter btn">{variable_name}</span>
              <span className="documentation-view__parentheses">)</span>
            </>
          ) : moduleName && serviceId ? (
            <>{`${serviceId}.${moduleName}`}</>
          ) : (
            serviceId && <>{`${serviceId}`}</>
          )}
        </span>
      }
    />
  );
};

const DocDescription = ({ doc, setDocument, Plugin }) => {
  const { serviceId, methodName, moduleName } = doc;
  const [text, setText] = useState(doc.documentation);
  const saveDocument = async (setFormDisplay) => {
    if (Plugin) {
      try {
        const results = await Plugin.saveDoc({ ...doc, documentation: text });
        setDocument(results);
        setFormDisplay(false);
      } catch (error) {
        console.error(error);
      }
    }
  };

  const updateDoc = (documentation) => setText(documentation);
  const cancel = () => setText(doc.documentation);

  useEffect(() => {
    setText(doc.documentation);
  }, [doc]);
  return (
    <EditBox
      mainObject={
        <Markdown children={text || "Use markdown to create your documentation here"} />
      }
      hiddenForm={<DescriptionBox text={text || ""} setValue={updateDoc} />}
      formSubmit={saveDocument}
      stateChange={[serviceId, methodName, moduleName]}
      onCancel={cancel}
    />
  );
};
