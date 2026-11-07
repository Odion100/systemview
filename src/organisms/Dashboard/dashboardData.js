import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import ServiceContext from "../../ServiceContext";
import { hostFiles } from "../../utils/hostFiles";
import { owedFrom, owedHead } from "../AgentChat/owed";

// ONE READ, ONE DERIVATION, FOR EVERY TILE ON THE SURFACE.
//
// Three dashboards were built in parallel and each one does its own hub read, its own fingerprint,
// its own per-document file read and its own derivation. That was correct while they were three
// separate pages — it is what let three agents work without colliding. It stops being correct the
// moment their sections stand on ONE page: three tiles each reading the registry on their own
// 30-second timer will drift apart, and a surface whose head says "4 approvals waiting" over a
// list showing three is worse than no surface at all. The whole reason this page exists is that
// the counts he had could not be trusted.
//
// So the read moves up here and the tiles take it from a context. A tile may still bring its own
// data — the registry is OPEN, and a terminal or the board wants nothing from this — but a tile
// that shows registry state reads it HERE or it is a second opinion nobody asked for.

/** The fingerprint — what makes the poll cheap. It changes exactly when a re-read would say
 *  something new, so forty documents are not re-read every thirty seconds for an unchanged answer.
 *  Copied from the three dashboards, which independently arrived at the same six fields. */
export const printOf = (rows) =>
  (rows || [])
    .map(
      (r) =>
        `${r.id}@${r.project}@${r.path}@${(r.state || {}).parsed || 0}@${r.openedAt || 0}@${r.stale ? 1 : 0}@${
          r.missing ? 1 : 0
        }`,
    )
    .sort()
    .join("|");

/**
 * The registry, read once: every row across every project, each with its file's text.
 *
 * `read` stays false until an answer has actually landed, and that is the load-bearing field —
 * a zero nobody measured must never draw as a zero. "You are owed nothing" and "nothing came
 * back" are different sentences and only one of them is ever safe to show.
 */
export function useRegistryRead(SystemViewService, { every = 30000 } = {}) {
  const [state, setState] = useState({ read: false, docs: [], roots: {}, error: "" });
  const print = useRef("");
  const docs = useRef([]);
  useEffect(() => {
    let dead = false;
    const pull = async () => {
      const agent = SystemViewService && SystemViewService.Agent;
      const sv = SystemViewService && SystemViewService.SystemView;
      // An older hub simply has no such door. The surface says so rather than guessing.
      if (!agent || !agent.documentsRegistry) return;
      try {
        const [raw, roots] = await Promise.all([
          // NO FILTERS — every kind, every project, in one read. The registry IS the list of what
          // exists, and it never walks a folder: a folder scan picks up the playground documents
          // that hold a live unverdicted approval for the reader to press.
          agent.documentsRegistry({}),
          // The WIDEST list of projects there is — `projectRoots()` includes the folder-only ones,
          // and the denominator is the point: one project out of twelve is not a picture.
          sv && sv.projectRoots ? Promise.resolve(sv.projectRoots()).catch(() => ({})) : Promise.resolve({}),
        ]);
        const rows = (Array.isArray(raw) ? raw : []).filter((r) => r && r.id && r.kind && r.path);
        const p = printOf(rows);
        if (p !== print.current) {
          print.current = p;
          docs.current = await Promise.all(
            rows.map(async (row) => {
              // A ROW WHOSE FILE IS GONE AND A RETIRED ONE OWE NOTHING, so neither is read. Both
              // are still handed on, and counted out loud. `text: undefined` is what "could not be
              // read" means — carried, never swallowed.
              if (row.missing || (row.state || {}).retired) return { row };
              try {
                const f = await hostFiles(row.project).readFile({ path: row.path });
                return { row, text: f && f.ok !== false ? f.content || "" : undefined };
              } catch {
                return { row };
              }
            }),
          );
        }
        if (!dead) {
          setState({ read: true, docs: docs.current, roots: roots && typeof roots === "object" ? roots : {}, error: "" });
        }
      } catch (e) {
        // AN EMPTY ANSWER THAT SAYS IT FAILED, never a stale one held over. The surface must not
        // read as "nothing to do" when it means "nothing came back".
        if (!dead) setState({ read: false, docs: [], roots: {}, error: String((e && e.message) || e) });
      }
    };
    pull();
    const t = setInterval(pull, every);
    return () => {
      dead = true;
      clearInterval(t);
    };
  }, [SystemViewService, every]);
  return state;
}

const DashboardDataContext = createContext(null);

/**
 * THE DOOR IS TRAVEL NOW. His ruling, 2026-11-06: *"Nothing should actually be clicked to travel,
 * except an explicit symbol, like an arrow, to open the next page. And it actually should travel —
 * not open it up on the side."* So the side-opening `openAddress` door is gone from this surface:
 * the one thing that opens a document is the arrow, and the arrow takes the WINDOW there — the
 * Code page's own file door, the same URL shape `SystemView.openFile` writes (`?tab=docs&file=…`),
 * reached by pushState + popstate because the router listens to popstate and a reload is never on
 * the table here (his standing rule: never suggest a page reload to him again).
 */
export const openDoc = ({ project, path, line } = {}) => {
  const q = new URLSearchParams();
  q.set("tab", "docs");
  q.set("file", path || "");
  q.set("fproj", project || "");
  q.set("flang", "markdown");
  if (Number(line) > 1) q.set("flines", `${line}-${line}`);
  window.history.pushState({}, "", `/specs/${project || ""}?${q.toString()}`);
  window.dispatchEvent(new PopStateEvent("popstate"));
};

/**
 * Wrap the surface in this once. Every tile that shows registry state reads it with
 * `useDashboardData()`; tiles that need nothing from the registry simply do not call it.
 *
 * `beat` is a counter the provider ticks every minute so clock wording stays honest between
 * polls — a tile that renders "retires in 4 hours" must not still say it tomorrow. Tiles that do
 * not read clocks can ignore it; it costs one render a minute for the whole surface, which is
 * cheaper than each tile running its own interval.
 */
export function DashboardDataProvider({ children, every }) {
  const { SystemViewService } = useContext(ServiceContext);
  const { read, docs: allDocs, roots, error } = useRegistryRead(SystemViewService, every ? { every } : undefined);
  const [beat, setBeat] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setBeat((b) => b + 1), 60000);
    return () => clearInterval(t);
  }, []);

  // THE FILTER BELONGS TO THE STACK NOW, NOT TO THIS PROVIDER. His ruling, 2026-11-06: *"They
  // should be filtering everything below them"* — a selection narrows the tiles BELOW the tile
  // that holds it, never the whole page, so placement is scope and only the stack knows position.
  // The narrowing itself (what a held segment, project, arc or report MEANS) lives in
  // `filters.js`, where it is testable without a mount; `TileStack` merges what stands above each
  // tile and hands the narrowed data down. This provider hands over the whole world, once.
  //
  // WHAT A PRESS ON A SEGMENT FILTERS BY IS STILL OBLIGATIONS, not documents — his correction
  // (*"of course I want to filter by obligations"*) moved into `filters.js` with the rest.
  const unfiltered = useMemo(() => {
    const o = owedFrom({ docs: allDocs, now: Date.now() });
    return { ...o, head: owedHead(o) };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allDocs, beat]);

  const value = useMemo(() => {
    return {
      read,
      error,
      roots,
      beat,
      open: openDoc,
      // WHAT A TILE READS when nothing above it holds a selection — the stack substitutes a
      // narrowed pair when something does. `head` is stripped off `owed` exactly as before: only
      // a head draws the head.
      docs: allDocs,
      owed: { ...unfiltered, head: undefined },
      // WHAT A HEAD READS, ALWAYS UNNARROWED — and what `filters.js` narrows FROM. A head counting
      // the filtered set would restate its own press back at itself — press "4 approvals waiting"
      // and it becomes "4 of 4", with no way left to see there were ever more.
      allDocs,
      allOwed: unfiltered,
      filtering: false,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [read, error, allDocs, roots, beat, unfiltered]);

  return <DashboardDataContext.Provider value={value}>{children}</DashboardDataContext.Provider>;
}

/**
 * What a registry tile is handed. Returns `null` outside a provider rather than throwing, so a
 * tile can be rendered on its own in a test or a story and say "no data" instead of exploding.
 */
export function useDashboardData() {
  return useContext(DashboardDataContext);
}

export default DashboardDataProvider;
