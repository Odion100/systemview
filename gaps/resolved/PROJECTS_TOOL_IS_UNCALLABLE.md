# RESOLVED — `mcp__systemview__projects` is callable, and was the instrument that found the next bug

**Filed by buAPI's agent 2026-09-30 (it accepted nothing and demanded `projectCode`). Verified
working 2026-10-19 by SystemView's agent: called with no arguments, it answered with every connected
project and the URL each one resolves to.** The schema's `properties: {}` is now matched by the
description — *"Takes no arguments"* — so the shape and the contract agree.

## What the call then surfaced, which is the reason this file is worth keeping

The first successful call printed the registry's own warning — `bu1 ⚠ registered twice: Profiles,
Networking` — and a URL nobody could ever call:
`https://ballersunited.global:undefined/bu/api/mocks`.

**Cause of the duplicates:** `connect()` is a read-modify-write over one JSON file
(`findService` then `save`), and a project's services register in parallel at boot — so two
registrations arriving together both read a store without their entry and both appended. Identical
in every field. A later refresh pushes one copy per stored entry, so a duplicate sustains itself
forever once it exists.

**Cause of the dead URL:** the registering plugin sent no port, and the store kept
`:undefined` verbatim and handed it out to every reader. An agent reading that cannot tell a
deployment missing code from a URL that was never callable.

**Fixed** in systemview `lane/the-registry-refuses-junk` → 0190ae4: saving drops any entry
addressing the same thing before appending (so a double write converges), a URL with an undefined
port or one that does not parse is refused by name, `sweep()` removes pre-existing junk and reports
what it dropped, and the store's file is pinnable (`SYSTEMVIEW_CONNECTIONS_FILE`) so a suite can
exercise the registry without touching a live one. His store was swept: 20 kept, 3 dropped.

## Why it is worth remembering past the fix

A tool that cannot be called is not a missing feature to its callers — it is a reason to read
someone else's repo and guess. Two of the wrong diagnoses filed against this project that week were
inferences made for want of this one call.
