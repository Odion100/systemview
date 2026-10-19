// RFC-071 — THE ONE CALL THAT TELLS SOMEBODY. The window observes the press; the HOST emits the
// ambient `document.updated` (see autobot's files-host.cjs), which is what reaches the members'
// sessions. Nothing in the window announces anything itself.
//
// It lives alone because three controls make this call now — the document's block, a thread's row,
// and the pinned update row that carries both — and a second copy of the payload is a second
// answer to "what does a landing look like".
export const sendUpdateTo = async ({ path, project, members, summary, threads = 1, thread = "", by = "you" }) => {
  const bridge = typeof window !== "undefined" && window.systemview && window.systemview.documents;
  if (!bridge || !bridge.sendUpdate)
    return { ok: false, error: "this window cannot announce a send — the host door is not granted here" };
  try {
    const r = await bridge.sendUpdate({
      path,
      project,
      members,
      by,
      summary,
      threads,
      ...(thread ? { thread } : {}),
    });
    if (!r || r.ok === false) return { ok: false, error: (r && r.error) || "the send was refused" };
    return { ok: true };
  } catch (e) {
    return { ok: false, error: (e && e.message) || "the send failed" };
  }
};
