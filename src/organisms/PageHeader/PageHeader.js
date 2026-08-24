import React, { useState, useEffect } from "react";
import NavLinks from "../NavLinks/NavLinks";
import LOGO from "../../assets/sysly.png";
import { useAppDark } from "../../atoms/appTheme";
import { BotHub } from "../AgentChat/AgentChat";
import "./styles.scss";

const { version: VERSION } = require("../../../package.json");

// ONE header for every top-level page (Specs / Logs / Stats). Identical everywhere — brand + logo on the
// left-of-center, version pinned left, and the page nav on the right. No per-page back button: the nav IS
// how you move between pages. `current` highlights the page you're on; `projectCode` scopes the links.
const PageHeader = ({ current, projectCode }) => {
  // APP dark mode — the shared appTheme state flips the :root tokens (sv-dark on <html>) and notifies
  // JS subscribers (react-json-view themes). Independent of the editor's own dark toggle.
  const [dark, toggle] = useAppDark();

  // The served bundle, checked against the one this tab actually booted. Same source of truth the
  // self-updater polls; this is only the visible half.
  const [stale, setStale] = useState(false);
  useEffect(() => {
    const s = document.querySelector('script[src*="static/js/main."]');
    const m = s && s.src.match(/main\.[a-z0-9]+\.js/);
    const current = m ? m[0] : null;
    if (!current) return undefined;
    const check = async () => {
      try {
        const res = await fetch("/sv-bundle", { cache: "no-store" });
        const { bundle } = await res.json();
        setStale(!!bundle && bundle !== current);
      } catch {}
    };
    check();
    const t = setInterval(check, 15000);
    return () => clearInterval(t);
  }, []);

  return (
    <div className="page-header">
      {/* IS THIS TAB RUNNING THE CURRENT BUILD? His question, and a fair one after a night of me
          verifying against my browser while he looked at an older one: *"so you can't see here and
          tell me, because my browser is not up to date."* Now the window itself says. It should
          never appear — tabs self-update — but when it does, one click is the way out and nobody
          has to guess whose copy is stale. */}
      <span className="page-header__version" title={stale ? "This tab is running an older build" : `v${VERSION}`}>
        v{VERSION}
      </span>
      {stale && (
        <button
          type="button"
          className="page-header__stale"
          title="This tab is running an older build than the server is serving"
          onClick={() => window.location.reload()}
        >
          update
        </button>
      )}
      <span className="page-header__brand">SystemView</span>
      <img className="page-header__logo" src={LOGO} alt="logo" />
      {/* Right cluster — the theme pill sits immediately LEFT of the Specs/Stats control. */}
      <span className="page-header__right">
        {/* The agent hub — every bot lives here; parked ones wait here. Sits right before the
            theme pill (his spot). */}
        <BotHub />
        <button
          className={`page-header__theme ${dark ? "page-header__theme--dark" : ""}`}
          title={dark ? "Switch to light" : "Switch to dark"}
          onClick={toggle}
        >
          {dark ? "☀ light" : "☾ dark"}
        </button>
        <NavLinks projectCode={projectCode} current={current} />
      </span>
    </div>
  );
};

export default PageHeader;
