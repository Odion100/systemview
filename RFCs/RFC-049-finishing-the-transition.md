# RFC-049 — Finishing the transition

You're right on every count, and one of them is a leak I built on purpose and never came back to.

## 1. A codebase is not a service — and mine pretends to be one

To carry host files through the existing plumbing, I made a folder you add look like a
SystemLynx connection: `serviceId: "Files"`, a fake `Plugin` module, a `host://` URL.
`loadService` short-circuits on a marker and never dials anything. It works, and it is
exactly the wrong shape — which is why your two throwaway folders showed up claiming
services they do not have.

Your rule, said plainly: **a project is a project; a service connects TO a project.**
Adding a folder should produce a codebase with files, git and an agent, and **no service
list at all**. The plugin then adds services, tests and probes on top — additive, never
required.

That fake entry is one file (`src/utils/hostProject.js`) and one short-circuit
(`src/utils/loadService.js`). Killing it means projects get a real second kind, rather
than one kind wearing a costume.

## 2. The room chat is obsolete

Right now the panel holds two conversations and an attach line at the bottom —
"back to the room", "resumed", a picker. You should never see any of that again.

What replaces it, when a project has no agent attached yet, is **one prompt**:

> *No agent here yet.* → **Attach a conversation** · **Start a new one**

Pick a conversation and you are talking to that agent directly, in that project, with the
SystemView handle still live — so it can still move your window, put things on the TV and
run its commands from inside the chat.

## 3. The closed bubble has to change source

The peek that sticks out of a minimized chat reads the ROOM's status lines today — the
`statuses` the hub emits. When the room goes, that source goes with it, and the bubble
would sit there silent while an agent is mid-tool.

His instruction, carried into the teardown: **the minimized bubble shows the same line the
open panel shows** — the session's own cooking line, tool in flight and all. One source of
"is anything happening", whether the panel is open, closed or docked.

## 4. Version control

The diff, the stripes and staging all still read through the old project shape, which is
why SystemView's own project behaves and a folder you added does not. Once a host-backed
project is a real project rather than a costumed service, git comes from the host's
`gitState` for both and the difference disappears.

## The calls that are yours

::question[When a folder has no services, what does the service area do?]{id=svc options=hide-it-entirely|show-"connect a service"|keep-an-empty-list}

::question[The room chat — delete it, or keep it reachable somewhere for agent-to-agent traffic?]{id=room options=delete-it|keep-it-out-of-the-way|keep-it-as-is}

::question[Do the two throwaway test projects get migrated, or do I drop them and you re-add them the new way?]{id=migrate options=migrate-them|drop-and-re-add|leave-them-alone}
