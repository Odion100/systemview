# RFC-080 — a component library for every window

::rfc{id=RFC-080}

**DRAFT. Nothing here is approved and nothing is built.** Parked 2026-11-14 so the argument is not
re-derived. It came out of the same conversation that parked RFC-079, and it stands completely
separate from the connect arc — where the two touch is one seam, named at the bottom.

## The idea, in his words

> *"What if we created a system of components — componentizing all these different things, from the
> chat to documents to everything. Every portion. You have a component library and you make sure
> these components are written in a way that can stand on their own, anywhere… I already know that I
> wanted to be able to make agents pop up in different windows — whether I'm browsing the internet,
> whether I'm in another application."*

And the two forward-looking halves:

> *"I also want to give the ability eventually in the future for agents to be able to create UIs on
> the fly, and we have to build and compile them."*

> *"This component library would have a UI, or another app, where you can actually literally test it
> and see the different components."*

## Why it is already owed

- **Two UIs are drifting today.** SystemView's `src/` (CRA) and autobot's `electron/ui` (vite) are
  two React apps. Anything both need is written twice — one definition, or it drifts.
- **The property already exists in exactly one place**, which is why the idea is buildable rather
  than aspirational: `AgentChat` is fed by a TRANSPORT — `openAgent()` hands back
  `{transport, history}`, the component subscribes and renders. It does not know where its session
  lives, which is why the same chat works docked, in the workbench, and in the strip. Most other
  organisms reach into the hub directly and therefore only work in the window that raised them.
- **The qualifying test is therefore concrete:** fed only by props and a transport · no reach into
  the host app's globals · styles self-carried.

## The architecture — React inside, web components at the boundary

They are not competitors; they are the inside and the outside of one library.

| layer | choice | why |
|---|---|---|
| authoring | **React** | the 43-block markdown vocabulary, the chat, the workbench already are; a rewrite buys a second mental model and nothing visible |
| boundary | **custom elements + shadow DOM** | `<sv-agent-chat session="…">` is consumable by ANY html — a browsed page, another app, a bare popup. Shadow DOM is "styles self-carried" enforced by the platform: the host page's CSS cannot bleed in, ours cannot bleed out |
| build | **vite/esbuild lib mode** | autobot already uses esbuild (`build:systemlynx`); the library must not inherit CRA |
| injected payload | optionally **Preact-aliased** | same API, ~4KB — matters when the bundle rides into browsed pages |

**Components never travel — contracts do.** The vocabulary is installed everywhere; what crosses a
wire is the session address, the document, the event stream. Interactive markdown already proved the
model: the document travels as text, any window carrying the renderer shows it alive.

## "Pops up anywhere" is two mechanisms, kept apart

1. **Inside the shell's browser** — injection: a container plus the custom element dropped into the
   page being browsed. This is where shadow DOM earns its place.
2. **Over OTHER applications** — no web standard reaches there. That is an OS-level frameless
   always-on-top Electron panel, which is simply the smallest possible consumer of the same library.

Both collapse to the same sentence: the host carries the library, the session address is what
arrives.

## Agents building UIs on the fly

esbuild compiles in milliseconds, in-process. An agent writes a component against the library,
esbuild bundles it, it mounts as a custom element wherever. The pipeline is essentially what
`build:systemlynx` does today, aimed at components. The library existing FIRST is what makes
agent-built UIs composable rather than feral — they build against the vocabulary.

## The gallery

The thing that makes a library real instead of a folder: every component visible, in every state,
with knobs. Two candidates, genuinely open (d2 below): **Storybook** — standard, free prop-knobs,
fastest to stand up — or **our own story surface** — SystemView already carries a story canvas, and
a gallery that is DOCUMENTS (each component demoed in interactive markdown) matches how everything
else here works and is agent-readable for free.

## Structure

A workspace package — `components/` — consumed by: SystemView's window, autobot's `electron/ui`
(killing the two-apps drift), the injection bundle, and the floating panel. Library first; consumers
migrate organism by organism. Nothing big-bangs.

## The one seam with connect

The connect meeting's `d-channel` decides what rides the wire between machines. This library is that
channel's consumer: whatever the channel is, it has to be able to carry a TRANSPORT the components
can sit on. That constraint is the whole relationship — the library needs nothing else from
connect, and connect needs nothing else from the library.

## Open — none of this is settled

::decision[Where does the package live — a workspace inside systemview, inside autobot, or its own repo?]{id=d1 owner=systemview-test}

::decision[Is the gallery Storybook, or our own story surface grown into one?]{id=d2 owner=systemview-test}

::decision[Is the injected bundle Preact-aliased from day one, or React until the payload measurably hurts?]{id=d3 owner=systemview-test}

::decision[Which organism migrates first — AgentChat (nearest to passing the test) or Markdown (the biggest payoff)?]{id=d4 owner=systemview-test}

::decision[Is in-page injection part of v1, or does v1 stop at the two existing apps plus the floating panel?]{id=d5 owner=systemview-test}

::decisions

## What this does NOT propose

- No rewrite of any surface off React. The library is extraction, not reauthoring.
- No UI code crossing connections. Contracts travel; components are installed.
- No decision about connect's channel — only the constraint that it can carry a transport.
- No change to how documents register or render. The markdown vocabulary moves house eventually; it
  does not change.
