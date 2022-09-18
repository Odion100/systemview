import React from "react";
import ReactMarkdown from "react-markdown";
import "./styles.scss";

const Markdown = ({ children, remarkPlugins }) => {
  return (
    <div className="markdown">
      <ReactMarkdown remarkPlugins={remarkPlugins}>{children}</ReactMarkdown>
    </div>
  );
};

export default Markdown;
