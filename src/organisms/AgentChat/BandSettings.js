import React, { useEffect, useState } from "react";
import { listDefs } from "../../utils/hostAgents";
import { FIELDS, SOURCE_CHOICES, sourceChoices, UNITS, patchFor, summaryOf, toggleSource, usable } from "./nudgeSettings";
import {
  FIELDS as COMPACTION_FIELDS,
  UNITS as COMPACTION_UNITS,
  patchFor as compactionPatchFor,
  summaryOf as compactionSummaryOf,
  usable as compactionUsable,
} from "./compactionSettings";

// THE SETTINGS, IN THE BAND AREA.
//
// HIS SHAPE: *"use that bottom area where the tabs are for the settings instead of something that
// pops up"* — treat it like a tab below. A popup over the band hides the thing you are configuring,
// and it was the wrong size the moment there was more than one subject to configure.
//
// TWO SECTIONS, ONE AT A TIME: the worklist nudge's knobs and the auto-compaction valve's. Both
// are REHOUSED, not redesigned — same fields, same doors, same absence lines as the popup had.
//
// EACH SECTION STATES ITS OWN ABSENCE. Two doors on two different shells: `nudge` (the chaser's
// knobs) and `compaction` (the valve). A shell can have either, neither or both, so each section
// says so for itself rather than one hiding behind another — absence stated beats a panel of
// defaults that write nowhere.
const BandSettings = () => {
  const [tab, setTab] = useState("worklist");

  // THE MANAGER IS PICKED, NOT TYPED — his correction, 2026-11-09: *"I don't know why you didn't
  // just give me the ability to select the agent or why would I type a specific name in."* He is
  // right, and the typed field was worse than inconvenient: the authority is matched against a
  // session's SLOT exactly, so one typo names an agent that does not exist and the refusal reads
  // "assigning work is the manager's, and that is managr" — a correct refusal nobody can act on.
  // A select cannot misspell, and it is one discrete act, so it sends on change like every toggle
  // here (the draft-and-blur dance existed only because a text input writes once per keystroke).
  //
  // THE ROSTER IS THE HARNESS'S, read through the door the Agents page already uses — no new
  // bridge, so no shell restart to arm it.
  const [roster, setRoster] = useState(null);
  useEffect(() => {
    let alive = true;
    Promise.resolve(listDefs())
      .then((list) => alive && setRoster((list || []).map((r) => r && r.id).filter(Boolean)))
      .catch(() => alive && setRoster([]));
    return () => {
      alive = false;
    };
  }, []);

  // ── THE CHASER'S OWN KNOBS ──
  const [settings, setSettings] = useState(null);
  // THE KINDS THE HARNESS SENT, so the switches are the harness's own list rather than a copy kept
  // here. Absent on an older shell, which is what the fallback in nudgeSettings is for.
  const [kinds, setKinds] = useState(null);
  const [door, setDoor] = useState("asking");
  const [saving, setSaving] = useState("");
  useEffect(() => {
    const api = typeof window !== "undefined" && window.systemview && window.systemview.nudge;
    if (!api || typeof api.read !== "function") {
      setDoor("absent");
      return undefined;
    }
    let alive = true;
    Promise.resolve(api.read())
      .then((r) => {
        if (!alive) return;
        const s = r && r.settings;
        if (usable(s)) {
          setSettings(s);
          setKinds(Array.isArray(r.kinds) ? r.kinds : null);
          setDoor("present");
        } else setDoor("absent");
      })
      .catch(() => alive && setDoor("absent"));
    return () => {
      alive = false;
    };
  }, []);
  const send = (patch) => {
    if (!patch) return;
    setSaving(Object.keys(patch)[0] || "");
    Promise.resolve(window.systemview.nudge.write(patch))
      .then((r) => {
        if (r && r.ok && usable(r.settings)) setSettings(r.settings);
        setSaving("");
      })
      .catch(() => setSaving(""));
  };

  // ── AUTO-COMPACTION ──
  const [compactionCfg, setCompactionCfg] = useState(null);
  const [compactionDoor, setCompactionDoor] = useState("asking");
  const [compactionSaving, setCompactionSaving] = useState("");
  useEffect(() => {
    const api = typeof window !== "undefined" && window.systemview && window.systemview.compaction;
    if (!api || typeof api.read !== "function") {
      setCompactionDoor("absent");
      return undefined;
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
    setCompactionSaving(Object.keys(patch)[0] || "");
    Promise.resolve(window.systemview.compaction.write(patch))
      .then((r) => {
        if (r && r.ok && compactionUsable(r.settings)) setCompactionCfg(r.settings);
        setCompactionSaving("");
      })
      .catch(() => setCompactionSaving(""));
  };

  const TABS = [
    { key: "worklist", label: "worklist settings" },
    { key: "compaction", label: "auto-compaction" },
  ];

  return (
    <div className="agent-chat__bandset">
      <div className="agent-chat__bandcog-tabs">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            className={`agent-chat__bandcog-tab${tab === t.key ? " agent-chat__bandcog-tab--on" : ""}`}
            onClick={() => setTab(t.key)}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="agent-chat__bandset-body">
        {/* ── THE WORKLIST KNOBS — carried over, every control it had (c19) ── */}
        <div className={`agent-chat__bandcog-sec${tab === "worklist" ? "" : " agent-chat__bandcog-sec--off"}`}>
          {door !== "present" ? (
            <div className="agent-chat__bandcog-absent">
              {door === "asking"
                ? "asking the shell…"
                : "This shell has no nudge door yet — the harness half of it has not landed. Nothing here would be read."}
            </div>
          ) : (
            <>
              {FIELDS.map((f) => (
                <label
                  className={`agent-chat__bandcog-row${saving === f.key ? " agent-chat__bandcog-row--saving" : ""}`}
                  key={f.key}
                >
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
                  {f.kind === "slot" && (
                    <select
                      className="agent-chat__bandcog-slot"
                      value={settings[f.key] || ""}
                      onChange={(e) => send(patchFor(settings, f.key, e.target.value))}
                    >
                      {/* EMPTY IS A REAL CHOICE AND IT IS THE DEFAULT — a blank authority admits
                          nobody, so "nobody" is an option he can return to, never a placeholder
                          that means "unset and therefore anyone". */}
                      <option value="">nobody</option>
                      {/* A NAME ALREADY SET THAT IS NOT IN THE ROSTER STILL APPEARS. An agent can
                          be removed after being named manager, and a select that silently dropped
                          the value would rewrite his setting the next time he touched anything
                          else in this panel. It shows, marked, and he decides. */}
                      {settings[f.key] && roster && !roster.includes(settings[f.key]) ? (
                        <option value={settings[f.key]}>{settings[f.key]} — no such agent</option>
                      ) : null}
                      {(roster || []).map((id) => (
                        <option key={id} value={id}>
                          {id}
                        </option>
                      ))}
                    </select>
                  )}
                  {/* THE ROSTER'S OWN ABSENCE, said rather than drawn as an empty menu — the same
                      rule the two sections above follow. A shell with no agents door leaves this
                      a one-option select, which reads as "there are no agents" and is a lie. */}
                  {f.kind === "slot" && roster && !roster.length && (
                    <span className="agent-chat__bandcog-none">no agents defined to choose from</span>
                  )}
                  {f.kind === "sources" && (
                    <span className="agent-chat__bandcog-sources">
                      {sourceChoices(kinds).map((c) => (
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
          )}
        </div>

        {/* ── AUTO-COMPACTION — carried over, every control it had (c19) ── */}
        <div className={`agent-chat__bandcog-sec${tab === "compaction" ? "" : " agent-chat__bandcog-sec--off"}`}>
          {compactionDoor !== "present" ? (
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
          )}
        </div>
      </div>
    </div>
  );
};

export default BandSettings;
