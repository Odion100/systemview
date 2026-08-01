import React from "react";
import NavLinks from "../NavLinks/NavLinks";
import LOGO from "../../assets/sysly.png";
import "./styles.scss";

const { version: VERSION } = require("../../../package.json");

// ONE header for every top-level page (Specs / Logs / Stats). Identical everywhere — brand + logo on the
// left-of-center, version pinned left, and the page nav on the right. No per-page back button: the nav IS
// how you move between pages. `current` highlights the page you're on; `projectCode` scopes the links.
const PageHeader = ({ current, projectCode }) => (
  <div className="page-header">
    <span className="page-header__version">v{VERSION}</span>
    <span className="page-header__brand">SystemView</span>
    <img className="page-header__logo" src={LOGO} alt="logo" />
    <NavLinks projectCode={projectCode} current={current} />
  </div>
);

export default PageHeader;
