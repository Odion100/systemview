import React, { useEffect, useMemo, useState } from "react";
import "./styles.scss";
import { callStats } from "../../utils/hostAgents";

// RFC-057 — THE CALL LEDGER, READ. The context store could always answer "is this note earning its
// place?" because every retrieval is stamped. Nothing else was: tool calls, MCP calls, skill fires
// and hook fires went out to the live feed and vanished with the session. This is the other half of
// that question — "if we created these internal tools, are they being used properly?" (his words).
//
// PAGE LEVEL ON PURPOSE. The store panel lives beside the store because it is ABOUT the store; this
// is about the system, so it is not a chip at the bottom of another surface. His correction, and it
// is the rule now: statistics go where their subject lives.
const KINDS = [
  { key: "tool", label: "Tools", hint: "the agent's own tools — Bash, Read, Edit, Task" },
  { key: "mcp", label: "MCP", hint: "harness and service tools reached over MCP" },
  { key: "skill", label: "Skills", hint: "a skill loaded — the description fired" },
  { key: "hook", label: "Hooks", hint: "context pushed by an event, nobody asked" },
  { key: "session", label: "Sessions", hint: "opened, re-initialized, ended" },
];

const RANGES = [
  { key: 0, label: "all" },
  { key: 1, label: "today" },
  { key: 7, label: "7 days" },
];

const ms = (n) => (n >= 1000 ? `${(n / 1000).toFixed(1)}s` : `${Math.round(n)}ms`);
const when = (iso) => {
  const d = Date.parse(iso || "");
  if (!d) return "";
  const mins = Math.floor((Date.now() - d) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
};

const CallStats = ({ projectCode, agentId }) => {
  const [data, setData] = useState(null);
  const [kind, setKind] = useState("tool");
  const [days, setDays] = useState(0);
  const [mine, setMine] = useState(false); // global by default — which tools does the SYSTEM use
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let gone = false;
    callStats({ days, agent: mine && agentId ? agentId : null }).then((r) => {
      // TWO DIFFERENT NULLS. No bridge (an old shell) is not the same as no calls yet, and a
      // spinner that never resolves cannot tell you which — the store panel learned this first.
      if (!gone) setData(r || "unavailable");
    });
    return () => { gone = true; };
  }, [days, mine, agentId, tick]);

  const rows = useMemo(
    () => (data && data !== "unavailable" ? data.calls.filter((c) => c.kind === kind) : []),
    [data, kind],
  );
  const top = rows.length ? rows[0].calls || 1 : 1;

  if (data === "unavailable")
    return (
      <div className="callstats callstats--empty">
        The harness can't answer yet — relaunch the browser to arm the call ledger.
      </div>
    );
  if (!data) return <div className="callstats callstats--empty">Reading the ledger…</div>;

  const active = KINDS.find((k) => k.key === kind);
  const nothingYet = !data.totals.calls;

  return (
    <div className="callstats">
      <div className="callstats__head">
        <span className="callstats__title">Calls — what the system actually runs</span>
        <span className="callstats__spacer" />
        {agentId && (
          <button
            className={`callstats__toggle${mine ? " callstats__toggle--on" : ""}`}
            onClick={() => setMine((m) => !m)}
            title="Narrow to the selected agent"
          >
            {mine ? agentId : "all agents"}
          </button>
        )}
        <select className="callstats__range" value={days} onChange={(e) => setDays(Number(e.target.value))}>
          {RANGES.map((r) => (
            <option key={r.key} value={r.key}>{r.label}</option>
          ))}
        </select>
        <button className="callstats__refresh" onClick={() => setTick((t) => t + 1)}>Refresh</button>
      </div>

      <div className="callstats__totals">
        <span><b>{data.totals.calls.toLocaleString()}</b> calls</span>
        <span><b>{data.totals.names}</b> distinct</span>
        <span><b>{data.totals.fails}</b> failed</span>
        <span><b>{Object.keys(data.agents).length}</b> agents</span>
        {data.since && <span className="callstats__since">since {when(data.since)}</span>}
      </div>

      {/* A LEDGER THAT HAS JUST STARTED IS NOT AN EMPTY SYSTEM. Said plainly, because "no calls"
          on a surface whose job is to find dead tools reads as "nothing is being used". */}
      {nothingYet && (
        <div className="callstats__none">
          Nothing recorded yet. The ledger writes from the moment the harness restarts with it armed
          — every call before that was never written down, not never made.
        </div>
      )}

      {!nothingYet && (
        <>
          <div className="callstats__kinds">
            {KINDS.map((k) => {
              const n = (data.byKind && data.byKind[k.key]) || 0;
              return (
                <button
                  key={k.key}
                  className={`callstats__kind${kind === k.key ? " callstats__kind--on" : ""}`}
                  onClick={() => setKind(k.key)}
                  title={k.hint}
                >
                  {k.label}
                  <span className="callstats__kind-n">{n}</span>
                </button>
              );
            })}
          </div>

          <div className="callstats__hint">{active ? active.hint : ""}</div>

          <table className="callstats__table">
            <thead>
              <tr>
                <th>{kind === "session" ? "event" : "name"}</th>
                <th className="callstats__num">calls</th>
                <th className="callstats__num">failed</th>
                {kind !== "session" && kind !== "hook" && <th className="callstats__num">p50</th>}
                {kind !== "session" && kind !== "hook" && <th className="callstats__num">p90</th>}
                <th>by</th>
                <th>last</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((c) => (
                <tr key={`${c.kind}:${c.name}`} className={c.fails ? "callstats__tr--bad" : ""}>
                  <td className="callstats__name">{c.name}</td>
                  <td className="callstats__num">
                    <span className="callstats__bar">
                      <span className="callstats__fill" style={{ width: `${Math.round((c.calls / top) * 100)}%` }} />
                    </span>
                    {c.calls}
                  </td>
                  <td className="callstats__num">
                    {c.fails ? <b className="callstats__fails">{c.fails}</b> : <span className="callstats__zero">0</span>}
                  </td>
                  {kind !== "session" && kind !== "hook" && <td className="callstats__num">{ms(c.p50)}</td>}
                  {kind !== "session" && kind !== "hook" && <td className="callstats__num">{ms(c.p90)}</td>}
                  <td className="callstats__who">
                    {Object.entries(c.agents)
                      .sort((a, b) => b[1] - a[1])
                      .map(([who, n]) => (
                        <span className="callstats__chip" key={who}>
                          {who}
                          {n > 1 && <i>×{n}</i>}
                        </span>
                      ))}
                  </td>
                  <td className="callstats__last">{when(c.last)}</td>
                </tr>
              ))}
              {!rows.length && (
                <tr>
                  <td colSpan={7} className="callstats__none">
                    Nothing of this kind recorded in this window.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </>
      )}
    </div>
  );
};

export default CallStats;
