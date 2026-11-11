# The door stopped crying wolf — and I killed the wrong process getting there

::report{id="The door stopped crying wolf" as=account retain=24h}

**`commitLinks` reported seventeen findings tonight and every one was noise.** They were account
reports naming the commits they account for — eight from a single report — and the number grew with
every honest account anyone filed. It now reads **"the two directions agree"**, with the skipped
records counted and named rather than quietly dropped.

**And an honest one about how I got there:** arming it took three hub restarts, because the first
two didn't restart the hub. `lsof -ti :3000 | head -1` is not the hub — it's whatever process
happens to hold the first socket on that port, which was **your shell's Electron network helper**. I
killed it. Electron respawned it immediately and your window carried on, but that was luck rather
than care, and it is written to the store so no future session repeats it.

| | |
|---|---|
| **fixed** | `unclaimed` fires only for documents that COMMISSION work; the rest are counted as `noted` and said out loud |
| **mistake** | killed an Electron helper inside your shell while aiming at the hub. Respawned on its own; no damage I can find |
| **tests** | 2607 window · 380 hub · 23 cli · `yarn verify` green including the production build |
| **arming** | the hub half is **live** (listener pid 2694). The renderer half is autobot's and **rides your shell restart** |

---

## Why seventeen findings were all wrong

A `Serves:` trailer answers one question: **what asked for this work.** An arc asked. An RFC asked.
A gap asked. **A report asked for nothing** — it is written *after* the work it accounts for, so its
id did not exist when those commits were made and they could not have named it. Meanwhile
report-authoring requires a `::commit{sha=}` record per commit.

So the rule was asking a question that could not come out any other way, and every honest account
manufactured findings. A door whose output is mostly noise stops being read — which is worse than no
door at all, because it still looks like a check.

::commit{sha=43b53e0c}
::commit{sha=73ff922 project=autobot}

**Three things keep this from being a quiet narrowing**, and the first is the one that matters:

- **The records are counted, not dropped.** `noted` carries them and the door says *"N records on
  accounts — not checked, because an account records work rather than commissioning it."* A check
  that narrows itself in silence is precisely the fault I fixed in this same door an hour earlier,
  when it was reporting clean by not looking past 200 commits. The lesson applies to its own rules.
- **The default is strict.** An unknown or missing kind is still checked. Noise is visible; silence
  is not, so a new document kind cannot lose its teeth by nobody adding it to a list.
- **The teeth stay where a mistake can actually be made.** A commit that really does carry
  `Serves: <report id>` while the report lacks the record is still `oneWay`. A trailer naming one
  document while another carries the sha is still `crossed`, whoever carries it. Both have
  assertions.

:file[api/commitLinks.js]

## The mistake, in full

I restarted the hub twice believing I had armed the change, and both times the door kept answering
with the old code. What actually happened:

1. `lsof -ti :3000` lists **every process with a socket on that port** — clients included. The first
   row was your shell's Electron network helper, and `kill … | head -1` killed it. Electron respawns
   that helper on its own, which is why nothing visibly broke; the shell's main process never
   wobbled (unbroken elapsed time, checked).
2. The real hub kept running, so the `systemview start` I then launched found the port taken and
   came up as a **client** of the old hub. Two hub processes, one listener, old code answering.
3. The fix is to aim at the listener and nothing else:
   `lsof -nP -iTCP:3000 -sTCP:LISTEN -t`, kill that, confirm the port is empty, then start one.

Written to the context store so this costs nobody else an hour. **The reason it took three tries to
notice is the interesting part:** every step reported success — the kill returned 0, the new process
started, `curl` answered 200 — and the only thing that said otherwise was the door still printing
seventeen findings. The output was the evidence; the process management was testimony.

## Where the tests stand

| suite | ran | says |
|---|---|---|
| window | 2607 | green |
| hub | 380 | green — 6 new here, 11 across tonight's two commitLinks changes |
| cli | 23 | green |
| production build | bare, in `yarn verify` | compiles |

## What I could NOT verify

- **The `noted` line rendered.** Your shell holds the old renderer until you restart, so what I have
  seen is the hub's behaviour change (seventeen findings → "the two directions agree") and the unit
  assertions that those seventeen land in `noted`. I have not watched the sentence come out of the
  door. **Until you restart, the door will read as a clean bill of health with the caveat missing** —
  which is the one state I would not choose if I could help it.
- **`noted` populated over the real repo**, specifically. The direct HTTP call to the hub answers
  "no folder for this project" (the MCP route resolves the root differently), so I proved the
  narrowing through the MCP door and the contents through unit assertions, not both at once.
- **Whether killing that helper cost you anything.** I can see the shell's main process was never
  interrupted and the window answered afterwards. I cannot see whether a request in flight failed.

## Press-list

- [ ] After your next shell restart: `commitLinks` on this project should say "the two directions
      agree" *and* carry a line naming how many records it did not check, and why.
- [ ] If you ever see that door report clean with no window line and no noted line, the shell is
      older than the hub — that is the state it is in right now.
