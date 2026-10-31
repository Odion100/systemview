// ARCS AS BAND ROWS — RFC-072 §7 and slice 6.
//
// An arc belongs in the band for the same reason reports and documents do: it is work the project
// is carrying, and work the project is carrying belongs where the rest of it is rather than behind
// a file path only an agent knows. The band's standing rule applies unchanged — a kind with no
// rows gets no tab, so a project with no arcs sees nothing.
//
// THE ROW IS DERIVED FROM THE DOCUMENT, NEVER STORED. §3 of the RFC is the whole design: the arc
// document IS the state, and anything that kept its own copy of "how far along is ARC-004" would
// be a second answer that drifts the moment somebody ticks an objective by hand. So this reads the
// `::objective` blocks out of the file every time and counts them.
//
// PURE ON PURPOSE. It takes `{ path, text }` and returns rows — no fetching, no React — because
// the question "does this arc read as 3 of 7 with two blocked" is answerable in jest, and "can the
// window list a folder" is not.
import { arcProgress, isBlockedByNeeds } from "../../atoms/Markdown/objectives";

/** `RFCs/arcs/ARC-004-the-thing.md` → `ARC-004`. The number is the identity; the rest is cosmetic. */
export const arcIdFromPath = (path) => {
  const m = /(ARC-\d+)/i.exec(String(path || "").split("/").pop() || "");
  return m ? m[1].toUpperCase() : "";
};

// The title a human says out loud: the arc block's own, else the filename with its number and
// extension stripped back into words. A row keyed only by number is unreadable in a list of five.
export const titleFromPath = (path) => {
  const file = String(path || "").split("/").pop() || "";
  return file
    .replace(/\.md$/i, "")
    .replace(/^ARC-\d+[-_]?/i, "")
    .replace(/[-_]+/g, " ")
    .trim();
};

/**
 * One row per arc document.
 *
 * `blocked` counts objectives that are stopped, by EITHER route — `state=blocked` written on the
 * objective, or `needs` that are not met. That is the number that changes what he does next: an arc
 * at 2 of 7 with nothing blocked is moving; the same arc with four blocked is waiting on something,
 * and those are not the same situation even though the progress is identical.
 *
 * COUNTING ONLY THE DERIVED ROUTE MADE THE SURFACE SILENT ABOUT THE WRITTEN ONE. `blocked` is the
 * one state an author WRITES rather than derives, on the grounds that it is a statement about the
 * world — and the live system's only such objective has its `needs` already satisfied, so the band
 * drew nothing at all while the document said `state=blocked` with a reason attached. A declared
 * stop is the stronger signal of the two: somebody looked and said so.
 */
export function arcRows(docs = []) {
  return docs
    .filter((d) => d && d.path && typeof d.text === "string")
    .map((d) => {
      const { total, done, objectives, arc } = arcProgress(d.text);
      const ctx = { objectives, arc };
      const blocked = objectives.filter(
        (o) => o.state !== "done" && (o.state === "blocked" || isBlockedByNeeds(o, ctx)),
      ).length;
      return {
        key: d.path,
        path: d.path,
        id: (arc && arc.id) || arcIdFromPath(d.path),
        title: (arc && arc.title) || titleFromPath(d.path),
        owner: (arc && arc.owner) || "",
        total,
        done,
        blocked,
        // DONE IS EVERY OBJECTIVE DONE, and an arc with NO objectives is not done — it is empty.
        // Treating 0 of 0 as complete would quietly retire an arc somebody just created.
        complete: total > 0 && done === total,
      };
    })
    // Unfinished first, because the band is a place to act. Within that, the one closest to
    // finishing leads — it is the cheapest to close.
    .sort((a, b) => {
      if (a.complete !== b.complete) return a.complete ? 1 : -1;
      const ra = a.total ? a.done / a.total : 0;
      const rb = b.total ? b.done / b.total : 0;
      if (ra !== rb) return rb - ra;
      return String(a.id).localeCompare(String(b.id));
    });
}

/** "3 of 7 · 2 blocked" — what the row says without being opened. */
export const arcLine = (row) =>
  `${row.done} of ${row.total}${row.blocked ? ` · ${row.blocked} blocked` : ""}${row.complete ? " · done" : ""}`;

export default arcRows;
