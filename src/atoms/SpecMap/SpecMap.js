import React from "react";
import "./styles.scss";

// THE SPEC MAP — one drawing of a whole living spec: the arc on top, fanning into its OBJECTIVES,
// each objective fanning into the RFCs that serve it. `::progress` in a real arc feeds it the
// document's own objectives and the registry's attached RFCs.
//
//   arc        — { id, station? }
//   objectives — [{ id, label?, state?, because?, count?, plans: [{ id, title?, station?, met?, total?, project?, path? }] }]
//   onOpen(plan)      — optional; "open the document" on a plan chip's menu
//   onJump(objective) — optional; "jump to its block" on an objective's menu
//   onRun(target)     — optional; the runner. NOT WIRED YET anywhere (his call, 2026-10-28): the
//                       menu line exists disabled, the machinery below is ready — when a handler
//                       arrives, pressing run marks the node `is-running` (the border says so)
//                       until the promise settles. Set up as if we could run; the runner comes later.
//   onAttach(oi)      — optional; offers "+ attach a plan" on unplanned objectives
//
// THE NODES SHOW THEIR STATE (his call, same night): objectives wear their written state word —
// open, doing, done, blocked — and chips wear their derived station. No state colouring; he
// directs colours later. A CLICK SUMMONS A MENU — a floating context-menu shape at the node,
// regular click; the click itself never acts, it only offers.
//
// THE LOOK AND THE SIZE ARE THE PAGE'S within a row: 240px columns, the page's vertical rhythm.
// More objectives than fit WRAP downward; between rows the spine runs longer than a row's own
// footprint so a junction never lands beside a chip.
const COLW = 240;
const ARCY = 50; // the fan's origin under the arc chip — the page's geometry
const OBJ0 = 96; // first objective band top
const PLAN0 = 196; // first plan band top — the page's own depth, untouched
const ROWH = 200; // between-row spacing — longer than the page's 154 so junctions sit in clear air
const H0 = 250; // the page's single-row stage height

const SpecMap = ({
  arc = {},
  objectives = [],
  onOpen,
  onJump,
  onRun,
  onAttach,
  className = "",
}) => {
  // how many page-true columns the pane affords — measured, and re-measured when the pane moves
  const scrollRef = React.useRef(null);
  const stageRef = React.useRef(null);
  const [paneW, setPaneW] = React.useState(0);
  React.useLayoutEffect(() => {
    const el = scrollRef.current;
    if (!el || typeof ResizeObserver === "undefined") return undefined;
    const ro = new ResizeObserver(() => setPaneW(el.clientWidth));
    ro.observe(el);
    setPaneW(el.clientWidth);
    return () => ro.disconnect();
  }, []);

  // THE MENU — one open at a time, anchored where the pressed node sits on the stage. A click
  // outside or Escape closes it; pressing the same node again closes it too.
  const [menu, setMenu] = React.useState(null); // { kind, x, y, key, data }
  React.useEffect(() => {
    if (!menu) return undefined;
    const close = (e) => {
      if (e.type === "keydown" && e.key !== "Escape") return;
      if (e.type === "mousedown" && e.target.closest && e.target.closest(".sv-spec__menu")) return;
      setMenu(null);
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", close);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", close);
    };
  }, [menu]);

  const summon = (e, kind, key, data) => {
    if (menu && menu.key === key) return setMenu(null);
    const stage = stageRef.current.getBoundingClientRect();
    const node = e.currentTarget.getBoundingClientRect();
    return setMenu({
      kind,
      key,
      data,
      x: node.left - stage.left + node.width / 2,
      y: node.bottom - stage.top + 6,
    });
  };

  // RUN — ready, not wired: with no onRun the line renders disabled and honest. With one, the
  // node wears is-running (dashed border, quiet pulse) until the handler's promise settles.
  const [running, setRunning] = React.useState(() => new Set());
  const run = (key, target) => {
    if (!onRun) return;
    setMenu(null);
    setRunning((s) => new Set(s).add(key));
    Promise.resolve(onRun(target)).finally(() =>
      setRunning((s) => {
        const next = new Set(s);
        next.delete(key);
        return next;
      })
    );
  };

  const n = Math.max(objectives.length, 1);
  const perRow = Math.max(1, Math.floor((paneW || n * COLW) / COLW));
  const cols = Math.min(n, perRow);
  const rowCount = Math.ceil(n / perRow);
  const W = cols * COLW;
  const H = H0 + (rowCount - 1) * ROWH;
  const col = (ci) => COLW * (ci + 0.5);
  const planX = (ci, pi, total) => {
    const gap = Math.min(92, (COLW - 40) / Math.max(total, 1));
    return col(ci) + (pi - (total - 1) / 2) * gap;
  };
  const mid = W / 2;

  const rows = [];
  for (let r = 0; r < rowCount; r += 1) rows.push(objectives.slice(r * perRow, (r + 1) * perRow));

  const menuBody = () => {
    if (!menu) return null;
    const { kind, data } = menu;
    const item = (label, handler, title) => (
      <button
        type="button"
        className="sv-spec__menu-item"
        disabled={!handler}
        title={title || ""}
        onClick={handler ? () => { setMenu(null); handler(); } : undefined}
      >
        {label}
      </button>
    );
    if (kind === "arc") {
      return (
        <>
          <div className="sv-spec__menu-head">
            <code>{data.id}</code> <span>{data.station || "draft"}</span>
          </div>
          {onRun
            ? item("run specs", () => run(menu.key, { kind: "arc", id: data.id }))
            : item("run specs", null, "the runner isn't wired yet")}
        </>
      );
    }
    if (kind === "obj") {
      const o = data;
      return (
        <>
          <div className="sv-spec__menu-head">
            <code>{o.id}</code> <span>{o.state || "open"}</span>
          </div>
          {o.because ? <div className="sv-spec__menu-why">{o.because}</div> : null}
          {item("jump to its block", onJump ? () => onJump(o) : null, onJump ? "" : "no document to jump in")}
          {onRun
            ? item("run specs", () => run(menu.key, { kind: "objective", id: o.id }))
            : item("run specs", null, "the runner isn't wired yet")}
        </>
      );
    }
    const p = data;
    return (
      <>
        <div className="sv-spec__menu-head">
          <code>{p.id}</code> <span>{p.station || "draft"}</span>
          {p.total ? (
            <span className="sv-spec__menu-claims">
              {p.met || 0}/{p.total} claims met
            </span>
          ) : null}
        </div>
        {item("open the document", onOpen ? () => onOpen(p) : null, onOpen ? "" : "no opener on this surface")}
        {onRun
          ? item("run specs", () => run(menu.key, { kind: "plan", id: p.id }))
          : item("run specs", null, "the runner isn't wired yet")}
      </>
    );
  };

  return (
    <div className={`sv-spec${className ? ` ${className}` : ""}`}>
      <div className="sv-spec__scroll" ref={scrollRef}>
        <div className="sv-spec__stage" ref={stageRef} style={{ width: `${W}px`, height: `${H}px` }}>
          <svg
            className="sv-spec__wire"
            viewBox={`0 0 ${W} ${H}`}
            preserveAspectRatio="none"
            aria-hidden="true"
          >
            {rowCount > 1 ? (
              <path
                className="sv-spec__link"
                d={`M ${mid} ${ARCY} L ${mid} ${OBJ0 + (rowCount - 1) * ROWH - 46}`}
              />
            ) : null}
            {rows.map((row, r) => {
              const objY = OBJ0 + r * ROWH;
              const planY = PLAN0 + r * ROWH;
              return row.map((o, ci) => (
                <g key={o.id}>
                  {(o.plans || []).map((p, pi) => {
                    const x = planX(ci, pi, o.plans.length);
                    return (
                      <path
                        key={p.id}
                        className="sv-spec__link"
                        d={`M ${x} ${planY} C ${x} ${planY - 22} ${col(ci)} ${planY - 24} ${col(ci)} ${planY - 46}`}
                      />
                    );
                  })}
                  <path
                    className="sv-spec__link"
                    d={`M ${col(ci)} ${objY} C ${col(ci)} ${objY - 22} ${mid} ${objY - 24} ${mid} ${objY - 46}`}
                  />
                </g>
              ));
            })}
          </svg>

          <div className="sv-spec__arcrow">
            <button
              type="button"
              className={`sv-spec__arc${running.has("arc") ? " is-running" : ""}`}
              onClick={(e) => summon(e, "arc", "arc", arc)}
            >
              <span className="sv-spec__kind">arc</span>
              <code>{arc.id || "arc"}</code>
              <span className={`sv-spec__station is-${arc.station || "draft"}`}>
                {arc.station === "inProgress" ? "progress" : arc.station || "draft"}
              </span>
            </button>
          </div>

          {rows.map((row, r) => (
            <React.Fragment key={`row-${row[0] ? row[0].id : r}`}>
              <div
                className="sv-spec__objrow"
                style={{ top: `${OBJ0 + r * ROWH}px`, gridTemplateColumns: `repeat(${cols}, 1fr)` }}
              >
                {row.map((o) => (
                  <div className="sv-spec__objcell" key={o.id}>
                    <button
                      type="button"
                      className={`sv-spec__obj${(o.plans || []).length ? "" : " is-unplanned"}${running.has(`obj-${o.id}`) ? " is-running" : ""}`}
                      onClick={(e) => summon(e, "obj", `obj-${o.id}`, o)}
                    >
                      <span className="sv-spec__objtop">
                        <span className="sv-spec__objkind">objective</span>
                        <span className="sv-spec__objid">{o.id}</span>
                        <span
                          className={`sv-spec__objstate is-${o.state || "open"}`}
                          title={o.because || ""}
                        >
                          {/* the written state is `doing` (RFC-072's ring); the card SAYS progress
                              (his call, 2026-10-28) — a display word, never a second state */}
                          {(o.state || "open") === "doing" ? "progress" : o.state || "open"}
                        </span>
                      </span>
                      {o.label ? <span className="sv-spec__objwhy">{o.label}</span> : null}
                    </button>
                  </div>
                ))}
              </div>

              <div
                className="sv-spec__planrow"
                style={{ top: `${PLAN0 + r * ROWH}px`, gridTemplateColumns: `repeat(${cols}, 1fr)` }}
              >
                {row.map((o, ci) => {
                  const oi = r * perRow + ci;
                  return (
                    <div className="sv-spec__plancell" key={o.id}>
                      {(o.plans || []).map((p) => (
                        <button
                          type="button"
                          key={p.id}
                          className={`sv-spec__plan${running.has(`plan-${p.id}`) ? " is-running" : ""}`}
                          title={p.title || ""}
                          onClick={(e) => summon(e, "plan", `plan-${p.id}`, p)}
                        >
                          <span className="sv-spec__plan-top">
                            <span className="sv-spec__plan-id">{p.id}</span>
                            <span className={`sv-spec__plan-st is-${p.station || "draft"}`}>
                              {p.station || "draft"}
                            </span>
                          </span>
                          {p.total ? (
                            <span className="sv-spec__plan-claims">
                              claims {p.met || 0}/{p.total}
                            </span>
                          ) : null}
                        </button>
                      ))}
                      {!(o.plans || []).length && onAttach ? (
                        <button type="button" className="sv-spec__attach" onClick={() => onAttach(oi)}>
                          + attach a plan
                        </button>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            </React.Fragment>
          ))}

          {menu ? (
            <div className="sv-spec__menu" style={{ left: `${menu.x}px`, top: `${menu.y}px` }}>
              {menuBody()}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
};

export default SpecMap;
