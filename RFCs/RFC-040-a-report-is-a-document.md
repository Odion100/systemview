# RFC-040 — A TV report is a document, not a chat record

**Status**: designed 2026-08-19, not started. From his board note: *"we need to pull TV reports out of
the chat document and just point to them and save them separately… they kind of become just like
regular reports anyway."*

## The one fact that causes everything

A show is a **chat record carrying its entire text**. That single fact caused all four of these:

| symptom | why |
|---|---|
| the picker listed the same report three times | three pushes wrote three records |
| delete had to mean **hide** | you cannot remove a record from a transcript without rewriting history |
| compaction was dangerous | 23 show records had to be special-cased or his reports would vanish |
| the room file was 138KB | mostly report text, re-sent in full on every push |

Each got its own patch this week. They are one bug.

## The change

A show becomes a **report file**, in the store reports already use:

```
.systemview/report.<projectCode>.<slug>.md      the document
.systemview/reports.index.json                  the entry (name, path, ts)
```

The chat record keeps only a **pointer**: `{ cmd: "show", label, args: { report: "<name>" } }`.

- **Re-pushing** the same title is a **save** to the same file. Duplicates become impossible rather
  than deduped after the fact.
- **Deleting** is deleting a document — the ✕ and the hidden flag both retire.
- **Compaction** stops caring: the room carries a pointer, so nothing it drops can lose a report.
- **His answers** (`answer=`, `verdict=`, `sha=`, thread replies) are written into the FILE, so they
  survive independently of the room — and the TV's separate click-state store retires with them.

## What has to move

1. `cli/chat.js show` — write the document + index entry through the project's plugin, then post the
   pointer record. `--file` already reads the markdown; this changes where it lands.
2. `chatGetTv` / `chatSetTv` — read and write the file when a record carries `args.report`; keep the
   old text path for records that predate this, so nothing already in a room breaks.
3. The TV, the picker, the collector — all read the label from the record and the body from the file.
4. `systemview reply` — splices into the file instead of the record. Simpler than today.

## Migration

**On first read, not in a batch.** A text-carrying record opened on the TV is written out as a
report and the record is patched to a pointer. Nothing is converted that nobody looks at, and there
is never a moment where half the room is one kind and half the other from the reader's point of view.

## What this unlocks next (his other board note)

Agents currently re-read a whole report to answer one thread. Once a report is a file:

- `systemview thread <pc> <report> <id>` — one thread **with its wrapper** (the heading and any
  checklist rows around it), which is what BUApp asked for.
- `--since` — what changed since I last read it: new replies, flipped boxes. A file has history and
  snapshots already, so the delta is a diff, not a new subsystem.
- **and who** — my addition: a delta that doesn't say whether it was him or another agent makes me
  read everything again anyway.

That is RFC-041, and it is cheap only because of this one.
