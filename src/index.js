import React from "react";
import ReactDOM from "react-dom";
import "./index.css";
import App from "./App";
import reportWebVitals from "./reportWebVitals";
// import "./assets/fonts/FontsFree-Net-SFMono-Regular.ttf";
// import "./assets/fonts/Malkor-Regular.ttf";
import { Client } from "systemlynx";

const url = "http://localhost:3000/systemview/api";

Client.loadService(url).then((SystemViewService) => {
  ReactDOM.render(
    <React.StrictMode>
      <App SystemViewService={SystemViewService} />
    </React.StrictMode>,
    document.getElementById("root")
  );
});

// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
reportWebVitals();
