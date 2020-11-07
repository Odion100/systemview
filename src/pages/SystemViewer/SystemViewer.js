import React, { useState } from "react";
import "./styles.scss";
import SystemNavigator from "../../organisms/SystemNavigator/SystemNavigator";

const SystemViewer = ({ SystemViewAPI }) => {
  console.log(SystemViewAPI);
  const [viewState, setState] = useState({
    project_code: "",
    document_pointer: "",
  });

  const SearchInputSubmit = async (e) => {
    console.log(SystemViewAPI);
    const { SystemView } = SystemViewAPI;
    const system = await SystemView.get({ project_code: e.target.value });
    console.log(system);
    console.log(e.target.value);
  };

  return (
    <section className="system-viewer">
      <div className="row">
        <div className="col-3">
          <SystemNavigator SearchInputSubmit={SearchInputSubmit} />
        </div>
        <div className="col-6"></div>
        <div className="col-3"></div>
      </div>
    </section>
  );
};

export default SystemViewer;
