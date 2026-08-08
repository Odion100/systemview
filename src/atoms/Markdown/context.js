import React, { createContext, useContext, useMemo } from "react";
import { useLocation } from "react-router-dom";

// RFC-025 — the SURFACE CONTEXT. A block needs to know where the document it lives in is being read
// from: `:ns[Math.add]` (two segments) means "Math.add on THIS document's service", and a `::chart`
// needs a project to pull stats for.
//
// Two sources, explicit wins:
//   1. whatever the hosting surface provides (a story pane knows its target service, a test note
//      knows its namespace) — via <MarkdownScopeProvider>
//   2. otherwise the /specs/:projectCode/:serviceId/:moduleName/:methodName URL, which is exactly
//      right for the Documentation tab and costs the surfaces zero plumbing
const MarkdownScope = createContext(null);

export function MarkdownScopeProvider({ value, children }) {
  const stable = useMemo(
    () => value || null,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [value && value.projectCode, value && value.serviceId, value && value.moduleName, value && value.methodName]
  );
  return <MarkdownScope.Provider value={stable}>{children}</MarkdownScope.Provider>;
}

export function useMarkdownScope() {
  const explicit = useContext(MarkdownScope);
  const location = useLocation();
  return useMemo(() => {
    const [, section, projectCode, serviceId, moduleName, methodName] = location.pathname.split("/");
    const fromUrl = section === "specs" ? { projectCode, serviceId, moduleName, methodName } : {};
    // Drop empty keys so an explicit scope's `undefined` can't blank out a real URL segment.
    const merged = { ...fromUrl };
    Object.entries(explicit || {}).forEach(([k, v]) => {
      if (v) merged[k] = v;
    });
    return merged;
  }, [explicit, location.pathname]);
}

// RFC-025 §4.6 — the WRITE channel for input blocks (::question, ::slider). A block asks for
// `setAttr(line, key, value)` and the atom rewrites that attribute inside the directive's own `{…}`
// in the source document, then hands the whole document to the surface to save. `editable` is false
// wherever there is nothing to save to (a help topic is a code constant), and blocks must SAY so
// rather than pretending to persist.
const MarkdownWrite = createContext({ editable: false, setAttr: () => {} });

export function MarkdownWriteProvider({ value, children }) {
  return <MarkdownWrite.Provider value={value}>{children}</MarkdownWrite.Provider>;
}

export function useMarkdownWrite() {
  return useContext(MarkdownWrite);
}

// RFC-025 §12 — the comment channel for `:::thread` blocks. The Markdown atom loads the sidecar once
// per document and hands every thread the same store, so a doc with ten threads makes one read.
const MarkdownComments = createContext({
  threads: {},
  writable: false,
  error: "",
  addReply: () => {},
  removeReply: () => {},
});

export function MarkdownCommentsProvider({ value, children }) {
  return <MarkdownComments.Provider value={value}>{children}</MarkdownComments.Provider>;
}

export function useCommentsContext() {
  return useContext(MarkdownComments);
}

// "Am I already inside a thread?" — set by the Thread block around its own children, so the
// start-a-thread affordance in the margin doesn't offer to wrap something that's already wrapped.
const InThread = createContext(false);

export function InThreadProvider({ children }) {
  return <InThread.Provider value={true}>{children}</InThread.Provider>;
}

export function useInThread() {
  return useContext(InThread);
}
