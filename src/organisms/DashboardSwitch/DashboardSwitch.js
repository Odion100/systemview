import React, { useState } from "react";
// The component files directly: A ships an index.js and B and C do not, and importing a folder
// that happens to have one is a difference that only shows up at build time.
import DashboardA from "../DashboardA/DashboardA";
import DashboardB from "../DashboardB/DashboardB";
import DashboardC from "../DashboardC/DashboardC";
import "./styles.scss";

// THREE DASHBOARDS, AND A WAY TO FLIP BETWEEN THEM.
//
// Three lanes were each given the same brief — the purpose, the data that already exists, and one
// visual cue — and told to commit to their own point of view rather than hedge toward a middle.
// All three built a whole page. They are disjoint by construction (each in its own directory,
// none touching a shared file), so all three can stand in the tree at once.
//
// THIS EXISTS SO THE CHOICE IS MADE BY LOOKING, NOT BY READING. Three descriptions of a dashboard
// are three arguments; three dashboards over the same live registry is a decision you can make in
// ten seconds. It is a temporary surface on purpose: when one is picked the other two come out
// and this goes with them.
//
// THE PICK IS REMEMBERED, because comparing means flipping back and forth and then leaving — and
// coming back to whichever you were last looking at is the whole of what this has to do between
// sessions. localStorage, not the URL: the URL is the system's addressing and a scratch choice
// between three candidates does not belong in it.
const KEY = "sv.dash.pick";
const PICKS = [
  { id: "a", label: "A · one track", Component: DashboardA },
  { id: "b", label: "B · the floor", Component: DashboardB },
  { id: "c", label: "C · the shelves", Component: DashboardC },
];

export default function DashboardSwitch() {
  const [pick, setPick] = useState(() => {
    try {
      const v = localStorage.getItem(KEY);
      if (PICKS.some((p) => p.id === v)) return v;
    } catch { /* private mode — the default is fine, it just will not be remembered */ }
    return "a";
  });
  const choose = (id) => {
    setPick(id);
    try { localStorage.setItem(KEY, id); } catch {}
  };
  const current = PICKS.find((p) => p.id === pick) || PICKS[0];
  const Current = current.Component;
  return (
    <div className="dashswitch">
      <div className="dashswitch__bar">
        {/* SAID OUT LOUD, because a surface that looks permanent and is not is how a candidate
            quietly becomes the thing nobody chose. */}
        <span className="dashswitch__says">three candidates, same data — pick one and the other two come out</span>
        <span className="dashswitch__picks">
          {PICKS.map((p) => (
            <button
              key={p.id}
              type="button"
              className={`dashswitch__pick${p.id === pick ? " is-on" : ""}`}
              onClick={() => choose(p.id)}
            >
              {p.label}
            </button>
          ))}
        </span>
      </div>
      {/* KEYED ON THE PICK, so switching remounts rather than handing the next one the previous
          one's state. These are three independent pages that happen to share a slot; letting
          React reconcile across them would let A's open fold decide what B draws. */}
      <div className="dashswitch__body" key={current.id}>
        <Current />
      </div>
    </div>
  );
}
