import React from "react";
import { setHelpTopic } from "../../Help/helpStore";
import HELP_TOPICS from "../../Help/helpTopics";

// RFC-025/026 — `:help[markdown]`. Same contract as `:ns` and `:file` chips: a CLICK from a
// document REVEALS the topic — highlights its row in the nav's help section, the document you're
// reading stays put. ⌘/Ctrl-click opens the topic for real (the row itself opens it too).
const HelpLink = ({ label, attrs = {} }) => {
  const key = (label || attrs.topic || "").trim();
  const topic = HELP_TOPICS[key];
  if (!topic) {
    return (
      <span className="md-chip md-chip--help md-chip--dead" title={`No help topic named "${key}"`}>
        <span className="md-chip__kind">help</span>
        {key}
        <span className="md-chip__why">no topic</span>
      </span>
    );
  }
  return (
    <button
      type="button"
      className="md-chip md-chip--help"
      onClick={(e) => {
        e.stopPropagation();
        if (e.metaKey || e.ctrlKey) return setHelpTopic(key);
        window.dispatchEvent(
          new CustomEvent("sv:revealInNav", { detail: { kind: "help", topic: key } })
        );
      }}
      title={`Show "${topic.title}" in the nav — ⌘-click to open it`}
    >
      <span className="md-chip__kind">help</span>
      {attrs.as || topic.title}
    </button>
  );
};

export default HelpLink;
