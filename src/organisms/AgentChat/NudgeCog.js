import React, { useEffect, useRef, useState } from "react";
import { FIELDS, SOURCE_CHOICES, UNITS, patchFor, summaryOf, toggleSource, usable } from "./nudgeSettings";
import {
  FIELDS as COMPACTION_FIELDS,
  UNITS as COMPACTION_UNITS,
  patchFor as compactionPatchFor,
  summaryOf as compactionSummaryOf,
  usable as compactionUsable,
} from "./compactionSettings";

// THE COG AT THE RIGHT END OF THE TAB ROW. His placement: *"on the right side of the tabs all the
// way at the end."*
//
// IT COSTS NO HEIGHT. The tab row is a flex row, so the cog is pushed to the far end with
// `margin-left: auto` rather than being given a row of its own — the same mistake the document
// pin's tuck handle made, where adding a child to a column container pushed the whole stack down.
//
// IT IS NOT A TAB. `bandTabs` decides which tabs exist from what has rows, and a settings cog has
// no rows and must never compete for that space — it is always there, including when the band has
// exactly one tab, because configuring the nudge is not a kind of work.
//
// WHEN THE DOOR IS ABSENT, IT SAYS SO AND RENDERS NOTHING ELSE. A shell older than the harness half
// of this feature has no `window.systemview.nudge`, and the honest answer there is absence stated
// rather than a panel of defaults that write nowhere — a surface showing knobs that change nothing
// is worse than no surface.
const NudgeCog = () => {
  const [settings, setSettings] = useState(null);
  const [open, setOpen] = useState(false);
  const [door, setDoor] = useState("asking"); // asking | present | absent
  const [saving, setSaving] = useState("");
  // ONE SECTION AT A TIME (his: "create tabs or scrolls or both — I can't see the top of my
  // settings"). The panel opens UPWARD from a cog at the bottom of the window, so two stacked
  // sections ran off the top — and the top is where the first section's knobs live. Tabs halve the
  // height; the panel's max-height + scroll (styles.scss) is the safety under short windows.
  const [tab, setTab] = useState("worklist"); // worklist | compaction
  // CLICKING AWAY CLOSES IT (his: "I have to click the cog to close this menu instead of just
  // clicking outside of it"). Same rule every menu here follows — pointerdown so it closes before
  // whatever was clicked starts handling.
  const rootRef = useRef(null);
  useEffect(() => {
    if (!open) return undefined;
    const away = (e) => {
      if (rootRef.current && !rootRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("pointerdown", away);
    return () => document.removeEventListener("pointerdown", away);
  }, [open]);

  useEffect(() => {
    const api = typeof window !== "undefined" && window.systemview && window.systemview.nudge;
    if (!api || typeof api.read !== "function") {
      setDoor("absent");
      return;
    }
    let alive = true;
    Promise.resolve(api.read())
      .then((r) => {
        if (!alive) return;
        const s = r && r.settings;
        if (usable(s)) {
          setSettings(s);
          setDoor("present");
        } else setDoor("absent");
      })
      .catch(() => alive && setDoor("absent"));
    return () => {
      alive = false;
    };
  }, []);

  // AUTO-COMPACTION rides the same cog — a second section, its own door, its own absence. A shell
  // older than the valve has `nudge` and no `compaction`; each section states its own state rather
  // than one hiding behind the other.
  const [compactionCfg, setCompactionCfg] = useState(null);
  const [compactionDoor, setCompactionDoor] = useState("asking");
  const [compactionSaving, setCompactionSaving] = useState("");
  useEffect(() => {
    const api = typeof window !== "undefined" && window.systemview && window.systemview.compaction;
    if (!api || typeof api.read !== "function") {
      setCompactionDoor("absent");
      return;
    }
    let alive = true;
    Promise.resolve(api.read())
      .then((r) => {
        if (!alive) return;
        const s = r && r.settings;
        if (compactionUsable(s)) {
          setCompactionCfg(s);
          setCompactionDoor("present");
        } else setCompactionDoor("absent");
      })
      .catch(() => alive && setCompactionDoor("absent"));
    return () => {
      alive = false;
    };
  }, []);
  const sendCompaction = (patch) => {
    if (!patch) return;
    const api = window.systemview.compaction;
    setCompactionSaving(Object.keys(patch)[0] || "");
    Promise.resolve(api.write(patch))
      .then((r) => {
        if (r && r.ok && compactionUsable(r.settings)) setCompactionCfg(r.settings);
        setCompactionSaving("");
      })
      .catch(() => setCompactionSaving(""));
  };

  // A WRITE GOES TO THE HARNESS AND THE ANSWER COMES BACK FROM IT. The panel never keeps its own
  // version: what it shows is what the harness said it stored, so a clamped or refused value is
  // visible immediately instead of looking accepted until the next reload.
  const send = (patch) => {
    if (!patch) return;
    const api = window.systemview.nudge;
    setSaving(Object.keys(patch)[0] || "");
    Promise.resolve(api.write(patch))
      .then((r) => {
        if (r && r.ok && usable(r.settings)) setSettings(r.settings);
        setSaving("");
      })
      .catch(() => setSaving(""));
  };

  if (door === "asking") return null;

  return (
    <div className="agent-chat__bandcog" ref={rootRef}>
      <button
        type="button"
        className={`agent-chat__bandcog-btn${open ? " agent-chat__bandcog-btn--on" : ""}`}
        title={summaryOf(door === "absent" ? null : settings)}
        onClick={() => setOpen((v) => !v)}
      >
        ⚙
      </button>
      {open && (
        <div className="agent-chat__bandcog-panel">
          {/* THE TABS — the two heads, made pressable. One section at a time is what keeps the
              upward-opening panel inside the window. */}
          <div className="agent-chat__bandcog-tabs">
            <button
              type="button"
              className={`agent-chat__bandcog-tab${tab === "worklist" ? " agent-chat__bandcog-tab--on" : ""}`}
              onClick={() => setTab("worklist")}
            >
              worklist settings
            </button>
            <button
              type="button"
              className={`agent-chat__bandcog-tab${tab === "compaction" ? " agent-chat__bandcog-tab--on" : ""}`}
              onClick={() => setTab("compaction")}
            >
              auto-compaction
            </button>
          </div>
          {/* THE BODY SCROLLS, THE PANEL DOES NOT MOVE (his: the header "moves down" between
              sections). The panel is bottom-anchored, so a per-tab height difference moved its TOP
              edge — the tabs — up and down. Fixed panel height, tabs pinned, body scrolls. */}
          <div className="agent-chat__bandcog-body">
          {tab === "worklist" && (door === "absent" ? (
            // ABSENCE STATED, never a stale copy shown.
            <div className="agent-chat__bandcog-absent">
              This shell has no nudge door yet — the harness half of it has not landed. Nothing here
              would be read.
            </div>
          ) : (
            <>
              {FIELDS.map((f) => (
                <label className={`agent-chat__bandcog-row${saving === f.key ? " agent-chat__bandcog-row--saving" : ""}`} key={f.key}>
                  <span className="agent-chat__bandcog-label">{f.label}</span>
                  {f.kind === "toggle" && (
                    <input
                      type="checkbox"
                      checked={!!settings[f.key]}
                      onChange={(e) => send(patchFor(settings, f.key, e.target.checked))}
                    />
                  )}
                  {UNITS[f.kind] !== undefined && (
                    <span className="agent-chat__bandcog-num">
                      <input
                        type="number"
                        min={f.min}
                        max={f.max}
                        value={settings[f.key]}
                        onChange={(e) => send(patchFor(settings, f.key, e.target.value))}
                      />
                      <em>{UNITS[f.kind]}</em>
                    </span>
                  )}
                  {f.kind === "sources" && (
                    <span className="agent-chat__bandcog-sources">
                      {SOURCE_CHOICES.map((c) => (
                        <button
                          type="button"
                          key={c.key}
                          className={`agent-chat__bandcog-src${(settings.sources || []).includes(c.key) ? " agent-chat__bandcog-src--on" : ""}`}
                          onClick={() => send(patchFor(settings, "sources", toggleSource(settings, c.key)))}
                        >
                          {c.label}
                        </button>
                      ))}
                    </span>
                  )}
                  <span className="agent-chat__bandcog-help">{f.help}</span>
                </label>
              ))}
              <div className="agent-chat__bandcog-foot">{summaryOf(settings)}</div>
            </>
          ))}
          {/* AUTO-COMPACTION — the release valve's knobs, its own tab, its own absence line: a
              shell with the nudge door and not this one says so instead of pretending. */}
          {tab === "compaction" && (compactionDoor !== "present" ? (
            <div className="agent-chat__bandcog-absent">
              {compactionDoor === "asking"
                ? "asking the shell…"
                : "This shell has no auto-compaction door yet — restart it to arm the valve. Nothing here would be read."}
            </div>
          ) : (
            <>
              {COMPACTION_FIELDS.map((f) => (
                <label
                  className={`agent-chat__bandcog-row${compactionSaving === f.key ? " agent-chat__bandcog-row--saving" : ""}`}
                  key={`compaction-${f.key}`}
                >
                  <span className="agent-chat__bandcog-label">{f.label}</span>
                  {f.kind === "toggle" && (
                    <input
                      type="checkbox"
                      checked={!!compactionCfg[f.key]}
                      onChange={(e) => sendCompaction(compactionPatchFor(compactionCfg, f.key, e.target.checked))}
                    />
                  )}
                  {COMPACTION_UNITS[f.kind] !== undefined && (
                    <span className="agent-chat__bandcog-num">
                      <input
                        type="number"
                        min={f.min}
                        max={f.max}
                        value={compactionCfg[f.key]}
                        onChange={(e) => sendCompaction(compactionPatchFor(compactionCfg, f.key, e.target.value))}
                      />
                      <em>{COMPACTION_UNITS[f.kind]}</em>
                    </span>
                  )}
                  <span className="agent-chat__bandcog-help">{f.help}</span>
                </label>
              ))}
              <div className="agent-chat__bandcog-foot">{compactionSummaryOf(compactionCfg)}</div>
            </>
          ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default NudgeCog;
