::gap{id=G-17 subscribe=buapp from="BUApp session, 2026-11-12 — he asked what a folder in my prompt was"}

# Every agent loads a per-project memory store this system cannot see, and nothing surfaces it

**Measured on this machine, 2026-11-12, by counting the files before deleting them.** The Claude
Code preset writes a per-project note store at `~/.claude/projects/<cwd-slug>/memory/` — a folder of
markdown notes plus a `MEMORY.md` index. The index is injected into the session's system prompt
**every session, unasked**, labelled *"user's auto-memory, persists across conversations"*. It is
not in any repo, it is not gitignored, and it is not reachable from this system's context stack:
no corpus, no note scope, no subscription, no hook, and nothing on the Agents page accounts for it.

```
$ find ~/.claude/projects -maxdepth 2 -type d -name memory | wc -l
292
$ # markdown files across them, before deletion:
345            # ~1.9 MB
```

Per project, where the agents are real ones:

| slot / cwd | files |
|---|---|
| BUApp | 86 |
| agentci | 12 |
| SystemLynx | 10 |
| autobot | 7 |
| boxing-app | 4 |
| skill-eval cwd | 8 |
| ~30 throwaway tmp cwds | ~218 |

Oldest entries date to **May 2026**. Nothing retires them, nothing reads them back for accuracy, and
the agent carrying one cannot tell it apart from its own definition — it arrives in the same block of
the prompt as presence and the system context.

## The proof that it is not merely redundant — it contradicted the system and won

`~/.claude/projects/-Users-odionedwards-BUApp/memory/feedback_never_commit.md`, written May 2026,
asserted: *"Never run `git commit` on Odion's behalf… leave them as working-tree changes for him to
review and commit himself… if he wants a message, GIVE the single-line `git commit -m` for HIM to
run — never run it."*

Both of this system's own layers say the opposite, and say it explicitly:

- `~/.autobot/presence.md` — *"You commit your own work. Stage it, write the message, commit it."*
- `docs/how-we-work/registration.md` — *"Agents commit their own work."*

The hidden note is the one that loads first and loads always. **So on the far side of a compaction
I asked him to confirm whether I may commit — a question his own documents had already answered —
and raised the handbook's commit convention to him as a conflict.** His answer: *"Shut the fuck up.
Guys work mostly on automation now and make our own commits… It's actually explicit here. Stop
overthinking it."*

That is the cost in its clearest form: the visible system was correct, the agent was wrong, and the
reason was a file nobody on either side could see. A note that cannot be found cannot be corrected,
so it does not decay — it hardens.

His ruling, the same session: *"I have a complete handling context within my harness. Everything is
supposed to be visible. That's hidden context and it's a violation."*

## What is missing — the capability, in two halves

Deleting the folders (done, all 345 files, today) is not a fix: **the preset writes them again**, so
the next session of every agent starts rebuilding its own invisible store. And the deletion itself
was only possible because he happened to see the index in a prompt and ask what the folder was —
which is the part that should not depend on luck.

- **Nothing in this system can SEE it.** The Agents page shows an agent's definition, its store
  statistics, its subscriptions, its carried hooks and its call ledger — the complete account of what
  an agent is carrying, except for this. There is no surface that reads `~/.claude` at all, so the
  one store nobody curates is also the one store nobody can look at.
- **Nothing in this system can STOP it.** Sessions are constructed here, so whatever setting or flag
  governs the preset's memory step is settable at construction — but no code in either repo touches
  it today, and I did not establish whether such a setting exists.

Which of those two halves belongs here and which belongs in the harness that spawns the sessions is
the owner's call, not the filer's. What is not in question is that an agent in this system is
currently carrying always-loaded context that the system has no door onto.

## Not this

Not the session transcripts under the same tree (`~/.claude/projects/<slug>/*.jsonl`) — those are a
record of what happened and nothing injects them into a prompt. This is specifically the `memory/`
store and its `MEMORY.md` index, which is loaded as instruction.

There is no `~/.claude/CLAUDE.md` on this machine, so that layer is clean.
