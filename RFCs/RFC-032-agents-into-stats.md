# RFC-032 — Agents into Stats

*Status: APPROVED (his "yeah cool I'm with it let's get to it", 2026-08-09). Build starts
after session compaction.*

## Motivation

The Stats page (`/reports/:projectCode` — pages/Reports/Reports.js) is invisible to agents:
no bots mount there, the view stamp only describes `/specs`, nav commands can't target it,
and agents have no way to read the numbers the human is looking at. The arc: agents become
stats-aware, then human + agents improve stats together, then systemlynx verifies every
tracking feature against live load.

## The gaps (grounded 2026-08-09)

1. **No bots on Stats** — `AgentChat` renders only in pages/SystemView/SystemView.js (~line
   340); `/reports` has no chat, no presence, no TV.
2. **Stamp is specs-only** — `send()` in AgentChat builds the view from `/specs` URL parsing;
   from Stats a message carries no page/range/service context.
3. **Nav can't reach Stats** — `execCommand("nav")` builds `/specs/...` paths only.
4. **Agents can't read stats** — no CLI verb; the page calls each service plugin's
   `getStats()` (stats.js minute buckets); agents have no equivalent.

**Already in hand:** `::chart{report,range,service}`, `::topology`, `::load{limit}` blocks
render live in TV shows (organisms/Charts extraction, shared derive.js) — once agents can
read stats they can show the numbers on the TV mid-conversation.

## Plan (in order, as approved)

1. **Bots ride the Stats page** — mount AgentChat (+ hub) on `/reports`; dock line, peeks,
   TV all carry over (positions already persist via localStorage).
2. **Stamp + nav learn Stats** — view stamp gains `page: "stats"` + projectCode + time range
   + service/section focus; `nav` command accepts stats targets (page, range, service) and
   `refresh` scope for stats.
3. **CLI stats verb** — `systemview stats <pc> [service] [--range]` reading the same
   `getStats()` the page uses, plus a digest form (top methods, error hotspots, deltas) for
   quick agent reads.
4. **Improve stats together** — him in the room, findings/proposals TV-first with live
   `::chart`/`::topology`/`::load` embeds.
5. **systemlynx verification round** — systemlynx joins to verify tracking features are real
   and explicit: edges, couplings, LB cluster/tentacle config, trace stamping — against a
   live load. (Part of this RFC per approval; the LB client-side adoption itself stays
   systemlynx RFC-009's business.)

## Out of scope

- systemlynx RFC-009 (`loadService(serviceId, {loadbalancer})`) — theirs, draft, unimplemented.
- Other-screen presence (his named later arc).
- New metrics collection in the plugin beyond what stats.js already tracks (improvement
  round may file follow-ups).
