import React from "react";
import NsLink from "./blocks/NsLink";
import FileLink from "./blocks/FileLink";
import { Callout, Details, Columns, Col, Tabs, Tab, Carousel, Slide } from "./blocks/Structure";
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

// `file` is TWO things depending on how it's written — the same split `run` has. Inline is a
// reference (`:file[path]` → a chip that points at it); block is the thing itself (`::file[path]` →
// the file, in the document). One name, because it's one concept at two weights.
const FileBlock = (props) => (props.kind === "inline" ? <FileLink {...props} /> : <FileEmbed {...props} />);

// RFC-025 §3 — THE REGISTRY. Adding a feature to every markdown surface in the app is adding a line
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
  file: { Component: FileBlock },
  diff: { Component: DiffEmbed },
  help: { Component: HelpLink },
  // embeds — live things inside prose
  chart: { Component: ChartEmbed },
  test: { Component: TestEmbed },
  run: { Component: RunBlock },
  load: { Component: LoadEmbed },
  topology: { Component: TopologyEmbed },
  logs: { Component: LogsEmbed },
  // inputs — the document asks you something, and the answer lands back in the document
  question: { Component: Question },
  // conversation — a reply thread on a wrapped block, like a story pane's
  thread: { Component: Thread },
  // one reply, written INTO the document inside its thread
  reply: { Component: Reply },
  // decision — a story's approve/reject verdict, wrapped around whatever is being proposed
  approval: { Component: Approval },
  // structure
  callout: { Component: Callout },
  details: { Component: Details },
  columns: { Component: Columns },
  col: { Component: Col },
  tabs: { Component: Tabs },
  tab: { Component: Tab },
  carousel: { Component: Carousel },
  slide: { Component: Slide },
};

export default BLOCKS;
