// WHAT THE REPORT PANE TELLS THE RENDERER ABOUT THE DOCUMENT IT IS DRAWING.
//
// This is three lines and it exists because one of its fields went missing for the life of the
// feature. `docPath` is the SEND DOOR: the members corner reads the document's path from the scope,
// and without it every chip still draws and every press is refused with "no document path". A
// meeting opened in this pane looked completely live and could not tell a single member anything,
// while the same file opened in the code pane worked — because only the code pane passed it.
//
// A surface that claims a subscription nothing can honour is the exact failure RFC-071 exists to
// prevent; this was that failure one layer up, in the plumbing rather than the model.
//
// It lives in its own module because ReportsTab cannot be mounted in Jest — it pulls in the
// markdown renderer, which is ESM inside untransformed node_modules — so anything left inline there
// is unprovable by construction, and "unprovable" is how a missing field survives.
export const reportScope = ({ projectCode, host, moduleName, methodName, doc } = {}) => ({
  projectCode: projectCode || "",
  serviceId: (host && host.serviceId) || null,
  moduleName: moduleName || null,
  methodName: methodName || null,
  // NEVER DEFAULTED TO A GUESS. An empty path is the honest answer when there is no document — the
  // corner then refuses rather than sending somebody an update about a file that does not exist.
  docPath: (doc && doc.path) || "",
});

export default reportScope;
