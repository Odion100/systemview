import React, { useEffect, useState } from "react";
import LifecycleTrail from "./lifecycle";
import LeafPick from "./LeafPick";
import { useMarkdownWrite } from "../context";
import { getAgent } from "../../../utils/hub";
import { parseRetain, retainLine, tickFor } from "./retention";

// The subtype vocabulary is OPEN (RFC-076 §2: `as=` picks what done means, from a vocabulary, not
// an enum) — these are the words already in use, and the picker's free field is the openness.
const SUBTYPES = ["planning", "notice", "audit", "account", "brief", "spec"];
const WINDOWS = ["1h", "6h", "12h", "1d", "2d", "3d", "7d", "14d", "30d", "90d", "permanent"];

// RFC-073 §1.2 — `::report{id=subscribe-and-registration}` at the top of a document.
//
// IT MAKES THE DOCUMENT A REPORT, wherever it lives. Reports were a kind only because they sat in
// `.systemview/` and matched `report.*.md` — `bandTabs.js` says so itself: *"only because it lives in
// `.systemview`, not because the word 'report' means anything to the band."* With the leaf, the
// word means something: this document says it is one.
//
// `show()` writes this leaf when it files a report, so no skill has to remember to — that is
// registration path 2 of the five in RFC-073 §4. Identity only; nothing to press.
// THE LEAF IS THE TRAIL (2026-10-28) — identity at the periphery, the lifecycle as the body.
//
// RFC-076 §4.6 (2026-10-29) — THE LEAF IS ALSO THE CLOCK'S FACE. Rendering this block IS the
// report being read, so the mount stamps the first open (the hub's ledger, first write wins), and
// the countdown renders here, where the reader already is: "retires in 3 days", with DIVERT
// (restart the clock from now) and PERMANENT (writes retain=permanent into the leaf — the explicit
// forever) beside it. A leaf that declares no subtype or no retention wears what is missing —
// surfaced at the document the same way the drawer surfaces it on the row.
const Report = ({ attrs = {}, line }) => {
  const { editable, setAttr } = useMarkdownWrite() || {};
  const [openedAt, setOpenedAt] = useState(null);
  const retired = !!attrs.retired;
  const retain = String(attrs.retain || "").trim();
  const windowMs = parseRetain(retain);

  // THE CLOCK MOVES. It used to be a snapshot: `retainLine` took `now` at render and nothing ever
  // re-rendered, so the face sat saying the same thing while the window actually closed — *"it
  // should be making me feel like, oh, this shit's going away. That's the point."* The cadence is
  // the granularity of the words themselves (`tickFor`), so a fortnight ticks hourly and the last
  // few minutes tick per second. No interval at all when there is nothing left to count: retired,
  // permanent, undeclared, or not yet read.
  const [, setBeat] = useState(0);
  const left = windowMs != null && openedAt ? openedAt + windowMs - Date.now() : null;
  const every = tickFor(left);
  useEffect(() => {
    if (!every) return undefined;
    const t = setInterval(() => setBeat((b) => b + 1), every);
    return () => clearInterval(t);
  }, [every]);

  useEffect(() => {
    // the stamp rides the render because the render is the reading — but never for a retired
    // report (its clock already spoke) and never without an id (nothing to stamp)
    if (!attrs.id || retired) return;
    const agent = getAgent();
    if (!agent || !agent.documentOpened) return;
    let dead = false;
    agent
      .documentOpened({ id: attrs.id })
      .then((r) => {
        if (!dead && r && r.ok) setOpenedAt(r.openedAt);
      })
      .catch(() => {});
    return () => {
      dead = true;
    };
  }, [attrs.id, retired]);

  const divert = async () => {
    const agent = getAgent();
    if (!agent || !agent.documentOpened || !attrs.id) return;
    try {
      const r = await agent.documentOpened({ id: attrs.id, restart: true });
      if (r && r.ok) setOpenedAt(r.openedAt);
    } catch {}
  };
  // THE CHIPS ARE THE EDITORS (his direction, 2026-10-29): the subtype badge and the clock are
  // pressable where the write door is open — a picker, not a form. A missing attribute renders the
  // SAME picker wearing the question ("subtype?"), so the invalid wear sits beside its own fix.
  const setWord = (key) => (word) => {
    if (setAttr && line) setAttr(line, key, word);
  };
  const okWindow = (word) => parseRetain(word) !== undefined; // the free field can't write a word no clock can read

  const missing = [!attrs.as && "no subtype", !retain && "no retention"].filter(Boolean);
  const clock = retainLine({ retired, retain, windowMs, openedAt });

  return (
    <div className="md-arc md-report">
      <span className="md-arc__who">
        <span className="md-arc__kind">report</span>
        <span className="md-arc__id">{attrs.id || "report"}</span>
        {attrs.title ? <span className="md-arc__title">{attrs.title}</span> : null}
        {editable && setAttr && line ? (
          <LeafPick
            className="md-pick--as"
            label={attrs.as || "subtype?"}
            title="what kind of report this is — as= picks what done means"
            options={SUBTYPES.filter((s) => s !== attrs.as)}
            free="or name one…"
            onPick={setWord("as")}
          />
        ) : attrs.as ? (
          <span className="md-report__as">{attrs.as}</span>
        ) : null}
        {missing.length ? (
          <span className="md-report__invalid" title="RFC-076 §2 — a report declares its subtype and its ending">
            invalid — {missing.join(", ")}
          </span>
        ) : null}
        {clock || (editable && setAttr && line && !retired) ? (
          <span className={`md-report__clock${clock && clock.urgent ? " is-soon" : ""}`}>
            {editable && setAttr && line ? (
              <LeafPick
                className="md-pick--retain"
                label={clock ? clock.text : "retention?"}
                title="when this report leaves — a window from first read, or the explicit forever"
                options={WINDOWS.filter((w) => w !== retain)}
                free="or 45d…"
                onPick={(w) => {
                  if (!okWindow(w)) return false; // refused — LeafPick keeps the field open to fix
                  setWord("retain")(w);
                  return true;
                }}
              />
            ) : (
              clock && clock.text
            )}
            {clock && clock.counting ? (
              <button type="button" className="md-report__divert" onClick={divert} title="restart the clock from now">
                divert
              </button>
            ) : null}
          </span>
        ) : null}
      </span>
      {/* A report is never done; it is filed or retired. */}
      <LifecycleTrail kind="report" id={attrs.id} line={line} attrs={attrs} />
    </div>
  );
};

export default Report;
