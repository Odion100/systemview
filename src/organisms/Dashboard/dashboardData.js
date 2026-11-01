import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import ServiceContext from "../../ServiceContext";
import { hostFiles } from "../../utils/hostFiles";
import { openAddress } from "../../atoms/Markdown/openRef";
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
 * THE ONE OPENER (openRef.js): every surface that opens a file address calls this, and nothing
 * else dispatches `sv:openFileInNav`. An arc, an RFC, a gap and a report are all markdown files,
 * so they ride the door files already ride. A tile never navigates on its own — a second rule
 * about where a document lands is exactly what openRef exists to prevent.
 */
export const openDoc = ({ project, path, line } = {}) =>
  openAddress({ projectCode: project || "", path, language: "markdown", lines: line > 1 ? [line, line] : undefined });

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

  // THE FILTER BELONGS TO THE SURFACE, NOT TO A TILE. His ruling: *"especially because they're
  // going to be components, those headers, if they have filters, need to filter the entire, all
  // of the sections."* A head that narrowed only the section under it was reading its own
  // placement as scope — which stops meaning anything the moment he can drag it to another page.
  //
  // AND WHAT IT FILTERS BY IS OBLIGATIONS, not documents. His correction: *"of course I want to
  // filter by obligations."* The head counts obligations and the press has to mean exactly the
  // ones it counted — press "4 approvals waiting" and you see four approvals, not every
  // obligation carried by the four documents that happen to hold them. Deriving the narrowed set
  // by re-running `owedFrom` over the surviving documents gets that wrong in a way that looks
  // right: a document with one approval and three blocked objectives comes back with all four.
  //
  // So there are two narrowings off ONE press, and tiles take whichever they show:
  //   owed  the obligations the segment counted, exactly — for the lists
  //   docs  the documents those obligations sit on — for the rails, the shelves, the tracks,
  //         which draw documents and have no idea what an obligation is
  const [only, setOnly] = useState(null);

  const unfiltered = useMemo(() => {
    const o = owedFrom({ docs: allDocs, now: Date.now() });
    return { ...o, head: owedHead(o) };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allDocs, beat]);

  const value = useMemo(() => {
    // `owedHead` hands every segment the keys of the obligations it counted, so this is a lookup
    // and never a second predicate. A `why ===` test written here would agree with the head today
    // and drift the first time either side learns a new kind of obligation.
    const seg = only && (unfiltered.head.segs || []).find((x) => x.key === only);
    const wanted = seg ? new Set(seg.keys || []) : null;
    const keep = (list) => (list || []).filter((o) => wanted.has(o.key));
    const press = wanted ? keep(unfiltered.press) : unfiltered.press;
    const work = wanted ? keep(unfiltered.work) : unfiltered.work;
    const onDoc = wanted ? new Set([...press, ...work].map((o) => `${o.project || ""}\u0000${o.id}`)) : null;
    const docs = onDoc ? allDocs.filter((d) => onDoc.has(`${d.row.project || ""}\u0000${d.row.id}`)) : allDocs;
    return {
      read,
      error,
      roots,
      beat,
      open: openDoc,
      // WHAT AN ORDINARY TILE READS — both narrowed when a segment is held, and narrowed from the
      // same press, so a list and a rail standing side by side can never disagree about scope.
      docs,
      owed: { ...unfiltered, press, work, head: undefined },
      // WHAT A HEAD READS, ALWAYS UNNARROWED. A head counting the filtered set would restate its
      // own press back at itself — press "4 approvals waiting" and it becomes "4 of 4", with no
      // way left to see there were ever more. The counts are the thing you filter FROM.
      allDocs,
      allOwed: unfiltered,
      // The held segment and the press. A tile that offers no filter ignores both.
      only,
      segment: seg || null,
      setOnly: (key) => setOnly((o) => (o === key ? null : key)),
      filtering: !!wanted,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [read, error, allDocs, roots, beat, only, unfiltered]);

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
