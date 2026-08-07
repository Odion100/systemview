import React from "react";
import { setHelpTopic } from "./helpStore";
import "./styles.scss";

// The little ? — drop it beside any title/control with a topic key from helpTopics.js. Clicking it
// shows that topic's doc in the middle panel (Documentation subscribes to the help store).
export default function Help({ topic, className = "" }) {
  return (
    <span
      className={`help-icon ${className}`}
      title="What is this? — opens the help doc in the middle panel"
      onClick={(e) => {
        e.stopPropagation();
        setHelpTopic(topic);
      }}
    >
      ?
    </span>
  );
}
