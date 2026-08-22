import React, { useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import ServiceContext from "../../ServiceContext";
import loadServiceWithHeaders from "../../utils/loadService";
import Markdown from "../../atoms/Markdown/Markdown";
import DescriptionBox from "../../atoms/DescriptionBox/DescriptionBox";
import { EditorThemeToggle, useEditorDark } from "../../atoms/CodeView/editorTheme";
import { raiseError } from "../../atoms/Banner/bannerStore";
import "./styles.scss";

// The REPORTS tab — namespace-scoped documents that are NOT part of the project's documentation.
//
// The Documentation tab documents the SYSTEM: one doc per namespace, living in the repo beside the
// code, committed. A report is the other thing you need a document for — a write-up, a plan, a
// review, an agent's findings — several per namespace, temporary, and deliberately NOT in the repo:
// they live in `.systemview/`, which is ignored, so they never pollute the project's docs or its git.
//
// It replaces what a story does, without a story's frame: the picker is ONE LINE in the header, so
// the document gets the whole panel. Same renderer as everywhere else, write path wired, so every
// block works — runnables, embeds, checklists, threads.

const slug = (s) => String(s || "").replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80);
const INDEX = ".systemview/reports.index.json";
// Flat inside `.systemview/`: that folder always exists (stories live there) and older published
// plugins can't create directories — the same constraint the comment sidecars work under.
const filePath = (nsKey, name) => `.systemview/report.${slug(nsKey)}.${slug(name)}.md`;

const hasPlugin = (s) =>
  ((s.system && s.system.connectionData && s.system.connectionData.modules) || []).some((m) => m.name === "Plugin");

const ReportsTab = ({ projectCode, serviceId, moduleName, methodName, openName, onOpen }) => {
  const { connectedServices = [] } = useContext(ServiceContext);
  const [editorDark] = useEditorDark("docs");
  const [index, setIndex] = useState(null); // { [nsKey]: [{ name, path, ts }] }
  const [doc, setDoc] = useState(null); // { name, path, content }
  const [picking, setPicking] = useState(false);
  const [naming, setNaming] = useState("");
  // A report is something you WRITE, not only something you read — same Edit/Save the Documentation
  // tab has, on the same editor.
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const nameRef = useRef(null);

  const nsKey = [projectCode, serviceId, moduleName, methodName].filter(Boolean).join(".") || "";
  const nsLabel = [serviceId, moduleName, methodName].filter(Boolean).join(".") || projectCode || "";

  const host = useMemo(() => {
    const inProject = connectedServices.filter((s) => s.projectCode === projectCode && hasPlugin(s));
    return inProject.find((s) => s.serviceId === serviceId) || inProject[0] || null;
  }, [connectedServices, projectCode, serviceId]);
  const Plugin = useMemo(
    () => (host ? loadServiceWithHeaders(host.system.connectionData, host.headers, host.credentials).Plugin : null),
    [host]
  );

  // Reports are tracked in one small index file — the list here is the index, not a directory
  // walk (`.systemview` shows in the file tree now, but the index is what names a report).
  useEffect(() => {
    let dead = false;
    (async () => {
      if (!Plugin) return setIndex({});
      try {
        const res = await Plugin.readFile({ path: INDEX });
        if (!dead) setIndex(JSON.parse(res.content || "{}"));
      } catch {
        if (!dead) setIndex({}); // no reports yet is the normal case, not an error
      }
    })();
    return () => {
      dead = true;
    };
  }, [Plugin]);

  // THE FOLDER IS THE TRUTH; THE INDEX IS JUST A LIST. A report written straight to disk — by an
  // agent, by hand — opened fine from a link but could not be CHOSEN, because the picker only ever
  // showed what the index knew about (his catch: buAPI linked him a report he then couldn't find in
  // the options). Anything named like a report of this namespace shows up now, registered or not.
  const [found, setFound] = useState([]);
  const svcIds = useMemo(
    () => connectedServices.filter((s) => s.projectCode === projectCode).map((s) => s.serviceId),
    [connectedServices, projectCode]
  );
  useEffect(() => {
    let dead = false;
    (async () => {
      if (!Plugin) return setFound([]);
      const prefix = `.systemview/report.${slug(nsKey)}.`;
      try {
        const res = await Plugin.listFiles({ glob: `${prefix}*.md` });
        const hits = ((res && (res.files || res)) || [])
          .map((f) => ({ path: (f && f.path) || f, ts: (f && (f.mtime || f.ts)) || 0 }))
          .filter((f) => f.path && f.path.startsWith(prefix) && /\.md$/i.test(f.path))
          .map((f) => ({ ...f, name: f.path.slice(prefix.length).replace(/\.md$/i, "") }))
          // A deeper namespace's reports live under the same prefix (`report.buAPI.Profiles.x.md`
          // starts with `report.buAPI.`) — they belong to that namespace's picker, not this one.
          .filter((e) => !svcIds.some((id) => id && e.name.startsWith(`${id}.`)));
        if (!dead) setFound(hits);
      } catch {
        if (!dead) setFound([]); // no file access is the old behaviour, not an error
      }
    })();
    return () => {
      dead = true;
    };
  }, [Plugin, nsKey, svcIds]);

  // Removing a report drops it from the list without destroying the writing — so the discovered
  // list has to remember what you dropped, or the scan would just put it straight back.
  const hidden = useMemo(() => new Set(((index && index.__hidden) || [])), [index]);
  const mine = useMemo(() => {
    const listed = (index && index[nsKey]) || [];
    const known = new Set(listed.map((r) => r.path));
    return [...listed, ...found.filter((f) => !known.has(f.path) && !hidden.has(f.path))];
  }, [index, nsKey, found, hidden]);

  // READ-MODIFY-WRITE, never blind write. The index holds EVERY namespace's reports, so writing the
  // copy this component loaded on mount would erase anything another tab (or another window, or an
  // agent) added since — one stale write and someone's reports vanish from the list. Only the
  // namespace being edited is replaced; everything else is carried over from what's on disk now.
  const saveIndex = useCallback(
    async (nsList, hide) => {
      let onDisk = {};
      try {
        const res = await Plugin.readFile({ path: INDEX });
        onDisk = JSON.parse(res.content || "{}") || {};
      } catch {
        onDisk = {};
      }
      const next = { ...onDisk };
      if (hide) next.__hidden = [...new Set([...(onDisk.__hidden || []), hide])];
      if (nsList && nsList.length) next[nsKey] = nsList;
      else delete next[nsKey];
      setIndex(next);
      try {
        await Plugin.writeFile({ path: INDEX, content: JSON.stringify(next, null, 2) + "\n" });
      } catch (e) {
        raiseError("Couldn't save the reports index", e && (e.message || String(e)));
      }
    },
    [Plugin, nsKey]
  );

  const read = useCallback(
    async (entry) => {
      if (!Plugin || !entry) return;
      try {
        const data = await Plugin.readFile({ path: entry.path });
        setDoc({ ...entry, content: data.content || "" });
      } catch (e) {
        // AN UNREADABLE REPORT MUST NOT LOOK LIKE AN EMPTY ONE. This used to fall back to blank
        // content, so a wrong path — a report from another project, a typo in a command, a deleted
        // file — opened a document with the right-looking title and nothing in it, and there was no
        // way to tell that from a report someone genuinely hadn't written yet.
        setDoc({ ...entry, content: "", failed: (e && (e.message || String(e))) || "could not be read" });
      }
    },
    [Plugin]
  );

  // The open report rides the URL, so a refresh keeps you where you were. RFC-029: `?rdoc=` may
  // carry the entry NAME (a click here) or the file PATH (a `:report[…]` chip, a nav command) —
  // resolve either, across EVERY namespace of the project, because a report link must open the
  // report no matter where you're standing ("you gotta select the report" was the bug).
  useEffect(() => {
    if (!openName) return setDoc(null);
    if (doc && (doc.name === openName || doc.path === openName)) {
      // OPENED BY PATH, TITLED BY FILENAME. `?rdoc=` may arrive before the index does (a chip, a nav
      // command, the TV's hand-off), and the fallback below names the document after its file — so
      // the header read `report.systemview-test.Four-off-the-board` instead of "Four off the board".
      // Adopt the real name the moment the index can supply it; the title is how he knows what he's
      // reading.
      if (doc.path === openName && index) {
        for (const list of Object.values(index)) {
          const hit = (Array.isArray(list) ? list : []).find(
            (r) => r && r.path === openName && r.name && r.name !== doc.name,
          );
          if (hit) {
            setDoc((d) => (d ? { ...d, name: hit.name } : d));
            break;
          }
        }
      }
      return;
    }
    let entry = mine.find((r) => r.name === openName || r.path === openName);
    if (!entry && index) {
      for (const list of Object.values(index)) {
        const hit = (list || []).find((r) => r.name === openName || r.path === openName);
        if (hit) {
          entry = hit;
          break;
        }
      }
    }
    // Not indexed but it's a markdown path — a report is just a file; open it anyway.
    if (!entry && /\.md$/i.test(openName))
      entry = { name: (openName.split("/").pop() || openName).replace(/\.md$/i, ""), path: openName };
    if (entry) read(entry);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openName, index, nsKey, Plugin]);

  // RFC-029 refresh scope `reports` — re-read the index AND the open document in place.
  const [refreshTick, setRefreshTick] = useState(0);
  useEffect(() => {
    const on = (e) => {
      const s = ((e && e.detail) || {}).scope || "all";
      if (s === "all" || s === "reports") setRefreshTick((n) => n + 1);
    };
    window.addEventListener("sv:refresh", on);
    return () => window.removeEventListener("sv:refresh", on);
  }, []);
  useEffect(() => {
    if (!refreshTick || !Plugin) return;
    (async () => {
      try {
        const res = await Plugin.readFile({ path: INDEX });
        setIndex(JSON.parse(res.content || "{}"));
      } catch {}
      if (doc) {
        try {
          const data = await Plugin.readFile({ path: doc.path });
          setDoc((cur) => (cur ? { ...cur, content: data.content || "" } : cur));
        } catch {}
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshTick]);

  // THE OPEN REPORT KEEPS ITSELF FRESH — his catch: "I had to refresh to see your changes to the
  // report why is that". A report is a file (RFC-040) and this pane read it once, on open, so an
  // agent writing to it while he read changed nothing on screen. It re-reads on a beat and repaints
  // only when the bytes actually differ, so a document sitting untouched costs one small read and
  // never moves under him. It stands off while he's editing or mid-save — his keystrokes win.
  useEffect(() => {
    if (!Plugin || !doc || !doc.path || editing) return undefined;
    let dead = false;
    const path = doc.path;
    const reread = async () => {
      if (dead || document.hidden) return;
      if (Date.now() - savingRef.current < 4000) return; // a save of his is still settling
      try {
        const data = await Plugin.readFile({ path });
        if (dead || typeof data.content !== "string") return;
        setDoc((cur) =>
          cur && cur.path === path && cur.content !== data.content
            ? { ...cur, content: data.content, failed: undefined }
            : cur,
        );
      } catch {
        /* mid-write, or the host is down — what's on screen stays */
      }
    };
    const t = setInterval(reread, 4000);
    window.addEventListener("focus", reread);
    return () => {
      dead = true;
      clearInterval(t);
      window.removeEventListener("focus", reread);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [Plugin, doc && doc.path, editing]);

  const open = (entry) => {
    setPicking(false);
    setEditing(false);
    onOpen(entry.name);
    read(entry);
  };
  // An explicit ✕ means "I don't want a report showing" — remember it, or the auto-open below
  // would reopen the pane the moment it closed. Forgotten when the namespace changes.
  const closedRef = useRef(false);
  useEffect(() => {
    closedRef.current = false;
  }, [nsKey]);
  const close = () => {
    closedRef.current = true;
    setDoc(null);
    setEditing(false);
    onOpen(null);
  };

  // Landing on a namespace that HAS reports shows the LATEST one straight away — an empty pane
  // with a picker while a report exists reads as broken, doubly so when there's exactly one.
  useEffect(() => {
    if (doc || openName || closedRef.current || !mine.length) return;
    const latest = [...mine].sort((a, b) => (b.ts || 0) - (a.ts || 0))[0];
    open(latest);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index, nsKey, Plugin]);

  const create = async (name) => {
    const clean = String(name || "").trim();
    if (!clean || !Plugin) return;
    const entry = { name: clean, path: filePath(nsKey, clean), ts: Date.now() };
    const body = `# ${clean}\n\n`;
    try {
      await Plugin.writeFile({ path: entry.path, content: body });
    } catch (e) {
      raiseError("Couldn't create the report", e && (e.message || String(e)));
      return;
    }
    await saveIndex([...mine.filter((r) => r.name !== clean), entry]);
    setNaming("");
    setPicking(false); // creating IS choosing — leaving the list open just covers what you made
    setDoc({ ...entry, content: body });
    onOpen(clean);
  };

  const remove = async (entry) => {
    await saveIndex(mine.filter((r) => r.name !== entry.name), entry.path);
    if (doc && doc.name === entry.name) close();
    // The .md itself is left on disk — dropping it from the list is not the same as destroying the
    // writing, and `.systemview` is ignored anyway.
  };

  // Stale-tab guard: `base` = the content this pane loaded. A conflict answer means someone else
  // saved meanwhile — surface it and let a deliberate second Save overwrite (their version is in
  // the snapshot ring either way).
  const conflictRef = useRef(false);
  // A save is in flight — the freshness poll below stands off while it is, so it can't read the
  // pre-save bytes back over what you just wrote.
  const savingRef = useRef(0);
  const save = useCallback(
    async (next) => {
      if (!doc) return;
      const base = doc.content;
      savingRef.current = Date.now();
      setDoc((d) => (d ? { ...d, content: next } : d));
      try {
        const res = await Plugin.writeFile(
          conflictRef.current
            ? { path: doc.path, content: next }
            : { path: doc.path, content: next, base },
        );
        if (res && res.conflict) {
          conflictRef.current = true;
          raiseError(
            "Save held — this report changed elsewhere",
            "Another tab or an agent saved it after you loaded it, so your save was held instead of wiping theirs. Their version is on disk (and yours can go in over it: Save again to overwrite — every version stays in ⏱ history).",
          );
          return;
        }
        conflictRef.current = false;
      } catch (e) {
        raiseError("Couldn't save the report", e && (e.message || String(e)));
      }
    },
    [Plugin, doc]
  );

  // DOC UNDO — the report's saved versions (the snapshot ring writeFile feeds). Click restores;
  // the current version is snapshotted first, so a restore is always reversible.
  const [hist, setHist] = useState(null);
  const toggleHistory = async () => {
    if (hist) return setHist(null);
    setHist({ loading: true, snaps: [] });
    try {
      const h = await Plugin.fileHistory({ path: doc.path });
      setHist({ loading: false, snaps: h.snaps || [] });
    } catch (e) {
      setHist(null);
      raiseError("No history here", "This service's plugin predates doc history — update systemview-plugin to get the snapshot ring.");
    }
  };
  const restoreSnap = async (ts) => {
    try {
      const snap = await Plugin.readSnapshot({ path: doc.path, ts });
      await Plugin.writeFile({ path: doc.path, content: snap.content });
      setDoc((d) => (d ? { ...d, content: snap.content } : d));
      setHist(null);
      conflictRef.current = false;
    } catch (e) {
      raiseError("Couldn't restore that version", e && (e.message || String(e)));
    }
  };
  const ago = (ts) => {
    const s = Math.max(1, Math.round((Date.now() - ts) / 1000));
    if (s < 60) return `${s}s ago`;
    if (s < 3600) return `${Math.round(s / 60)}m ago`;
    if (s < 86400) return `${Math.round(s / 3600)}h ago`;
    return `${Math.round(s / 86400)}d ago`;
  };

  if (!host)
    return <div className="reports-tab__empty">No connected service in this project can read files.</div>;

  // ONE LINE of chrome, always — the picker is a dropdown in it, never a page of its own.
  const bar = (
    <div className={`reports-tab__bar ${!editorDark ? "reports-tab__bar--light" : ""}`}>
      <span className="reports-tab__kind">report</span>
      <button
        type="button"
        className="reports-tab__current"
        title={mine.length ? "Switch report" : "No reports on this namespace yet"}
        onClick={() => setPicking((p) => !p)}
      >
        {doc ? doc.name : mine.length ? `${mine.length} report${mine.length === 1 ? "" : "s"}` : "none yet"}
        <span className="reports-tab__caret">▾</span>
      </button>
      <span className="reports-tab__ns" title="Reports are scoped to this namespace">
        {nsLabel}
      </span>
      <span className="reports-tab__bar-actions">
        <EditorThemeToggle scope="docs" />
        {doc && !editing ? (
          <>
            <button
              type="button"
              className={`reports-tab__x ${hist ? "reports-tab__x--on" : ""}`}
              title="Saved versions of this report — click one to restore it"
              onClick={toggleHistory}
            >
              ⏱
            </button>
            <button
              type="button"
              className="reports-tab__x"
              title="Edit this report"
              onClick={() => {
                setDraft(doc.content);
                setEditing(true);
              }}
            >
              Edit
            </button>
          </>
        ) : null}
        {doc && editing ? (
          <>
            <button
              type="button"
              className="reports-tab__x reports-tab__x--save"
              title="Save"
              onClick={async () => {
                await save(draft);
                setEditing(false);
              }}
            >
              Save
            </button>
            <button type="button" className="reports-tab__x" title="Discard changes" onClick={() => setEditing(false)}>
              Cancel
            </button>
          </>
        ) : null}
        {doc && !editing ? (
          <button type="button" className="reports-tab__x" title="Close — back to the namespace" onClick={close}>
            ✕
          </button>
        ) : null}
      </span>
      {picking ? (
        <div className="reports-tab__menu" onClick={(e) => e.stopPropagation()}>
          {mine.length ? (
            mine.map((r) => (
              <div key={r.name} className="reports-tab__menu-row">
                <button type="button" className="reports-tab__menu-item" onClick={() => open(r)}>
                  {r.name}
                </button>
                <button
                  type="button"
                  className="reports-tab__menu-del"
                  title="Remove from the list (the file stays)"
                  onClick={() => remove(r)}
                >
                  ×
                </button>
              </div>
            ))
          ) : (
            <div className="reports-tab__menu-note">Nothing on {nsLabel} yet.</div>
          )}
          <div className="reports-tab__new">
            <input
              ref={nameRef}
              className="reports-tab__new-input"
              placeholder="new report…"
              value={naming}
              onChange={(e) => setNaming(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") create(naming);
                if (e.key === "Escape") setPicking(false);
              }}
            />
            <button type="button" className="reports-tab__new-go" disabled={!naming.trim()} onClick={() => create(naming)}>
              +
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );

  return (
    <div className="reports-tab" onClick={() => picking && setPicking(false)}>
      {bar}
      {hist && doc ? (
        <div className="reports-tab__history">
          {hist.loading ? (
            <span className="reports-tab__history-note">loading…</span>
          ) : !hist.snaps.length ? (
            <span className="reports-tab__history-note">no saved versions yet — history starts with the next save</span>
          ) : (
            hist.snaps.map((s) => (
              <button
                key={s.ts}
                type="button"
                className="reports-tab__history-item"
                title={new Date(s.ts).toLocaleString()}
                onClick={() => restoreSnap(s.ts)}
              >
                {ago(s.ts)}
              </button>
            ))
          )}
        </div>
      ) : null}
      <div className="reports-tab__body">
        {doc && doc.failed && !editing ? (
          // Say what went wrong and name the path. A blank page here sent him hunting for a report
          // that was never there — the command had simply asked for a path this project can't read.
          <div className="reports-tab__failed">
            <b>Couldn't read this report.</b>
            <div className="reports-tab__failed-path">{doc.path}</div>
            <div className="reports-tab__failed-why">
              {nsLabel ? `${nsLabel} ` : ""}has no such file — check the path, or the project it belongs to.
            </div>
          </div>
        ) : doc && editing ? (
          <div className={`md-view md-view--${editorDark ? "dark" : "light"}`}>
            <div className="edit-box edit-box--edit">
              <DescriptionBox text={draft} setValue={setDraft} dark={editorDark} />
            </div>
          </div>
        ) : doc ? (
          <div className={`md-view md-view--${editorDark ? "dark" : "light"}`}>
            <Markdown
              dark={editorDark}
              scope={{ projectCode, serviceId: host.serviceId, moduleName, methodName }}
              commentKey={`report-${slug(nsKey)}-${slug(doc.name)}`}
              onSourceChange={save}
            >
              {doc.content}
            </Markdown>
          </div>
        ) : (
          <div className="reports-tab__empty">
            {mine.length
              ? `${mine.length} report${mine.length === 1 ? "" : "s"} on ${nsLabel} — pick one above.`
              : `No reports on ${nsLabel} yet. Name one above and it lives in .systemview/, out of the repo.`}
          </div>
        )}
      </div>
    </div>
  );
};

export default ReportsTab;
