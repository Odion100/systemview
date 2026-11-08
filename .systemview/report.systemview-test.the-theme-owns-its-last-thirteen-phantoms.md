::report{id="The theme owns its last thirteen phantoms" as=account retain=24h}

::members{who=systemview-test}

Thirteen `--sv-` tokens were consumed across ten stylesheets and defined nowhere — every use
carrying its own hardcoded fallback, written for light mode, which on a dark surface is the
dark-on-dark your card named (and once, inverted: `--sv-panel` rendered a dark menu in light mode).
The card's list was ten days old; today's census found 15 consumed-but-undefined, of which two are
not phantoms at all.

## The evaluation, recorded before the work

On the card before building: eleven of the thirteen are **second names for ramp concepts** and die
by repointing — three grays to `--sv-text-muted`, two hairlines to `--sv-border-soft`, two hovers to
`--sv-hover`, `--sv-surface-soft` to `--sv-inset`, `--sv-bg-raised` and `--sv-panel` to
`--sv-surface`, `--sv-mono` to the literal stack. Two are **real concepts**: `--sv-amber` (18 uses)
and `--sv-accent` (6), defined in both theme halves at the values their dominant fallbacks already
rendered — the theme file's own rule for the reds: naming a colour is not the moment to change one.
The one use that wanted green rather than "accent" now names `--sv-kind-report`.

The two survivors are **dynamic element variables** — `--sv-buffered` (SpeakReply writes a percent
per element) and `--sv-tree-max` (CodebaseNav writes a pixel height). The theme must never define
them; the suite now says so by name instead of carrying them as debt.

## The suite watched its own blind spot get proven

The first mutation pass came back GREEN on both mutations — a drifted hex and a deleted
definition — because the phantom check collects definitions from *every* stylesheet, so the
markdown scope's redeclaration shields `theme.scss` from it entirely. The new pair is therefore
pinned the way the reds are: both halves, exact values, and no stylesheet may carry a fallback for
either. Re-run: each mutation fails exactly one claim; restored, 14 green.

## Where the tests stand

| what ran | what it said |
|---|---|
| `themeTokens` suite | 14 pass — the debt list is gone, the dynamic pair named, the new pair pinned |
| `yarn verify` | 2340 window · 365 hub · 12 cli, plus the production build |

The stylesheet rides the css hash; the window swaps on its own hold.

## Walk it

- [ ] dark mode: an expanded commit's body, the job-run state menu in light mode, and anything
      amber — pending chips, held rows — now flip with the theme instead of freezing light values
- [ ] `src/sass/theme.scss` — the pair sits beside the reds with the same one-rule comment

::file[src/sass/theme.scss#L48-62]

::file[src/sass/themeTokens.test.js#L35-52]

## The commit

::commit{sha=21737419}
