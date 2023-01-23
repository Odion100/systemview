import React, { useState, useContext, useEffect } from "react";
import "./styles.scss";
import DescriptionBox from "../../atoms/DescriptionBox/DescriptionBox";
import EditBox from "../../molecules/EditBox/EditBox";
import Title from "../../atoms/Title/Title";
import Markdown from "../../atoms/Markdown/Markdown";
import remarkGfm from "remark-gfm";
import ServiceContext from "../../ServiceContext";
import { Client } from "systemlynx";

const MethodDoc = ({ serviceId, moduleName, methodName }) => {
  const { connectedServices, SystemViewService } = useContext(ServiceContext);
  const serviceData = connectedServices.find(
    (service) => service.serviceId === serviceId
  );
  const { SystemView } = SystemViewService;
  const { SystemView: SystemViewPlugin } = serviceData
    ? Client.createService(serviceData.system.connectionData)
    : {};

  const [doc, setDocument] = useState({
    documentation: "",
    namespace: { serviceId, moduleName, methodName },
  });

  const fetchDocument = async (SystemViewPlugin) => {
    console.log(SystemViewPlugin);
    try {
      if (SystemViewPlugin) {
        const results = await SystemViewPlugin.getSpecs({
          serviceId,
          moduleName,
          methodName,
        });
        setDocument(results);
        console.log("setDocument", results);
      }
    } catch (error) {
      setDocument({
        documentation: "",
        namespace: { serviceId, moduleName, methodName },
      });
      console.error(error);
    }
  };

  useEffect(() => {
    fetchDocument(SystemViewPlugin);
  }, [methodName, moduleName, serviceId, SystemViewPlugin]);

  useEffect(() => {
    SystemView.on(`service-updated:${serviceId}`, async ({ system }) => {
      const { SystemView: SystemViewPlugin } = await Client.loadService(
        system.connectionData.serviceUrl,
        { forceReload: true }
      );

      fetchDocument(SystemViewPlugin);
    });
  }, []);
  return (
    <div className="documentation-view">
      <div className="row">
        <DocTitle serviceId={serviceId} moduleName={moduleName} methodName={methodName} />
      </div>
      <div className="row documentation-view__data-table">
        <DocDescription
          doc={doc}
          setDocument={setDocument}
          SystemViewPlugin={SystemViewPlugin}
        />
      </div>
    </div>
  );
};

const DocTitle = ({ serviceId, moduleName, methodName, variable_name = "payload" }) => {
  return (
    <Title
      text={
        <span className="documentation-view__title">
          {methodName && moduleName && serviceId ? (
            <>
              {`${serviceId}.${moduleName}.${methodName}`}(
              <span className="documentation-view__parameter">{variable_name}</span>)
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

const DocDescription = ({ doc, setDocument, SystemViewPlugin }) => {
  const saveDocument = async (setFormDisplay) => {
    try {
      const results = await SystemViewPlugin.saveSpecs(doc);
      setDocument(results);
      setFormDisplay(false);
    } catch (error) {
      console.error(error);
    }
  };

  const updateDoc = (documentation) => {
    doc.documentation = documentation;
    setDocument(doc);
  };
  return (
    <EditBox
      mainObject={
        <Markdown
          children={doc.documentation || "What does this method do?"}
          remarkPlugins={[remarkGfm]}
        />
      }
      hiddenForm={<DescriptionBox text={doc.documentation || ""} setValue={updateDoc} />}
      formSubmit={saveDocument}
      stateChange={[doc.namespace]}
    />
  );
};

export default MethodDoc;
