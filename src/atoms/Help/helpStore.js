// The help channel — any ? icon, a `:help[…]` chip, or the nav's help section names a topic.
//
// URL-BACKED (RFC-026): the open topic is the `?help=` param, owned by SystemView.js. That is the
// whole fix for "help locks you in": every way out is just a URL change — the browser back button
// pops a topic (each one is a history entry), navigating anywhere drops the param, and nothing has
// to remember to clear a module-level stack. This file is only the doorbell.
export function setHelpTopic(topic) {
  window.dispatchEvent(new CustomEvent("sv:help", { detail: { topic } }));
}

// One step back — to the previous topic, or out to whatever the centre showed before the first one.
// Topics are history entries, so this is literally the back button.
export function backHelpTopic() {
  window.history.back();
}
