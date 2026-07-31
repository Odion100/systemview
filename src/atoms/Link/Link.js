import React from "react";
import "./styles.scss";
import { Link, useLocation, useHistory } from "react-router-dom";

// Nav links carry the current `?tab=` so browsing services/methods keeps you on the tab you're on
// (Documentation / Logs / Stories) instead of snapping back to docs on every click. And they TOGGLE:
// clicking the item you're already on de-selects it (back to /specs, the SystemView help).
const MyLink = ({ link, add_class, text, linkClick }) => {
  const location = useLocation();
  const history = useHistory();
  const tab = new URLSearchParams(location.search).get("tab");
  const to = tab ? { pathname: link, search: `?tab=${tab}` } : link;
  const isActive = location.pathname === link;
  const handleClick = (e) => {
    if (isActive) {
      e.preventDefault();
      history.push("/specs"); // deselect → the default SystemView docs
    }
  };
  return (
    <Link className="link" to={to} onClick={handleClick}>
      {text}
    </Link>
  );
};

export default MyLink;
