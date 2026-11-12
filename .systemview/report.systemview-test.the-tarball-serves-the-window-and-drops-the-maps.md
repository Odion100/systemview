::report{id="The tarball serves the window and drops the maps" as=account retain=30d}

::members{who=systemview-test}

:::glance
- **agent** — systemview-test
- **run** — a use-pass sitting, off a board card about the published CLI
- **new features** — none
- **fixes** — source maps dropped from the tarball — 50.8MB to 30.2MB unpacked, and the card's premise that the build output does nothing for a CLI was false
- **corrections** — three dead services of my own, resurrected on every boot by stale .systemview/manifest.json entries — cleaned as data, not code
- **decisions** — G-13 — RFC-074's two deleted claims, the only two reds, waiting on his call
- **live** — not stated
- **checked** — runProofs whole project 44 of 46, the two reds the same deliberate tripwire · yarn `test:cli` 15 — three new, packing the tarball dry · the dial list after the clean: TestService · Test · Hub
:::

A use-pass sitting: the project's whole proof inventory run headless and read past the green line,
and the two things that broke under my own hands fixed with the evidence beside them.

## The tarball — and the card's premise was wrong

The card said the published CLI ships the IDE's build output and none of it does anything for a
CLI. **The second half is false, and acting on it would have shipped a dead hub:** `api/index.js`
resolves `buildPath` against the package's own folder, so an npm-installed `systemview start`
serves the tarball's bundle — `build/` is the window, as cargo. Your own running hub only escapes
because the standing-order recipe uses `/usr/local/bin/systemview`, the yarn link into this repo —
`which systemview` resolves to the nvm global `2.40.1`, a real install serving its own packaged
bundle if anything ever launches it bare.

The honest cut is the **source maps**: `"!build/**/*.map"` in `files` takes the unpacked install
from **50.8MB to 30.2MB**, and the only loss is devtools' source view. The card's `spec`
declaration is honoured as a node suite that PACKS the tarball dry — the same walk `npm publish`
does — because `npm pack` is not a door any registered service can dial; the claims below are
runnable where the subject lives.

::claims

::::claim[the tarball ships no source maps, and the window it serves is still whole — index.html, the main bundle, the stylesheet, the CLI, the hub, the shared vocabulary and the spec runner all ship]{id=p1 state=met by=systemview-test note="cli/package.test.js packs dry and asserts both halves; mutation: the negation out of files reds exactly the no-maps claim; 15 cli tests green" told=systemview-test}
:::cmd
cd ~/Systemly/systemview && yarn test:cli 2>&1 | tail -4
:::
::::

## The resurrection — three dead services on every run, cause read off the disk

Every proofs run dialled `GatedService` (5556), `GatedSibling` (5557) and `LoadBalancer` (5569) and
printed *did not answer* — all three dead, all mine. The cause was one layer down from where it
looked: `.systemview/manifest.json`'s services list still carried the gated pair **and
`SystemViewCore`, the renamed-away name** — and `getConnectionData` replays the WHOLE manifest list
whenever any live sibling answers, so one living fixture resurrected every dead one on every boot,
through two hub restarts today.

Cleaned as data, not code: the three stale entries out of the manifest (`TestService` stays — alive
at 5555), the dead rows disconnected from the live hub, and the live plugin's `getManifest` re-read
to confirm the file is what any future boot replays. A scoped proofs run now dials three services
and nothing else:

:::cmd
cd ~/Systemly/systemview && curl -s http://localhost:3000/systemview/api >/dev/null && echo "hub up — run any spec and read the 'ran against' line: TestService · Test · Hub, nothing dead"
:::

**BUApp's `Test` row (60211) was left alone on purpose** — it answers, it is another project's
hosted service, and a live registration is not residue.

## Where the whole inventory stands

| what ran | what it said |
|---|---|
| `runProofs`, whole project | **44 of 46** — the only two reds are the same deliberate tripwire, counted from RFC-075 L357 and from G-13: RFC-074's two deleted claims, waiting on your call |
| `yarn test:cli` | 15 — three new, packing the tarball |
| the dial list, after the clean | TestService · Test · Hub — no *did not answer* |

## Walk it

::branch[main]

- [ ] `runProofs({projectCode: "systemview-test", dryRun: true})` → 46 collected, and a real run's
      `ran against` line carries no dead dials
- [ ] `npm pack --dry-run` in this repo → 150 files, no `.map`, 30.2MB unpacked
- [ ] the two reds are G-13's tripwire — resolving G-13 is what turns them

::file[package.json#L108-L119]

::file[cli/package.test.js]

## The commits

::commit{sha=7ed0744c}

## What this did not touch

RFC-076 answers `runProofs` with *no run or test blocks* — its behavioural claims are cmd-backed,
which is the spec debt its own ladder already names (`stepSpecs`: 42 owing). Known, counted, not
this sitting's. And the `Test` service's spec store still lists a doc named `SystemViewCore.md` —
the old name on a filename, cosmetic, left where it is.
