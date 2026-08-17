# RFC-036 — Every project's plugin, as an MCP server

**Status: PARKED.** Written to be ready, not scheduled. His words: *"you can write an RFC but I'm not
going to implement it — it'll be good to have."* Nothing here is started; this file exists so the
decision is already thought through if the day comes.

**Why it lives in `RFCs/parked/`:** the numbered line in `RFCs/` is work that got built. Mixing a
"someday" document into it makes every RFC number a question about whether it shipped.

---

## The observation

The SystemView plugin is already an MCP server minus the protocol.

MCP asks a tool provider for three things: a **list of tools with JSON Schemas**, a **way to call
one**, and a **transport**. The plugin has two of the three already, per project:

| MCP wants | what already exists |
|---|---|
| a set of named callables | `readFile` `readFileRaw` `listFiles` `search` `getSource` `getDiff` `changedFiles` `stageFiles` `stageHunk` `discardFiles` `gitState` `commit` `push` `writeFile` `deleteFile` `moveFile` `copyFile` `fileHistory` `readSnapshot` — plus logs, stats, chat and the tests |
| a way to call one | SystemLynx RPC, and `systemview probe <Service.Module.method>` on top of it |
| a description of what exists | `.systemview/<serviceId>.manifest.json` — every module, every method, per project |
| **JSON Schemas for the arguments** | **missing — this is the whole gap** |
| a transport | the plugin already runs inside a live HTTP/WS service |

So this is not a new subsystem. It is schemas plus an adapter route.

## Two tool families, not one

An MCP server for a project would publish two distinct sets, and conflating them would make a mess:

1. **SystemView's own verbs** — files, git, history, tests, logs, code comments. Identical in every
   project, so the schemas are written once, by hand, and are exact.
2. **The project's own service methods** — `Basketball.Games.get`, `Profiles.Users.signUp`. These
   differ per project and per deploy, which is precisely why they can only come from the manifest.

## Where the schemas come from

**The saved tests are the argument shapes.** A saved test carries real, verified arguments:

```json
"args": [{ "name": "argument:", "input": { "namespace": "GatedService.Auth.echo" }, "input_type": "object" }]
```

That is one real call to that method that actually ran. An inferred JSON Schema from those examples
gives the shape and the types for free, and every method with a saved test gets a schema that is
grounded in something that executed — not in someone's memory of the signature.

**Say the limitation out loud:** inference from examples produces a *shape*, not a *contract*. It
cannot know which fields are optional, or that a string is an ISO date rather than a string. So:

- a method **with** saved tests → an inferred schema, marked `from: tests`
- a method **without** → a permissive `{ type: "object" }`, marked `from: none`, so a client knows it
  is being handed a guess
- an optional hand-written override in `specs/schemas/<Module>.<method>.json` wins over both

The `input_type` field already recorded on every argument is the seed of this, and multi-argument
methods already spread positionally — the array form maps to a tuple schema without inventing
anything.

## Transport and auth

MCP's streamable-HTTP transport is a thin route on a service that is already listening. Auth is the
one place this cannot be casual: the plugin reaches the filesystem and git. The existing
`headers`/`session` store is the material, and the server should refuse to start without an explicit
token in `.systemview/mcp.json` — never a default-open port.

## The decision this RFC actually turns on

**Which verbs are exposed.** `readFile`, `listFiles`, `search`, `getSource`, `getDiff`, `gitState`,
`fileHistory` and the tests are read-only and safe to publish. `writeFile`, `deleteFile`, `moveFile`,
`copyFile`, `stageFiles`, `commit`, `push` are not — and the UI's protection for them (two-step
confirms, the snapshot ring, a human looking at the row) has **no equivalent over a protocol**.

Recommendation, if this is ever built: **read verbs by default, write verbs opt-in per project**, in
`.systemview/mcp.json`, off unless someone turns them on. The snapshot ring stays the floor under
anything destructive.

## What it would buy

Any MCP client — Claude Code, ChatGPT, an IDE — could read a project's files, run its tests, probe
its methods and read his code comments **without SystemView being open**, and without that client
knowing anything about SystemLynx. One server per project, published by the thing that already knows
the project.

The reverse is the more interesting half: SystemView becomes a *provider* in an ecosystem it is
currently a *consumer* of.

## Non-goals

- **Not** the hub running agents on API keys. That is a separate question (who holds the session),
  and it is still open.
- **Not** a rewrite of the chat, presence, or agent-control surfaces. An MCP client is a caller, not
  a member of the room — anything that speaks in the room still arrives as an agent with a name.

## Open questions

1. One server per **project**, or one per **service**? Per project matches how he thinks; per service
   matches how the plugin is actually mounted.
2. Do the code comments belong in `tools` or in MCP `resources`? They read more like resources.
3. Does `systemview test` become one tool, or one tool per saved test? One tool with a filter is the
   honest mapping of the CLI that exists.
