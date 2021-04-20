import React from "react";
import "./styles.scss";

const Link = ({ link, add_class, text, linkClick }) => {
  const click = (e) => {
    e.stopPropagation();
    if (typeof linkClick === "function") linkClick();
  };
  return (
    <a className={`link ${add_class}`} href={link} onClick={click}>
      {text}
    </a>
  );
};

export default Link;
