import React from "react";

const ServiceContext = React.createContext({
  SystemViewService: {},
  connectedServices: [],
  setConnectedServices: () => {},
});

export default ServiceContext;
