import React from "react";
import "./styles.scss";

const Link = ({ link, add_class, text }) => {
  return (
    <a className={`link ${add_class}`} href={link}>
      {text}
    </a>
  );
};

export default Link;
