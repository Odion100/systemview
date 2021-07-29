import React, { useState } from "react";
import "./styles.scss";
import SystemNavigator from "../../organisms/SystemNavigator/SystemNavigator";
import Documentation from "../../organisms/Documentation/Documentation";

const SystemLink = ({ project_code }) => {
  const [document_ref, setRef] = useState({ project_code });
  console.log(document_ref);
  return (
    <section className="system-viewer">
      <div className="row">
        <div className="col-4">
          <SystemNavigator project_code={document_ref.project_code} setRef={setRef} />
        </div>
        <div className="col-6">
          <Documentation
            project_code={document_ref.project_code}
            service_id={document_ref.service_id}
            module_name={document_ref.module_name}
            method_name={document_ref.method_name}
          />
        </div>
        <div className="col-2"></div>
      </div>
    </section>
  );
};

export default SystemLink;
