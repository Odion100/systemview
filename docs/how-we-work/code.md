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

## The shape of a service — modules are plain objects, and placement declares coupling

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

**`common/` exists at every level, and placement declares the coupling.** A repo-root `common/` is
shared across services; a service's own `common/` across that service's modules; middleware unique
to one module sits beside it. **Moving a file into a `common/` is a statement that a second consumer
exists** — never a junk drawer.

**And the specs sit beside the service, one file per method** — `<service>/specs/tests/<Module>.<method>.json`.
**That is the whole payoff of this chapter in one path shape.** Because the method has a namespace,
the spec has an address; because the spec has an address, a claim in a document can point at it and
re-run forever. A method behind a hand-rolled request cannot be named, so it cannot be pointed at,
so the claim above it falls back to prose.

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
