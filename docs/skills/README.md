# docs/skills — MIRRORS, not skills

**Nothing in this folder is loaded by anything.** These are tracked copies of skills whose live
files sit in `~/.claude/skills/<name>/SKILL.md`, which is where the Skill tool discovers from and
therefore the only place a skill can actually fire.

A mirror exists for one reason: `~/.claude` is not a repo. There is no diff there and no undo, so a
pass over a 400-line skill is a change nobody can audit afterwards. Committing the before and the
after of the same mirror turns that into one reviewable diff.

## Why this folder is not the fix for untracked skills

It looks like the fix and it is not, because of one distinction `electron/agents/skillSources.cjs`
spells out — **writable and discoverable are not the same truth.** A folder the harness merely
points at is visible and readable; its skills **cannot fire** until they live where the CLI looks.
So a skill moved here would be tracked, would travel, and would silently stop working.

The real move is the SDK's local plugin door — `plugins: [{ type: "local", path }]` — which loads a
chosen absolute directory that provides skills. That is designed in **RFC-064 here / RFC-010 in
autobot** (one design, two repos, two numbers) and the central part of it has not landed.

Until it does: **the live file is the authority, this copy is downstream.** After editing a skill,
re-copy it here in the same commit. A mirror that drifts from its skill is worse than no mirror,
because a reader cannot tell which one is the system.
