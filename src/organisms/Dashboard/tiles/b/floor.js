import React from "react";
import "../../../DashboardB/styles.scss";
import { floorFrom } from "../../../DashboardB/dashboardB.data";
import { parseAddress } from "../../../../atoms/Markdown/objectives";
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
// FOUR SLOTS, BECAUSE THE SURFACE HOLDS SEVERAL WORLDS NOW. Filtering went POSITIONAL (his
// ruling, 2026-11-06: a tile narrows everything BELOW it), so one page can legitimately hold the
// whole set the heads count plus a different narrowed set per band of tiles under each held
// selection. Unheld they all collapse to one array and one key, so the extra slots cost nothing
// until something is actually held.
let slots = [];
const derive = (docs, roots, beat) => {
  const hit = slots.find((s) => s.docs === docs && s.roots === roots && s.beat === beat);
  if (hit) return hit.floor;
  const floor = floorFrom({ docs: docs || [], projects: roots || {}, now: Date.now() });
  slots = [{ docs, roots, beat, floor }, ...slots].slice(0, 4);
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
 * THE DOOR TRAVELS — `openDoc` pushes the Code page's own file route and fires popstate, which is
 * the route this function used to keep as a last resort and is now the WHOLE door. His ruling,
 * 2026-11-06: *"it actually should travel — not open it up on the side."* `data.open` IS that
 * opener; it is still taken as an argument so a tile never reaches past the surface for a door,
 * and so a test can hand in a spy. Nothing here PRESSES anything — opening the document is the
 * whole interaction, because the control lives in the document — and nothing but the ARROW calls
 * it any more.
 */
export function openBead(bead, open = openDoc) {
  if (!bead) return;
  open({ project: bead.project, path: bead.path, line: bead.line });
}

/**
 * ONE TRACK, NARROWED TO ONE ARC — the RFCs planned into it, by the address on their own leaf
 * (`arc=ARC-001-O6`, the same address `plansByObjective` resolves by, matched on the arc id the
 * same way because a cross-repo plan carries no project prefix). His ruling, 2026-11-06: *"you
 * should be able to click on arcs and it should filter all the RFCs for that arc."* A pure
 * function of the track and the held arc's id, so the claim is provable without a mount.
 */
export function trackForArc(track, arcId) {
  if (!track || !arcId || track.kind !== "rfc") return track;
  const mine = (b) => {
    const a = parseAddress(b.arc);
    return !!a && a.arc === arcId;
  };
  const stations = track.stations.map((s) => ({ ...s, beads: s.beads.filter(mine) }));
  return { ...track, stations, total: stations.reduce((n, s) => n + s.beads.length, 0), narrowedTo: arcId };
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
