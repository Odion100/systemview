// RFC-045 — THE HOST SEAM.
//
// SystemView renders a terminal; it never runs one. The process lives in whatever is embedding the
// app (autobot's Electron shell today), and the only thing that crosses the line is this transport.
// That is the whole security story, and it is structural rather than disciplinary: there is no exec
// path in this codebase to reach, so nothing on the SystemLynx module surface — which every agent in
// every room can call — can start a process.
//
// The contract, frozen with autobot (their RFC-001, our RFC-045):
//
//   window.systemview.terminal.open({ projectCode, cwd, cols, rows }) -> Promise<Transport>
//
//   Transport = {
//     onData(cb)   // cb(chunk) — RAW bytes, escape codes included. Returns an unsubscribe.
//     onExit(cb)   // cb({ code, signal }) — a shell exiting is normal, not an error.
//     write(data)  // keystrokes and pastes, exactly as typed
//     resize(cols, rows)
//     history()    // optional -> Promise<string>: scrollback for a re-mounted pane
//     dispose()    // detach THIS VIEW. Never "kill the session".
//   }
//
// `cwd` is optional and the host is the authority on it — it can resolve a project's root from the
// hub, which the browser deliberately is not told.
export const terminalHost = () => {
  if (typeof window === "undefined") return null;
  const t = window.systemview && window.systemview.terminal;
  return t && typeof t.open === "function" ? t : null;
};

export const hasTerminalHost = () => !!terminalHost();

// `sessions()` lists what is running ON THE MACHINE — including shells left behind by a previous run
// of the app — and `killSession()` ends any of them without a view attached. Both are optional: a
// host without them simply shows nothing to manage.
export const canListSessions = () => {
  const t = terminalHost();
  return !!(t && typeof t.sessions === "function");
};
