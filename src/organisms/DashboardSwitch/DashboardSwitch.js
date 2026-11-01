import React, { useState } from "react";
import TileStack from "../Dashboard/TileStack";
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
// EVERY PAGE IS A STACK OF TILES — there is no second kind. For a while three pages rendered a
// whole candidate dashboard apiece so the extracted tiles could be checked against the real thing
// piece by piece; the candidates are retired and that comparison lives in `equivalence.test.js`,
// which still mounts the original components and holds the tiles to them node for node. One
// render path here, and the check it justified did not go with it.

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
  const only = pages.length <= 1;

  return (
    <div className="dashswitch">
      <div className="dashswitch__bar">
        <span className="dashswitch__says">
          {refused || "every page is yours — add, reorder, swap a block for another version of it"}
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
        {page ? (
          <TileStack
            page={page}
            onChange={(next) => write(pages.map((p) => (p.id === next.id ? next : p)))}
          />
        ) : null}
      </div>
    </div>
  );
}
