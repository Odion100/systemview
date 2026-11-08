import React from "react";
import ReactDOM from "react-dom";

import "./index.css";
import "./sass/theme.scss";
import App from "./App";
import reportWebVitals from "./reportWebVitals";
import { Client } from "./systemClient";
import { setHub } from "./utils/hub";

// THE LAST CRASH IS READABLE. A production white screen swallows its own error — nothing on
// screen, nothing to copy. Every uncaught error and rejection is written to localStorage so the
// crash that just blanked the window can be read after the fact (sv.lastCrash), by a human or
// over CDP.
try {
  const record = (kind, message, stack) => {
    try {
      localStorage.setItem(
        "sv.lastCrash",
        JSON.stringify({ kind, message: String(message).slice(0, 500), stack: String(stack || "").slice(0, 1200), at: new Date().toISOString(), url: window.location.href }),
      );
    } catch {}
  };
  window.addEventListener("error", (e) => record("error", e.message, e.error && e.error.stack));
  window.addEventListener("unhandledrejection", (e) => record("rejection", (e.reason && e.reason.message) || e.reason, e.reason && e.reason.stack));
} catch {}


// import "./assets/fonts/FontsFree-Net-SFMono-Regular.ttf";
// import "./assets/fonts/Malkor-Regular.ttf";

const url = "http://localhost:3000/systemview/api";

// FORCE THE RELOAD. `loadService` hands back a CACHED client when one exists for the url, with its
// module map frozen at first construction — and this window is long-lived by design: it swaps its
// own bundle in place rather than reloading, so a client built on the day it opened is the client it
// keeps. A hub that gains a method is then a method this window cannot call, while the registry, the
// manifest and the live service all list it. `forceReload` evicts first (Client.js:37), which is the
// one thing that makes the next build real.
Client.loadService(url, { forceReload: true }).then((SystemViewService) => {
  setHub(SystemViewService);
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
