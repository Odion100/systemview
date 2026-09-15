import React, { useEffect, useState } from "react";
import { docsList, docsPlan, docsIndex, docsDrop, docsSearch, saveCorpus, pickPath, docsPreview, hasDocs } from "../../utils/hostAgents";
import "./styles.scss";

// RFC-058 §8 — THE CORPORA SURFACE. His index, on his screen.
//
// The whole reason this panel exists is in one line of the RFC: *chunking is normally invisible,
// which is exactly why RAG rots.* A pipeline whose cuts nobody has ever looked at cannot be
// corrected, and a wrong chunk answers with the same confidence as a right one. So the dry run is
// not a debugging aid here — it is the main view, and indexing is the thing you do after reading it.
//
// Every button calls the SAME function in docs.cjs that the `docsPlan` / `docsIndex` MCP tools call.
// One implementation, two doors — the cuts he judges are the cuts an agent gets.

const fmtWhen = (iso) => {
  if (!iso) return "never indexed";
  const d = new Date(iso);
  return isNaN(d.getTime()) ? String(iso) : d.toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
};

const BLANK = { name: "", kind: "permanent", root: "", glob: "**/*.md", exclude: "" };

// The name is a suggestion, not a demand — a folder called `SystemLynx` becomes `systemlynx`.
const nameFrom = (p) => String(p || "").split("/").filter(Boolean).pop().replace(/\.(md|markdown)$/i, "").toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/^-+|-+$/g, "");

export default function CorporaPanel() {
  const [rows, setRows] = useState(null);
  const [err, setErr] = useState("");
  const [open, setOpen] = useState(null);      // corpus name whose plan is open
  const [plan, setPlan] = useState(null);      // the dry run for `open`
  const [maxChars, setMaxChars] = useState(2200);
  const [busy, setBusy] = useState("");
  const [say, setSay] = useState("");
  const [editing, setEditing] = useState(null); // BLANK-shaped draft, or null
  const [showChunk, setShowChunk] = useState({}); // "source#n" -> true
  // ASKING IS THE POINT. The corpora list says what is embedded; this says what it ANSWERS — the
  // same call `docs()` makes for an agent, so what he reads here is what they get.
  const [q, setQ] = useState("");
  const [hits, setHits] = useState(null); // null = not asked; [] = asked, nothing matched
  const [asking, setAsking] = useState(false);
  // PICK, THEN TICK. The form used to be corpora.json with labels on it — a root to type and a glob
  // to get right, where a typo matches nothing and the corpus is silently empty. Now the files it
  // found are the form: uncheck what you do not want, and the unchecked ones become the excludes.
  // ONE PIECE OF STATE, not two. These were `found` and `picked` as separate useStates, set one
  // after the other inside an async function — and React 17 does NOT batch updates after an
  // `await`, so it rendered in between with the list present and the selection still null, and
  // `picked.size` took the whole window to a white screen. Two values that must always agree are
  // one value.
  const [sel, setSel] = useState(null); // { all: [rel], on: Set<rel> } — or null before a pick
  const [scanning, setScanning] = useState(false);

  const refresh = async () => {
    const r = await docsList();
    if (!r) return setErr("The corpora live in the harness — open this inside the SystemView browser.");
    if (r.error) return setErr(r.error);
    setErr("");
    setRows(r.corpora || []);
  };

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const ask = async (corpus) => {
    const text = q.trim();
    if (!text) { setHits(null); return; }
    setAsking(true);
    const r = await docsSearch({ q: text, limit: 8, ...(corpus ? { corpus } : {}) });
    setAsking(false);
    if (!r) return setSay("the document index is a harness capability — open this in the SystemView browser");
    if (r.error) return setSay(r.error);
    setSay("");
    setHits(r.results || []);
  };

  const scan = async (draft) => {
    if (!draft.root) return;
    setScanning(true);
    const r = await docsPreview({ root: draft.root, glob: draft.glob || "**/*.md" });
    setScanning(false);
    if (r.error) return setSay(r.error);
    const files = r.files || [];
    setSel({ all: files, on: new Set(files) });
  };

  // One file or a whole folder — the same flow, because "add this document" is the common case and
  // it should not require understanding a pattern language.
  const pick = async (kind) => {
    const r = await pickPath(kind);
    if (r.unavailable) return setSay("the file picker is a harness capability — open this in the SystemView browser");
    if (r.canceled || !r.path) return;
    if (kind === "file") {
      const parts = r.path.split("/");
      const file = parts.pop();
      const root = parts.join("/");
      const draft = { ...(editing || BLANK), root, glob: file, name: (editing && editing.name) || nameFrom(file) };
      setEditing(draft);
      setSel({ all: [file], on: new Set([file]) });
      return;
    }
    const draft = { ...(editing || BLANK), root: r.path, glob: "**/*.md", name: (editing && editing.name) || nameFrom(r.path) };
    setEditing(draft);
    scan(draft);
  };

  const readCuts = async (name, mc) => {
    setBusy(`plan:${name}`);
    const r = await docsPlan(name, { maxChars: mc || maxChars });
    setBusy("");
    if (!r || r.error) return setSay((r && r.error) || "could not read the cuts");
    setOpen(name);
    setPlan(r.plan);
    setSay("");
  };

  const runIndex = async (name) => {
    setBusy(`index:${name}`);
    const r = await docsIndex(name);
    setBusy("");
    if (r.error) return setSay(r.error);
    const x = r.result || {};
    setSay(`${x.corpus}: ${x.indexed} embedded · ${x.skipped} unchanged${x.changedFiles ? ` · ${x.changedFiles} files changed` : ""}${x.removed ? ` · ${x.removed} removed` : ""}`);
    refresh();
  };

  const runDrop = async (name, kind) => {
    // A PERMANENT CORPUS IS HIS. The tool refuses this for agents; here it is allowed but asked for
    // out loud, because the files are untouched either way — this deletes what was embedded.
    if (kind === "permanent" && !window.confirm(`Drop the embedded chunks for "${name}"?\n\nThe files are not touched — this removes what was indexed, and you can re-index at any time.`)) return;
    setBusy(`drop:${name}`);
    const r = await docsDrop(name);
    setBusy("");
    if (r.error) return setSay(r.error);
    setSay(`dropped ${r.corpus} (${r.dropped} chunks)`);
    if (open === name) { setOpen(null); setPlan(null); }
    refresh();
  };

  const save = async () => {
    const d = editing;
    if (!d.name.trim() || !d.root.trim()) return setSay("a corpus needs a name and a root");
    setBusy("save");
    // THE UNTICKED FILES ARE THE EXCLUDES. An exact path is a valid pattern that matches only
    // itself, so nothing here needs him to write one — the list he just read IS the config.
    const dropped = sel ? sel.all.filter((f) => !sel.on.has(f)) : [];
    const typed = String(d.exclude || "").split(/[\n,]+/).map((x) => x.trim()).filter(Boolean);
    const r = await saveCorpus({
      name: d.name.trim(),
      kind: d.kind,
      root: d.root.trim(),
      glob: d.glob.trim() || "**/*.md",
      exclude: [...new Set([...dropped, ...typed])],
    });
    setBusy("");
    if (r.error) return setSay(r.error);
    setEditing(null);
    setSel(null);
    setSay(`saved ${d.name} — ${sel ? sel.on.size : "all"} file(s). Read the cuts, then index.`);
    refresh();
  };

  const remove = async (name) => {
    if (!window.confirm(`Remove the corpus "${name}" from the config?\n\nThis does not delete files or embedded chunks — drop those separately.`)) return;
    const r = await saveCorpus({ name, remove: true });
    if (r.error) return setSay(r.error);
    setEditing(null);
    refresh();
  };

  if (!hasDocs() && !rows)
    return (
      <div className="corpora corpora--empty">
        <h3>Document corpora</h3>
        <p>{err || "The corpora are a harness capability — open this inside the SystemView browser to manage them."}</p>
      </div>
    );

  return (
    <div className="corpora">
      <div className="corpora__head">
        <h3>Document corpora</h3>
        <div className="corpora__headnote">
          What is embedded, how it was cut, and what has drifted since. <b>Read the cuts before you index</b> —
          chunking is invisible once it is done, and a wrong chunk answers as confidently as a right one.
        </div>
        <button className="corpora__add" onClick={() => setEditing({ ...BLANK })}>+ corpus</button>
      </div>

      {/* ONE QUESTION FIELD, the same shape the notes surface uses — because from his side it is the
          same question ("what can be pulled here?") even though the door underneath is the other one. */}
      <div className="corpora__query">
        <input
          className="corpora__q"
          value={q}
          placeholder="Ask the documentation — the same answer an agent gets…"
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && ask(open || undefined)}
        />
        <button onClick={() => ask(open || undefined)} disabled={asking}>{asking ? "asking…" : "Search"}</button>
        {hits !== null ? <button className="corpora__ghost" onClick={() => { setHits(null); setQ(""); }}>Clear</button> : null}
      </div>
      {open && hits !== null ? <div className="corpora__scoped">searching <b>{open}</b> only — clear the open corpus to search all of them</div> : null}

      {hits !== null ? (
        <div className="corpora__hits">
          {!hits.length ? (
            <div className="corpora__none">
              Nothing matched that question. Empty means nothing matched <i>that phrasing</i> — not that it is
              undocumented. Try the angle you would use with a person.
            </div>
          ) : null}
          {hits.map((h, i) => (
            <div className="corpora__hit" key={`${h.corpus}:${h.source}:${h.line}:${i}`}>
              <div className="corpora__hitwhere">
                <span className="corpora__hitscore">{typeof h.score === "number" ? h.score.toFixed(2) : ""}</span>
                <b>{h.source}</b>
                {h.headingPath && h.headingPath.length ? <span className="corpora__path">{h.headingPath.join("  ›  ")}</span> : null}
                {h.part ? <span className="corpora__part">{h.part}</span> : null}
                <span className="corpora__hitcorpus">{h.corpus}</span>
                {/* STALE IS SAID OUT LOUD. A chunk whose file has moved on still answers, and
                    nothing about the answer looks old unless something says so. */}
                {h.stale ? <span className="corpora__stale">the file has changed since this was indexed</span> : null}
              </div>
              <pre className="corpora__text">{h.text}</pre>
            </div>
          ))}
        </div>
      ) : null}

      {err ? <div className="corpora__err">{err}</div> : null}
      {say ? <div className="corpora__say">{say}</div> : null}

      {editing ? (
        <div className="corpora__form">
          {/* STEP ONE IS A BUTTON, not a text field. Adding one document is the common case and it
              must not require understanding a pattern language. */}
          <div className="corpora__pick">
            <button onClick={() => pick("file")}>Choose a document…</button>
            <button onClick={() => pick("dir")}>Choose a folder…</button>
            {editing.root ? (
              <span className="corpora__picked">
                {editing.root}
                {editing.glob && editing.glob !== "**/*.md" ? <b>/{editing.glob}</b> : <i> · all markdown, any depth</i>}
              </span>
            ) : (
              <span className="corpora__hint">pick one file, or a folder and tick what you want from it</span>
            )}
          </div>

          {scanning ? <div className="corpora__hint">looking…</div> : null}

          {/* WHAT IT FOUND IS THE FORM. Untick and it becomes an exclude — no glob to get right, and
              nothing silently matching nothing. */}
          {sel ? (
            sel.all.length ? (
              <div className="corpora__files">
                <div className="corpora__fileshead">
                  {sel.on.size} of {sel.all.length} selected
                  <button className="corpora__ghost" onClick={() => setSel({ ...sel, on: new Set(sel.all) })}>all</button>
                  <button className="corpora__ghost" onClick={() => setSel({ ...sel, on: new Set() })}>none</button>
                </div>
                <div className="corpora__filelist">
                  {sel.all.map((f) => (
                    <label key={f} className={sel.on.has(f) ? "" : "is-off"}>
                      <input
                        type="checkbox"
                        checked={sel.on.has(f)}
                        onChange={() => {
                          const next = new Set(sel.on);
                          if (next.has(f)) next.delete(f);
                          else next.add(f);
                          setSel({ ...sel, on: next });
                        }}
                      />
                      {f}
                    </label>
                  ))}
                </div>
              </div>
            ) : (
              <div className="corpora__nochunks">no markdown found in there</div>
            )
          ) : null}

          <div className="corpora__formrow">
            <label>call it<input value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} placeholder="systemview-docs" /></label>
            <label>kind
              <select value={editing.kind} onChange={(e) => setEditing({ ...editing, kind: e.target.value })}>
                <option value="permanent">permanent — yours, agents read it</option>
                <option value="working">working — an agent's scratch, droppable</option>
              </select>
            </label>
          </div>

          <div className="corpora__formacts">
            <button onClick={save} disabled={busy === "save" || !editing.root}>{busy === "save" ? "saving…" : "save"}</button>
            <button className="corpora__ghost" onClick={() => { setEditing(null); setSel(null); }}>cancel</button>
            {rows && rows.some((r) => r.name === editing.name) ? (
              <button className="corpora__danger" onClick={() => remove(editing.name)}>remove from config</button>
            ) : null}
          </div>
        </div>
      ) : null}

      <table className="corpora__table">
        <thead>
          <tr><th>corpus</th><th>kind</th><th>files</th><th>chunks</th><th>stale</th><th>last indexed</th><th /></tr>
        </thead>
        <tbody>
          {(rows || []).map((c) => (
            <tr key={c.name} className={open === c.name ? "is-open" : ""}>
              <td>
                <button className="corpora__name" onClick={() => (open === c.name ? (setOpen(null), setPlan(null)) : readCuts(c.name))}>{c.name}</button>
                <div className="corpora__root">{c.root}<span className="corpora__glob">{c.glob}</span></div>
              </td>
              <td><span className={`corpora__kind corpora__kind--${c.kind}`}>{c.kind}</span></td>
              {/* MATCHED vs INDEXED. Showing only what is embedded made a corpus he had just
                  defined read as 0 files — which says "nothing there" and means "not indexed yet". */}
              <td>
                {typeof c.matched === "number" && c.matched !== c.files ? (
                  <span className="corpora__pending">{c.matched} matched<i>{c.files} indexed</i></span>
                ) : (
                  c.files
                )}
              </td>
              <td>{c.chunks || <span className="corpora__ok">not indexed</span>}</td>
              {/* STALENESS IS THE NUMBER THAT MATTERS. A corpus whose files have moved on is still
                  answering, and nothing about the answer looks old. */}
              <td>{c.stale ? <span className="corpora__stale">{c.stale}</span> : <span className="corpora__ok">—</span>}</td>
              <td className="corpora__when">{fmtWhen(c.lastIndexed)}</td>
              {/* The BUTTONS flex, not the cell. `display:flex` on a <td> takes it out of the
                  table layout entirely — it stops sharing the row's height and border, which is
                  exactly what it looked like: two columns side by side that never agreed. */}
              <td className="corpora__actcell">
                <div className="corpora__acts">
                <button onClick={() => readCuts(c.name)} disabled={busy === `plan:${c.name}`}>{busy === `plan:${c.name}` ? "…" : "read the cuts"}</button>
                <button onClick={() => runIndex(c.name)} disabled={busy === `index:${c.name}`}>{busy === `index:${c.name}` ? "indexing…" : c.chunks ? "re-index" : "index"}</button>
                <button className="corpora__ghost" onClick={() => setEditing({ name: c.name, kind: c.kind, root: c.root, glob: c.glob, exclude: "" })}>edit</button>
                {c.chunks ? <button className="corpora__danger" onClick={() => runDrop(c.name, c.kind)} disabled={busy === `drop:${c.name}`}>drop</button> : null}
                </div>
              </td>
            </tr>
          ))}
          {rows && !rows.length ? (
            <tr><td colSpan={7} className="corpora__none">No corpora yet. A corpus is a root, a glob and what to leave out — and excludes are not garnish: the first real dry run pulled 261 chunks of RFCs and scratch notes into a "reference" corpus.</td></tr>
          ) : null}
        </tbody>
      </table>

      {plan && open ? (
        <div className="corpora__plan">
          <div className="corpora__planhead">
            <b>{plan.corpus}</b> — the cuts, nothing embedded
            <span className="corpora__totals">
              {plan.totals.files} files · {plan.totals.chunks} chunks · biggest {plan.totals.biggest}
              {plan.totals.split ? ` · ${plan.totals.split} split` : ""}
              {plan.totals.overMax ? ` · ${plan.totals.overMax} over max` : ""}
              {plan.totals.empty ? ` · ${plan.totals.empty} files produced nothing` : ""}
            </span>
            <label className="corpora__max">
              maxChars
              <input
                type="number"
                value={maxChars}
                min={400}
                step={100}
                onChange={(e) => setMaxChars(Number(e.target.value) || 2200)}
                onBlur={() => readCuts(open, maxChars)}
              />
              <span className="corpora__hint">change it and re-read — this is how you tune the cuts</span>
            </label>
          </div>
          {plan.files.map((f) => (
            <div key={f.source} className="corpora__file">
              <div className="corpora__filehead">
                {f.source}
                <span className="corpora__filemeta">{f.chunks.length} chunks · {f.bytes}b · {f.hash}</span>
              </div>
              {!f.chunks.length ? (
                <div className="corpora__nochunks">nothing survived the cut — every heading here is shorter than the minimum body</div>
              ) : null}
              {f.chunks.map((c, n) => {
                const key = `${f.source}#${n}`;
                return (
                  <div key={key} className="corpora__chunk">
                    <button className="corpora__chunkhead" onClick={() => setShowChunk({ ...showChunk, [key]: !showChunk[key] })}>
                      <span className="corpora__chars">{c.chars}</span>
                      {c.part ? <span className="corpora__part">{c.part}</span> : null}
                      <span className="corpora__path">{c.headingPath.length ? c.headingPath.join("  ›  ") : "(preamble)"}</span>
                    </button>
                    {showChunk[key] ? <pre className="corpora__text">{c.text}</pre> : null}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
