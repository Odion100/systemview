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
    // `chat` is in the deps because a block that reports a failure needs to name the file it
    // lives in, and a memo that dropped it would hand every room the first room's name.
    [value && value.projectCode, value && value.serviceId, value && value.moduleName, value && value.methodName, value && value.chat]
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
// WHERE THIS MARKDOWN IS BEING READ — and it decides where a reference LANDS.
//
// A link inside a document, read in the centre, opens the next document BESIDE the one you are on:
// you are reading, and being thrown somewhere else loses your place. The same block rendered in
// the CHAT means "show me this" — the chat is not a place you are reading a document from, and a
// chip there that quietly added a tab somewhere else read as a link that did nothing.
//
// It is a context rather than a prop because the blocks that open addresses are nested anywhere
// inside a document, and threading a flag through every one of them is how it ends up missing from
// the one nobody remembered.
const InDocument = createContext(false);

export function InDocumentProvider({ value = true, children }) {
  return <InDocument.Provider value={!!value}>{children}</InDocument.Provider>;
}

export const useInDocument = () => useContext(InDocument);

// A DOCUMENT QUOTED INSIDE ANOTHER ONE — RENDERED, NEVER ACTING.
//
// `::file[path#L1-5]` brings a file into the document and renders it as markdown, which means a
// registration leaf in those lines renders too. That is right: an embed shows you what the file
// says. What is wrong is the leaf ACTING, because it is not this document's identity — it is a
// quotation of another one.
//
// MEASURED 2026-11-07: a report embedded the first five lines of another report, whose line 1 is
// its leaf. Every leaf carries a `DocProofs` that claims the proofs panel on mount, so opening the
// host document loaded its own three specs and then lost the panel to the embedded id a beat later
// — *"the test show up for a second and then go away."* One open tab, two leaves, and the panel
// scoped to a document nobody had open.
//
// It is a context for the same reason `InDocument` is: the blocks that act are nested anywhere
// inside the rendered file, and a prop threaded through every one of them is a prop missing from
// the one nobody remembered.
const InEmbed = createContext(false);

export function InEmbedProvider({ value = true, children }) {
  return <InEmbed.Provider value={!!value}>{children}</InEmbed.Provider>;
}

export const useInEmbed = () => useContext(InEmbed);

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
//
// IT NOW CARRIES WHICH THREAD, not just whether. A decision pressed inside a thread belongs to
// that conversation, so it has to reach the thread's people and stamp the thread's own `sent=` —
// and a boolean cannot say which line to write to. Still falsy outside a thread, which is the
// only thing the original consumer asked of it.
const InThread = createContext(null);

export function InThreadProvider({ value = null, children }) {
  return <InThread.Provider value={value}>{children}</InThread.Provider>;
}

export function useInThread() {
  return useContext(InThread);
}

// RFC-071 — THE DOCUMENT'S MEMBERS, in scope for everything inside it. A thread inherits the
// document's membership unless it names its own, so the thread has to be able to see it — and the
// document's `::members` block is parsed once by the atom rather than re-scanned per thread.
const MarkdownMembers = createContext([]);

export function MarkdownMembersProvider({ value, children }) {
  return <MarkdownMembers.Provider value={value}>{children}</MarkdownMembers.Provider>;
}

export function useDocMembers() {
  return useContext(MarkdownMembers);
}
