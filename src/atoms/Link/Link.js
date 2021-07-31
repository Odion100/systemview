import React from "react";
import "./styles.scss";
import { Link } from "react-router-dom";

const myLink = ({ link, add_class, text, linkClick }) => {
  const click = (e) => {
    e.stopPropagation();
    if (typeof linkClick === "function") linkClick();
  };
  return (
    <Link className="link" to={link}>
      {text}
    </Link>
  );
};

export default myLink;
