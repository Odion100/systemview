import { hostFiles } from "./utils/hostFiles";

// RFC-053 — WHAT THIS HOST GRANTS THE MARKDOWN VOCABULARY.
//
// The registry no longer reaches into the app; the app hands it a bag of capabilities and the
// blocks read that. This file is SystemView's answer to that bag, and it is the only place in the
// app where "what a document may touch here" is written down.
//
// A MODULE CONSTANT ON PURPOSE. Built once, so every consumer's identity is stable — a fresh bag
// per render would re-run every block's effect on every paint, which is the exact shape of the
// render loop that pinned this machine at a load average of 600 (FileEmbed, measured).
//
// `files` and `git` are the SAME object here because the hub serves both through one bridge — but
// they stay two keys, because a host that grants reading and withholds committing is an obvious
// thing to want, and the other side of this seam (autobot's browser) will want exactly that.
//
// AND THAT IS THE WHOLE BAG — his cutback, and he was right: `services`/`stats`/`tests` were
// SystemView's model of the world wearing a capability costume. A browser implementing that bag
// would be implementing SystemView. What both apps genuinely share is the grammar, the registry,
// and these two verbs; every other block is HOST VOCABULARY, registered by the app whose world it
// describes, importing that app's own context like the application code it is.
const project = (projectCode) => (projectCode ? hostFiles(projectCode) : null);

export const systemviewCapabilities = {
  files: project,
  git: project,
};

export default systemviewCapabilities;

