import { hostFiles } from "../../utils/hostFiles";
import { useCallback, useContext, useEffect, useState } from "react";
import loadServiceWithHeaders from "../../utils/loadService";
import ServiceContext from "../../ServiceContext";
import { raiseError } from "../Banner/bannerStore";

// RFC-025 §12 — reply threads on a BLOCK, the same conversation a story pane already carries.
//
// Storage is a SIDECAR, not the document. A comment is *about* the document, not part of it: writing
// threads inline would put conversation into every git diff and carry it to anyone the file is shared
// with. Because a `:::thread{id=…}` names itself, the sidecar is a plain id → replies map — none of
// the heading/hash anchoring an "any block is commentable" design would have needed.
//
// It needs NO new plugin method: `.systemview/comments/<key>.json` is written through the same
// readFile/writeFile the codebase surface already uses.
const slug = (s) => String(s || "doc").replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 120);
// Flat inside `.systemview/` on purpose: that folder already exists (stories live there), and the
// plugin's writeFile does not create missing directories — so a nested path would fail against every
// currently published plugin. (writeFile now mkdirs too, but this keeps working on older ones.)
export const commentsPath = (key) => `.systemview/comments.${slug(key)}.json`;

// A key prefixed `app:` is one of SYSTEMVIEW'S OWN surfaces — the hub, a help topic — which belong to
// no project. Those threads go to the hub server (api/Comments.js) instead of a project's `.systemview/`.
// Routing them through "the first plugin host that answered" scattered them across whichever repo
// happened to be connected: a hub reply written while another project was up vanished when it wasn't.
export const isAppKey = (key) => String(key || "").startsWith("app:");

// The reply shape is EXACTLY a story pane's: { text, ts, author } — "agent" replies get their own look.
export function useComments(commentKey, projectCode) {
  const { connectedServices = [], SystemViewService } = useContext(ServiceContext);
  const [threads, setThreads] = useState(null); // { [threadId]: [reply] }
  const [error, setError] = useState("");

  const app = isAppKey(commentKey);
  const host = app
    ? null
    : connectedServices.find(
        (s) =>
          (!projectCode || s.projectCode === projectCode) &&
          ((s.system && s.system.connectionData && s.system.connectionData.modules) || []).some((m) => m.name === "Plugin")
      );
  // Files come from the hub, addressed by PROJECT — a service that happens to be up is no longer
  // part of the address. See hostFiles.
  const Plugin = host ? hostFiles(host.projectCode) : null;
  const CLI = app && SystemViewService ? SystemViewService.CLI : null;
  const store = Plugin || CLI;

  useEffect(() => {
    let dead = false;
    (async () => {
      if (!commentKey || !store) {
        setThreads({});
        return;
      }
      try {
        const loaded = CLI
          ? await CLI.getComments(commentKey)
          : JSON.parse((await Plugin.readFile({ path: commentsPath(commentKey) })).content || "{}");
        if (!dead) setThreads(loaded || {});
      } catch {
        // Nothing stored yet is the normal case, not an error.
        if (!dead) setThreads({});
      }
    })();
    return () => {
      dead = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [commentKey, host && host.serviceId, !!CLI]);

  const persist = useCallback(
    async (next) => {
      setThreads(next);
      if (!store || !commentKey) return;
      try {
        if (CLI) await CLI.saveComments(commentKey, next);
        else await Plugin.writeFile({ path: commentsPath(commentKey), content: JSON.stringify(next, null, 2) + "\n" });
        setError("");
      } catch (e) {
        setError(e.message || "could not save the reply");
        raiseError("Couldn't save the reply", e && (e.message || String(e)));
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [store, commentKey]
  );

  const addReply = useCallback(
    (threadId, text, author = "you") => {
      const body = String(text || "").trim();
      if (!body) return;
      const cur = threads || {};
      persist({ ...cur, [threadId]: [...(cur[threadId] || []), { text: body, ts: Date.now(), author }] });
    },
    [threads, persist]
  );

  const removeReply = useCallback(
    (threadId, index) => {
      const cur = threads || {};
      const list = (cur[threadId] || []).filter((_, i) => i !== index);
      const next = { ...cur };
      if (list.length) next[threadId] = list;
      else delete next[threadId];
      persist(next);
    },
    [threads, persist]
  );

  return {
    threads: threads || {},
    ready: threads != null,
    // No key and no store (no plugin host connected at all) ⇒ nothing to read or save, and the
    // thread says so rather than pretending.
    writable: !!(commentKey && store),
    error,
    addReply,
    removeReply,
  };
}
