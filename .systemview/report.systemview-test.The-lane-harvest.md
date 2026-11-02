::report{id="The lane harvest" as=account retain=12h retired=2026-10-31 retiredAs=expired}

# The lane harvest

Fifty lane branches had been standing for nine to twelve days with their work never brought in.
Their run records had been swept by the retention janitor, which unregistered them — so the lanes
door could not see them and `remove` had no grip on them. Not one of the fifty read `in`. Sixteen
read `out`: **proven absent from the tree**.

This is the account of what came back.

**systemview — all 37 accounted for, and already merged into `main` at `fc5baf1`.** 32 commits,
80 files, +5415/−289, each lane keeping its own commit message. Suites green on the assembled
result: **1633 window tests / 114 suites, 238 api tests.**

**autobot — all 13 accounted for, merged into `ElementLocator` at `748c4a6`.** 11 commits. Suites
green: context 157, registry 55, jobs 39, definitions 29, documents 29, markdown-state 37, lanes 17,
nudge 20, worklist 60 with the retention split restored on top, hooks and ledger passed.

All 50 lane branches and 53 worktrees have been swept. No lane run records remain.

---

## Brought in — systemview

| what it fixes | lane |
|---|---|
| The band's *decision waiting on you* count read 20 of 23 reports and missed approvals nested in threads | `an-approval-waiting-is-never-missed` |
| A service being down made tests read **failed** instead of **not run** — four chat tests sat in standing red where a regression would have been invisible | `suite-says-not-up` |
| A step that declared assertions and saved none reported a pass | `a-step-that-asserts-nothing-says-so` |
| A subagent that never registered a lane spent and wrote with the strip silent | `no-subagent-runs-unseen` |
| The context bar read healthy at the percentage we act on | `the-context-bar-says-our-mark` |
| A report on disk whose index write failed was invisible to every agent | `no-report-hides-on-disk` |
| A verdict needed scrolling to the block; now it is two chips at the top | `a-verdict-without-scrolling-to-the-block` |
| *Back to where you were* degraded to a branch you may never have stood on | `branch-remembers-where-you-stood` |
| A code fence threw away its info string, so a sample read as a block that failed to render | `a-fence-says-what-it-is` |
| A reply made its author current only on the thread, so a solo-member document owed updates about its own words | `a-reply-makes-its-author-current` |
| A thread send could not name the reply's author, which was the last thing holding back a wake loop | `a-reply-says-who-wrote-it` |
| A job run's state chip was derived; now his own mark wins it | `job-card-state-selector` |
| An expanded job card's file chip pushed the whole strip sideways | `strip-never-scrolls-sideways` |
| A panel that threw unmounted the window | `a-panel-that-throws-goes-grey` |
| The registry accepted a url nobody can call, and parallel boots left duplicates | `the-registry-refuses-junk` |
| A door-backed document did not come back after a refresh | `a-standing-tab-brings-its-document-back` |
| The hub's log sort across services was a no-op | `one-timeline-across-services` |
| A trace payload could kill the service it was observing | `observability-cannot-kill-the-observed` |
| One command for the whole codebase — `yarn test` only ever covered the window | `one-command-runs-the-whole-suite` |
| A verdict press announced itself as *a document was updated* | `a-decision-tells-the-room` |
| A ticked checkbox told the room too | `a-ticked-task-is-a-decision` |
| Stale lanes were measured before being partitioned, so six dead branches skewed every pair | `a-landing-order-you-can-trust` |
| A lane accepted by hand left no receipt | `his-press-leaves-a-receipt` |
| The credential and cookie chain had no claims | `the-cookie-rule-is-claimed` |
| The plugin had no harness, so its request hooks were read rather than proven | `the-plugin-gets-a-test-harness` |
| Membership parity between the hub's parser and the window's was unproven | `documents-sees-thread-members` |
| A thread born three colons wide could be narrowed by `normalizeFences` | `a-thread-is-born-replyable` |
| The markdown reference still taught per-thread attaching after inheritance shipped | `the-markdown-doc-teaches-the-rule-that-shipped` |
| Two gaps answered — one already fixed, one blocked upstream | `two-gaps-answered` |

## Brought in — autobot

| what it fixes | lane |
|---|---|
| Editing a skill's `SKILL.md` never made its sessions stale — the fingerprint watched the def's *list of names*, so a description could be rewritten fifteen times and nobody was told | `editing-a-skill-makes-a-session-stale` |
| A verdict press announced as *a document you are a member of was updated*, sending the reader to open a file to learn what they had been told | `a-decision-has-its-own-headline` |
| A job report pointer led nowhere once its subject settled — 29 of 66 | `a-job-report-pointer-is-a-claim` |
| A job lost its run while a lane ran underneath it | `a-job-keeps-its-run-under-a-lane` |
| The jobs suite stamped his live chore board with its own fake job | `job-state-is-his-mark` |
| A worktree's borrowed `node_modules` symlink was committable, and landing it clobbered the real deps | `gitignore-covers-the-symlink` |
| A lane's receipt did not say **whether** the work was merged or applied as uncommitted changes — the whole answer to whether your tree is the only copy | `a-receipt-says-how-the-work-came-in` |
| Three suites wrote into your live store: the context suite inflated the note read-counts maintenance reads, the hooks suite wrote its fire ledger, session logging re-derived the log path behind the pin | `suites-leave-his-store-alone` |
| A subscription could not be read as a hook, so a typo'd operator was accepted at the writing door and three moment names mapped to nothing | `subs-are-hooks` |

## Already in — nothing lost, verified against the code

Twelve lanes had reached the tree by another route and were then built past. Each was checked, not
assumed.

**systemview:** `voice-kokoro` (the same neural engine shipped a day later with 28 voices instead of
8) · `an-objective-is-a-block` · `an-arc-shows-its-own-state` · `the-worklist-settings-cog` ·
`a-card-says-what-was-done` · `chat-probes-own-their-rooms` · `gate-test-current-design` ·
`the-hub-says-where-it-keeps-its-rooms`

**autobot:** `board-door-takes-a-status` · `an-unfinished-run-nudges-its-agent` ·
`a-thread-send-does-not-wake-its-author` · `a-job-run-keeps-its-report-pointer`

## Left out on purpose — three refusals worth knowing

- **`a-thread-send-does-not-wake-its-author`** — half of it is already in; the other half was
  **deliberately reversed** after *"I clicked the send update button and you didn't get no
  message."* Landing it would have re-broken a bug already fixed.
- **`voice-kokoro`'s engine toggle** — its premise is overruled in `voice.js`, and mechanically
  `useEngine(null)` resolves to kokoro, so the toggle would be a control that lies.
- **`an-arc-shows-its-own-state`'s `::timeline` block** — removed by intent, replaced by the spec
  map. Re-registering it would revert a decision, not recover work.

A fourth was a near-miss: a `hubServedItsDir` field would have been a spec claim that can never
fail, because the guard above it returns early. A tautological assertion is worse than none.

## The single-page question, answered

No lane had it, and **there is no page reload on that path.** All 37 branches were searched and
every full document load in `src` accounted for — the four `location.reload()` calls are the bundle
self-update, none on the view switch. `NavLinks` already uses react-router `<Link>`, and every
markdown chip does `preventDefault` + `history.push`.

The symptom is a **destructive unmount, not a refresh.** `src/App.js:142` is a `<Switch>`, so
crossing Code↔Agents unmounts the entire page tree; `AgentChat` is mounted separately inside each
page, so the chat, the terminals and the code pane are torn down and rebuilt every time. A fix has
to keep both trees mounted and toggle visibility instead of swapping routes.

One dead file turned up on the way: `src/organisms/AgentPanel/AgentPanel.js:164` is the only raw
internal `<a href>` in `src` with no `preventDefault` — it would be a full load into the agents view
and would drop the project code. Nothing imports it.

## Why this could happen at all

The run record **is** a lane's registration. The retention janitor was applying one window to every
kind of run, so it swept lane and job records at twelve hours — which did not merely lose a receipt,
it unregistered fifty lanes and put them beyond the only verb permitted to clear them. Retention is
now per source family: `keepHours` for skill and session lists, `keepWorkHours` for job and lane
runs, floored at a day, pinned by a claim in `tests/worklist.js`.
