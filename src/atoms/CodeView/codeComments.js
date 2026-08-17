import { useCallback, useEffect, useState } from "react";

// RFC-034 — COMMENTS ON CODE. Threads on a source file, the same conversation a document thread
// carries, except nothing is ever written into the file: a comment about code is not code, and
// `:::thread` in a `.js` would mean editing his source to talk about it.
//
// So the store is a SIDECAR — which is not a new mechanism here. `src/atoms/Markdown/comments.js`
// already keeps comments for every markdown surface. This is its own file and its own shape because
// that store is live and flat (`{ id: [reply] }`), and a LINE RANGE doesn't fit it.
//
//   .systemview/comments.code-<slug(path)>.json
//   { "threads": [ { id, from, to, replies: [{ text, ts, author }] } ] }
//
// ANCHOR = A LINE RANGE, AND ONLY A LINE RANGE. His call, twice over: line numbers used as-is
// (nothing re-finds them, so a comment on 57-64 stays on 57-64 after you insert a line above), and
// function pointers proposed then withdrawn in the same minute — "that makes it hard to insert, so
// how about not". He's right: a range says exactly where the thread goes and a function name
// doesn't.
//
// Reply shape is EXACTLY the document thread's and the story pane's — { text, ts, author } — so
// "you" and "agent" keep their distinct looks for free.

// THEIR OWN FOLDER, MIRRORING THE TREE — his call: "you should probably refer to it as code
// comments, you should probably put it in a folder like that… I'm thinking of ways to make it easy
// for the agents to be on my same page as me: I'm looking at the UI, they are not." So
//
//   .systemview/code-comments/src/atoms/CodeView/codeComments.js.json
//
// and not a flattened `comments.code-src-atoms-…` name. An agent listing that folder sees exactly
// which file each conversation is about, and the reverse mapping stops being a guess: the earlier
// flat name was LOSSY (every `/` became `-`), so "which files have comments" had to compare mangled
// slugs. Now it's the path with a prefix and a suffix. `writeFile` creates missing directories, so
// the folder appears with the first comment and never needs seeding.
const ROOT = ".systemview/code-comments";
export const codeCommentsPath = (path) => `${ROOT}/${path}.json`;

// The tree already lists `.systemview/`, so "which files have comments" is answerable from the file
// list the nav ALREADY has — no new plugin method, no extra call.
export const isCodeCommentFile = (p) => String(p || "").startsWith(`${ROOT}/`) && /\.json$/.test(p);
export const commentedPathSet = (files) => {
  const out = new Set();
  (files || []).forEach((f) => {
    const p = typeof f === "string" ? f : f.path;
    if (isCodeCommentFile(p)) out.add(p.slice(ROOT.length + 1).replace(/\.json$/, ""));
  });
  return out;
};

const emptyDoc = { threads: [] };
const parse = (text) => {
  try {
    const d = JSON.parse(text || "{}");
    return Array.isArray(d.threads) ? d : emptyDoc;
  } catch {
    return emptyDoc;
  }
};

// A thread id only has to be unique inside one file's sidecar, and it must not come from a clock the
// two surfaces could disagree on — the range plus a counter is enough.
const nextId = (threads) => {
  let n = threads.length + 1;
  const taken = new Set(threads.map((t) => t.id));
  while (taken.has(`c${n}`)) n += 1;
  return `c${n}`;
};

// One file's threads, loaded from its sidecar and written straight back. `Plugin` is the project's
// file host — no host, no comments (rather than an error: a file you can't write to can't hold a
// conversation either).
export function useCodeComments(Plugin, path) {
  const [threads, setThreads] = useState([]);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    if (!Plugin || !path) return setThreads([]);
    try {
      const res = await Plugin.readFile({ path: codeCommentsPath(path) });
      setThreads(parse(res.content).threads);
    } catch {
      // Nothing stored yet is the normal case, not an error.
      setThreads([]);
    }
  }, [Plugin, path]);

  useEffect(() => {
    load();
  }, [load]);

  // Every write goes through here so the file and the state can't disagree. THE LAST THREAD LEAVING
  // TAKES THE FILE WITH IT — his ask ("they'll be deleted anyway"), and it's what keeps the tree
  // mark honest and `.systemview/` from silting up.
  const save = useCallback(
    async (next) => {
      setThreads(next);
      setError("");
      if (!Plugin) return;
      try {
        if (!next.length && Plugin.deleteFile) await Plugin.deleteFile({ path: codeCommentsPath(path) });
        else
          await Plugin.writeFile({
            path: codeCommentsPath(path),
            content: `${JSON.stringify({ threads: next }, null, 2)}\n`,
          });
        window.dispatchEvent(new CustomEvent("sv:comments", { detail: { path } }));
      } catch (e) {
        setError((e && e.message) || "could not save the comment");
      }
    },
    [Plugin, path],
  );

  const addThread = useCallback(
    (from, to, text) => {
      const t = {
        id: nextId(threads),
        from,
        to,
        replies: [{ text, ts: Date.now(), author: "you" }],
      };
      // Kept in line order, so "the next thread down" means what it looks like.
      const next = [...threads, t].sort((a, b) => a.from - b.from || a.to - b.to);
      save(next);
      return t.id;
    },
    [threads, save],
  );

  const addReply = useCallback(
    (id, text, author = "you") =>
      save(
        threads.map((t) =>
          t.id === id ? { ...t, replies: [...t.replies, { text, ts: Date.now(), author }] } : t,
        ),
      ),
    [threads, save],
  );

  // The × on a reply DELETES it — same as a document thread's, which is the language this app
  // already speaks. Taking the last reply out takes the thread with it: an empty thread is a mark
  // on a file with nothing behind it.
  const removeReply = useCallback(
    (id, i) =>
      save(
        threads
          .map((t) => (t.id === id ? { ...t, replies: t.replies.filter((_r, k) => k !== i) } : t))
          .filter((t) => t.replies.length),
      ),
    [threads, save],
  );

  const removeThread = useCallback((id) => save(threads.filter((t) => t.id !== id)), [threads, save]);
  const removeAll = useCallback(() => save([]), [save]);

  return { threads, error, addThread, addReply, removeReply, removeThread, removeAll, reload: load };
}

// DICTATION FOR A PLAIN-DOM WIDGET. `useDictation` is a hook and a CodeMirror widget is not a React
// component, so this is the same browser-native recognition in a form a widget can call: press to
// listen, press again to stop, finals append. Interim text streams too — the live line IS the
// recording indicator, same as the chat's mic.
export function dictateInto(textarea, onState) {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR) return null;
  const rec = new SR();
  rec.lang = navigator.language || "en-US";
  rec.interimResults = true;
  rec.continuous = true;
  let base = textarea.value;
  rec.onresult = (e) => {
    let fin = "";
    let inter = "";
    for (let i = e.resultIndex; i < e.results.length; i++) {
      if (e.results[i].isFinal) fin += e.results[i][0].transcript;
      else inter += e.results[i][0].transcript;
    }
    if (fin) base = `${base}${base && !/\s$/.test(base) ? " " : ""}${fin.trim()}`;
    textarea.value = inter ? `${base}${base ? " " : ""}${inter}` : base;
  };
  const end = () => onState && onState(false);
  rec.onend = end;
  rec.onerror = end;
  try {
    rec.start();
    if (onState) onState(true);
  } catch {
    return null;
  }
  return rec;
}
export const dictationSupported = () => !!(window.SpeechRecognition || window.webkitSpeechRecognition);
