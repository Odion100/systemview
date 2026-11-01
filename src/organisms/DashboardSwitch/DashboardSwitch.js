import React, { useState } from "react";
// The component files directly: A ships an index.js and B and C do not, and importing a folder
// that happens to have one is a difference that only shows up at build time.
import DashboardA from "../DashboardA/DashboardA";
import DashboardB from "../DashboardB/DashboardB";
import DashboardC from "../DashboardC/DashboardC";
import { loadPages, savePages, loadPick, savePick, addPage, removePage, movePage } from "./pages";
import "./styles.scss";

// THE DASHBOARD'S PAGES.
//
// This was a three-way switch between candidate dashboards. It is becoming the page strip of a
// configurable surface, and his instruction was that it KEEPS THE LOOK: *"the switcher doesn't go
// away — it's going to look the same. It's just going to be like an X button on the tabs, plus a
// plus button up there."* So the pills are unchanged; each grows an `×`, and one `+` sits at the
// end of the row — not on the tabs.
//
// THE THREE CANDIDATES ARE NOW PAGES, not a choice. *"Let's not delete this current dashboard, so
// I can check them against each other piece by piece."* Each is a page holding one whole
// dashboard, still running its own code — so an extracted tile gets compared against the real
// thing rather than against a screenshot of it. They come off when he picks, and not before.
const LEGACY = { a: DashboardA, b: DashboardB, c: DashboardC };

export default function DashboardSwitch() {
  const [pages, setPages] = useState(() => loadPages());
  const [pick, setPick] = useState(() => loadPick(loadPages()));
  const [drag, setDrag] = useState("");
  // WHY THE LAST CLOSE REFUSED. `removePage` answers with a reason rather than silently doing
  // nothing, and a control that appears to do nothing is the thing worth avoiding — even though
  // the `×` is also hidden at one page, because a rule enforced only where it is painted is one
  // refactor from being gone.
  const [refused, setRefused] = useState("");

  const write = (next, nextPick) => {
    setPages(savePages(next));
    if (nextPick && nextPick !== pick) setPick(savePick(nextPick));
  };
  const choose = (id) => setPick(savePick(id));
  const add = () => {
    const { pages: next, pick: landed } = addPage(pages);
    write(next, landed);
    setRefused("");
  };
  const close = (id) => {
    const out = removePage(pages, id, pick);
    if (out.refused) return setRefused(out.refused);
    setRefused("");
    return write(out.pages, out.pick);
  };

  const page = pages.find((p) => p.id === pick) || pages[0];
  const Legacy = page && page.legacy ? LEGACY[page.legacy] : null;
  const only = pages.length <= 1;

  return (
    <div className="dashswitch">
      <div className="dashswitch__bar">
        <span className="dashswitch__says">
          {refused || "three candidates, same data — and a page of your own"}
        </span>
        <span className="dashswitch__picks">
          {pages.map((p) => (
            // DRAG TO REORDER, the same shape the centre tab strip already uses: the tab is the
            // handle, dropping on a tab puts you where IT sat. Copied rather than invented, so
            // there is one way to reorder a strip in this window.
            <span
              key={p.id}
              className={`dashswitch__tab${p.id === pick ? " is-on" : ""}${drag === p.id ? " is-dragging" : ""}`}
              draggable
              onDragStart={(e) => {
                setDrag(p.id);
                e.dataTransfer.effectAllowed = "move";
                e.dataTransfer.setData("text/sv-dashpage", p.id);
              }}
              onDragEnd={() => setDrag("")}
              onDragOver={(e) => {
                if (e.dataTransfer.types.includes("text/sv-dashpage")) e.preventDefault();
              }}
              onDrop={(e) => {
                const id = e.dataTransfer.getData("text/sv-dashpage");
                if (!id || id === p.id) return;
                e.preventDefault();
                write(movePage(pages, id, p.id));
              }}
            >
              <button type="button" className="dashswitch__pick" onClick={() => choose(p.id)}>
                {p.label}
              </button>
              {/* NOT SHOWN AT ONE PAGE. A strip that lets you close the last page leaves a
                  surface with nothing on it and no way back. */}
              {only ? null : (
                <button
                  type="button"
                  className="dashswitch__close"
                  title={`Close ${p.label}`}
                  aria-label={`Close ${p.label}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    close(p.id);
                  }}
                >
                  ×
                </button>
              )}
            </span>
          ))}
          {/* ONE +, AT THE END OF THE ROW — his words, and not on the tabs. */}
          <button type="button" className="dashswitch__add" title="Add a page" aria-label="Add a page" onClick={add}>
            +
          </button>
        </span>
      </div>
      {/* KEYED ON THE PAGE, so switching remounts rather than handing the next one the previous
          one's state. Two pages that happen to share a slot are not one component with changing
          props; letting React reconcile across them would let one page's open fold decide what
          the next draws. */}
      <div className="dashswitch__body" key={page ? page.id : "none"}>
        {Legacy ? (
          <Legacy />
        ) : (
          // AN EMPTY PAGE SAYS IT IS EMPTY AND SAYS WHAT TO DO. A blank panel reads as something
          // that failed to load; this is a page he just made and has not put anything on.
          <div className="dashswitch__empty">
            <b>{page ? page.label : "Nothing here"}</b>
            <span>Nothing on this page yet. Tiles land here as the extraction comes in.</span>
          </div>
        )}
      </div>
    </div>
  );
}
