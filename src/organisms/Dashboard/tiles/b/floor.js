import React from "react";
import "../../../DashboardB/styles.scss";
import { floorFrom } from "../../../DashboardB/dashboardB.data";
import { onCodePage } from "../../../../atoms/Markdown/openRef";
import { openDoc } from "../../dashboardData";

// ─── WHAT EVERY B TILE SHARES ──────────────────────────────────────────────────────────────────
//
// The floor was one page: one hub read, one derivation, five sections drawn from it. The sections
// are now tiles that can stand anywhere on a configurable surface, and the thing that had to NOT
// come with them is the read — a tile that opens its own registry poll is a second opinion nobody
// asked for, and three of them on one surface drift apart within a minute. The read lives above,
// in `dashboardData.js`, and arrives as one prop.
//
// What a tile MAY still bring is its own DERIVATION over that one read, and B's is `floorFrom` —
// the whole point of view this dashboard committed to (a document is a thing standing somewhere,
// not a row). It stays, and it is shared below so five tiles cost one pass rather than five.

/** The kind hues, as var names. The values live in the stylesheet WITH a dark step; a tile reads
 *  them through `.dbb-ctx`, which is why every tile wears that class. */
export const HUES = { rfc: "var(--dbb-rfc)", arc: "var(--dbb-arc)", gap: "var(--dbb-gap)", report: "var(--dbb-report)" };

// The station words a human says out loud. `inProgress` is the only one that needs it.
const STATION_WORDS = { inProgress: "in progress" };
export const stationWord = (s) => STATION_WORDS[s] || s;

/** How often the page re-reads the registry. Same cadence and the same justification as the band's
 * owed poll: the provider's fingerprint makes an unchanged tick cost one registry read and no file
 * reads, and the derivation still re-runs because a retention clock crosses into urgent by the
 * passage of time and nothing else. */
export const EVERY = 30000;

// ─── THE DERIVATION, ONCE FOR THE WHOLE SURFACE ────────────────────────────────────────────────
//
// A ONE-SLOT CACHE, KEYED ON THE IDENTITY OF WHAT THE READ HANDED OVER. Five tiles render in one
// pass off one `data` object; without this they run `floorFrom` five times over the same documents
// and — worse — five times with five different `Date.now()`s, so the head could say a report is
// urgent while the stack below it still has it comfortable. One key, one `now`, one answer.
//
// `beat` is in the key on purpose: the provider ticks it every minute precisely so clock wording
// stays honest between polls, and a cached floor that ignored it would still be saying "retires in
// 4 hours" tomorrow.
//
// TWO SLOTS, BECAUSE THE SURFACE HOLDS TWO WORLDS when a head segment is held: the narrowed set
// every ordinary tile derives from, and the whole set the head counts. Unheld they are the same
// array and the same key, so the second slot never fills and the whole surface still costs one
// pass.
let slots = [];
const derive = (docs, roots, beat) => {
  const hit = slots.find((s) => s.docs === docs && s.roots === roots && s.beat === beat);
  if (hit) return hit.floor;
  const floor = floorFrom({ docs: docs || [], projects: roots || {}, now: Date.now() });
  slots = [{ docs, roots, beat, floor }, ...slots].slice(0, 2);
  return floor;
};

/**
 * B's floor over WHAT THE SURFACE IS SHOWING — narrowed when a head segment is held.
 *
 * Every ordinary tile reads this and needs no filter awareness at all: the provider hands down a
 * shorter `docs` and the rails, the stacks and the project cards narrow for free. That is his
 * ruling made cheap — *"those headers, if they have filters, need to filter the entire, ALL of
 * the sections"* — and it holds because the narrowing happens above every tile rather than inside
 * one of them.
 *
 * Returns `null` when there is no data at all (a tile rendered outside the provider), which every
 * tile draws as "reading the registry…" rather than as an empty floor — an unmeasured nothing is
 * not a nothing, and that rule does not get weaker because the section moved.
 */
export function floorOf(data) {
  if (!data) return null;
  return derive(data.docs, data.roots, data.beat);
}

/**
 * B's floor over EVERYTHING, ignoring the filter. Only the head reads this, and it has to: a head
 * counting the filtered set restates its own press back at itself, and the one number he can no
 * longer get is how much there was before he narrowed it.
 */
export function floorOfAll(data) {
  if (!data) return null;
  return derive(data.allDocs || data.docs, data.roots, data.beat);
}

/** Only for tests that need two mounts not to share one cached answer. */
export const forgetFloor = () => {
  slots = [];
};

// ─── OPENING A DOCUMENT ────────────────────────────────────────────────────────────────────────

/**
 * THE ONE OPENER (openRef.js), offered first to whatever document display the tile is mounted in,
 * and navigated only if nothing answered — the rule that file already writes. `data.open` IS that
 * opener; it is taken as an argument so a tile never reaches past the surface for a door.
 *
 * The last-resort route is B's own and it has to survive the move: when no panel hosts the address
 * and we are not already on the Code page, pushing the Code page's file door beats leaving a dead
 * click. Nothing here PRESSES anything — opening the document is the whole interaction B offers,
 * because the control lives in the document.
 */
export function openBead(bead, open = openDoc) {
  if (!bead) return;
  const d = open({ project: bead.project, path: bead.path, line: bead.line }) || {};
  if (d.handled || onCodePage()) return;
  const q = new URLSearchParams();
  q.set("tab", "docs");
  q.set("file", bead.path);
  q.set("fproj", bead.project);
  q.set("flang", "markdown");
  if (bead.line > 1) q.set("flines", `${bead.line}-${bead.line}`);
  window.history.pushState({}, "", `/specs/${bead.project}?${q.toString()}`);
  // the router listens to popstate — this is how a pushed URL reaches it without a reload, which
  // is never on the table here (his standing rule: never suggest a page reload to him again)
  window.dispatchEvent(new PopStateEvent("popstate"));
}

// ─── THE WRAPPER EVERY TILE WEARS ──────────────────────────────────────────────────────────────

/**
 * `.dbb-ctx` is not decoration — it is the half of the old root rule a section cannot live without:
 * the colour it inherits, the 13px it sits on, the resets, and every `--dbb-*` it paints with. On
 * B's own page the outer `.dbb` already carries all of it, so this wrapper changes nothing there;
 * on any other surface it is the difference between a hue and no colour at all.
 */
export const Ctx = ({ children }) => <div className="dbb-ctx">{children}</div>;

/** Nothing has landed yet. Said the way B's page says it, because it is the same sentence. */
export const Reading = ({ bad = "" }) => (
  <Ctx>
    <div className={`dbb-empty${bad ? " is-bad" : ""}`}>{bad || "reading the registry…"}</div>
  </Ctx>
);
