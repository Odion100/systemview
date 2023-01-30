import React from "react";
import ReactMarkdown from "react-markdown";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { dracula } from "react-syntax-highlighter/dist/cjs/styles/prism";
import remarkGfm from "remark-gfm";

import "./styles.scss";

const Markdown = ({ children }) => {
  return (
    <div className="markdown">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        renderers={{ code: CodeBlock }}
        components={{
          code({ node, inline, className, children, ...props }) {
            const match = /language-(\w+)/.exec(className || "");
            return !inline && match ? (
              <SyntaxHighlighter
                children={String(children).replace(/\n$/, "")}
                style={dracula}
                language={match[1]}
                PreTag="div"
                {...props}
              />
            ) : (
              <code className={className} {...props}>
                {children}
              </code>
            );
          },
        }}
      >
        {children}
      </ReactMarkdown>
    </div>
  );
};

function CodeBlock({ value, language }) {
  return (
    <SyntaxHighlighter language={language} style={dracula}>
      {value || ""}
    </SyntaxHighlighter>
  );
}

export default Markdown;
