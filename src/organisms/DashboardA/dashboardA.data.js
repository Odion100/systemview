// THE CROSS-PROJECT DASHBOARD — the fold, with no React in it so every number on the page is
// answerable in jest.
//
// WHAT THIS SURFACE IS FOR, in his words: *"the dashboard is about all the different kind of
// things, you know, arcs or RFCs, in their progress, and reports"* — *"to be able to see all the
// stuff that's waiting, all the projects going on at the same time."* So the question every pixel
// answers is **what is going on, and what needs me**, over every registered project at once.
//
// THE POINT OF VIEW THIS FILE COMMITS TO, and it is a claim about the work rather than about
// pixels: THERE ARE ONLY TWO KINDS OF THING IN THIS SYSTEM.
//
//   WORK THAT MOVES   an RFC, an arc, a gap. Each one is somewhere on a journey from written to
//                     finished, and the useful read across twelve projects is WHERE THE MASS SITS
//                     — a hundred things agreed and nothing moving is a different day from a
//                     hundred things moving. So they are drawn on ONE shared track, per project,
//                     and the track is the page's spine.
//   WORK THAT DECAYS  a report. A report does not travel; it is an account of something already
//                     done, and the only thing that happens to it is that its clock runs out. So
//                     reports are not on the track at all — they are a STACK per project, and the
//                     stack's job is the countdown.
//
// That split is why this file exports two different shapes (`marks` and `reports`) instead of one
// list of documents with a kind field: putting a report in the "finished" column of a journey it
// never walked would be the surface inventing a story.
//
// IT DERIVES NOTHING NEW ABOUT A DOCUMENT. Every state word is `lifecycleState.stateOf`, every
// claim count is `claims.claimsOf`, every objective count is `arcRows`, every clock is
// `retention.retainLine`, and everything owed is `owed.owedFrom`. What is new here — and the only
// thing — is the SHARED AXIS (`phaseOf`): a per-kind table mapping each kind's own station onto one
// of five columns, so four different trails can be read down one page. It maps words; it decides
// nothing.
import { owedFrom, owedHead, isFixture, docKey } from "../AgentChat/owed";
import arcRows, { arcLine } from "../AgentChat/arcRows";
import rfcRows, { rfcLine } from "../AgentChat/rfcRows";
import gapRows, { gapLine } from "../AgentChat/gapRows";
import { GROUP_OF, TRAILS, stateOf } from "../../atoms/Markdown/blocks/lifecycleState";
import { parseRetain, retainLine } from "../../atoms/Markdown/blocks/retention";
import { claimsOf } from "../../atoms/Markdown/claims";

/** The kinds that TRAVEL — drawn on the shared track. A report is not one of them, by design. */
export const MOVING_KINDS = ["rfc", "arc", "gap"];
export const KINDS = ["rfc", "arc", "gap", "report"];

/**
 * THE SHARED AXIS. Four trails, five columns, one direction of travel.
 *
 * The columns are named for what is TRUE OF THE WORK, not for any one kind's vocabulary — `built`
 * means something only to an RFC, `inProgress` only to an arc, and a column headed with either
 * would be a lie about the other three. The hint under each is the legend, and it is on the page:
 * his standing rule for a surface like this is *"the reason I know it's an approval is because it
 * says it above."*
 */
export const PHASES = [
  { id: "proposed", label: "proposed", hint: "written down — nobody has agreed to it yet" },
  { id: "agreed", label: "agreed", hint: "signed off, and not started" },
  { id: "moving", label: "moving", hint: "somebody is building it right now" },
  { id: "landed", label: "landed", hint: "finished, and the evidence is in it" },
  { id: "setdown", label: "set down", hint: "paused or declined — outright endings leave the page" },
];

// ONE TABLE, PER KIND, AND IT MAPS WORDS ONLY. Two placements are worth arguing with out loud:
//
//   rfc `built` → MOVING, not landed. A built RFC whose claims are not proved is not finished; the
//   proving IS the work still happening, and `settled` is the word that means it is done. Calling
//   built "landed" is exactly the lie `stateOf` was fixed to stop telling.
//
//   gap `open` → PROPOSED. An open gap is a problem somebody filed. Nothing has been agreed and
//   nothing is moving — even the interesting case (`open · proof ready`) is one PRESS from landed,
//   not partway through a build. The row's own words carry that nuance; the column does not pretend
//   to.
const PHASE_OF = {
  rfc: { draft: "proposed", approved: "agreed", built: "moving", settled: "landed", rejected: "setdown", retired: "setdown" },
  arc: { draft: "proposed", approved: "agreed", inProgress: "moving", settled: "landed", rejected: "setdown", retired: "setdown" },
  gap: { open: "proposed", resolved: "landed", rejected: "setdown", retired: "setdown" },
  report: { filed: "landed", retired: "setdown" },
};

/** Which column a kind's station sits in, or "" when the station is not one this kind has. */
export const phaseOf = (kind, station) => (PHASE_OF[kind] || {})[String(station || "")] || "";

/**
 * Every station of every trail has a column — asserted in the test, because a trail gaining a
 * station is exactly how a document would silently stop being drawn.
 */
export const everyStationMapped = () =>
  Object.keys(TRAILS).every((kind) => TRAILS[kind].every((station) => !!phaseOf(kind, station)));

// ── TITLES ──────────────────────────────────────────────────────────────────────────────────────
//
// THE ROW DOES NOT CARRY ONE. `api/documentsRegistry.js` passes through only what the shell wrote
// (`id kind path project arc at` + `state`) and `title` is not among the fields the hub's own
// `upsertRow` whitelist writes either — so measured against the live registry, every row's title is
// undefined. It is read off `title` anyway when a future parse starts supplying it, then the
// document's own `# ` heading, then the filename. A report's filename carries the write door's
// `report.<project>.` prefix, which is plumbing and not a name.
const heading = (text) => {
  const m = /^#\s+(.+)$/m.exec(String(text || ""));
  return m ? m[1].trim() : "";
};
export function docTitle(row = {}, text = "") {
  if (row.title) return String(row.title).trim();
  const h = heading(text);
  if (h) return h.replace(/^(RFC|ARC|GAP)[- ]?\d+\s*[—\-–:]\s*/i, "").trim();
  const file = String(row.path || "").split("/").pop() || "";
  return file
    .replace(/\.(md|markdown)$/i, "")
    .replace(/^report\.[^.]*\./i, "")
    .replace(/^(RFC|ARC|GAP)-\d+[-_]?/i, "")
    .replace(/[-_.]+/g, " ")
    .trim();
}

// ── WHAT STAYS ON THE PAGE ──────────────────────────────────────────────────────────────────────
//
// ENDINGS LEAVE, PAUSES STAY. The same rule the RFC and gap drawers follow, applied to all four
// kinds here rather than to two — because it is one rule about retirement and not a per-kind
// preference (gapRows says so in those words). A cancelled or superseded document is a decision
// that the thing is finished with, and keeping it costs every future reader a re-read to reject it;
// a PAUSE stays, showing its reason, because a pause vanishing would be a deletion wearing a
// softer word.
export const isEnding = (row) => GROUP_OF(((row || {}).state || {}).retiredAs) === "ending";

// ── PROGRESS WITHIN ONE DOCUMENT ────────────────────────────────────────────────────────────────
//
// THREE SEGMENTS, NEVER TWO. An RFC's bar is met / marked-but-unproved / nothing, and an arc's is
// done / blocked / nothing. Collapsing the middle segment into either neighbour is the specific
// dishonesty both derivations exist to prevent — 24 of 41 marked met with 21 resting on nothing was
// the measurement that produced `unproved` in the first place.
const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));
function barFor(kind, row, text, krow) {
  const st = (row && row.state) || {};
  if (kind === "rfc") {
    // The live text when we have it, the row's cached parse when we do not. They agree by
    // construction — `claimsOf`'s own comment names the registry's `metClaims` as the conjunction
    // it was written to match — so this is one answer with a fallback, not two answers.
    const c = typeof text === "string" && text.trim() ? claimsOf(text) : null;
    const rc = st.claims || {};
    const total = c ? c.total : Number(rc.total) || 0;
    if (!total) return null;
    const done = clamp(c ? c.met : Number(rc.met) || 0, 0, total);
    return {
      total,
      done,
      extra: clamp(c ? c.unproved : Number(rc.unproved) || 0, 0, total - done),
      doneWord: "met",
      extraWord: "marked, unproved",
      unitWord: "claims",
    };
  }
  if (kind === "arc") {
    const o = st.objectives || {};
    const total = krow ? krow.total : Number(o.total) || 0;
    if (!total) return null;
    const done = clamp(krow ? krow.done : Number(o.done) || 0, 0, total);
    return {
      total,
      done,
      extra: clamp(krow ? krow.blocked : 0, 0, total - done),
      doneWord: "done",
      extraWord: "blocked",
      unitWord: "objectives",
    };
  }
  // A gap has no interior to measure — it is one problem, open or closed, and its row says which.
  return null;
}

// ── ONE MARK ON THE TRACK ───────────────────────────────────────────────────────────────────────
const lineFor = (kind, krow) =>
  !krow ? "" : kind === "rfc" ? rfcLine(krow) : kind === "arc" ? arcLine(krow) : kind === "gap" ? gapLine(krow) : "";

/**
 * One travelling document. `owes` is the list of obligations `owed.js` found in THIS document —
 * never a count this file worked out, and never a press: it is why the mark pulses, and the only
 * thing a press does is open the document, where the control actually lives.
 */
function markFor({ row, text }, krow, owesById) {
  const station = stateOf(row.kind, row);
  // KEYED BY PROJECT AND ID. `owesById[row.id]` merged two projects' RFC-001 into one entry, so
  // a document wore another repo's obligations — wrong by construction on a cross-project page.
  const owes = owesById[docKey(row)] || [];
  return {
    key: `${row.kind}:${row.id}:${row.path}`,
    id: row.id,
    kind: row.kind,
    path: row.path,
    project: row.project || "",
    title: (krow && krow.title) || docTitle(row, text),
    station,
    phase: phaseOf(row.kind, station),
    line: lineFor(row.kind, krow),
    bar: barFor(row.kind, row, text, krow),
    // THE REGISTRY ROW IS A CACHE OF THE LAST PARSE (§1.4) and `stale` is the lag, made visible so
    // a surface can say "this moved since anybody read it" instead of either trusting or polling.
    // On this page it is the only honest signal of MOVEMENT, so it is carried to the pixel.
    stale: !!row.stale,
    missing: !!row.missing,
    fixture: isFixture(row),
    owes,
    press: owes.filter((o) => o.group === "press").length,
    work: owes.filter((o) => o.group === "work").length,
  };
}

// ── THE REPORT STACK ────────────────────────────────────────────────────────────────────────────
/**
 * One card in a project's stack. Everything about the clock is `retainLine`'s answer, including its
 * four silences — permanent, undeclared, unread, retired — because a stack that showed a number for
 * all of them would be inventing deadlines.
 *
 * `left` is the SORT KEY only, and it is the same arithmetic the clock face does (`openedAt +
 * window - now`). The words on the card are always `retainLine`'s.
 */
export function reportCard({ row, text }, now = Date.now()) {
  const st = (row && row.state) || {};
  const windowMs = parseRetain(st.retain);
  const openedAt = row.openedAt || null;
  const clock = retainLine({ retired: !!st.retired, retain: st.retain, windowMs, openedAt, now });
  const counting = !!(clock && clock.counting && openedAt && windowMs != null);
  return {
    key: `report:${row.id}:${row.path}`,
    id: row.id,
    kind: "report",
    path: row.path,
    project: row.project || "",
    title: docTitle(row, text),
    subtype: String(st.subtype || ""),
    clock: clock ? clock.text : "",
    urgent: !!(clock && clock.urgent),
    counting,
    left: counting ? openedAt + windowMs - now : null,
    permanent: windowMs === null,
    // THE CLOCK DOES NOT START UNTIL HE FIRST OPENS IT (§4.6). An unread report with a window is
    // not "fine" and it is not "expiring" — it is waiting for him, and that is its own state.
    unread: windowMs != null && !openedAt,
    undeclared: windowMs === undefined && !st.retired,
    retired: !!st.retired,
    stale: !!row.stale,
    fixture: isFixture(row),
  };
}

// WHAT A STACK PUTS ON TOP. The thing that is about to be destroyed leads, because waiting is the
// only thing on this page that DESTROYS something — the same reason the clock leads `owed.js`'s
// press group. Then the rest of the running clocks by how little is left, then the ones he has
// never opened (a clock that has not started), then permanent, then retired at the bottom.
const stackRank = (r) => (r.retired ? 5 : r.urgent ? 0 : r.counting ? 1 : r.unread ? 2 : r.undeclared ? 3 : 4);
const byStack = (a, b) =>
  stackRank(a) - stackRank(b) ||
  (a.counting && b.counting ? a.left - b.left : 0) ||
  String(a.title).localeCompare(String(b.title));

// ── THE WHOLE PAGE ──────────────────────────────────────────────────────────────────────────────
const empty = () => PHASES.reduce((acc, p) => ({ ...acc, [p.id]: 0 }), {});

/**
 * THE FOLD.
 *
 * @param docs  `[{ row, text }]` — every registry row, with its file's text where it could be read.
 *              `text: undefined` is what "could not be read" means, carried rather than swallowed,
 *              exactly as the drawer's own poll carries it.
 * @param roots `{ [projectCode]: absoluteRoot }` from `SystemView.projectRoots()` — the WIDEST list
 *              of projects, including the ones with nothing registered in them. Those are the whole
 *              reason this argument exists: a project missing from the page reads as "no work here",
 *              and a project drawn empty reads as "nothing was read here", and only the second one
 *              is ever true of a folder nobody has parsed.
 * @param fixtures include proof fixtures (`MOCK-*`, anything under `proofs/`). Off by default and
 *              the number is ALWAYS reported, so the exclusion is arguable instead of silent —
 *              `owed.js` set that rule and this page does not get to break it.
 */
export function dashboard({ docs = [], roots = {}, now = Date.now(), fixtures = false } = {}) {
  const all = (docs || []).filter((d) => d && d.row && d.row.id && d.row.kind && d.row.path);

  // WHAT IS OWED IS NOT RE-ASKED HERE. One call, over every project at once, and the page reads its
  // answer — the two halves of the masthead are literally `owedHead`'s segments.
  const owed = owedFrom({ docs: all, now });
  const head = owedHead(owed);
  const owesById = {};
  [...owed.press.map((x) => ({ ...x, group: "press" })), ...owed.work.map((x) => ({ ...x, group: "work" }))].forEach(
    (x) => {
      (owesById[docKey(x)] = owesById[docKey(x)] || []).push(x);
    },
  );

  // The live set: endings gone, fixtures gone unless he asked for them, and the count of each
  // exclusion kept so the page can say it.
  const endings = all.filter((d) => isEnding(d.row)).length;
  const fixtureCount = all.filter((d) => isFixture(d.row)).length;
  const live = all.filter((d) => !isEnding(d.row) && (fixtures || !isFixture(d.row)));

  // PER-KIND ROWS COME FROM THE MODULES THAT ALREADY OWN THEM, indexed by path within their kind —
  // within a kind a path is the row's own key, and ACROSS kinds it is not unique: the live registry
  // has `MOCK-RFC` (rfc) and `MOCK-RFC-SPEC` (report) both pointing at `RFCs/proofs/mock-rfc.md`.
  const ofKind = (k) => live.filter((d) => d.row.kind === k);
  const index = (rows) => rows.reduce((acc, r) => ({ ...acc, [r.path]: r }), {});
  const withText = (ds) => ds.filter((d) => typeof d.text === "string").map((d) => ({ ...d, path: d.row.path }));
  const krows = {
    rfc: index(rfcRows(withText(ofKind("rfc")))),
    // `arcRows` reads the document and nothing else — an arc's `blocked` is the one count no
    // registry row carries, because it is a statement an author WRITES on an objective.
    arc: index(arcRows(withText(ofKind("arc")))),
    gap: index(gapRows(withText(ofKind("gap")))),
  };

  const marks = live
    .filter((d) => MOVING_KINDS.includes(d.row.kind))
    .map((d) => markFor(d, (krows[d.row.kind] || {})[d.row.path] || null, owesById));
  const reports = live.filter((d) => d.row.kind === "report").map((d) => reportCard(d, now));

  // ONE LANE PER PROJECT THE MACHINE KNOWS ABOUT — plus any project a registry row names that the
  // roots map has never heard of, which is a real disagreement and belongs on screen rather than
  // dropped on the floor.
  const codes = [...new Set([...Object.keys(roots || {}), ...all.map((d) => d.row.project || "")])].filter(Boolean);
  const projects = codes
    .map((code) => {
      const mine = marks.filter((m) => m.project === code);
      const rep = reports.filter((r) => r.project === code).sort(byStack);
      const rowsHere = all.filter((d) => d.row.project === code);
      const phases = mine.reduce((acc, m) => ({ ...acc, [m.phase]: (acc[m.phase] || 0) + 1 }), empty());
      const counts = KINDS.reduce(
        (acc, k) => ({ ...acc, [k]: k === "report" ? rep.length : mine.filter((m) => m.kind === k).length }),
        {},
      );
      return {
        code,
        root: (roots || {})[code] || "",
        unknownRoot: !(roots || {})[code],
        marks: mine.sort(
          (a, b) =>
            b.press - a.press ||
            b.work - a.work ||
            PHASES.findIndex((p) => p.id === a.phase) - PHASES.findIndex((p) => p.id === b.phase) ||
            String(a.id).localeCompare(String(b.id), undefined, { numeric: true }),
        ),
        reports: rep,
        phases,
        counts,
        press: mine.reduce((n, m) => n + m.press, 0) + rep.filter((r) => r.urgent).length,
        work: mine.reduce((n, m) => n + m.work, 0),
        moving: phases.moving || 0,
        stale: [...mine, ...rep].filter((x) => x.stale).length,
        gone: rowsHere.filter((d) => d.row.missing).length,
        // REGISTERED, not "has documents". Zero here means nobody has ever parsed this folder, and
        // the page has to say that in those words — an empty state reading as "nothing to do" when
        // it means "nothing was read" is the lie this whole system exists to stop.
        registered: rowsHere.length,
      };
    })
    // WHAT NEEDS HIM LEADS. Then what is actually moving, then size, then the never-parsed folders
    // at the bottom — they are the page's footnote, not its content.
    .sort(
      (a, b) =>
        (a.registered ? 0 : 1) - (b.registered ? 0 : 1) ||
        b.press - a.press ||
        b.work - a.work ||
        b.moving - a.moving ||
        b.registered - a.registered ||
        a.code.localeCompare(b.code),
    );

  return {
    projects,
    owed,
    head,
    marks,
    reports: reports.sort(byStack),
    totals: {
      projects: projects.length,
      live: projects.filter((p) => p.registered).length,
      registered: all.length,
      read: owed.counted,
      marks: marks.length,
      reports: reports.length,
      endings,
      fixtures: fixtureCount,
      showingFixtures: !!fixtures,
      phases: marks.reduce((acc, m) => ({ ...acc, [m.phase]: (acc[m.phase] || 0) + 1 }), empty()),
      kinds: KINDS.reduce(
        (acc, k) => ({ ...acc, [k]: k === "report" ? reports.length : marks.filter((m) => m.kind === k).length }),
        {},
      ),
    },
  };
}

/**
 * THE ONE SENTENCE UNDER THE MASTHEAD — what the page is standing on, and what it left out. It is
 * prose rather than a strip of numbers for the same reason `skippedLine` is: each omission means
 * something different, and a surface that omits silently is the failure this one is built against.
 */
export function readingLine(totals = {}) {
  if (!totals.registered) return "the registry is empty — no document has been parsed on this machine";
  const parts = [
    `${totals.read} of ${totals.registered} documents read`,
    `${totals.live} of ${totals.projects} projects have anything registered`,
  ];
  if (totals.endings) parts.push(`${totals.endings} retired outright and left the page`);
  if (totals.fixtures) parts.push(`${totals.fixtures} proof ${totals.showingFixtures ? "fixtures shown" : "fixtures hidden"}`);
  return parts.join(" · ");
}

export default dashboard;
