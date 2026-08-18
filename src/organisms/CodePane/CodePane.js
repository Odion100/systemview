import React, { useCallback, useContext, useEffect, useMemo, useState } from "react";
import ServiceContext from "../../ServiceContext";
import loadServiceWithHeaders from "../../utils/loadService";
import CodeEditor from "../../atoms/CodeView/CodeEditor";
import { changeMarksOf, hunksOf, stagedContentFor } from "../../atoms/CodeView/gitLines";
import { useCodeComments } from "../../atoms/CodeView/codeComments";
import { importBlocks, kindOfLine, originalName } from "../../atoms/CodeView/codeNav";
import RowMenu from "../../atoms/RowMenu/RowMenu";
import DiffView from "../../atoms/DiffView/DiffView";
import { useEditorDark, EditorThemeToggle } from "../../atoms/CodeView/editorTheme";
import Markdown from "../../atoms/Markdown/Markdown";
import "./styles.scss";

// RFC-022 — the CODE center. EDIT-FIRST: every file opens straight into the CM6 editor (the inversion
// of the read-first namespace lens). `.md` gets a Preview toggle in the header (edit ⇄ rendered,
// remembered per file). Save = the plugin's writeFile; dirty state shows until saved (⌘S / Ctrl+S or
// the Save button). Bytes come from the codebase's file host at render time — locators, not copies.

const CLASSNAME = "code-pane";

// WHERE YOU CAME FROM. Following an import, a search result or a trace hop is now one click, so
// coming BACK has to be one click too — and "reach for the browser's button at the top of the
// screen" is not that (his words). This is a trail of the files THIS PANE opened, kept outside the
// component because the pane is remounted for every file; it never leaves the app, and the button
// can say the name of the file it will take you to.
const stack = [];
let at = -1;
// Which button caused the next arrival, so the effect knows it is a MOVE along the stack rather than
// a new place to remember. Without it, pressing back would push where you came from all over again.
let moving = null;
const sameFile = (a, b) => a && b && a.path === b.path && a.projectCode === b.projectCode;

const CodePane = ({ file, onClose }) => {
  const { connectedServices } = useContext(ServiceContext);
  const [content, setContent] = useState(null); // null = loading
  const [savedContent, setSavedContent] = useState(null);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const isMd = file.language === "markdown";
  // AN IMAGE IS NOT TEXT. Opening a .png from the tree read its bytes as a string and printed them
  // into the editor. The bytes never had to travel that way: the hub already serves repo files raw
  // at /sv-raw for the ::image block, so the pane just points an <img> at the same route — no read,
  // no base64, no megabyte of mangled binary through the service call.
  const isImage = /\.(png|jpe?g|gif|webp|svg|avif|bmp|ico)$/i.test(file.path || "");
  // Markdown opens in PREVIEW by default (the rendered document) — the per-file memory now stores
  // the opt-OUT, so only an explicit flip to Edit sticks.
  const [preview, setPreview] = useState(
    () => isMd && localStorage.getItem(`sv.mdPreview.${file.path}`) !== "false",
  );
  // Theme GROUPS by content: md files follow the docs family, code files the code family, diff the diff family.
  const [codeDark] = useEditorDark("code");
  const [docsDark] = useEditorDark("docs");
  const [diffDark] = useEditorDark("diff");

  // Git diff: `hasDiff` = the file differs from HEAD (the nav's orange dot, answered here);
  // `diffMode` flips the body to the side-by-side DiffView; `diffData` is fetched on entry.
  const [hasDiff, setHasDiff] = useState(false);
  // DIFF IS A MODE, NOT A PER-FILE CHOICE. Flip it once and the next file you open comes up as a
  // diff too — when it has one. It used to reset on every file, so a pass through five changed
  // files was five identical clicks.
  const [diffMode, setDiffMode] = useState(
    () => localStorage.getItem("sv.diffMode") === "true",
  );
  const [diffData, setDiffData] = useState(null);
  // base = the file at HEAD. Fetched for any changed file, not just on entering diff, because the
  // PLAIN view now marks its changed lines too.
  const [base, setBase] = useState(null);
  // The STAGED copy (git show :path). null = no index entry at all (untracked).
  const [index, setIndex] = useState(null);
  // The pane's EFFECTIVE theme + which family its header toggle flips.
  const themeScope = diffMode ? "diff" : isMd ? "docs" : "code";
  const editorDark = diffMode ? diffDark : isMd ? docsDark : codeDark;

  const host = connectedServices.find(
    (s) => s.serviceId === file.serviceId && s.projectCode === file.projectCode,
  );
  // The open file's codebase disconnected/was deleted → close the pane instead of sitting on a dead
  // error. Guarded on connectedServices being loaded (empty at boot ≠ gone).
  useEffect(() => {
    if (!host && connectedServices.length && onClose) onClose();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [host, connectedServices.length]);
  // Memoized because the comment store keys its load on it — an identity that changed every render
  // would re-read the sidecar every render.
  const Plugin = useMemo(
    () =>
      host ? loadServiceWithHeaders(host.system.connectionData, host.headers, host.credentials).Plugin : null,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [host && host.serviceId, host && host.projectCode],
  );

  useEffect(() => {
    setContent(null);
    setSavedContent(null);
    setError("");
    setPreview(isMd && localStorage.getItem(`sv.mdPreview.${file.path}`) !== "false");
    // The MODE survives the file change (that's the point of it); its DATA does not.
    setDiffData(null);
    setHasDiff(false);
    setBase(null);
    setIndex(null);
    // No host yet ≠ no access: on a refresh this effect fires before the services have connected.
    // Stay in the loading state — `!!host` in the deps re-runs the load the moment the host arrives
    // (and the auto-close effect above handles a host that's genuinely gone).
    if (!host) return undefined;
    // An image is fetched by the <img> tag, not read into state — don't pull the bytes twice.
    if (isImage) {
      setContent("");
      setSavedContent("");
      return undefined;
    }
    let live = true;
    (async () => {
      try {
        const res = await Plugin.readFile({ path: file.path });
        if (!live) return;
        setContent(res.content);
        setSavedContent(res.content);
        try {
          const ch = Plugin.changedFiles ? await Plugin.changedFiles() : null;
          const changed = !!(ch && ch.files && ch.files.some((f) => f.path === file.path));
          if (!live) return;
          setHasDiff(changed);
          // One extra call, only for a file that actually differs: it feeds BOTH the edge marks in
          // the plain view and the diff view if the mode is on, so nothing is fetched twice.
          if (changed) {
            const d = await Plugin.getDiff({ path: file.path });
            if (!live) return;
            setBase(d.base);
            setIndex(d.index == null ? null : d.index);
            setDiffData(d);
          }
        } catch {}
      } catch (e) {
        if (live) setError(e.message || "could not read file");
      }
    })();
    return () => { live = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [file.projectCode, file.serviceId, file.path, !!host]);

  // Which lines differ from HEAD, recomputed against what's on screen — so a line you just typed
  // marks itself without saving first. Cheap: trimmed prefix/suffix, then LCS on what's left.
  // The arithmetic itself lives in gitLines.js, shared with the file embeds in a document.
  const changeMarks = useMemo(() => changeMarksOf(base, index, content), [base, index, content]);
  const hunks = useMemo(() => hunksOf(base, index, content), [base, index, content]);

  // STAGE JUST THIS RUN, not the whole file.
  const stageHunkAt = async (h, unstage) => {
    // SAY WHY when nothing happens. Every one of these used to be a silent return, which is how a
    // button that did nothing looked identical to a button that was broken.
    if (!Plugin) return setError("no file host for this project");
    if (!Plugin.stageHunk)
      return setError("this project's plugin predates line-level staging — restart the service");
    if (content == null) return;
    const built = stagedContentFor(h, { base, index, content, unstage });
    if (built.error) return setError(built.error);
    const out = built.content;
    setError("");
    try {
      await Plugin.stageHunk({ path: file.path, content: out });
      // Re-read rather than assume: the index is git's now, not ours.
      const d = await Plugin.getDiff({ path: file.path });
      setBase(d.base);
      setIndex(d.index == null ? null : d.index);
      // Tell the rest of the window. Staging here used to leave the nav on the old state until
      // something forced it — his report: "I had to unstage and stage it just for it to kick in".
      window.dispatchEvent(new CustomEvent("sv:git"));
    } catch (e) {
      setError(e.message || "could not stage those lines");
    }
  };

  // …and listen for everyone else's. Staging from the nav has to move these stripes too.
  useEffect(() => {
    const onGit = async () => {
      if (!Plugin || !hasDiff) return;
      try {
        const d = await Plugin.getDiff({ path: file.path });
        setBase(d.base);
        setIndex(d.index == null ? null : d.index);
      } catch {}
    };
    window.addEventListener("sv:git", onGit);
    return () => window.removeEventListener("sv:git", onGit);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [file.path, hasDiff, !!host]);

  // Entering diff mode fetches a FRESH base/head (edits + saves since the last look must show).
  // The choice is a MODE and it sticks — leaving it off for the next file is what made this five
  // clicks for five files.
  const toggleDiff = async () => {
    if (diffMode) {
      localStorage.setItem("sv.diffMode", "false");
      return setDiffMode(false);
    }
    try {
      const d = await Plugin.getDiff({ path: file.path });
      setDiffData(d);
      setBase(d.base);
      setIndex(d.index == null ? null : d.index);
      setDiffMode(true);
      localStorage.setItem("sv.diffMode", "true");
    } catch (e) {
      setError(e.message || "could not load diff");
    }
  };

  const dirty = content !== null && content !== savedContent;

  // Doc undo: `conflict` = someone else saved since this tab loaded (the write was refused, their
  // version is in conflict.current); `hist` = the History dropdown ({loading, snaps}) or null.
  const [conflict, setConflict] = useState(null);
  const [hist, setHist] = useState(null);

  const save = useCallback(async (force) => {
    if (!Plugin || content === null) return;
    setSaving(true);
    try {
      // `base` = what this tab loaded — the plugin refuses the write if the disk moved meanwhile
      // (stale-tab guard). `force` resends without base after the human chose to overwrite.
      const res = await Plugin.writeFile(
        force ? { path: file.path, content } : { path: file.path, content, base: savedContent },
      );
      if (res && res.conflict) {
        setConflict(res);
      } else {
        setSavedContent(content);
        setConflict(null);
        setError("");
      }
    } catch (e) {
      setError(e.message || "save failed");
    }
    setSaving(false);
  }, [Plugin, content, file.path, savedContent]);

  const openHistory = async () => {
    if (hist) return setHist(null);
    setHist({ loading: true, snaps: [] });
    try {
      const h = await Plugin.fileHistory({ path: file.path });
      setHist({ loading: false, snaps: h.snaps || [] });
    } catch (e) {
      setHist(null);
      setError(e.message || "could not load history");
    }
  };
  // Restoring is a normal write of the snapshot's content — the current version gets snapshotted
  // first (server-side), so undoing an undo is just another restore.
  const restoreSnap = async (ts) => {
    try {
      const snap = await Plugin.readSnapshot({ path: file.path, ts });
      await Plugin.writeFile({ path: file.path, content: snap.content });
      setContent(snap.content);
      setSavedContent(snap.content);
      setConflict(null);
      setHist(null);
      setError("");
    } catch (e) {
      setError(e.message || "restore failed");
    }
  };
  const ago = (ts) => {
    const s = Math.max(1, Math.round((Date.now() - ts) / 1000));
    if (s < 60) return `${s}s ago`;
    if (s < 3600) return `${Math.round(s / 60)}m ago`;
    if (s < 86400) return `${Math.round(s / 3600)}h ago`;
    return `${Math.round(s / 86400)}d ago`;
  };

  // ⌘S / Ctrl+S saves while the pane is mounted.
  useEffect(() => {
    const onKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "s") {
        e.preventDefault();
        save();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [save]);

  const togglePreview = () => {
    const next = !preview;
    setPreview(next);
    localStorage.setItem(`sv.mdPreview.${file.path}`, String(next));
  };

  // RFC-034 — COMMENTS SHOW BY DEFAULT. They were hidden until you asked, and the cost of that was
  // writing one, refreshing, and finding it closed — "I hate the fucking refreshing it closed if I
  // just made a comment". They're his notes on his file; they should be on the page.
  const [commentsOn, setCommentsOn] = useState(true);
  const [draft, setDraft] = useState(null); // the range being written about
  const [compose, setCompose] = useState(null); // { id, record } — the comment being added to
  // Which comments are flipped AGAINST the file's default — held here, not in the editor, because
  // the editor is rebuilt whenever the theme changes and that used to close them all on a flip.
  const [openComments, setOpenComments] = useState([]);
  const toggleComment = useCallback(
    (id) => setOpenComments((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id])),
    [],
  );
  const [clearArmed, setClearArmed] = useState(false);
  // ONE SEARCH THAT ALSO TRACES CODE. The term is the pane's, not the editor's, because it has to
  // SURVIVE THE FILE — his ask: "the search follows you if you navigate to another file". Kept per
  // project, so opening the next file already has it running.
  const [term, setTerm] = useState(() => {
    try {
      return localStorage.getItem(`sv.codeSearch.${file.projectCode}`) || "";
    } catch {
      return "";
    }
  });
  const [hits, setHits] = useState([]);
  // RFC-034 — THE 💬 IN THE HEADER IS A LIST, not a switch. "you can click on them and go straight to
  // those lines, you can delete them on the side, you can clear all of them": one row per comment,
  // the row takes you there, the × on it deletes that one, clear-all sits at the bottom instead of
  // being its own control up in the corner.
  const [listOpen, setListOpen] = useState(false);
  // The range a list row asked for. It carries a counter so clicking the SAME row twice jumps twice
  // — the editor keys its centring on the range, and a repeat of the same two numbers is not a change.
  const [jump, setJump] = useState(null);
  // THE POINTED-AT RANGE HAS TO BE DISMISSABLE. `#L17-40` (or an agent pointing you somewhere) marks
  // those lines and they stayed marked with nothing to press — "you can't unselect". So the range
  // says what it is and carries its own ×, and clearing it also takes `flines` out of the address so
  // the URL matches what you are looking at.
  // Every file the pane shows is pushed once; opening the SAME file again (a new line range, say)
  // is not a step in the trail.
  const here = { path: file.path, projectCode: file.projectCode, serviceId: file.serviceId, language: file.language };
  const [nav, setNav] = useState(0); // just to re-render the two buttons when the stack moves
  useEffect(() => {
    if (sameFile(stack[at], here)) return; // same file again (a new line range) is not a step
    if (moving) {
      moving = null; // the cursor was already moved by the button that sent us here
    } else {
      // A NEW PLACE retires whatever was ahead — the same rule every back/forward pair has ever had.
      stack.splice(at + 1);
      stack.push(here);
      at = stack.length - 1;
    }
    setNav((n) => n + 1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [file.path, file.projectCode]);
  const backTo = at > 0 ? stack[at - 1] : null;
  const fwdTo = at >= 0 && at < stack.length - 1 ? stack[at + 1] : null;
  const step = useCallback((d) => {
    const to = stack[at + d];
    if (!to) return;
    at += d;
    moving = true;
    window.dispatchEvent(new CustomEvent("sv:openFileInNav", { detail: to }));
  }, []);

  const [rangeOff, setRangeOff] = useState(false);
  useEffect(() => {
    setRangeOff(false);
  }, [file.path, String(file.lines)]);
  const shownRange = !rangeOff && !jump && file.lines && file.lines[0] ? file.lines : null;
  const clearRange = useCallback(() => {
    setRangeOff(true);
    setJump(null);
    try {
      const u = new URL(window.location.href);
      if (u.searchParams.has("flines")) {
        u.searchParams.delete("flines");
        window.history.replaceState(window.history.state, "", u.toString());
      }
    } catch {}
  }, []);
  // THE BAR BELONGS TO THE EDITOR. A markdown file opens RENDERED and a changed file can be showing
  // the side-by-side diff — in both, the box was drawn over a surface it cannot search, which is a
  // box that does nothing (his catch: "the search shows over markdown documents and it doesn't
  // work"). Flip that .md to Edit and it comes back, because then there is something to search.
  const editorShowing = !isImage && !error && content !== null && !(diffMode && diffData) && !(preview && isMd);
  // WHICH definition you are on. "1 def" is not a label, it is the way to it — press it and you are
  // there; press it again and you are on the next one, when there is more than one.
  const [defAt, setDefAt] = useState(0);
  // ...and a walker over EVERY instance, which is the other half of reading a search: ‹ › steps
  // through them in order and wraps, the same gesture the changes already have.
  const [hitAt, setHitAt] = useState(-1);
  useEffect(() => {
    setDefAt(0);
    setHitAt(-1);
  }, [term, file.path]);
  const stepHit = useCallback(
    (d) => {
      if (!hits.length) return;
      const next = (hitAt + d + hits.length + (hitAt < 0 && d < 0 ? 1 : 0)) % hits.length;
      const i = hitAt < 0 && d > 0 ? 0 : next;
      setHitAt(i);
      setJump([hits[i].line, hits[i].line, Date.now()]);
    },
    [hits, hitAt],
  );
  // THE GLOBAL HALF. Never automatic: a search across every file on every keystroke is a service
  // call per letter. One press, and what comes back is grouped by file with the definition-looking
  // lines on top — the same heuristic the in-file marks use, so the two halves agree.
  const [wide, setWide] = useState(null); // null = never asked · "loading" · { groups, truncated }
  // Across the project a line is judged on its own (search returns lines, not files), so the shared
  // line rule is the right one here — the multi-line import case is what the OPEN file is for.
  const KIND = (t, text) => kindOfLine(t, text);
  const searchProject = useCallback(async () => {
    if (!Plugin || !Plugin.search || !term) return;
    setWide("loading");
    try {
      const res = await Plugin.search({ query: term, max: 400 });
      const word = new RegExp(`\\b${term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`);
      const byFile = new Map();
      (res.hits || []).forEach((h) => {
        // The plugin matches a SUBSTRING (it is the same search the whole app uses); the whole-word
        // filter belongs here, where we know we are chasing a name and not a phrase.
        if (!word.test(h.text)) return;
        if (!byFile.has(h.path)) byFile.set(h.path, []);
        const kind = KIND(term, h.text);
        byFile.get(h.path).push({ ...h, kind, def: kind === "decl" });
      });
      const score = (rows) => (rows.some((r) => r.kind === "decl") ? 2 : rows.some((r) => r.kind === "import") ? 1 : 0);
      const groups = [...byFile.entries()]
        .map(([path, rows]) => ({
          path,
          // Inside a file too: the declaration is the line you were looking for.
          rows: rows.slice().sort((a, b) => (b.def ? 1 : 0) - (a.def ? 1 : 0) || a.line - b.line),
          defs: rows.filter((r) => r.def).length,
          rank: score(rows),
        }))
        // The file that DECLARES it first, then the ones that merely import it, then plain users.
        .sort((a, b) => b.rank - a.rank || b.defs - a.defs || a.path.localeCompare(b.path));
      setWide({ groups, truncated: !!res.truncated });
    } catch (e) {
      setWide({ groups: [], error: (e && e.message) || "search failed" });
    }
  }, [Plugin, term]);
  // THE TRACE HOP. When the name is bound HERE by an import, the box can carry you into the file it
  // came from — the chain his design is built on: click the name, see it here, keep going. It reads
  // the import line for the specifier, and the ALIAS matters: `import { a as b }` means the other
  // file calls it `a`, so that is the name to chase over there.
  const trace = useMemo(() => {
    if (!term || content == null) return null;
    const text = String(content);
    const q = term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const word = new RegExp(`\\b${q}\\b`);
    // A DESTRUCTURED IMPORT SPANNING LINES is the common case and the one a line-by-line reader
    // misses entirely — his catch. Ask the blocks first, by position, not by line.
    for (const b of importBlocks(text)) {
      if (word.test(b.members) && /^[./]/.test(b.spec))
        return { spec: b.spec, name: originalName(b.members, term) };
    }
    // Then the single-line forms: `import X from "y"`, `const X = require("y")`.
    for (const line of text.split("\n")) {
      if (!word.test(line)) continue;
      const from = line.match(/\bfrom\s*['"]([^'"]+)['"]/) || line.match(/\brequire\s*\(\s*['"]([^'"]+)['"]/);
      if (!from || !/^[./]/.test(from[1])) continue;
      const alias = line.match(new RegExp(`\\b([A-Za-z_$][\\w$]*)\\s+as\\s+${q}\\b`));
      return { spec: from[1], name: alias ? alias[1] : term };
    }
    return null;
  }, [term, content]);

  // A new term retires the old results rather than leaving last question's answer on screen.
  useEffect(() => {
    setWide(null);
  }, [term]);
  const setSearchTerm = useCallback(
    (t) => {
      setTerm(t);
      try {
        localStorage.setItem(`sv.codeSearch.${file.projectCode}`, t || "");
      } catch {}
    },
    [file.projectCode],
  );

  const [codeMenu, setCodeMenu] = useState(null);
  const { threads, error: commentError, addThread, addReply, removeReply, removeThread, removeAll } =
    useCodeComments(Plugin, file.path);
  useEffect(() => {
    // A different file starts clean — its own comments, nothing half-written carried over.
    setDraft(null);
    setCompose(null);
    setOpenComments([]);
    setClearArmed(false);
    setListOpen(false);
    setJump(null);
  }, [file.path]);

  // CLICK AN IMPORT, OPEN THAT FILE (the editor marks the paths; resolving one is this pane's job,
  // because it owns the file host). Node's own resolution order, minus node_modules: the exact path,
  // then the usual extensions, then the folder's index. Each candidate is simply READ — the first
  // one that answers exists, and nothing needs an index or a parser.
  const EXTS = ["", ".js", ".jsx", ".ts", ".tsx", ".mjs", ".cjs", ".json", ".scss", ".css", ".md"];
  const EXT_LANG = {
    js: "javascript", jsx: "javascript", mjs: "javascript", cjs: "javascript",
    ts: "typescript", tsx: "typescript", json: "json", md: "markdown", markdown: "markdown",
    scss: "scss", css: "css", html: "html", yml: "yaml", yaml: "yaml", sh: "shell", py: "python", sql: "sql",
  };
  const langFor = (p) => EXT_LANG[(String(p).split(".").pop() || "").toLowerCase()] || "text";
  const openImport = useCallback(
    async (spec, focusName) => {
      if (!Plugin || !spec) return;
      const dir = file.path.includes("/") ? file.path.slice(0, file.path.lastIndexOf("/")) : "";
      // Resolve `./x`, `../x` and `/x` against this file's own folder, flattening the dots by hand —
      // there is no path module in a browser and the answer has to be a repo-relative path anyway.
      const parts = (spec.startsWith("/") ? spec.slice(1) : `${dir}/${spec}`).split("/");
      const out = [];
      parts.forEach((seg) => {
        if (!seg || seg === ".") return;
        if (seg === "..") out.pop();
        else out.push(seg);
      });
      const base = out.join("/");
      const tries = [...EXTS.map((e) => `${base}${e}`), ...EXTS.slice(1).map((e) => `${base}/index${e}`)];
      for (const candidate of tries) {
        try {
          const res = await Plugin.readFile({ path: candidate });
          // LAND ON THE NAME, not at the top. We already have the bytes from the existence check, so
          // finding where the other file declares it costs nothing — and arriving at line 1 and
          // scrolling is the exact thing this whole feature exists to stop.
          let lines = null;
          if (focusName && res && res.content) {
            const rows = String(res.content).split("\n");
            const word = new RegExp(`\\b${focusName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`);
            let firstHit = -1;
            for (let i = 0; i < rows.length; i += 1) {
              if (!word.test(rows[i])) continue;
              if (firstHit < 0) firstHit = i + 1;
              if (KIND(focusName, rows[i]) === "decl") {
                lines = [i + 1, i + 1];
                break;
              }
            }
            if (!lines && firstHit > 0) lines = [firstHit, firstHit];
          }
          window.dispatchEvent(
            new CustomEvent("sv:openFileInNav", {
              detail: {
                projectCode: file.projectCode,
                serviceId: file.serviceId,
                path: candidate,
                language: langFor(candidate),
                ...(lines ? { lines } : {}),
              },
            }),
          );
          return;
        } catch {
          /* not this one — try the next */
        }
      }
      // SAY SO. A link that quietly does nothing is the thing that makes you doubt the whole feature.
      setError(`can't find ${spec} from ${file.path}`);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [Plugin, file.path, file.projectCode, file.serviceId],
  );

  const onComment = useMemo(
    () => ({
      addThread: (from, to, text) => {
        const id = addThread(from, to, text);
        setDraft(null);
        // The one you just wrote is SHOWN — it inherits the default, and any flip against it is
        // stale the moment the comment is new.
        if (id) setOpenComments((cur) => cur.filter((x) => x !== id));
      },
      addReply,
      removeReply,
      removeThread,
      cancelDraft: () => setDraft(null),
      // The right-click ON a comment. Everything you can do to one lives here — reply, reply by
      // voice, delete it — because that is where this app keeps its verbs.
      threadMenu: (e, id) => {
        const t = threads.find((x) => x.id === id);
        if (!t) return;
        const tl = t.from === t.to ? `${t.from}` : `${t.from}-${t.to}`;
        setCodeMenu({
          x: e.clientX,
          y: e.clientY,
          title: `comment on ${tl}`,
          items: [
            { label: "Reply", action: () => setCompose({ id, record: false }) },
            { label: "🎙 Reply by voice", action: () => setCompose({ id, record: true }) },
            {
              label: "Delete this comment",
              danger: true,
              confirm: `Delete the comment on ${tl}?`,
              action: () => removeThread(id),
            },
          ],
        });
      },
    }),
    [addThread, addReply, removeReply, removeThread, threads],
  );

  // The code's own right-click. The pane owns it because only the pane knows about the store; the
  // editor just reports which lines the pointer (or the selection) is on.
  const onCodeMenu = (e, range) => {
    const label = range.from === range.to ? `${range.from}` : `${range.from}-${range.to}`;
    const items = [
      {
        label: `Comment on ${label}`,
        action: () => {
          setCommentsOn(true);
          setDraft({ ...range, record: false });
        },
      },
      // START RECORDING ON THE CLICK — his ask, verbatim: "the recorder in the right-click option.
      // Boom. You click it, it starts recording your next comment."
      {
        label: `🎙 Comment on ${label} by voice`,
        action: () => {
          setCommentsOn(true);
          setDraft({ ...range, record: true });
        },
      },
    ];
    // DELETING A COMMENT LIVES HERE — "who needs a delete thing anyway, you just right click". Any
    // thread overlapping the lines you clicked is offered, named by its range so two on top of each
    // other stay tellable apart.
    threads
      .filter((t) => t.to >= range.from && t.from <= range.to)
      .forEach((t) => {
        const tl = t.from === t.to ? `${t.from}` : `${t.from}-${t.to}`;
        items.push({ label: `Reply to the comment on ${tl}`, action: () => setCompose({ id: t.id, record: false }) });
        items.push({ label: `🎙 Reply to ${tl} by voice`, action: () => setCompose({ id: t.id, record: true }) });
        items.push({
          label: `Delete the comment on ${tl}`,
          danger: true,
          confirm: `Delete the comment on ${tl}?`,
          action: () => removeThread(t.id),
        });
      });
    setCodeMenu({ x: e.clientX, y: e.clientY, title: `${file.path.split("/").pop()} · ${label}`, items });
  };

  const segments = file.path.split("/");

  return (
    <div className={CLASSNAME}>
      <div className={`${CLASSNAME}__header ${!editorDark ? `${CLASSNAME}__header--light` : ""}`}>
        {backTo && (
          <button
            type="button"
            className={`${CLASSNAME}__back`}
            title={`Back to ${backTo.path}`}
            onClick={() => step(-1)}
          >
            ‹
          </button>
        )}
        <span className={`${CLASSNAME}__kind`}>code</span>
        {/* Breadcrumb — the path, its file name emphasized. */}
        <span className={`${CLASSNAME}__crumb`} title={file.path}>
          {segments.map((seg, i) => (
            <span key={i}>
              {i > 0 && <span className={`${CLASSNAME}__crumb-sep`}>/</span>}
              <span
                className={
                  i === segments.length - 1 ? `${CLASSNAME}__crumb-file` : `${CLASSNAME}__crumb-dir`
                }
              >
                {seg}
              </span>
            </span>
          ))}
        </span>
        {dirty && <span className={`${CLASSNAME}__dirty`} title="unsaved changes" />}
        <span className={`${CLASSNAME}__actions`}>
          {fwdTo && (
            <button
              type="button"
              className={`${CLASSNAME}__back`}
              title={`Forward to ${fwdTo.path}`}
              onClick={() => step(1)}
            >
              ›
            </button>
          )}
          <EditorThemeToggle scope={themeScope} />
          {/* Shown while the MODE is on even where this file has no diff — otherwise opening an
              unchanged file takes away the only control that turns the mode back off. */}
          {(hasDiff || diffMode) && (
            <button
              type="button"
              className={`${CLASSNAME}__btn ${diffMode ? `${CLASSNAME}__btn--pinned` : ""}`}
              title={
                diffMode
                  ? hasDiff
                    ? "Diff mode is on — every changed file opens like this. Click to leave it."
                    : "Diff mode is on, but this file matches HEAD. Click to leave it."
                  : "This file differs from git HEAD — show the diff, and keep showing diffs"
              }
              onClick={toggleDiff}
            >
              Diff
            </button>
          )}
          {/* RFC-034 — one control for ALL of this file's comments, off by default. The count is on
              it so you can tell there's a conversation here without turning it on. */}
          {/* NOT PINNED. It was wearing the amber "this mode is on" look, which shouted at you about
              the normal state of the file — comments showing is not a mode you're in. */}
          {!isImage && !diffMode && threads.length > 0 && (
            <button
              type="button"
              className={`${CLASSNAME}__btn ${listOpen ? `${CLASSNAME}__btn--pinned` : ""}`}
              title={`${threads.length} comment${threads.length === 1 ? "" : "s"} on this file — open the list`}
              onClick={() => {
                setListOpen(!listOpen);
                setClearArmed(false);
              }}
            >
              💬{threads.length ? ` ${threads.length}` : ""}
            </button>
          )}
          {isMd && !(diffMode && hasDiff) && (
            <button type="button" className={`${CLASSNAME}__btn`} onClick={togglePreview}>
              {preview ? "Edit" : "Preview"}
            </button>
          )}
          <button
            type="button"
            className={`${CLASSNAME}__btn ${hist ? `${CLASSNAME}__btn--pinned` : ""}`}
            title="Saved versions of this file — click one to restore it (the current version is kept in history too)"
            onClick={openHistory}
          >
            ⏱
          </button>
          <button
            type="button"
            className={`${CLASSNAME}__btn ${CLASSNAME}__btn--save`}
            onClick={() => save()}
            disabled={!dirty || saving}
          >
            {saving ? "Saving…" : "Save"}
          </button>
          {onClose && (
            <button
              type="button"
              className={`${CLASSNAME}__btn ${CLASSNAME}__btn--close`}
              title="Close file"
              onClick={onClose}
            >
              ×
            </button>
          )}
        </span>
      </div>
      {/* THE SEARCH BAR. One box: type in it, or ⌘-click a name in the code and it fills itself.
          It says how many hits are in this file and how many of them look like a definition, and it
          carries across files — the whole point is that it follows you. */}
      {editorShowing && (
        <div className={`${CLASSNAME}__find`}>
          {shownRange && (
            <button
              type="button"
              className={`${CLASSNAME}__range`}
              title="These lines were pointed at — click to let go of them"
              onClick={clearRange}
            >
              {`L${shownRange[0]}${shownRange[1] && shownRange[1] !== shownRange[0] ? `–${shownRange[1]}` : ""}`}
              <span className={`${CLASSNAME}__range-x`}>×</span>
            </button>
          )}
          <input
            className={`${CLASSNAME}__find-input`}
            value={term}
            placeholder="find in file — or ⌘-click a name"
            spellCheck={false}
            onChange={(e) => setSearchTerm(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Escape") setSearchTerm("");
            }}
          />
          {term && hits.length > 0 && (
            <span className={`${CLASSNAME}__find-walk`}>
              <button type="button" title="Previous instance" onClick={() => stepHit(-1)}>
                ‹
              </button>
              <span className={`${CLASSNAME}__find-at`}>
                {hitAt < 0 ? "–" : hitAt + 1}
              </span>
              <button type="button" title="Next instance" onClick={() => stepHit(1)}>
                ›
              </button>
            </span>
          )}
          {term && (
            <span className={`${CLASSNAME}__find-count`}>
              {`${hits.length} here`}
              {hits.some((h) => h.def) && (
                <button
                  type="button"
                  className={`${CLASSNAME}__find-def`}
                  title={(() => {
                    const defs = hits.filter((h) => h.def);
                    const what = defs.find((d) => d.word);
                    const kind = what ? what.word : defs.some((d) => d.kind === "import") ? "import" : "definition";
                    return defs.length > 1
                      ? `Go to the ${kind} — press again for the next one`
                      : `Go to the ${kind}`;
                  })()}
                  onClick={() => {
                    const defs = hits.filter((h) => h.def);
                    if (!defs.length) return;
                    const d = defs[defAt % defs.length];
                    setDefAt((n) => n + 1);
                    setJump([d.line, d.line, Date.now()]);
                  }}
                >
                  {` · ${hits.filter((h) => h.def).length} def`}
                </button>
              )}
            </span>
          )}
          {trace && (
            <button
              type="button"
              className={`${CLASSNAME}__find-trace`}
              title={`Open ${trace.spec} and land on ${trace.name}`}
              onClick={() => openImport(trace.spec, trace.name)}
            >
              {`→ ${trace.spec}`}
            </button>
          )}
          {term && (
            <button
              type="button"
              className={`${CLASSNAME}__find-wide`}
              title={`Search every file in ${file.projectCode}`}
              disabled={wide === "loading"}
              onClick={searchProject}
            >
              {wide === "loading" ? "searching…" : "project"}
            </button>
          )}
          {term && (
            <button
              type="button"
              className={`${CLASSNAME}__find-x`}
              title="Clear the search"
              onClick={() => setSearchTerm("")}
            >
              ×
            </button>
          )}
        </div>
      )}
      {/* THE PROJECT RESULTS. Files that DEFINE the name first, then the rest — and every row is the
          line itself, so you can usually answer the question without opening anything. */}
      {editorShowing && wide && wide !== "loading" && (
        <div className={`${CLASSNAME}__wide`}>
          {wide.error ? (
            <div className={`${CLASSNAME}__wide-note`}>{wide.error}</div>
          ) : !wide.groups.length ? (
            <div className={`${CLASSNAME}__wide-note`}>
              {`no other file in ${file.projectCode} has “${term}”`}
            </div>
          ) : (
            <>
              <div className={`${CLASSNAME}__wide-note`}>
                {`${wide.groups.reduce((n, g) => n + g.rows.length, 0)} in ${wide.groups.length} file${wide.groups.length === 1 ? "" : "s"}`}
                {wide.truncated ? " · capped" : ""}
              </div>
              {wide.groups.map((g) => (
                <div key={g.path} className={`${CLASSNAME}__wide-group`}>
                  <div className={`${CLASSNAME}__wide-file`}>
                    {g.path}
                    <span className={`${CLASSNAME}__wide-n`}>{g.rows.length}</span>
                    {g.defs > 0 && <span className={`${CLASSNAME}__find-def`}>{`${g.defs} def`}</span>}
                  </div>
                  {g.rows.map((r) => (
                    <button
                      key={`${r.path}:${r.line}`}
                      type="button"
                      className={`${CLASSNAME}__wide-row${r.def ? ` ${CLASSNAME}__wide-row--def` : ""}`}
                      title={`${r.path}:${r.line}`}
                      onClick={() =>
                        window.dispatchEvent(
                          new CustomEvent("sv:openFileInNav", {
                            detail: {
                              projectCode: file.projectCode,
                              serviceId: file.serviceId,
                              path: r.path,
                              language: langFor(r.path),
                              lines: [r.line, r.line],
                            },
                          }),
                        )
                      }
                    >
                      <span className={`${CLASSNAME}__wide-line`}>{r.line}</span>
                      <span className={`${CLASSNAME}__wide-text`}>{r.text}</span>
                    </button>
                  ))}
                </div>
              ))}
            </>
          )}
        </div>
      )}
      {/* THE COMMENT LIST — what the 💬 opens. Every comment on this file: where it is, what it says,
          and an × to take it off. Clicking one goes to the lines and leaves the list. */}
      {listOpen && threads.length > 0 && (
        <div className={`${CLASSNAME}__clist`}>
          {threads.map((t) => {
            const range = t.from === t.to ? `${t.from}` : `${t.from}–${t.to}`;
            const first = ((t.replies || [])[0] || {}).text || "";
            return (
              <div key={t.id} className={`${CLASSNAME}__clist-row`}>
                <button
                  type="button"
                  className={`${CLASSNAME}__clist-go`}
                  title={`Go to line${t.from === t.to ? "" : "s"} ${range}`}
                  onClick={() => {
                    // Going TO a comment shows it — landing on a line whose comment is folded away
                    // would be arriving at nothing. `openComments` holds the flips AGAINST the
                    // file's default, so "shown" is a different list depending on that default.
                    setOpenComments((cur) =>
                      commentsOn ? cur.filter((x) => x !== t.id) : cur.includes(t.id) ? cur : [...cur, t.id],
                    );
                    setJump([t.from, t.to, Date.now()]);
                    setListOpen(false);
                  }}
                >
                  <span className={`${CLASSNAME}__clist-line`}>L{range}</span>
                  <span className={`${CLASSNAME}__clist-text`}>{first}</span>
                  {(t.replies || []).length > 1 && (
                    <span className={`${CLASSNAME}__clist-n`}>{t.replies.length}</span>
                  )}
                </button>
                <button
                  type="button"
                  className={`${CLASSNAME}__clist-x`}
                  title={`Delete the comment on ${range}`}
                  onClick={() => removeThread(t.id)}
                >
                  ×
                </button>
              </div>
            );
          })}
          <div className={`${CLASSNAME}__clist-foot`}>
            <button
              type="button"
              className={`${CLASSNAME}__clist-act`}
              title={commentsOn ? "Fold every comment away" : "Show every comment"}
              onClick={() => {
                setOpenComments([]);
                setCommentsOn(!commentsOn);
                if (commentsOn) setDraft(null);
              }}
            >
              {commentsOn ? "hide all" : "show all"}
            </button>
            <button
              type="button"
              className={`${CLASSNAME}__clist-act ${CLASSNAME}__clist-act--danger`}
              title="Delete every comment on this file — the sidecar goes with them"
              onClick={() => {
                if (!clearArmed) return setClearArmed(true);
                setClearArmed(false);
                removeAll();
                setListOpen(false);
              }}
              onBlur={() => setClearArmed(false)}
            >
              {clearArmed ? "delete them all?" : "clear all"}
            </button>
          </div>
        </div>
      )}
      {/* HISTORY — the snapshot ring: every save filed the previous version; click restores. */}
      {hist && (
        <div className={`${CLASSNAME}__history`}>
          {hist.loading ? (
            <span className={`${CLASSNAME}__history-note`}>loading…</span>
          ) : !hist.snaps.length ? (
            <span className={`${CLASSNAME}__history-note`}>
              no saved versions yet — history starts with the next save
            </span>
          ) : (
            hist.snaps.map((s) => (
              <button
                key={s.ts}
                type="button"
                className={`${CLASSNAME}__history-item`}
                title={new Date(s.ts).toLocaleString()}
                onClick={() => restoreSnap(s.ts)}
              >
                {ago(s.ts)} <span className={`${CLASSNAME}__history-bytes`}>{s.bytes}b</span>
              </button>
            ))
          )}
        </div>
      )}
      {/* CONFLICT — the stale-tab guard refused the save: someone else's version is on disk. */}
      {conflict && (
        <div className={`${CLASSNAME}__conflict`}>
          <span>
            Someone else saved this file after you loaded it — your save was held so it wouldn't
            wipe theirs.
          </span>
          <button type="button" className={`${CLASSNAME}__btn`} onClick={() => save(true)}>
            Save mine anyway
          </button>
          <button
            type="button"
            className={`${CLASSNAME}__btn`}
            onClick={() => {
              setContent(conflict.current);
              setSavedContent(conflict.current);
              setConflict(null);
            }}
          >
            Take theirs
          </button>
        </div>
      )}
      <div className={`${CLASSNAME}__body ${!diffMode && editorDark ? `${CLASSNAME}__body--dark` : ""} ${!editorDark ? `${CLASSNAME}__body--light` : ""}`}>
        {error && <div className={`${CLASSNAME}__error`}>{error}</div>}
        {!error && content === null && <div className={`${CLASSNAME}__loading`}>loading…</div>}
        {!error && isImage && (
          <div className={`${CLASSNAME}__image`}>
            <img
              className={`${CLASSNAME}__image-img`}
              src={`/sv-raw/${encodeURIComponent(file.projectCode)}/${encodeURIComponent(
                file.serviceId,
              )}?path=${encodeURIComponent(file.path)}`}
              alt={file.path}
            />
          </div>
        )}
        {!error && !isImage && content !== null && (diffMode && diffData ? (
          // The diff EDITS the working file: head = the editor's live content (unsaved edits show),
          // typing in the right side feeds the same dirty/Save/⌘S machinery as the plain editor.
          <DiffView base={diffData.base} head={content} language={diffData.language} dark={editorDark} onChange={setContent} />
        ) : preview && isMd ? (
          <div className={`md-view md-view--${editorDark ? "dark" : "light"}`}>
            <Markdown
              dark={editorDark}
              scope={{ projectCode: file.projectCode, serviceId: file.serviceId }}
              commentKey={`file-${file.path}`}
              // A checklist toggled in Preview saves the file — same writeFile the editor uses.
              onSourceChange={
                Plugin
                  ? async (next) => {
                      setContent(next);
                      try {
                        const res = await Plugin.writeFile({ path: file.path, content: next, base: savedContent });
                        if (res && res.conflict) setConflict(res);
                        else setSavedContent(next);
                      } catch (e) {
                        setError(e.message || "save failed");
                      }
                    }
                  : null
              }
            >
              {content}
            </Markdown>
          </div>
        ) : (
          // Every file edits with syntax coloring; the GLOBAL editor theme (default dark) decides the
          // canvas — the rendered md Preview follows it too.
          // `file.lines` is set when a :file[path#L40-70] link opened this — select + center it.
          <CodeEditor
            value={content}
            language={file.language}
            onChange={setContent}
            dark={editorDark}
            focusLines={jump || (rangeOff ? null : file.lines) || null}
            changeMarks={changeMarks}
            hunks={hunks}
            onStageHunk={stageHunkAt}
            comments={threads}
            commentsOn={commentsOn}
            onComment={onComment}
            commentDraft={draft}
            commentCompose={compose}
            commentOpen={openComments}
            onToggleComment={toggleComment}
            onCodeMenu={onCodeMenu}
            onOpenPath={openImport}
            search={term}
            onSearchHits={setHits}
            onWordClick={setSearchTerm}
          />
        ))}
      </div>
      {commentError && <div className={`${CLASSNAME}__error`}>{commentError}</div>}
      {/* The same two-step context menu the codebase tree uses — one menu, two surfaces. */}
      <RowMenu menu={codeMenu} onClose={() => setCodeMenu(null)} />
    </div>
  );
};

export default CodePane;
