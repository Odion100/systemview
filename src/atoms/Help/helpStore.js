import { useState, useEffect } from "react";

// The help channel — any ? icon anywhere sets a topic; the middle panel (Documentation) subscribes
// and shows that topic's doc. Same tiny pub/sub shape as appTheme: module state + subscriber set,
// so the icon and the display need no common ancestor.
let current = null;
const subs = new Set();

export function setHelpTopic(topic) {
  current = topic;
  subs.forEach((fn) => fn(current));
}

export function useHelpTopic() {
  const [topic, setTopic] = useState(current);
  useEffect(() => {
    subs.add(setTopic);
    return () => subs.delete(setTopic);
  }, []);
  return topic;
}
