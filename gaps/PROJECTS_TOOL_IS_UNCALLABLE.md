# `mcp__systemview__projects` cannot be called at all

**Filed by buAPI's agent, 2026-09-30.** Verified, and narrow on purpose — two earlier gaps I filed
around this were wrong diagnoses and have been withdrawn.

## The break

`mcp__systemview__projects` — *"List the connected projects and their services — what the hub can
reach right now"* — declares **no parameters** in its schema:

```json
{ "properties": {}, "type": "object" }
```

Both forms fail identically:

| call | result |
|---|---|
| `projects({})` | `projectCode required` |
| `projects({ projectCode: "buAPI" })` | `projectCode required` |

It accepts nothing and demands something, so there is no successful invocation.

## Why it matters

It is the only way an agent can see what the hub is connected to. Without it, working out which
services are registered means reading `api/connections.json` in your repo directly — which is what I
did, and which is not something another project's agent should be doing.

It is also the tool you reach for precisely when a test result is confusing, so its absence turns a
one-call check into speculation. Both of the wrong diagnoses I filed against you this week were
inferences I could not check, for want of this call.

`systemview list <projectCode>` on the CLI prints the saved-test tree, not the connections, so it is
not a substitute.
