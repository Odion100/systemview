import { useEffect, useState } from "react";

// The app's one message channel. Before this, a failure that wasn't inline (a run that couldn't
// resolve its service, a save that 500'd, a plugin that isn't answering) only existed in the devtools
// console — which means it didn't exist. Same tiny pub/sub as helpStore: module state + subscribers,
// so anything can raise a message without a common ancestor or a context wrapper.
let items = [];
let seq = 0;
const subs = new Set();
const notify = () => subs.forEach((fn) => fn(items));

// kind: "error" | "warn" | "info" | "ok". Errors STAY until dismissed — an error that vanishes on a
// timer is an error you missed. Everything else clears itself.
// `extra` carries what a message needs beyond words: { action: { label, run }, sticky }.
// AN OFFER IS A MESSAGE WITH A HAND. The stale-definition notice is the first of these — telling
// someone an agent is out of date and making them go find the button is half a feature, and a
// second bespoke floating card would have been a second design of a thing we already have.
// `sticky` keeps a non-error up until it is answered: an offer that times out is an offer missed.
export function raise(kind, text, detail = "", extra = {}) {
  const body = String(text || "").trim();
  if (!body) return;
  // Don't stack the same message twice (a re-render loop would otherwise bury the screen); bump a
  // count on the existing one instead.
  const same = items.find((m) => m.text === body && m.kind === kind);
  if (same) {
    items = items.map((m) => (m === same ? { ...m, count: (m.count || 1) + 1, ts: Date.now() } : m));
    notify();
    return same.id;
  }
  const id = ++seq;
  items = [
    ...items,
    { id, kind, text: body, detail: String(detail || ""), ts: Date.now(), count: 1, ...extra },
  ];
  notify();
  if (kind !== "error" && !extra.sticky) setTimeout(() => dismiss(id), kind === "ok" ? 3200 : 6000);
  return id;
}

// Raise-or-replace by a caller-owned key, so a message that tracks STATE (this agent is stale)
// updates in place instead of stacking a new card every time the state is re-observed.
export function raiseKeyed(key, kind, text, detail = "", extra = {}) {
  clearKeyed(key);
  return raise(kind, text, detail, { ...extra, msgKey: key });
}

export function clearKeyed(key) {
  const next = items.filter((m) => m.msgKey !== key);
  if (next.length === items.length) return;
  items = next;
  notify();
}

export const raiseError = (text, detail) => raise("error", text, detail);

export function dismiss(id) {
  const next = items.filter((m) => m.id !== id);
  if (next.length === items.length) return;
  items = next;
  notify();
}

export function useBanners() {
  const [list, setList] = useState(items);
  useEffect(() => {
    subs.add(setList);
    return () => subs.delete(setList);
  }, []);
  return list;
}

// Anything that escapes a promise nobody caught lands here too — that's the class of failure that
// used to be console-only.
export function installGlobalErrorChannel() {
  if (typeof window === "undefined" || window.__svBannerInstalled) return;
  window.__svBannerInstalled = true;
  window.addEventListener("unhandledrejection", (e) => {
    const r = e && e.reason;
    const text = (r && (r.message || r.error || r.msg)) || (typeof r === "string" ? r : "");
    if (text) raise("error", String(text).slice(0, 200));
  });
}
