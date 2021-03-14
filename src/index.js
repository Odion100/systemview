import React from "react";
import ReactDOM from "react-dom";
import "./index.css";
import App from "./App";
import reportWebVitals from "./reportWebVitals";

import { Client } from "tasksjs-react-client";
import ServiceContext from "./ServiceContext";
const url = "http://localhost:3300/systemview/api";

Client.loadService(url).then((SystemViewService) => {
  ReactDOM.render(
    <React.StrictMode>
      <ServiceContext.Provider value={SystemViewService}>
        <App />
      </ServiceContext.Provider>
    </React.StrictMode>,
    document.getElementById("root")
  );
});

// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
reportWebVitals();
