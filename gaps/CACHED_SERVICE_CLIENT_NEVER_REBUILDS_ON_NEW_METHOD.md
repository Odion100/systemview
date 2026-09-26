# The hub's cached SystemLynx client never rebuilds when a service publishes a new method

**Filed by buAPI's agent, 2026-09-23.** Found while registering a new method (`Basketball.Games.cancel`)
and trying to prove it with `mcp__systemview__probe` / `mcp__systemview__runTests`.

## Symptom

A method that a running service genuinely publishes is uncallable through SystemView — probe and
runTests both fail with:

```
client[moduleName][methodName] is not a function
```

...in **1ms**, with no request leaving the process. The failure is local to the hub, so it reads like
the method doesn't exist when it does.

## Proof — the live service and the hub disagree, right now

The service at `:4900`, fetched directly:

```bash
$ curl -s http://127.0.0.1:4900/bu/api/basketball | jq -r '.[]|select(.name=="Games")|.methods[].fn'
add get getPage editGameDetails updateTeam addAdmin removeAdmin addPlay override
editPlay undoPlay insertPlay endReview acceptCallout rejectCallout cancel setAdmins
                                                                  ^^^^^^ published
```

`.systemview/Basketball.manifest.json` also lists `cancel` — the manifest is current.

The hub, same moment:

```
mcp__systemview__probe  buAPI:Basketball.Games.cancel
  failed — client[moduleName][methodName] is not a function
  http://127.0.0.1:4900/bu/api/basketball · 1ms · anonymous
  other methods on Games: add, get, getPage, editGameDetails, updateTeam, addAdmin,
    removeAdmin, addPlay, override, editPlay, undoPlay, insertPlay, endReview,
    acceptCallout, rejectCallout, setAdmins
```

The hub's own "other methods on Games" hint is the tell: it stops at `setAdmins` and has no `cancel`.
It is reading a client object built before the method existed.

## What does NOT clear it

Tried, in order, all ineffective: `connect`, `disconnect` then `connect`, `refresh`, and a CLI
re-attach (`npx systemview` from the repo root). Only a full hub restart clears it — and the hub
serves 8 projects and several concurrent agent sessions, so restarting it is not something a
single project's agent should do to unblock itself.

## Why it matters more than it looks

This is the normal development loop, not an edge case. Every time a buAPI module gains a method, the
tool that exists to prove the method works is the one tool that cannot call it — and the error names
a client internal, so the natural reading is "my registration is broken." I re-derived the
registration three times before checking the live manifest against the hub's method list.

It also silently invalidates a test suite: `Basketball/specs/tests/Games.cancel.json` is correct and
its three assertions were verified by hand over raw HTTP (403 for a non-admin, 200 + `canceled` for
an admin, 403 `cannot cancel a game with a status of canceled` on a repeat), but the suite cannot go
green until the hub restarts. A red suite that is actually correct is the expensive kind of red.

## Suggested shape

Rebuild the cached client when the fetched manifest's method list differs from the cached one — the
hub already re-fetches the manifest, so the comparison is available at no extra cost. Failing that,
make `refresh` actually drop and rebuild the client, since that is what its name promises.

## Related, same session

`disconnect`/`connect` attempts left the hub's buAPI probes running **anonymous** — previously they
were authenticated from `.systemview/session.json`, and the session file is intact. So a reconnect
drops the session identity without restoring it. Possibly the same lifecycle bug, possibly its own;
recorded here rather than filed separately until someone who owns this code looks at both.
