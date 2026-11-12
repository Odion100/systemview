import React from "react";
import NsLink from "./blocks/NsLink";
import FileLink from "./blocks/FileLink";
import { Callout, Details, Columns, Col, Tabs, Tab, Carousel, Slide } from "./blocks/Structure";
import Glance from "./blocks/Glance";
import UiLink from "./blocks/UiLink";
import ChartEmbed from "./blocks/ChartEmbed";
import TestEmbed from "./blocks/TestEmbed";
import RunBlock from "./blocks/RunBlock";
import { LoadEmbed, TopologyEmbed } from "./blocks/StatsEmbeds";
import HelpLink from "./blocks/HelpLink";
import { Question } from "./blocks/Inputs";
import Thread, { Reply } from "./blocks/Thread";
import Approval from "./blocks/Approval";
import LogsEmbed from "./blocks/LogsEmbed";
import { FileEmbed, DiffEmbed } from "./blocks/FileEmbed";
import ImageEmbed from "./blocks/ImageEmbed";
import CommitBlock from "./blocks/CommitBlock";
import BranchBlock from "./blocks/BranchBlock";
import Ask from "./blocks/Ask";
import Members from "./blocks/Members";
import Objective from "./blocks/Objective";
import Cue from "./blocks/Cue";
import Prompt from "./blocks/Prompt";
import Arc from "./blocks/Arc";
import Rfc from "./blocks/Rfc";
import Report from "./blocks/Report";
import Gap from "./blocks/Gap";
import Progress from "./blocks/Progress";
import Claim from "./blocks/Claim";
import Claims from "./blocks/Claims";
import CmdBlock from "./blocks/CmdBlock";

// `file` is TWO things depending on how it's written — the same split `run` has. Inline is a
// reference (`:file[path]` → a chip that points at it); block is the thing itself (`::file[path]` →
// the file, in the document). One name, because it's one concept at two weights.
// An image is just another file kind: a block-form ::file pointed at one renders the image viewer.
const IMAGE_EXT = /\.(png|jpe?g|gif|webp|svg|avif|bmp|ico)(\s|$)/i;
const FileBlock = (props) => {
  if (props.kind !== "inline" && IMAGE_EXT.test(String(props.label || "").trim()))
    return <ImageEmbed {...props} />;
  return props.kind === "inline" ? <FileLink {...props} /> : <FileEmbed {...props} />;
};

// THE REGISTRY. Adding a feature to every markdown surface in the app is adding a line
// here; the renderer never changes. Nothing renders that isn't in this map (see directives.js on why
// that's also the security story).
//
// Each block component receives: { name, kind, attrs, label, children }
//   kind   "inline" | "leaf" | "container"
//   attrs  the {key=value} bag
//   label  the bracketed text, e.g. `:ns[Math.add]` → "Math.add"
export const BLOCKS = {
  // links — navigate, don't describe
  ns: { Component: NsLink },
  // `:ui[scratchpad]` — a reference to a REGION of the window. Same weight as :ns and :file, and it
  // is what lets an agent teach the layout on the fly ("this is the story, this is the scratch pad")
  // without a built-in tour. Clicking points at it; nothing is written anywhere.
  ui: { Component: UiLink },
  file: { Component: FileBlock },
  diff: { Component: DiffEmbed },
  help: { Component: HelpLink },
  // NO `report` CHIP HERE, AND THE ABSENCE IS THE FIX. This line read
  // `report: { Component: ReportLink }` and was overwritten eighty lines down by the registration
  // LEAF, because an object literal keeps the last key — so one name resolved to two different
  // components depending on where you read it: the leaf's lifecycle UI in a document, the real
  // chip in the chat, which imports `ReportLink` directly. One fact, two answers.
  //
  // The leaf owns the name. `::report{id=…}` is what makes a document a report, and the doctrine
  // is already that nothing should write a `:report[…]` chip at all — `agents/markdown.md`,
  // `agents/chat.md` and `docs/interactive-markdown.md` each say *never* — because a report is a
  // FILE and `:file[…]` reads as one without navigating anywhere. `ReportLink` stays on disk
  // because AgentChat still uses it as its unknown-ref fallback; what a `:report[…]` in a document
  // SHOULD draw is his open question, and removing a line that could never be reached does not
  // answer it either way.
  //
  // `registry.dupes.test.js` reads this source and fails on any repeated key, so the next one
  // cannot hide in a warning class nobody reads.
  // embeds — live things inside prose
  chart: { Component: ChartEmbed },
  test: { Component: TestEmbed },
  image: { Component: ImageEmbed },
  // RFC-071 — `::members{who=a|b}` — who is on this document. Leaf, at the top; the chips are the
  // membership itself, not a view of one kept somewhere else.
  members: { Component: Members },
  run: { Component: RunBlock },
  // `:::cmd` — a SHELL command, held verbatim, that the document you read it in can also run. A
  // separate name from `run` on purpose: `run` is the SystemLynx test engine (a service method and
  // its assertions), this is a process. One word for both would be one definition becoming two.
  // Opt-in only — a ```bash fence never becomes a button.
  cmd: { Component: CmdBlock },
  load: { Component: LoadEmbed },
  topology: { Component: TopologyEmbed },
  logs: { Component: LogsEmbed },
  // inputs — the document asks you something, and the answer lands back in the document
  question: { Component: Question },
  // `::ask[…]` — THE QUESTION, made visible. Not an input: it records nothing and offers nothing.
  // `question` is for a decision you want written down; this is for the one thing being asked, so
  // it cannot be scrolled past in a long reply and answered by a guess.
  ask: { Component: Ask },
  // conversation — a reply thread on a wrapped block, like a story pane's
  thread: { Component: Thread },
  // one reply, written INTO the document inside its thread
  reply: { Component: Reply },
  // RFC-072 — AN ARC IS A DOCUMENT OF OBJECTIVES, and these two are what make it one. `::arc` is a
  // leaf at the top that makes the document self-describing (no filename convention, no index);
  // `::objective` is a container whose attributes the machine addresses and whose content a person
  // reads. There is no issue store behind either: the block IS the record, so pressing an
  // objective's state writes into the file.
  arc: { Component: Arc },
  // RFC-073 §1.2 — the other two registration leaves. A document is an RFC or a report because it
  // SAYS so at the top, wherever it lives; the folder it sits in stopped meaning anything. Identity
  // only — the components render it and press nothing.
  rfc: { Component: Rfc },
  report: { Component: Report },
  gap: { Component: Gap },
  objective: { Component: Objective },
  // `::cue` — one directed action (say · highlight · point · press · call), rendered as a quiet
  // command log and replayable by press. A new reply's cues are PLAYED by the reply's own reader;
  // rendered history and documents never play themselves.
  cue: { Component: Cue },
  // `::prompt[label]{text="…"}` — a prompt, in a document, pressable: the press sends the words
  // into the chat as a visible message through the same send() a typed one takes. The block is
  // deliberately dumb — what the words ask for is between the author and the agent.
  prompt: { Component: Prompt },
  // Both RECOUNT from the objectives in their own document on every render — there is no stored
  // total anywhere, so neither can disagree with the blocks above it.
  progress: { Component: Progress },
  // CLAIMS — a statement somebody can check, and the mark written back into its line. `::claim[…]`
  // is the numbered claim an RFC used to end in, made pressable: met / not met / unchecked, each
  // mark carrying who, when and — required — a statement of what was done and seen. `::claims`
  // recounts them, so the status at the top of a document is derived, never typed. See claims.js.
  claim: { Component: Claim },
  claims: { Component: Claims },
  // decision — a story's approve/reject verdict, wrapped around whatever is being proposed
  approval: { Component: Approval },
  // a commit message you press instead of copy. An agent writes it, a human clicks it;
  // the sha lands back in the document like any other input block's answer.
  commit: { Component: CommitBlock },
  // `::record{sha=…}` IS `::commit{sha=…}` — the same block, named for the posture. A commit
  // block with a sha IS the record of that commit: frozen to it, showing its message and its
  // files, with nothing pressable. There was briefly a separate RecordBlock and it was the wrong
  // shape — *"wouldn't it be the same thing? You would use the same mechanism, right?"* Yes: an
  // offer that is pressed writes `sha=` into its own line, and that is what turns it into this.
  record: { Component: CommitBlock },
  // A branch offered for review — a live pointer, never a frozen patch: the diff vs its base is
  // computed at view time, and the switch/back verbs are the human's. The refinement lane's
  // delivery block.
  branch: { Component: BranchBlock },
  // structure
  callout: { Component: Callout },
  // THE REPORT HEADER — the same fields in the same order in every report, so a reader's eye lands
  // in the same place twice. Its own block rather than a dressed-up callout: a callout is a thing
  // to KNOW and this is neither that nor an ask, and borrowing one would have cost the two asks
  // their pull. See blocks/Glance.js for why an empty field is muted rather than hidden.
  glance: { Component: Glance },
  details: { Component: Details },
  columns: { Component: Columns },
  col: { Component: Col },
  tabs: { Component: Tabs },
  tab: { Component: Tab },
  carousel: { Component: Carousel },
  slide: { Component: Slide },
};

export default BLOCKS;
