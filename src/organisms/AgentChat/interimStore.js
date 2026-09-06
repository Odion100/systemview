import React, { useEffect, useState } from "react";

// HIS REPORT: *"the recorder feels much slower… you can feel the strain."* It was not the CSS.
//
// `interim` — the words as you say them — lived in AgentChat's own state, and the speech API fires
// a result for every few syllables. So every fragment of every sentence re-rendered the whole chat
// panel: the message list, the feed, the panels, the ~3,000-node tree autobot measured. The words
// land in two small leaves of that tree, and nothing else on screen depends on them.
//
// So the live transcript stops being React state and becomes a tiny store the LEAVES subscribe to.
// Speaking now repaints the line you are speaking into, and nothing else. The panel re-renders when
// recording starts and when it stops — two renders per dictation instead of one per syllable.
export function createInterimStore() {
  let value = "";
  const subs = new Set();
  return {
    get: () => value,
    set: (next) => {
      const v = next == null ? "" : String(next);
      if (v === value) return; // the API repeats itself constantly; an identical word is not news
      value = v;
      subs.forEach((f) => f(v));
    },
    subscribe: (f) => {
      subs.add(f);
      return () => subs.delete(f);
    },
  };
}

function useInterim(store) {
  const [v, setV] = useState(() => store.get());
  useEffect(() => {
    setV(store.get()); // whatever was said between render and subscribe
    return store.subscribe(setV);
  }, [store]);
  return v;
}

// The line under the composer while the mic is open.
export const InterimLine = ({ store, fallback = "listening…" }) => {
  const v = useInterim(store);
  return <>{v || fallback}</>;
};

// The big mic overlay's text. IT OWNS ITS OWN SCROLL PINNING — the ref callback has to run when the
// words change, and the words no longer change the parent, so the whole element lives here.
export const MicText = ({ store, input, className }) => {
  const v = useInterim(store);
  return (
    <div
      className={className}
      ref={(el) => {
        if (el) el.scrollTop = el.scrollHeight;
      }}
    >
      {input}
      {input && v ? " " : ""}
      <i>{v}</i>
      {!input && !v && "listening…"}
    </div>
  );
};
