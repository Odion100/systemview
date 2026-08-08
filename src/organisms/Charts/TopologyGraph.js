import React, { useEffect, useRef, useState } from "react";
import { MAP_HUES } from "./hues";
import "./styles.scss";

// The who-calls-whom graph — extracted whole from pages/Reports/Reports.js (RFC-025 §4.3), no
// behaviour change: draggable nodes with a persisted layout, per-caller hues, cards that expand into
// the methods called on them, and edges that split per method near an expanded card.
import { fmtInt, fmtMs } from "./format";

// Canvas height for the graph — travels with the component that draws it.
const TOPO_H = 520;

// "not real data yet" marker, kept with the component that uses it.
function Mock({ children }) {
  return <span className="report-mock" title="Mock data — not yet wired to live traces">{children}</span>;
}

// Half-extents of a node card, used to trim edge lines at the card's border so arrowheads land
// ON the box instead of vanishing under it.
const TOPO_HW = 92;
const TOPO_HH = 36;

// Keep a node inside the canvas. Positions are CENTRE px, so the usable band is inset by the card's
// half-width/height — a saved layout from a WIDE canvas (the Stats page) would otherwise drop nodes
// off the edge of a NARROW one (the same graph embedded in a document column).
function clampPos(p, w, h = TOPO_H) {
  const padX = Math.min(TOPO_HW + 8, Math.max(24, w / 2 - 4));
  const padY = TOPO_HH + 6;
  return {
    x: Math.min(Math.max(p.x, padX), Math.max(padX, w - padX)),
    y: Math.min(Math.max(p.y, padY), Math.max(padY, h - padY)),
  };
}

// Clamping can push two nodes onto the same boundary, where they'd sit on top of each other. Nudge
// any pair that ends up overlapping — vertically first, since the canvas is wider than it is tall.
function separate(map, w, h = TOPO_H) {
  const ids = Object.keys(map);
  const out = { ...map };
  for (let i = 0; i < ids.length; i++) {
    for (let j = i + 1; j < ids.length; j++) {
      const a = out[ids[i]];
      const b = out[ids[j]];
      if (!a || !b) continue;
      if (Math.abs(a.x - b.x) < TOPO_HW * 2 && Math.abs(a.y - b.y) < TOPO_HH * 2 + 10) {
        const down = b.y + TOPO_HH * 2 + 14;
        out[ids[j]] = clampPos(
          down < h - TOPO_HH ? { x: b.x, y: down } : { x: b.x, y: b.y - (TOPO_HH * 2 + 14) },
          w,
          h
        );
      }
    }
  }
  return out;
}

function TopologyGraph({ nodes, edges, projectCode, mock = false, variant = "" }) {
  const canvasRef = useRef(null);
  // The page and an embedded copy have very different widths, so they keep SEPARATE layouts —
  // dragging a node in a document must not squash the arrangement on the Stats page.
  const storageKey = `sv.topo.${projectCode}${variant ? `.${variant}` : ""}`;
  const [pos, setPos] = useState({}); // serviceId → {x,y} CENTER, px within the canvas
  const [drag, setDrag] = useState(null);
  const movedRef = useRef(false);
  const [sel, setSel] = useState(null); // {type:"edge", i} | {type:"node", id}
  // Cards EXPAND DOWN on click, listing the methods other services call on them; edge lines split
  // near an expanded card into one branch per method.
  const [expanded, setExpanded] = useState(() => new Set());
  const toggleExpand = (id) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  // Seed layout: saved arrangement wins; otherwise hub-and-spoke — the most called-INTO service
  // (Profiles in buAPI) sits center, the rest ring around it. Drag anywhere; the layout persists.
  const ids = nodes.map((n) => n.serviceId).join(",");
  useEffect(() => {
    const w = (canvasRef.current && canvasRef.current.clientWidth) || 900;
    let saved = {};
    try { saved = JSON.parse(localStorage.getItem(storageKey)) || {}; } catch { saved = {}; }
    const inbound = {};
    edges.forEach((e) => { inbound[e.to] = (inbound[e.to] || 0) + 1; });
    const order = [...nodes].sort((a, b) => (inbound[b.serviceId] || 0) - (inbound[a.serviceId] || 0));
    const hub = order.length > 2 && (inbound[order[0]?.serviceId] || 0) > 1 ? order[0].serviceId : null;
    const ring = order.filter((n) => n.serviceId !== hub);
    const next = {};
    order.forEach((n) => {
      // A saved position is clamped into THIS canvas — a layout saved when the pane was wider (or
      // saved by the full-width page) must not leave a node stranded off-screen.
      if (saved[n.serviceId]) { next[n.serviceId] = clampPos(saved[n.serviceId], w); return; }
      if (n.serviceId === hub) { next[n.serviceId] = { x: w / 2, y: TOPO_H / 2 }; return; }
      const i = ring.findIndex((r) => r.serviceId === n.serviceId);
      const a = (i / Math.max(1, ring.length)) * 2 * Math.PI - Math.PI / 2;
      next[n.serviceId] = {
        x: w / 2 + Math.cos(a) * w * 0.32,
        y: TOPO_H / 2 + Math.sin(a) * TOPO_H * 0.34,
      };
    });
    setPos(separate(next, w));
  }, [ids, projectCode]); // eslint-disable-line react-hooks/exhaustive-deps

  // The canvas resizes when a side panel collapses or a pane is dragged wider/narrower. Re-clamp so
  // nodes can't be left outside the new bounds (which is how one ends up unreachable).
  useEffect(() => {
    const el = canvasRef.current;
    if (!el || typeof ResizeObserver === "undefined") return undefined;
    const ro = new ResizeObserver(() => {
      const w = el.clientWidth || 900;
      setPos((prev) => {
        let changed = false;
        const next = {};
        Object.entries(prev).forEach(([id, p]) => {
          const c = clampPos(p, w);
          if (c.x !== p.x || c.y !== p.y) changed = true;
          next[id] = c;
        });
        return changed ? separate(next, w) : prev;
      });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    if (!drag) return undefined;
    const move = (e) => {
      movedRef.current = true;
      const rect = canvasRef.current.getBoundingClientRect();
      const x = Math.min(rect.width - 40, Math.max(40, e.clientX - rect.left + drag.dx));
      const y = Math.min(TOPO_H - 28, Math.max(28, e.clientY - rect.top + drag.dy));
      setPos((p) => ({ ...p, [drag.id]: { x, y } }));
    };
    const up = () => {
      setPos((p) => {
        try { localStorage.setItem(storageKey, JSON.stringify(p)); } catch { /* full/blocked — layout just won't persist */ }
        return p;
      });
      setDrag(null);
    };
    window.addEventListener("mousemove", move);
    window.addEventListener("mouseup", up);
    return () => {
      window.removeEventListener("mousemove", move);
      window.removeEventListener("mouseup", up);
    };
  }, [drag, storageKey]);

  const startDrag = (id) => (e) => {
    e.preventDefault();
    movedRef.current = false;
    const rect = canvasRef.current.getBoundingClientRect();
    const p = pos[id];
    if (!p) return;
    setDrag({ id, dx: p.x - (e.clientX - rect.left), dy: p.y - (e.clientY - rect.top) });
  };

  // Point on the border of the card centered at `c`, along the direction toward `toward`.
  const borderPoint = (c, toward, pad = 0) => {
    const dx = toward.x - c.x, dy = toward.y - c.y;
    const len = Math.max(1, Math.hypot(dx, dy));
    const ux = dx / len, uy = dy / len;
    const k = 1 / Math.max(Math.abs(ux) / TOPO_HW, Math.abs(uy) / TOPO_HH, 1e-6);
    const d = Math.min(k + pad, len / 2);
    return { x: c.x + ux * d, y: c.y + uy * d };
  };

  const live = edges
    .map((e, i) => ({ ...e, i }))
    .filter((e) => pos[e.from] && pos[e.to]);

  const nodeById = {};
  nodes.forEach((n) => { nodeById[n.serviceId] = n; });
  const selEdge = sel?.type === "edge" ? edges[sel.i] : null;

  // Every CALLER gets its own line color (stable: alphabetical over the edge sources) so crossing
  // lines never tangle into one gray web. Health stays on the cards; selection stays blue.
  const edgeHueIdx = {};
  [...new Set(live.map((e) => e.from))].sort().forEach((from, i) => {
    edgeHueIdx[from] = i % MAP_HUES.length;
  });

  // Selection: one line, or a whole CALLER (clicking a service that reaches out = clicking all its
  // lines at once — every edge it owns emphasizes, every callee expands, rows highlight in its hue).
  const isEdgeSelected = (e) =>
    (sel?.type === "edge" && sel.i === e.i) || (sel?.type === "caller" && e.from === sel.id);
  const selCaller =
    sel?.type === "caller" ? sel.id : sel?.type === "edge" ? (edges[sel.i] || {}).from : null;
  const selHue =
    selCaller != null && edgeHueIdx[selCaller] != null ? MAP_HUES[edgeHueIdx[selCaller]] : null;
  const selEdgeIds = new Set(live.filter((e) => isEdgeSelected(e)).map((e) => e.i));

  // EXPANDED cards: rows = the callee's methods that inbound edges actually call, ranked by volume.
  // Each row remembers which edges feed it, so a specific edge branches only to ITS rows.
  const ROW_H = 21;
  const ROW_CAP = 12;
  const rowsFor = {};
  nodes.forEach((n) => {
    if (!expanded.has(n.serviceId)) return;
    const map = new Map();
    live.forEach((e) => {
      if (e.to !== n.serviceId) return;
      (e.couplings || []).forEach((c) =>
        (c.calls || []).forEach((call) => {
          const m = String(call).match(/^(.*?)(?:\s*×\s*([\d,]+))?$/);
          const name = (m && m[1]) || String(call);
          const count = m && m[2] ? Number(m[2].replace(/,/g, "")) : 1;
          const row = map.get(name) || { name, count: 0, edges: new Set() };
          row.count += count;
          row.edges.add(e.i);
          map.set(name, row);
        }),
      );
    });
    const all = [...map.values()].sort((x, y) => y.count - x.count);
    rowsFor[n.serviceId] = { rows: all.slice(0, ROW_CAP), more: Math.max(0, all.length - ROW_CAP) };
  });

  // Per-edge geometry: the usual single bow — or, when the CALLEE is expanded, a TRUNK to a gather
  // point just off the card edge that SPLITS into one straight arrow per called method row.
  const geoms = live.map((e) => {
    const a = pos[e.from], b = pos[e.to];
    const info = rowsFor[e.to];
    const listTop = b.y + TOPO_HH + 6;
    const mine = info
      ? info.rows
          .map((r, idx) => ({ ...r, y: listTop + idx * ROW_H + ROW_H / 2 }))
          .filter((r) => r.edges.has(e.i))
      : [];
    if (!mine.length) {
      const p1 = borderPoint(a, b);
      const p2 = borderPoint(b, a, 4);
      const mx = (p1.x + p2.x) / 2, my = (p1.y + p2.y) / 2;
      const len = Math.max(1, Math.hypot(p2.x - p1.x, p2.y - p1.y));
      const px = -(p2.y - p1.y) / len, py = (p2.x - p1.x) / len;
      return { e, type: "simple", p1, p2, c: { x: mx + px * 22, y: my + py * 22 } };
    }
    const sign = a.x <= b.x ? -1 : 1; // approach the callee from the caller's side
    const G = {
      x: b.x + sign * (TOPO_HW + 38),
      y: mine.reduce((s, r) => s + r.y, 0) / mine.length,
    };
    const p1 = borderPoint(a, G);
    const mx = (p1.x + G.x) / 2, my = (p1.y + G.y) / 2;
    const len = Math.max(1, Math.hypot(G.x - p1.x, G.y - p1.y));
    const px = -(G.y - p1.y) / len, py = (G.x - p1.x) / len;
    return {
      e,
      type: "branched",
      p1,
      p2: G,
      c: { x: mx + px * 18, y: my + py * 18 },
      targets: mine.map((r) => ({ x: b.x + sign * (TOPO_HW - 2), y: r.y })),
    };
  });

  return (
    <>
      <div
        className="topo-canvas"
        ref={canvasRef}
        onMouseDown={(e) => { if (e.target === canvasRef.current) setSel(null); }}
      >
        <svg className="topo-svg">
          <defs>
            <marker id="topoArrow" markerWidth="9" markerHeight="9" refX="7.5" refY="4.5" orient="auto" markerUnits="userSpaceOnUse">
              <path d="M0,0 L9,4.5 L0,9 Z" className="topo-arrowhead" />
            </marker>
            <marker id="topoArrowSel" markerWidth="9" markerHeight="9" refX="7.5" refY="4.5" orient="auto" markerUnits="userSpaceOnUse">
              <path d="M0,0 L9,4.5 L0,9 Z" className="topo-arrowhead topo-arrowhead--sel" />
            </marker>
            {/* One arrowhead per palette hue — markers can't inherit their line's stroke. */}
            {MAP_HUES.map((h, i) => (
              <marker key={i} id={`topoArrow${i}`} markerWidth="9" markerHeight="9" refX="7.5" refY="4.5" orient="auto" markerUnits="userSpaceOnUse">
                <path d="M0,0 L9,4.5 L0,9 Z" fill={h} />
              </marker>
            ))}
          </defs>
          {geoms.map((g) => {
            const e = g.e;
            const d = `M${g.p1.x},${g.p1.y} Q${g.c.x},${g.c.y} ${g.p2.x},${g.p2.y}`;
            const isSel = isEdgeSelected(e);
            const hi = edgeHueIdx[e.from] || 0;
            const hueStyle = { stroke: MAP_HUES[hi] }; // selection thickens, the hue stays
            const arrow = `url(#topoArrow${hi})`;
            // Clicking a line SELECTS it and EXPANDS its callee (expand-only — never collapses),
            // so the highlighted method rows are immediately visible.
            const pick = () => {
              setSel({ type: "edge", i: e.i });
              setExpanded((prev) => {
                if (prev.has(e.to)) return prev;
                const next = new Set(prev);
                next.add(e.to);
                return next;
              });
            };
            return (
              <g key={`${e.from}->${e.to}`}>
                <path className="topo-edge-hit" d={d} onClick={pick} />
                <path
                  className={`topo-edge${isSel ? " is-sel" : ""}`}
                  d={d}
                  style={hueStyle}
                  markerEnd={g.type === "simple" ? arrow : undefined}
                />
                {g.type === "branched" &&
                  g.targets.map((t, ti) => (
                    <path
                      key={ti}
                      className={`topo-edge${isSel ? " is-sel" : ""}`}
                      d={`M${g.p2.x},${g.p2.y} L${t.x},${t.y}`}
                      style={hueStyle}
                      markerEnd={arrow}
                    />
                  ))}
              </g>
            );
          })}
        </svg>
        {geoms.map((g) => {
          const e = g.e;
          const { p1, p2, c } = g;
          // The chip rides the trunk bezier's midpoint (t=0.5): ¼·p1 + ½·control + ¼·p2.
          const chipX = 0.25 * p1.x + 0.5 * c.x + 0.25 * p2.x;
          const chipY = 0.25 * p1.y + 0.5 * c.y + 0.25 * p2.y;
          // Live edges carry real call VOLUME; mock edges fall back to their coupling count.
          const n = e.volume != null ? e.volume : e.couplings.reduce((s, cpl) => s + cpl.calls.length, 0);
          const isSel = isEdgeSelected(e);
          return (
            <span
              key={`chip-${e.from}->${e.to}`}
              className={`topo-chip${isSel ? " is-sel" : ""}`}
              style={{
                left: chipX,
                top: chipY,
                borderColor: MAP_HUES[edgeHueIdx[e.from] || 0],
                color: MAP_HUES[edgeHueIdx[e.from] || 0],
              }}
              onClick={() => {
                setSel({ type: "edge", i: e.i });
                setExpanded((prev) => {
                  if (prev.has(e.to)) return prev;
                  const next = new Set(prev);
                  next.add(e.to);
                  return next;
                });
              }}
              title={
                e.volume != null
                  ? `${e.from} calls ${e.to} — ${fmtInt(e.volume)} calls${e.errors ? `, ${fmtInt(e.errors)} errors` : ""}`
                  : `${e.from} calls ${e.to} — ${n} couplings`
              }
            >
              {fmtInt(n)}
            </span>
          );
        })}
        {(() => {
          return nodes.map((n) => {
          const p = pos[n.serviceId];
          if (!p) return null;
          const isOpen = expanded.has(n.serviceId);
          const info = rowsFor[n.serviceId];
          return (
            <div
              key={n.serviceId}
              className={`topo-gnode topo-gnode--${n.status || "ok"}${isOpen ? " topo-gnode--open" : ""}`}
              style={{ left: p.x, top: p.y }}
              onMouseDown={startDrag(n.serviceId)}
              onClick={() => {
                if (movedRef.current) return;
                const outbound = live.filter((e) => e.from === n.serviceId);
                if (outbound.length) {
                  // A CALLER: clicking it = clicking all its lines — select the caller and expand
                  // every service it reaches (expand-only), plus its own toggle.
                  setSel({ type: "caller", id: n.serviceId });
                  setExpanded((prev) => {
                    const next = new Set(prev);
                    if (next.has(n.serviceId)) next.delete(n.serviceId);
                    else next.add(n.serviceId);
                    outbound.forEach((e) => next.add(e.to));
                    return next;
                  });
                } else {
                  toggleExpand(n.serviceId);
                }
              }}
              title={isOpen ? "Collapse" : "Expand — the methods other services call here"}
            >
              <div className="topo-gnode__name">
                <span className={`report-dot report-dot--${n.status || "ok"}`} />
                {n.serviceId}
              </div>
              <div className="topo-gnode__sub">
                {fmtInt(n.count)} calls · p99 {fmtMs(n.p99)}
              </div>
              {isOpen && info && (
                <div className="topo-gnode__methods" onClick={(ev) => ev.stopPropagation()}>
                  {/* Name the CONNECTION when a selection highlights rows here — a floating tag,
                      NOT a flow row (a row would shift the anchors the branch arrows land on). */}
                  {selHue &&
                    selCaller !== n.serviceId &&
                    info.rows.some((r) => [...r.edges].some((id) => selEdgeIds.has(id))) && (
                      <div className="topo-gnode__from" style={{ color: selHue, borderColor: selHue }}>
                        ← {selCaller}
                      </div>
                    )}
                  {info.rows.length === 0 && (
                    <div className="topo-gnode__mrow topo-gnode__mrow--quiet">no inbound calls</div>
                  )}
                  {info.rows.map((r) => {
                    const hit = selHue && [...r.edges].some((id) => selEdgeIds.has(id));
                    return (
                      <div
                        className="topo-gnode__mrow"
                        key={r.name}
                        style={{
                          height: ROW_H,
                          ...(hit
                            ? {
                                background: `${selHue}1f`,
                                boxShadow: `inset 3px 0 0 ${selHue}`,
                                color: selHue,
                                fontWeight: 700,
                              }
                            : {}),
                        }}
                      >
                        <span className="topo-gnode__mname">{r.name}</span>
                        <span className="topo-gnode__mcount">{fmtInt(r.count)}</span>
                      </div>
                    );
                  })}
                  {info.more > 0 && (
                    <div className="topo-gnode__mrow topo-gnode__mrow--quiet">+{info.more} more</div>
                  )}
                </div>
              )}
            </div>
          );
          });
        })()}
        {live.length === 0 && (
          <div className="topo-canvas__empty">
            no coupling map for this project yet — the mock edge set covers buAPI
          </div>
        )}
      </div>
      <div className="topo-detail">
        {selEdge ? (
          <>
            <div className="topo-detail__title">
              {selEdge.from} → {selEdge.to}{" "}
              {mock ? (
                <Mock>couplings</Mock>
              ) : (
                <span className="topo-detail__live">
                  {fmtInt(selEdge.volume)} calls{selEdge.errors ? ` · ${fmtInt(selEdge.errors)} errors` : ""}
                </span>
              )}
            </div>
            {selEdge.couplings.map((c, i) => (
              <div className="topo-detail__row" key={i}>
                <b>{selEdge.from}.{c.module}</b>
                {" → "}
                {c.calls.map((call, j) => (
                  <span key={call}>
                    {j > 0 && " · "}
                    <code>{selEdge.to}.{call}</code>
                  </span>
                ))}
                <span className="topo-detail__via">via {c.via}</span>
              </div>
            ))}
          </>
        ) : sel?.type === "node" ? (
          (() => {
            const out = edges.filter((e) => e.from === sel.id);
            const inn = edges.filter((e) => e.to === sel.id);
            return (
              <>
                <div className="topo-detail__title">
                  {sel.id} {mock && <Mock>couplings</Mock>}
                </div>
                {out.length === 0 && inn.length === 0 && (
                  <div className="topo-detail__hint">no cross-service calls on record for this service</div>
                )}
                {out.map((e) => (
                  <div className="topo-detail__row" key={`o-${e.to}`}>
                    calls <b>{e.to}</b> from{" "}
                    {[...new Set(e.couplings.map((c) => c.module))].map((m, j) => (
                      <span key={m}>{j > 0 && ", "}<code>{sel.id}.{m}</code></span>
                    ))}
                  </div>
                ))}
                {inn.map((e) => (
                  <div className="topo-detail__row" key={`i-${e.from}`}>
                    called by <b>{e.from}</b>{" "}
                    {[...new Set(e.couplings.map((c) => c.module))].map((m, j) => (
                      <span key={m}>{j > 0 && ", "}<code>{e.from}.{m}</code></span>
                    ))}
                  </div>
                ))}
              </>
            );
          })()
        ) : (
          <div className="topo-detail__hint">
            drag nodes to arrange (the layout is saved) — click a line or its count chip for the
            module → method couplings behind it, or a node for its connections
          </div>
        )}
      </div>
    </>
  );
}

export default TopologyGraph;
