::report{id="The panel says what it could not build" as=account retain=24h}

::members{who=systemview-test}

The proofs panel's card builder skipped, in silence, every spec it could not build — the scope line
said "1 spec" while the list below rendered none of it, and a press ran nothing with no reason
anywhere on screen. You found it with your own hands tonight: *"the run blocks don't run, they don't
say anything. It's just you click it and nothing's happened."* The headless runner already named
this state; the panel was the last silent door.

## The evaluation, recorded before the work

The card was mine from earlier tonight, declared `spec`, reviewed with the verdict before building:
**do it as stated, window side.** Three causes, each now handled at build time and said in one line
under the proofs bar:

| the silence | now |
|---|---|
| a spec whose steps all failed to resolve was `continue`d | a named issue — document, line, `0 of N steps`, which project's pool came up empty |
| the builder ignored a block's `{project=…}` | the declared project picks the pool, as the document block and the headless runner already honour |
| an EXPLICITLY named service was never checked — `toStep` consults the pool only for short names, so the card built and died silently at press | explicit names are validated against the pool at build, so unresolvable is unresolvable whichever way the step was spelled |

The builder also moved out of the component into `proofRows.js`, which that file's own first
paragraph had required all along.

## Where the tests stand

| what ran | what it said |
|---|---|
| `proofRows` suite | 31 pass — 5 new, and silencing the issue push fails exactly the three that watch it |
| `yarn verify` | 2338 window · 365 hub · 12 cli, plus the production build |

The bundle is rebuilt (`main.d6d72c3e.js`) and waits on the window's own hold.

## Walk it

- [ ] open this report with the proofs panel beside it — the three chips resolve and run
- [ ] open a document naming a service that is not connected — the panel now says which step,
      which service, which project, where it used to say nothing

::file[src/organisms/TestPanel/proofRows.js#L63-131]

## The second pick closed without code

The `systemviewcore` ghost listener: zero hits in the current boot log. It was the stale
registration from the pre-rename era replaying through the old records, and it died with tonight's
registration cleanup. `api/hosted.json` holds two entries, both legitimate.

## The commit

::commit{sha=117a345c}
