import React, { useState, useContext } from "react";
import ServiceContext from "../../ServiceContext";
import "./styles.scss";
import SystemNavigator from "../../organisms/SystemNavigator/SystemNavigator";
import MethodDocumentation from "../../organisms/MethodDocumentation/MethodDocumentation";

const SystemViewer = () => {
  const SystemViewAPI = useContext(ServiceContext);
  const [viewState, setViewState] = useState({ project_code: "", document_pointer: "" });
  const [servicesList, setServices] = useState([]);

  const SearchInputSubmit = async (e) => {
    const { SystemView } = SystemViewAPI;

    try {
      const results = await SystemView.getServices({ project_code: e.target.value });
      if (results.length > 0)
        setViewState({
          project_code: results[0].project_code,
          document_pointer: "",
        });
      setServices(results.services);
    } catch (error) {
      console.log(error);
    }

    console.log(e.target.value);
  };

  return (
    <section className="system-viewer">
      <div className="row">
        <div className="col-4">
          <SystemNavigator SearchInputSubmit={SearchInputSubmit} servicesList={servicesList} />
        </div>
        <div className="col-6">
          <MethodDocumentation />
        </div>
        <div className="col-2"></div>
      </div>
    </section>
  );
};

export default SystemViewer;
