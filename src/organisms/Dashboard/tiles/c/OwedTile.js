import React, { useState } from "react";
import { groupOwed } from "../../../AgentChat/owed";
import { Ctx, open, useShelves } from "./surface";

// ═══ WHAT IS OWED ══════════════════════════════════════════════════════════════════════════════
//
// THE FIRST THING ON THE PAGE, and the reason the page exists: presses in one column, outstanding
// work in the other, each one a SENTENCE somebody wrote about a specific document. "31 documents"
// is a fact about the folder; "the proof is in the file — one press from resolved" is a fact about
// his afternoon.
//
// IT PRESSES NOTHING. Every row OPENS ITS DOCUMENT, because that is where the control lives: the
// facilitation ladder for an approval, the clock's keep-or-let-go on a report's leaf, the
// objective's own block. A list that signs for you is a list that decides for you.
//
// AND IT KNOWS NOTHING ABOUT THE FILTER. The head's press narrows `data.owed` on the surface, to
// EXACTLY the obligations the pressed segment counted — his correction: *"of course I want to
// filter by obligations."* Re-deriving the narrowed list from the documents that survived would
// hand a document with one approval and three blocked objectives back with all four, which is
// not what the number said. So this tile reads the list it is given and is narrowed for free,
// which is what lets the head sit on another page and still mean something here.
//
// The only trace of the filter is the sentence an empty column says: "none of these are in what
// you pressed" is a different answer from "nothing outstanding", and reading one as the other is
// the whole failure this surface exists to stop.

/**
 * ONE OWED CARD PER DOCUMENT — a sentence somebody wrote about it, and a door to it.
 *
 * An arc with four obligations was four cards in a column of nine, so the column read as nine
 * places to go when it was four. The card carries the strongest one and opens into the rest.
 */
const Owed = ({ item, shown, onToggle }) => {
  const one = !item.n || item.n === 1;
  return (
    <div className={`dbc-owed__g${shown ? " is-open" : ""}`}>
      <button
        type="button"
        className={`dbc-owed dbc-owed--${item.kind} is-${item.why}`}
        aria-expanded={one ? undefined : shown}
        onClick={() => (one ? open(item) : onToggle())}
      >
        <span className="dbc-owed__who">
          {item.project ? <em>{item.project}</em> : null}
          <b>{item.id}</b>
          <i>{item.why}</i>
        </span>
        <span className="dbc-owed__says">{item.says}</span>
        {item.tail ? <span className="dbc-owed__tail">{item.tail}</span> : null}
        {one ? null : <span className="dbc-owed__n">and {item.n - 1} more on this document ⌄</span>}
      </button>
      {one || !shown ? null : (
        <div className="dbc-owed__items">
          {item.items.map((o) => (
            <button type="button" key={o.key} className={`dbc-owed__item is-${o.why}`} onClick={() => open(o)}>
              <i>{o.why}</i>
              <span>{o.says}</span>
              {o.tail ? <em>{o.tail}</em> : null}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default function OwedTileC({ data }) {
  // THE SURFACE'S OWN LIST WHEN THERE IS ONE — already narrowed to the pressed segment's rows.
  // The tile's own derivation is the standalone fallback, and it is the same `owedFrom` either
  // way, so the two paths cannot disagree about what is owed.
  const d = useShelves(data);
  const owed = (data && data.owed) || d.owed;
  const filtering = !!(data && data.filtering);
  // WHICH DOCUMENTS ARE UNFOLDED. Nothing is open by default: a column that opens every document
  // is the table this is not.
  const [shown, setShown] = useState({});
  const toggle = (key) => setShown((f) => ({ ...f, [key]: !f[key] }));

  if (!owed.press.length && !owed.work.length) return null;

  // FOLDED AFTER FILTERING, not before — the surface narrows the obligations and the fold runs
  // over what survived, or a document would keep a count of things the filter had taken away.
  const press = groupOwed(owed.press);
  const work = groupOwed(owed.work);

  return (
    <Ctx>
      <section className="dbc-owes">
        <div className="dbc-owes__col">
          <h2>
            <b>⚑</b> press — your signature finishes it
          </h2>
          {press.length ? (
            press.map((p) => <Owed key={p.key} item={p} shown={!!shown[p.key]} onToggle={() => toggle(p.key)} />)
          ) : (
            <p className="dbc-owes__none">
              {filtering ? "none of these are in what you pressed" : "nothing waiting on a verdict of yours"}
            </p>
          )}
        </div>
        <div className="dbc-owes__col">
          <h2>outstanding — nobody can press it away</h2>
          {work.length ? (
            work.map((p) => <Owed key={p.key} item={p} shown={!!shown[p.key]} onToggle={() => toggle(p.key)} />)
          ) : (
            <p className="dbc-owes__none">{filtering ? "none of these are in what you pressed" : "nothing outstanding"}</p>
          )}
        </div>
      </section>
    </Ctx>
  );
}
