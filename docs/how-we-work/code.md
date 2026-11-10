# Code — the rules that outlive one codebase

Every other chapter here is about documents. This one is about the code those documents describe,
and it holds only what is **method** — true in every repo, and the reason a claim can be checked at
all. Framework API detail is not here: ask `context("systemlynx <the thing>")` for that, because a
second copy of an API drifts and the copy in the document nobody runs is the one that goes wrong
quietly.

There is one rule so far and it earns a chapter because nothing else in this corpus could hold it.

## Does it cross a wire? — the one question that decides whether something is a service

**If it already does client↔server communication — browser to hub, shell to hub, process to
process — it belongs at a module on a service.** His rule, and the reasoning is what makes it
method rather than preference: *that communication IS the problem the framework exists to solve
once.* An Express route, a hand-rolled fetch, or a reimplemented wire envelope is that problem
solved again, locally — so a fix in the framework reaches nobody, and the local copy has to be
maintained by whoever finds it next.

**If it is called directly, in-process, with no wire, it is not a candidate.** Wrapping it for
testing is the right answer instead, and which rung that wrapper sits on is `spec-authoring`'s call.

**The inverse error reads as diligence and is the common one.** Hunting a namespace for a plain
in-process function and inventing a service to hold it. His warning, given with the rule: *"just be
careful that you're not making up a reason to turn it into a SystemLynx service."* **A low rung on
direct code is not a finding. A low rung on something that already crosses a wire is.**

## Why this chapter is method and not the framework's own business

Because it is what makes the rest of this corpus possible. `claims.md` asks a behavioural claim for
a living spec — something addressable that re-runs and goes red on its own. **A method reached by a
hand-rolled request has no namespace, so there is nothing to address, so there is no spec anybody
else can run.** The claim then falls back to a `cmd` or a screenshot and the document quietly loses
the half that would have caught a regression.

So a wire crossed without the framework does not cost you tidiness. It costs the claim its proof,
one rung at a time, and the bill arrives in a document weeks later.

## Call it through the client — never rebuild the envelope

**To call a service, use the real client.** `Client.createService(connectionData)` or
`Client.loadService(url)` in code; the systemlynx MCP (`services` → `loadService` → `call`) for an
attached service ad hoc.

**Do not hand-roll HTTP against the wire.** The envelope is `{"__arguments": [ … ]}` — an **ARRAY**,
so a method taking one object takes an array of one. Rebuilding that by hand is where the
`__arguments` trap bites, and it bites in the direction nobody checks: a wrong-shaped body does not
error, it arrives as `undefined` and the method's own guard then blames the caller for the one
argument they got right.

**And it has been paid for here, which is why the rule is written down.** Measured in the harness:
two separate files reached a hosted service with a raw `fetch` and a hand-built envelope **while the
framework that solves it sat installed in that same repo's `node_modules`** — one of them carrying a
comment that an afternoon had already gone to getting the wrapping wrong, the other admitting in
prose that it "assumes the route shape, so nothing else can be attached." Nobody chose that; it was
easier to write one `fetch` than to load a client, twice, a year apart.

## The shape of a service — modules are plain objects, middleware declared per method

Four things that are the shape rather than one project's taste. buAPI is where this is practised
most fully and is worth reading if you have it; what follows is the pattern, which is what travels.

**A module is a plain object whose methods are assigned to `this`.** The methods live beside it in
their own file; the module file only wires them up.

```javascript
// Users/index.js — the surface
module.exports = function () {
  this.db = dbContext("Users");
  this.signUp = signUp;          // from ./methods.js
  this.signIn = signIn;
  this.before("signUp", resolveLocationHierarchy);
  this.before("edit", setUserId, replaceId(), rejectEdits(RESTRICTED));
};
```

Nothing is a handler and nothing takes a request — they are functions. That is what lets the same
object be hosted, called in-process, or wrapped for a test without changing a line.

**The middleware chain is DECLARED next to the wiring, per method.** One file then answers *what can
this module do, and what runs before each thing* — so authorisation is readable without tracing a
router.

**`common/` exists at every level**, and which level a thing sits at is not a filing preference —
it is a declaration. That is the next subject.

**And the specs sit beside the service, one file per method** — `<service>/specs/tests/<Module>.<method>.json`.
**That is the whole payoff of this chapter in one path shape.** Because the method has a namespace,
the spec has an address; because the spec has an address, a claim in a document can point at it and
re-run forever. A method behind a hand-rolled request cannot be named, so it cannot be pointed at,
so the claim above it falls back to prose.

## Depth declares coupling, and a file GRADUATES up to it

**The goal of a folder structure is to make coupling checkable** — not merely visible. Where a file
sits says how many things are permitted to depend on it, and the levels are a hierarchy:

| the file sits | it declares |
|---|---|
| repo-root `common/` | every service may couple to this |
| `<Service>/common/` | that service's modules, and nobody outside the service |
| beside one module — its own `methods.js`, `middleware.js`, `utils.js` | that module alone |

**A file is written at the narrowest level that works, and GRADUATES when a second consumer
appears.** That is why some modules carry their own methods and middleware while others are an
`index.js` alone: at the time of writing, those methods were genuinely unique to that module. When
something elsewhere needs one, it moves up a level — and **what moves is the function and the
comment that says why it exists, together.** A method that arrives in a `common/` without its reason
reads as a utility and gets used for a shape it was never built for.

**So depth is a record of demand, not a design.** This cannot be laid out top-down, because at write
time nobody knows what will be needed twice. The tree accumulates the answer, one promotion at a
time.

**And coupling has a legal direction — up, never sideways.** A module does not require a sibling
module. Measured across four services in the codebase where this is practised most fully: **zero
sideways requires**, 40 reaches up into a service's own `common/`, 62 into the repo root's. When a
sibling's function is wanted, the answer is never an import across; it is to graduate the shared
part up, or to recognise it belonged to one module and inline it there.

## The two coupling defects, and what the tree cannot tell you

**The second is the one nobody looks for:**

- **A sideways require.** It is in the path, so it is mechanical to find and the fix is one of the
  two moves above — never "add an import".
- **A file that was BORN shared.** Placed in a `common/` because it felt general, so it skipped
  graduation and its depth is a claim no second consumer ever paid for. **The tell is a shared file
  with exactly one consumer.** Nothing breaks, which is why it survives for years — and every reader
  after it takes the depth as settled fact and couples to it accordingly.

**What the tree cannot tell you.** It declares what MAY couple, never what does: a clean tree and a
tree with a sideways reach are indistinguishable until something greps the requires. So a folder
structure is a claim in exactly the sense that word carries here — it reads as proven, and it is
proven only when something presses it.

## A custom HTTP client is the framework's seam, not a workaround

**This is the boundary that keeps the rule above from over-firing**, and without it a reader
condemns code that is correct.

A transport with special needs — cookies, credentials, multipart uploads — does **not** mean
bypassing the client. The framework takes your transport: `createClient(myHttpClient)`. SystemView
does exactly this for its browser and CLI clients, and both touch `__arguments`
legitimately, because form-encoding the envelope is the custom client's own job.

**So the violation is bypassing the client entirely, never customizing its transport.** Reading
`__arguments` in a diff is not a finding by itself; reading it beside a bare `fetch` is.

## Ask it on both sides — the tell is in the caller

**Publishing at a namespace while every caller still hand-rolls HTTP has moved the problem, not
solved it.** And this is the half that gets missed, because the service looks finished: the module
is there, the methods are there, the namespace resolves. **The tell is never in the service — it is
in the caller**, which is a different file, often a different repo, and nobody opens it while
reading the thing they just built.

So the question is asked twice: does this cross a wire, and does everything that calls it go
through the client.
