import React from "react";
import NavLinks from "../NavLinks/NavLinks";
import LOGO from "../../assets/sysly.png";
import { useAppDark } from "../../atoms/appTheme";
import "./styles.scss";

const { version: VERSION } = require("../../../package.json");

// ONE header for every top-level page (Specs / Logs / Stats). Identical everywhere — brand + logo on the
// left-of-center, version pinned left, and the page nav on the right. No per-page back button: the nav IS
// how you move between pages. `current` highlights the page you're on; `projectCode` scopes the links.
const PageHeader = ({ current, projectCode }) => {
  // APP dark mode — the shared appTheme state flips the :root tokens (sv-dark on <html>) and notifies
  // JS subscribers (react-json-view themes). Independent of the editor's own dark toggle.
  const [dark, toggle] = useAppDark();

  return (
    <div className="page-header">
      <span className="page-header__version">v{VERSION}</span>
      <span className="page-header__brand">SystemView</span>
      <img className="page-header__logo" src={LOGO} alt="logo" />
      {/* Right cluster — the theme pill sits immediately LEFT of the Specs/Stats control. */}
      <span className="page-header__right">
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
