import React from "react";

const ServiceContext = React.createContext({
  SystemViewService: {},
  ConnectedProject: [],
  setConnectedProject: () => {},
});

export default ServiceContext;
