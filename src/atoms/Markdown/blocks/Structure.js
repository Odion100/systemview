import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import { useMarkdownWrite } from "../context";

// RFC-025 §4.4 — structure blocks. These wrap markdown (container directives), so their children are
// ordinary rendered markdown — headings, code, tables, other blocks.

//   :::callout{type=warn}
//   This path is **untested**.
//   :::
const ICONS = { info: "ℹ", warn: "⚠", danger: "✕", success: "✓", note: "ℹ" };
export const Callout = ({ attrs = {}, children }) => {
  const type = ICONS[attrs.type] ? attrs.type : "info";
  return (
    <div className={`md-callout md-callout--${type}`}>
      <span className="md-callout__icon">{ICONS[type]}</span>
      <div className="md-callout__body">{children}</div>
    </div>
  );
};

//   :::details{summary="Why this is bounded"}
//   …
//   :::
// Deliberately NOT <details>/<summary>: the native element can't be styled consistently across the
// light document and the dark one, and we want the same open/closed affordance the rest of the UI uses.
export const Details = ({ attrs = {}, children }) => {
  const [open, setOpen] = useState(attrs.open === "true" || attrs.open === "");
  return (
    <div className={`md-details${open ? " md-details--open" : ""}`}>
      <button type="button" className="md-details__head" onClick={() => setOpen((o) => !o)}>
        <span className="md-details__caret">{open ? "▾" : "▸"}</span>
        {attrs.summary || "Details"}
      </button>
      {open ? <div className="md-details__body">{children}</div> : null}
    </div>
  );
};

//   ::::columns{split=60}
//   :::col
//   left column markdown
//   :::
//   :::col
//   right column markdown
//   :::
//   ::::
// A lead sitting NEXT TO the thing it leads into — the same instinct as a lead pane beside its
// evidence, but inside one document. Note the colon count: the outer block takes one MORE colon than
// the `col`s inside it (that's how container directives nest).
// RESIZABLE (RFC-026): drag the boundary between the two columns; on release the split writes back
// into the source as `split=NN` — the document is the state, same as a slider or a question. On a
// read-only surface the drag still works, it just doesn't persist. Double-click resets to 50/50.
export const Columns = ({ attrs = {}, line, children }) => {
  const kids = React.Children.toArray(children).filter((k) => React.isValidElement(k));
  const { editable, setAttr } = useMarkdownWrite();
  const [split, setSplit] = useState(() => Number(attrs.split) || 50);
  useEffect(() => {
    setSplit(Number(attrs.split) || 50);
  }, [attrs.split]);
  const ref = useRef(null);

  const clamp = (v) => Math.min(85, Math.max(15, v));
  const pctAt = (clientX) => {
    const r = ref.current.getBoundingClientRect();
    return clamp(((clientX - r.left) / r.width) * 100);
  };
  const onDown = (e) => {
    e.preventDefault();
    const move = (ev) => ref.current && setSplit(pctAt(ev.clientX));
    // Commit ON RELEASE, never per-pixel — a drag must not write the file fifty times.
    const up = (ev) => {
      window.removeEventListener("mousemove", move);
      window.removeEventListener("mouseup", up);
      if (!ref.current) return;
      const v = Math.round(pctAt(ev.clientX));
      setSplit(v);
      if (editable && setAttr) setAttr(line, "split", v === 50 ? null : v);
    };
    window.addEventListener("mousemove", move);
    window.addEventListener("mouseup", up);
  };
  const reset = () => {
    setSplit(50);
    if (editable && setAttr) setAttr(line, "split", null);
  };

  // minmax(0, …) everywhere: a bare `Nfr` track has an AUTO minimum and refuses to shrink below
  // its content, so one wide embed would make the whole document scroll sideways.
  if (kids.length === 2)
    return (
      <div
        ref={ref}
        className="md-columns md-columns--resizable"
        style={{
          gridTemplateColumns: `minmax(0, ${split}fr) 18px minmax(0, ${100 - split}fr)`,
        }}
      >
        {kids[0]}
        <div
          className="md-columns__divider"
          title="Drag to resize · double-click resets — the split saves into the document"
          onMouseDown={onDown}
          onDoubleClick={reset}
        />
        {kids[1]}
      </div>
    );

  const authored = Number(attrs.split);
  return (
    <div
      className="md-columns"
      style={
        authored
          ? { gridTemplateColumns: `minmax(0, ${authored}fr) minmax(0, ${100 - authored}fr)` }
          : undefined
      }
    >
      {kids}
    </div>
  );
};

export const Col = ({ children }) => <div className="md-columns__col">{children}</div>;

// ── tabs ────────────────────────────────────────────────────────────────────────────────────────
//   ::::tabs
//   :::tab{label="CLI"}
//   …
//   :::
//   :::tab{label="UI"}
//   …
//   :::
//   ::::
// NOTE THE COLON COUNT: a container directive nests by giving the OUTER one more colons. Four for
// `tabs`, three for each `tab`.
//
// A tab can't be read from above (its label lives in a child's props, behind the block dispatch), so
// each Tab REGISTERS itself with the parent on mount and the bar is built from that registry. The
// registration is keyed by document order, so it survives re-renders.
const TabsCtx = createContext(null);

export const Tabs = ({ children }) => {
  const [labels, setLabels] = useState([]);
  const [active, setActive] = useState(0);
  const ctx = useMemo(
    () => ({
      register: (index, label) =>
        setLabels((cur) => {
          if (cur[index] === label) return cur;
          const next = [...cur];
          next[index] = label;
          return next;
        }),
      active,
    }),
    [active]
  );
  // Children arrive in document order; index by position so a tab knows which slot it owns.
  const kids = React.Children.toArray(children).filter((k) => React.isValidElement(k));
  return (
    <TabsCtx.Provider value={ctx}>
      <div className="md-tabs">
        <div className="md-tabs__bar" role="tablist">
          {labels.map((l, i) => (
            <button
              key={i}
              type="button"
              role="tab"
              aria-selected={i === active}
              className={`md-tabs__tab${i === active ? " md-tabs__tab--on" : ""}`}
              onClick={() => setActive(i)}
            >
              {l || `Tab ${i + 1}`}
            </button>
          ))}
        </div>
        <div className="md-tabs__body">
          {kids.map((k, i) => (
            <TabSlot key={i} index={i}>
              {k}
            </TabSlot>
          ))}
        </div>
      </div>
    </TabsCtx.Provider>
  );
};

// Passes its position down so the Tab inside can register under the right index.
const SlotCtx = createContext(0);
const TabSlot = ({ index, children }) => <SlotCtx.Provider value={index}>{children}</SlotCtx.Provider>;

export const Tab = ({ attrs = {}, children }) => {
  const ctx = useContext(TabsCtx);
  const index = useContext(SlotCtx);
  const label = attrs.label || attrs.title || "";
  useEffect(() => {
    if (ctx) ctx.register(index, label);
  }, [ctx, index, label]);
  // Outside a ::::tabs wrapper a lone :::tab is just its content — degrade, don't disappear.
  if (!ctx) return <div className="md-tabs__panel">{children}</div>;
  return ctx.active === index ? <div className="md-tabs__panel">{children}</div> : null;
};

// ── carousel ────────────────────────────────────────────────────────────────────────────────────
//   ::::carousel
//   :::slide{label="Throughput"}
//   ::chart{report=throughput range=1h}
//   :::
//   :::slide{label="Topology"}
//   ::topology
//   :::
//   ::::
// One item at a time with prev/next and dots — the story gallery's filmstrip idea, inside a document.
// Slides register their labels upward exactly like tabs do (a parent can't read a child's props
// through the block dispatch), and only the active slide is mounted, so an off-screen chart or test
// isn't fetching in the background.
const CarouselCtx = createContext(null);
const SlideSlot = createContext(0);

export const Carousel = ({ attrs = {}, children }) => {
  const [labels, setLabels] = useState([]);
  const [at, setAt] = useState(0);
  const kids = React.Children.toArray(children).filter((k) => React.isValidElement(k));
  const count = kids.length;
  const go = (d) => setAt((i) => (count ? (i + d + count) % count : 0));
  const ctx = useMemo(
    () => ({
      register: (index, label) =>
        setLabels((cur) => {
          if (cur[index] === label) return cur;
          const next = [...cur];
          next[index] = label;
          return next;
        }),
      active: at,
    }),
    [at]
  );
  return (
    <CarouselCtx.Provider value={ctx}>
      <div className="md-carousel">
        <div className="md-carousel__bar">
          <button type="button" className="md-carousel__nav" onClick={() => go(-1)} aria-label="previous">
            ‹
          </button>
          <span className="md-carousel__label">{labels[at] || attrs.label || `${at + 1} / ${count}`}</span>
          <span className="md-carousel__dots">
            {kids.map((_, i) => (
              <button
                key={i}
                type="button"
                className={`md-carousel__dot${i === at ? " md-carousel__dot--on" : ""}`}
                onClick={() => setAt(i)}
                title={labels[i] || `slide ${i + 1}`}
              />
            ))}
          </span>
          <button type="button" className="md-carousel__nav" onClick={() => go(1)} aria-label="next">
            ›
          </button>
        </div>
        <div className="md-carousel__stage">
          {kids.map((k, i) => (
            <SlideSlot.Provider key={i} value={i}>
              {k}
            </SlideSlot.Provider>
          ))}
        </div>
      </div>
    </CarouselCtx.Provider>
  );
};

export const Slide = ({ attrs = {}, children }) => {
  const ctx = useContext(CarouselCtx);
  const index = useContext(SlideSlot);
  const label = attrs.label || attrs.title || "";
  useEffect(() => {
    if (ctx) ctx.register(index, label);
  }, [ctx, index, label]);
  if (!ctx) return <div className="md-carousel__slide">{children}</div>;
  return ctx.active === index ? <div className="md-carousel__slide">{children}</div> : null;
};
