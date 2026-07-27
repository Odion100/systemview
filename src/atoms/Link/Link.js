import React from "react";
import "./styles.scss";
import { Link, useLocation } from "react-router-dom";

// Nav links carry the current `?tab=` so browsing services/methods keeps you on the tab you're on
// (Documentation / Logs / Stories) instead of snapping back to docs on every click.
const MyLink = ({ link, add_class, text, linkClick }) => {
  const location = useLocation();
  const tab = new URLSearchParams(location.search).get("tab");
  const to = tab ? { pathname: link, search: `?tab=${tab}` } : link;
  return (
    <Link className="link" to={to}>
      {text}
    </Link>
  );
};

export default MyLink;
