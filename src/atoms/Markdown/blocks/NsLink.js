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
  const go = (e) => {
    e.preventDefault();
    e.stopPropagation();
    // REVEAL, don't navigate. Reading a document and clicking a reference shouldn't yank the document
    // out from under you — the nav switches to the SystemLynx lens, expands to the target and
    // HIGHLIGHTS it without selecting it. You decide whether to actually go there by clicking it in
    // the tree. Cmd/Ctrl-click still navigates outright, for when that IS what you meant.
    if (e.metaKey || e.ctrlKey) {
      const tab = new URLSearchParams(location.search).get("tab");
      history.push(tab ? { pathname: path, search: `?tab=${tab}` } : path);
      return;
    }
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
    <a className="md-chip md-chip--ns" href={path} onClick={go} title={`Show ${path.replace("/specs/", "")} in the navigator — ⌘-click to go there`}>
      <span className="md-chip__kind">ns</span>
      {text}
    </a>
  );
};

export default NsLink;
