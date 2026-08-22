# RFC-044 — One kind of report

**Status**: drafted 2026-08-20, not started. Written from his message, which is the spec:

> *"Stage reports is no longer a thing. All reports become one thing. So now all I gotta do is say
> create a report. They all show up on TV. Stage is just a backdrop if I wanna take a report from TV
> to stage. That's all. So there's no more separate reports, and I don't have to worry about deleting
> those reports or doing anything with those reports anymore. The reports are on TV, which is very
> connected to the chat, and stage is just there for showing the reports elsewhere. And reports
> should get cleaned up naturally when compactions happen."*

## What is already true (RFC-040 got us most of the way)

`systemview show` writes `.systemview/report.<project>.<name>.md` **and** adds a row to
`.systemview/reports.index.json` — the same index the Stage's Reports tab lists. So a TV report is
already a Stage report: one file, one list, no copy. The 📄 hand-off (today) points the Stage at that
same path and closes the TV.

Two species remain, and they are the whole of this RFC:

1. **The TV lists ROOM RECORDS; the Stage lists DOCUMENTS.** The TV picker filters the chat for
   `cmd:"show"` records. So a report written in the Stage exists, is indexed, and is invisible on the
   TV — and a report pushed twice needed de-duping by title, because two records pointed at one file.
2. **Two deletes.** The TV has ✕ → `chatHide` (hide the record, keep the file). The Stage has its own
   hide list (`__hidden` in the index). Neither deletes anything, so both accumulate.

## The change

### 1. The TV lists documents

The picker and the collector read the **report index** for the project, newest first, instead of
filtering room records. Consequences, all of them simplifications:

- a report created anywhere — CLI, the Stage's Edit, an agent — is on the TV, with no announcement
  required;
- **the file is the identity**, so re-pushing a title cannot produce two entries and the de-dup rule
  (and its two implementations, picker + collector) is deleted;
- the room record goes back to being what it should always have been: a **line in the conversation
  saying a report was put up**, not the report's registry.

What stays in the room: `currentShow` — "what did an agent put on the screen just now" is a fact
about the conversation and belongs there. The index answers "what reports exist"; the room answers
"what was pushed". Today those two questions share one answer and it fits neither.

### 2. Delete is delete

One ✕, in both places, and it removes **the document and its index row**. The room keeps its record
— a transcript is not rewritten — and a pointer whose file is gone renders as a quiet
*"this report was deleted"* line rather than an error. Retire `__hidden` and the show-hiding path
(`chatHide` keeps its other uses).

His sentence — *"I don't have to worry about deleting those reports"* — is mostly answered by §3, but
when he does delete one it should mean it.

### 3. Lifecycle: compaction takes the reports with it

Nothing prunes report files today. Compaction is already an agent's standing instruction
(`agents/chat.md`), and it already knows which span of the room it is archiving — which names exactly
the reports that went with it.

Added to that procedure: when a span is archived, each report pointed at from inside that span moves
to `.systemview/reports/archive/`, **except** a report he answered in (a `:::reply{author=you` or an
`answer=` in the document). Those are decisions, not chatter, and they stay in the live list. The
index row moves with the file, so the Stage and the TV both stop listing it, and nothing is deleted —
same rule the chat archive follows.

This wants a line in `agents/chat.md` and in `systemview skill`, so every agent does it without being
asked, the same way room compaction works now.

### 4. The Stage becomes a viewer

The Reports tab keeps what a big surface is for — reading, editing, ⏱ history — and loses its
identity as a place where a *different kind of report* lives. Its "new report" writes the same file
and index row it does now; the only change is that the TV lists it.

## What this does not change

- Where reports live (`.systemview/report.<pc>.<name>.md`) — no migration.
- Threads, replies, answers, `systemview reply`, `systemview thread` — all document-level already.
- The 📄 hand-off, which is the "take a report from TV to Stage" he described, already built.

## Two questions for him

::question[On compaction, a report from the archived span should…]{id=q1 options="move to .systemview/reports/archive/|be deleted outright"}

::question[A report created in the Stage should…]{id=q2 options="appear in the TV list silently|also post a line in the room"}
