import { useState, useEffect } from "react";

// The help channel — any ? icon (or a `:help[…]` chip in a document) sets a topic; the middle panel
// subscribes and shows it. Same tiny pub/sub shape as appTheme: module state + a subscriber set, so
// the icon and the display need no common ancestor.
//
// It is a STACK, not a single value: a help topic can link to another topic, so the panel needs a way
// BACK to where you were rather than only a way out. Empty stack = no help, the document shows.
let stack = [];
const subs = new Set();
const notify = () => subs.forEach((fn) => fn(stack));

// `null` closes help entirely (used by tab clicks and by navigation, so help can never strand you on
// a page you've navigated away from — that was the "it locks you in, you have to refresh" bug).
export function setHelpTopic(topic) {
  if (topic == null) {
    if (!stack.length) return;
    stack = [];
  } else {
    if (stack[stack.length - 1] === topic) return;
    stack = [...stack, topic];
  }
  notify();
}

// One step back: to the previous topic, or out to the document when this was the first one.
export function backHelpTopic() {
  if (!stack.length) return;
  stack = stack.slice(0, -1);
  notify();
}

function useHelpStack() {
  const [s, setS] = useState(stack);
  useEffect(() => {
    subs.add(setS);
    return () => subs.delete(setS);
  }, []);
  return s;
}

export function useHelpTopic() {
  const s = useHelpStack();
  return s.length ? s[s.length - 1] : null;
}

// How deep we are, so the panel can offer Back only when there IS a back.
export function useHelpDepth() {
  return useHelpStack().length;
}
