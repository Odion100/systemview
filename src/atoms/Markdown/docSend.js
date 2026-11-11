// RFC-071 — THE ONE CALL THAT TELLS SOMEBODY. The window observes the press; the HOST emits the
// ambient `document.updated` (see autobot's files-host.cjs), which is what reaches the members'
// sessions. Nothing in the window announces anything itself.
//
// IT LIVES ALONE BECAUSE SEVERAL BLOCKS MAKE THIS CALL and a second copy of the payload would be a
// second answer to "what does a landing look like". The callers are the block-FAULT channel
// (`blockFailure`), a result block's `subscribe=` (`routeResult`, just below), and `CommitBlock`.
//
// THE PIN IS NOT ONE OF THEM, AND THAT DISTINCTION IS LOAD-BEARING. `MembersPin` releases held
// fires through the HOST (`releaseFires` → `releaseDocumentFires`), which stamps `told=` for
// exactly who was delivered. This call stamps NOTHING — it announces and returns. So a control
// that tells a document's members by coming through here would deliver without recording that it
// had, and every later press would send again: the "send all threads re-sends the ones with
// nothing new" fault, rebuilt. A thread's row and the pin both used to call this and were retired
// for that reason on 2026-11-06 ("a second send from the window was the same decision delivered
// twice"), so a comment still naming them is a map to the mistake.
//
// If you are adding something that tells a document's MEMBERS about the document, you want the
// pin's path, not this one.
// `decision` RIDES THE PAYLOAD rather than being inferred from the summary's wording. The host
// picks the headline, and a host that had to pattern-match prose to know what kind of event this
// was would be guessing at the one thing the sender already knows for certain.
export const sendUpdateTo = async ({ path, project, members, summary, threads = 1, thread = "", by = "you", decision = false, fault = false }) => {
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
      ...(decision ? { decision: true } : {}),
      // A FAULT is the third kind of thing this call carries, beside an edit and a decision: not
      // "go and look", but "the thing you wrote is broken". The headline and the closing line both
      // branch on it, so it has to travel rather than be guessed from the summary's wording.
      ...(fault ? { fault: true } : {}),
    });
    if (!r || r.ok === false) return { ok: false, error: (r && r.error) || "the send was refused" };
    return { ok: true };
  } catch (e) {
    return { ok: false, error: (e && e.message) || "the send failed" };
  }
};

// RFC-073 §5 slice 8 — A RESULT BLOCK'S COMPLETION, ROUTED. `subscribe=` on `::commit`, `:::cmd`,
// `::run`, `::test` or `::branch` names who hears the completion event the chat already receives;
// NOTHING is written into the document for it — there is no state to keep, only news to deliver
// (c55, c56). Same door as a document send, the block's own one-line summary.
export const routeResult = ({ subscribe, project, docPath, summary }) => {
  const members = String(subscribe || "")
    .split(/[|,]/)
    .map((x) => x.trim())
    .filter(Boolean);
  if (!members.length) return Promise.resolve({ ok: true, skipped: true });
  return sendUpdateTo({
    path: docPath || "chat",
    project,
    members,
    summary: String(summary || "").slice(0, 400),
  });
};
