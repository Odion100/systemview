import React from "react";

const ServiceContext = React.createContext({
  SystemLinkService: {},
  ConnectedProject: [],
  setConnectedProject: () => {},
});

export default ServiceContext;
