import React from "react";
import { setHelpTopic } from "../../Help/helpStore";
import HELP_TOPICS from "../../Help/helpTopics";

// RFC-025 — `:help[markdown]`. A chip that opens a HELP TOPIC in the center panel, the same channel
// every `?` icon uses. This is what turns the default SystemView document into a real hub: the index
// can send you into any topic without leaving the panel.
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
        setHelpTopic(key);
      }}
      title={topic.title}
    >
      <span className="md-chip__kind">help</span>
      {attrs.as || topic.title}
    </button>
  );
};

export default HelpLink;
