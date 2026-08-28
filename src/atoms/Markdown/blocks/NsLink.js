import React, { useContext, useMemo } from "react";
import { useHistory, useLocation } from "react-router-dom";
import ServiceContext from "../../../ServiceContext";
import { useMarkdownScope } from "../context";
import { parseTarget, resolveNamespace as resolve } from "../nsResolve";

// RFC-025 §4.1 — `:ns[Math.add]`. A namespace reference that NAVIGATES instead of describing.
// Parsing and live-tree resolution live in ../nsResolve.js, shared with `:::run` steps so a name that
// LINKS here also RUNS there.

const NsLink = ({ label, attrs = {} }) => {
  const scope = useMarkdownScope();
  const history = useHistory();
  const location = useLocation();
  const { connectedServices = [] } = useContext(ServiceContext);
  const text = label || attrs.to || "";

  const resolved = useMemo(() => {
    const parsed = parseTarget(text, scope);
    // Nothing connected yet (services still loading) — stay optimistic rather than flashing a dead
    // link at a document that's perfectly fine.
    if (!connectedServices.length) return { target: parsed, known: false };
    return { target: resolve(parsed, connectedServices), known: true };
  }, [text, scope, connectedServices]);

  const t = resolved.target;
  if (!t || !t.projectCode) {
    return (
      <span
        className="md-chip md-chip--ns md-chip--dead"
        title={`No connected service answers to "${text}" — the reference is stale, or that service isn't running.`}
      >
        <span className="md-chip__kind">ns</span>
        {text}
        <span className="md-chip__why">not connected</span>
      </span>
    );
  }

  const path = ["/specs", t.projectCode, t.serviceId, t.moduleName, t.methodName].filter(Boolean).join("/");
// CLICK OPENS. NOTHING HERE IS A WEB LINK. His ruling, twice over: *"no more only revealing…
// that's been annoying to me"* and *"they're not real links — none of these are really supposed to
// be links."* Reveal-only made a reference into a gesture you had to follow up by hand, and with
// the chat panel over the navigator the gesture was invisible — indistinguishable from a dead
// control. And being a real `<a href>` is what let the browser treat an app affordance as a web
// link (that is how every same-origin link ended up in a new tab: RFC-051 round, ChatLink).
// So: a BUTTON that opens. ⌘-click still opens too — one behaviour, no modifier to learn.
  const go = (e) => {
    e.preventDefault();
    e.stopPropagation();
    const tab = new URLSearchParams(location.search).get("tab");
    history.push(tab ? { pathname: path, search: `?tab=${tab}` } : path);
    // The tree still expands to it and marks it — the reveal rides along with the navigation
    // instead of standing in for it, so you arrive AND you can see where you arrived.
    window.dispatchEvent(
      new CustomEvent("sv:revealInNav", {
        detail: {
          kind: "namespace",
          projectCode: t.projectCode,
          serviceId: t.serviceId,
          moduleName: t.moduleName,
          methodName: t.methodName,
        },
      })
    );
  };

  return (
    <button type="button" className="md-chip md-chip--ns" onClick={go} title={`Go to ${path.replace("/specs/", "")}`}>
      <span className="md-chip__kind">ns</span>
      {text}
    </button>
  );
};

export default NsLink;
