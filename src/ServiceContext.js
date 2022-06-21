import React from "react";
import { Client } from "sht-tasks";

const ServiceContext = React.createContext({
  SystemLinkService: {},
  ConnectedProject: [],
  setConnectedProject: () => {},
});

export default ServiceContext;
