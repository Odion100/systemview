import React from "react";
import "./styles.scss";

const List = ({ children }) => {
  console.log(children);
  return <div className="list">{children}</div>;
};

export default List;
