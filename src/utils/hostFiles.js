import { getHub } from "./hub";
// THE FILES ARE THE SHELL'S. Not a service, not a plugin, not a thing that can be down.
//
// This module IS the file layer now. It used to live in hostProject.js as `hostBackedPlugin` — a
// folder wearing a fake SystemLynx service costume so it could slide through code that expected
// services. That costume was a bridge while the transition ran, and a bridge you keep building on
// is just the old building. His call, and it ends the transition: *"the plugin does not deal with
// files and git anymore."*
//
// So: no marker, no candidates, no picking. A project has a root, and you ask ONE place for it. That
// place is the hub — it holds the connections registry, the hosted registry AND (since
// api/shellProjects.js) the shell's own `~/.autobot/projects.json`, so it can answer for a project
// however that project arrived. The plugin is documentation and tests, which is what it was designed
// for.
//
// WHAT THE SHELL IS STILL FOR, so the name of this file does not mislead: it owns the REGISTRY — it
// picks the folder, names it, renames it, forgets it. The hub reads that list; it never writes it.
export const hasHostFiles = () =>
  !!(typeof window !== "undefined" && window.systemview && window.systemview.files);

// WHAT THE SHAPE-WALKING USED TO BE. This file once carried a breadth-first `walkAll` over the
// shell's one-directory-at-a-time bridge, because the nav wanted the whole tree flat and the shell
// answered one folder. The hub serves files now and answers both shapes itself, so the walk, the
// ignore list and the row normaliser went with it rather than sitting here as a second way to build
// a tree that nobody calls. What is left is the one thing still needed on this side: a file's
// language, which the hub does not have to guess about.
const EXT_LANG = {
  js: "javascript", jsx: "javascript", mjs: "javascript", cjs: "javascript",
  ts: "typescript", tsx: "typescript", json: "json", md: "markdown", markdown: "markdown",
  scss: "scss", css: "css", html: "html", yml: "yaml", yaml: "yaml", sh: "shell", py: "python", sql: "sql",
};
const languageOf = (p) => EXT_LANG[(String(p).split(".").pop() || "").toLowerCase()] || "text";

// The object-arg shape every call site already speaks, mapped onto the host's positional calls.
// One place, so the two vocabularies meet exactly once.
export const hostFiles = (projectCode, root) => {
  const hub = () => {
    const h = getHub();
    if (!h) throw new Error("the hub is not connected yet");
    return h;
  };
  // ONE OWNER, AND THIS IS WHERE THE SECOND ONE USED TO BE STANDING. A `viaShellOrHub` helper sat
  // here — try `window.systemview.files`, fall back to the hub — written for the mirror-image bug and
  // never actually wired to a verb. It is gone rather than finally used: the shell's bridge carries
  // nine verbs of the thirty below, so routing files through it would have made a project added in
  // the window read its files and still refuse to commit, list a branch or open a file's history.
  // The hub knows the shell's registry now (api/shellProjects.js), so there is one list of folders
  // again and every verb here asks exactly one place.
  return {
    readFile: async ({ path } = {}) => {
      const res = await hub().readFile(projectCode, { path, root });
      if (res && res.ok === false) throw new Error(res.error || "could not read that file");
      const content = typeof res === "string" ? res : (res && (res.content != null ? res.content : res.text)) || "";
      return { path, content, language: languageOf(path) };
    },
    writeFile: async ({ path, content } = {}) => {
      const res = await hub().writeFile(projectCode, { path, content, root });
      if (res && res.ok === false) throw new Error(res.error || "could not write that file");
      return res;
    },
    deleteFile: async ({ path } = {}) => {
      const res = await hub().deleteFile(projectCode, { path, root });
      if (res && res.ok === false) throw new Error(res.error || "could not delete that file");
      return res;
    },
    // EVERY OPTION HAS TO BE FORWARDED BY HAND HERE, and one that isn't is a silent no-op: the call
    // succeeds, the hub never sees the flag, and you get the default answer looking exactly like the
    // one you asked for. `shallow` is the lazy tree's whole request — ONE folder's children, dirs
    // included — so it is listed explicitly rather than spread, which is also how you can see at a
    // glance that it made the trip.
    listFiles: async ({ dir = ".", shallow, max } = {}) => {
      const res = await hub().listFiles(projectCode, { dir, root, shallow, max });
      if (res && res.ok === false) throw new Error(res.error || "could not list that folder");
      // A HUB THAT DOES NOT KNOW `shallow` ANSWERS RECURSIVELY, and says nothing about it — the flag
      // is simply unread, `entries` is absent, and `files` arrives instead. Reading `entries` off
      // that answer gave an EMPTY tree on every project with no error anywhere, because the call
      // succeeded (2026-09-19, live). The two layers arm separately here — a rebuilt bundle against
      // a not-yet-restarted hub is a normal minute, not an exotic one — so the skew degrades to a
      // working tree: this folder's own children, derived from the flat list the old hub sent.
      if (shallow && !res.entries && Array.isArray(res.files)) {
        const base = res.dir ? `${res.dir}/` : "";
        const seen = new Map();
        res.files.forEach((r) => {
          const rel = String(r.path).startsWith(base) ? String(r.path).slice(base.length) : null;
          if (!rel) return;
          const cut = rel.indexOf("/");
          const name = cut === -1 ? rel : rel.slice(0, cut);
          const path = `${base}${name}`;
          if (!seen.has(path))
            seen.set(path, { name, path, dir: cut !== -1, language: cut === -1 ? r.language || languageOf(path) : undefined });
        });
        const entries = [...seen.values()].sort((a, b) => (a.dir === b.dir ? a.name.localeCompare(b.name) : a.dir ? -1 : 1));
        return { dir: res.dir || "", shallow: true, entries, truncated: !!res.truncated, derived: true };
      }
      if (shallow)
        return {
          dir: res.dir || "",
          shallow: true,
          entries: (res.entries || []).map((r) => ({
            name: r.name || String(r.path).split("/").pop(),
            path: r.path,
            dir: !!r.dir,
            language: r.dir ? undefined : r.language || languageOf(r.path),
            mtime: r.mtime,
          })),
          truncated: !!res.truncated,
        };
      return {
        dir: res.dir || "",
        files: (res.files || []).map((r) => ({ path: r.path, language: r.language || languageOf(r.path), size: r.size })),
        truncated: !!res.truncated,
      };
    },
    search: async ({ query, max } = {}) => {
      const res = await hub().searchFiles(projectCode, { query, max, root });
      if (res && res.ok === false) throw new Error(res.error || "search did not run");
      return res.results || [];
    },
    // BY NAME, ON DISK — what the tree's filter box means, and the one question a partially loaded
    // tree cannot answer for itself. Same verb as `search`, `names: true`; the envelope is kept here
    // (unlike `search`) because `truncated` is the difference between "that is all of them" and
    // "that is the first 500", and the filter has to be able to say which.
    searchNames: async ({ query, max } = {}) => {
      const res = await hub().searchFiles(projectCode, { query, max, root, names: true });
      if (res && res.ok === false) throw new Error(res.error || "search did not run");
      return { results: res.results || [], truncated: !!res.truncated };
    },
    // GIT COMES FROM THE SHELL, which is where it belongs — his call and the right one: *"why would
    // we need the hub when we're the IDE running in the shell? That's a hack."* It is. The hub
    // version was built because the bridge had lost its git verbs the same day this file stopped
    // asking the plugin, and a dead code panel could not wait. autobot restored them; the shell is
    // the path again and the hub stays underneath ONLY so a gap on one side can never blank the
    // panel a second time. Two owners is what caused today; a fallback that is never the first
    // answer is not two owners.
    // ONE COMMIT, IN FULL — fetched only when a log row is opened, never with the 40-row log.
    showCommit: async (sha) => hub().showCommit(projectCode, { sha, root }),
    gitState: async () => {
      const st = await hub().gitState(projectCode, { root });
      if (st && st.ok === false) throw new Error(st.error || "git did not run");
      return st;
    },
    // The branch-review verbs (::branch block, the nav's switcher). Same shape as everything
    // here: the hub answers, ok:false is thrown as the error it carries.
    branches: async () => {
      const r = await hub().branches(projectCode, { root });
      if (r && r.ok === false) throw new Error(r.error || "could not list branches");
      return r;
    },
    switchBranch: async ({ name } = {}) => {
      const r = await hub().switchBranch(projectCode, { name, root });
      // the refusal (dirty files, unknown branch) is the ANSWER — pass it through, do not throw
      return r;
    },
    // WHICH REPO OWNS A BRANCH. A lane row is drawn in the chat of the session that spawned it,
    // which is not necessarily the repo the lane worked in — so the row has to ask before it acts,
    // or it sends every git verb to the wrong repository. `projectCode` here is only the caller's
    // guess; the answer comes back with the real one.
    branchOwner: async ({ branch } = {}) => hub().branchOwner(projectCode, { branch, root }),
    worktrees: async () => {
      const r = await hub().worktrees(projectCode, { root });
      if (r && r.ok === false) throw new Error(r.error || "could not list worktrees");
      return r;
    },
    branchState: async ({ branch, base } = {}) => {
      const r = await hub().branchState(projectCode, { branch, base, root });
      if (r && r.ok === false) throw new Error(r.error || "could not read the branch");
      return r;
    },
    branchDiff: async ({ branch, base } = {}) => {
      const r = await hub().branchDiff(projectCode, { branch, base, root });
      if (r && r.ok === false) throw new Error(r.error || "could not diff the branch");
      return r;
    },
    // the user's cleanup (RFC-059) — refusals pass through like switchBranch's: they are the answer
    removeWorktree: async ({ path, force } = {}) => hub().removeWorktree(projectCode, { path, force, root }),
    deleteBranch: async ({ name, force } = {}) => hub().deleteBranch(projectCode, { name, force, root }),
    // land: accept a reviewed branch onto the one you are standing on — a conflict is a refusal
    mergeBranch: async ({ branch } = {}) => hub().mergeBranch(projectCode, { branch, root }),
    // land from ON the branch: fast-forward the base up to here; non-ff is the refusal
    fastForward: async ({ branch, to } = {}) => hub().fastForward(projectCode, { branch, to, root }),
    // review-first accept: the branch's work arrives as uncommitted changes, his commit on top
    applyBranch: async ({ branch, base } = {}) => hub().applyBranch(projectCode, { branch, base, root }),
    changedFiles: async () => {
      const res = await hub().changedFiles(projectCode, { root });
      if (res && res.ok === false) throw new Error(res.error || "git did not run");
      // The panel reads `{ files: [{ path, status }] }` and keys rows on `status`; `partial` is what
      // lets a staged-then-edited file draw its second row instead of claiming to be fully staged.
      const files = ((res && res.files) || []).map((f) => ({ ...f, status: f.status || f.change || "modified" }));
      return { files };
    },
    getDiff: async ({ path, staged } = {}) => {
      const res = await hub().getDiff(projectCode, { path, staged, root });
      if (res && res.ok === false) throw new Error(res.error || "git did not run");
      return res;
    },
    stageFiles: async ({ paths, unstage } = {}) => {
      const res = await hub().stageFiles(projectCode, { paths, unstage, root });
      if (res && res.ok === false) throw new Error(res.error || "git did not run");
      return res;
    },
    // The HUB, like every other git verb — this one was still pointed at the shell (which has no
    // such verb), so "+ stage" on a hunk always failed. `content` is the rebuilt index copy.
    stageHunk: async ({ path, content } = {}) => {
      const res = await hub().stageHunk(projectCode, { path, content, root });
      if (res && res.ok === false) throw new Error(res.error || "git did not run");
      return res;
    },
    // Held on the shell side pending his word (write and destructive), so these stay on the hub.
    discardFiles: async ({ paths } = {}) => {
      const res = await hub().discardFiles(projectCode, { paths, root });
      if (res && res.ok === false) throw new Error(res.error || "discard failed");
      return res;
    },
    push: async () => {
      const res = await hub().push(projectCode, { root });
      if (res && res.ok === false) throw new Error(res.error || "push failed");
      return res;
    },
    fileHistory: async ({ path, limit } = {}) => {
      const res = await hub().fileHistory(projectCode, { path, limit, root });
      if (res && res.ok === false) throw new Error(res.error || "could not read that history");
      return res;
    },
    readSnapshot: async ({ path, sha } = {}) => {
      const res = await hub().readSnapshot(projectCode, { path, sha, root });
      if (res && res.ok === false) throw new Error(res.error || "could not read that snapshot");
      return res;
    },
    commit: async ({ message } = {}) => {
      const res = await hub().commit(projectCode, { message, root });
      if (res && res.ok === false) throw new Error(res.error || "commit failed");
      return res;
    },
  };
};

