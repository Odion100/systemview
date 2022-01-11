import React from "react";
import { Client } from "tasksjs-react-client";

const ServiceContext = React.createContext({
  SystemLinkService: {},
  TestServices: [],
  setTestServices: () => {},
});

export default ServiceContext;
