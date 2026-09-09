import { hostFiles } from "./hostFiles";

// ONE DELETE, USED EVERYWHERE A REPORT CAN BE DELETED (the nav's fold, the TV's list). His rule
// that forced the unification: *"if they're not unified, you can't even delete the TV reports."*
// A report is a FILE plus an INDEX ENTRY, and a delete is only a delete if it takes both — index
// only leaves a ghost file; file only leaves a list row that opens nothing.
export async function deleteReport(projectCode, path) {
  const files = hostFiles(projectCode);
  try {
    const res = await files.readFile({ path: ".systemview/reports.index.json" });
    const idx = JSON.parse(res.content || "{}");
    Object.keys(idx).forEach((k) => {
      idx[k] = (idx[k] || []).filter((x) => !(x && x.path === path));
    });
    await files.writeFile({ path: ".systemview/reports.index.json", content: JSON.stringify(idx, null, 1) });
  } catch {}
  try {
    if (files.deleteFile) await files.deleteFile({ path });
  } catch {}
}

// WHAT EXISTS — the index read once, answered as sets, so a list can ask "is this report real"
// by path or by name. Files are the truth; anything not answerable here is a memory.
export async function reportIndexSets(projectCode) {
  try {
    const res = await hostFiles(projectCode).readFile({ path: ".systemview/reports.index.json" });
    const idx = JSON.parse(res.content || "{}");
    const paths = new Set();
    const names = new Set();
    Object.values(idx).forEach((list) =>
      (Array.isArray(list) ? list : []).forEach((r) => {
        if (r && r.path) paths.add(r.path);
        if (r && r.name) names.add(r.name);
      }),
    );
    return { paths, names };
  } catch {
    return null; // unreadable index ≠ "everything is deleted" — the caller must not prune on null
  }
}

// THE ONE LIST — index + a scan of report.*.md files − the hidden set. His rule, said twice before
// it landed everywhere: "you see the same list on the side of the nav? It should be the same list
// on TV. It's the same thing — it's just where I get to see it." The nav fold and the TV picker
// both call THIS; there is no second opinion to drift.
export async function listReports(projectCode) {
  const files = hostFiles(projectCode);
  let idx = {};
  try {
    const res = await files.readFile({ path: ".systemview/reports.index.json" });
    idx = JSON.parse(res.content || "{}");
  } catch {}
  const hidden = new Set(idx.__hidden || []);
  const listed = Object.entries(idx)
    .filter(([k]) => k !== "__hidden")
    .flatMap(([, v]) => (Array.isArray(v) ? v : []))
    .filter((r) => r && r.path);
  const known = new Set(listed.map((r) => r.path));
  let scanned = [];
  try {
    const res = await files.listFiles({ glob: ".systemview/report.*.md" });
    scanned = ((res && (res.files || res)) || [])
      .map((f) => ({ path: (f && f.path) || f, ts: (f && (f.mtime || f.ts)) || 0 }))
      .filter((f) => f.path && /\.systemview\/report\..+\.md$/i.test(f.path))
      .filter((f) => !known.has(f.path) && !hidden.has(f.path))
      .map((f) => {
        const m = String(f.path).match(/report\.[^.]+\.(.+)\.md$/);
        return { ...f, name: m ? m[1].replace(/-/g, " ") : f.path.split("/").pop() };
      });
  } catch {}
  return [...listed, ...scanned].filter((r) => !hidden.has(r.path)).sort((a, b) => (b.ts || 0) - (a.ts || 0));
}
