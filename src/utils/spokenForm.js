// TURNING A REPLY INTO SOMETHING WORTH HEARING. His ask: *"I read a lot of long replies and I want
// the option to listen."* So this is not accessibility bolted on — it is a second way to take the
// same message, and the thing that decides whether it is usable is not the voice engine. It is this
// file. A reply read as its own source code ("colon colon ask bracket should the corpus point at")
// is worse than silence, because he has to listen to the whole thing to find that out.
//
// THE RULE: SPEAK THE INTENT, NEVER THE SYNTAX. Every block in `src/atoms/Markdown/registry.js`
// exists because it MEANS something — `::ask` is the one thing needed from him, `::commit` is a
// button, `:::cmd` is a process. Each one has a sentence a person would say in its place, and that
// sentence is what goes out. A block whose meaning is "look at this on screen" (a chart, a diff, a
// table) is ANNOUNCED and not read: hearing "a table, four columns and twelve rows" tells him
// whether to look, and that is the whole job. Reading the twelve rows aloud does not.
//
// WHY IT IS A PLAIN MODULE. No React, no engine, no DOM — because the question "does this reply
// sound right" is answerable in Jest, and the question "does this machine have a voice" is not.
// The platform-dependent half is `voice.js` and it is deliberately tiny. This file is the half that
// has to be right, and it is the half that is the same on every machine he ships this to —
// his standing constraint: *"I'm not trying to use Mac OS exclusively… this is eventually gonna be
// used by other people."* Nothing here knows what OS it is on, and nothing here ever should.
//
// THE ATTRIBUTE/DIRECTIVE REGEXES ARE A DELIBERATE SECOND COPY of the shapes in `AgentChat.js` and
// `atoms/Markdown`. Importing either would drag a 7,000-line component (and a stylesheet) into a
// unit test, which is exactly the coupling that would stop this from being tested at all. The cost
// is two definitions of one grammar; the alternative was no test for any of it.

// ── what is unspeakable ────────────────────────────────────────────────────────────────────────

// A path read aloud is a letter-by-letter recital of punctuation — "s r c slash atoms slash
// markdown slash registry dot j s". The BASENAME is the part a person would actually say, and the
// line range is an address, not a word, so it goes.
const basename = (p) =>
  String(p || "")
    .trim()
    .replace(/#L\d+(-L?\d+)?$/i, "")
    .split(/[\\/]/)
    .filter(Boolean)
    .pop() || "";

// A TOKEN IS ONLY A PATH WHEN IT CANNOT BE ANYTHING ELSE. The loose version of this test ate a
// commit message — `fix(api/reports): …` became "reports): …" — and would read "and/or" as a folder
// called "or". So: an anchored path (`/x`, `~/x`, `./x`), or a multi-segment one ending in a file
// extension, or three segments or more. Two bare words around a slash stay two words.
const PATHY = new RegExp(
  "^(?:" +
    "(?:[~.]{1,2}\\/|\\/)[\\w.@+-]+(?:\\/[\\w.@+-]+)*" + // /Users/x, ~/.autobot/presence.md, ./cli
    "|[\\w.@+-]+(?:\\/[\\w.@+-]+)+\\.[a-z0-9]{1,6}" + // src/utils/voice.js
    "|[\\w.@+-]+(?:\\/[\\w.@+-]+){2,}" + // src/atoms/Markdown
  ")(?:#L\\d+(?:-L?\\d+)?)?$",
  "i",
);
const looksLikePath = (s) => PATHY.test(String(s || "").trim());

// Glyphs the UI speaks with — marks, chevrons, status dots, box drawing, emoji. They carry meaning
// on screen and nothing at all in the ear; some engines spell them out, which is worse than
// dropping them. Letters, digits, ordinary punctuation and accented script survive.
const SYMBOLS =
  /[\u2000-\u206f\u2190-\u2bff\u2e00-\u2e7f\u3000-\u303f\u2600-\u27bf\u00b7\ufe00-\ufe0f\u{1f000}-\u{1faff}]/gu;

// INLINE CODE IS INLINE, AND THAT IS THE WHOLE DISTINCTION. His correction, 2026-10-21: *"you say
// some code, some code, some code — an inline code block is inline, that's not the same thing as
// code blocks."* A fenced block is an object on screen and announcing it is right. A backtick span
// is a WORD IN THE SENTENCE the author chose to mark, so replacing it with "some code" deletes the
// subject of the clause — and the rule it replaced required `^[\w.$-]+$`, which every term in this
// system's own vocabulary fails: `::objective`, `{kind, ref, project}`, `state=open`,
// `attachments[]` all came out as "some code" in one breath.
//
// So the default FLIPS: an inline span is READ. Only a genuine shell invocation is still announced,
// because `BUILD_PATH=build.next NODE_OPTIONS=--max-old-space-size=4096` is a minute of noise.
const sayCode = (code) => {
  const s = String(code || "").trim();
  if (!s) return "";
  if (looksLikePath(s)) return basename(s);
  // The punctuation that is how a term is TYPED rather than how it is said. A block is written
  // `::objective` and spoken "objective"; `{kind, ref}` is its field names, not its braces; an
  // attribute is said the way a person says it, with the word "equals".
  const said = s
    .replace(/^:{1,4}/, "")
    .replace(/\[\]/g, "")
    .replace(/[{}`]/g, "")
    .replace(/\s*=\s*/g, " equals ")
    .replace(/\s+/g, " ")
    .trim();
  if (!said) return "";
  // Past a phrase's length, or carrying shell plumbing, it is an invocation and the old rule holds.
  if (said.length > 60 || /--|\|\||&&|\$\(/.test(said)) return "some code";
  return said;
};

// ── the grammar ────────────────────────────────────────────────────────────────────────────────

const FENCE_RE = /^\s*(`{3,}|~{3,})\s*([\w+-]*)/;
const LEAF_RE = /^\s*(:{2,})([a-z][\w-]*)(?:\[([^\]]*)\])?(?:\{([^}]*)\})?\s*$/;
const OPEN_RE = /^\s*(:{3,})([a-z][\w-]*)(?:\[([^\]]*)\])?(?:\{([^}]*)\})?\s*$/;
const INLINE_RE = /:{1,4}([a-z][\w-]*)\[([^\]]*)\](?:\{([^}]*)\})?/g;
const H_RE = /^(#{1,6})\s+(.*)$/;
const TASK_RE = /^\s*[-*+]\s+\[([ xX])\]\s+(.*)$/;
const UL_RE = /^\s*[-*+]\s+(.*)$/;
const OL_RE = /^\s*(\d+)[.)]\s+(.*)$/;
const QUOTE_RE = /^\s*>\s?(.*)$/;
const HR_RE = /^\s*([-*_])\s*(\1\s*){2,}$/;

const parseAttrs = (src) => {
  const out = {};
  const re = /([\w-]+)(?:=(?:"([^"]*)"|'([^']*)'|([^\s}]+)))?/g;
  let m;
  while ((m = re.exec(String(src || "")))) {
    const [, k, dq, sq, bare] = m;
    out[k] = dq !== undefined ? dq : sq !== undefined ? sq : bare !== undefined ? bare : "true";
  }
  return out;
};

const splitRow = (line) => {
  let s = String(line).trim();
  if (s.startsWith("|")) s = s.slice(1);
  if (s.endsWith("|")) s = s.slice(0, -1);
  return s.split("|").map((c) => c.trim());
};
const isTableSep = (line) =>
  !!line && line.indexOf("|") !== -1 && splitRow(line).every((c) => /^:?-+:?$/.test(c));

// WHICH TABLES GET READ, AND WHICH STAY ANNOUNCED. A table was announced and skipped until
// 2026-10-21 — *"there's no reason we should be skipping over a table instead of reading the
// table."* He is right about the tables he actually writes: two or three columns of label and
// meaning, which read aloud the way a person would say them. The original reasoning was right about
// the OTHER kind — four hundred lines of cells read aloud is the failure this whole file exists to
// prevent — so the SHAPE decides rather than a blanket rule, and the size is said first either way
// so he knows what he is getting before he gets it.
const TABLE_MAX_COLS = 4;
const TABLE_MAX_ROWS = 12;
const readableTable = (head, body) =>
  body.length > 0 && body.length <= TABLE_MAX_ROWS && head.length <= TABLE_MAX_COLS;

// ONE ROW, SAID THE WAY A PERSON READS A TABLE OUT LOUD: the first cell names the row and every
// cell after it is said under its own column heading. Dropping the headings would leave a
// three-column row as three unlabelled fragments, which is worse than the announcement it replaced.
//
// An empty heading is common and deliberate — his label columns are written `| | what it is |` — so
// a cell whose heading is blank is read bare rather than under the word "blank". An empty CELL is
// said by saying nothing, because "blank" is not what the gap means.
const sayRow = (head, cells) => {
  const parts = [];
  cells.forEach((cell, k) => {
    if (!cell) return;
    const label = k === 0 ? "" : head[k] || "";
    parts.push(label ? `${label}: ${cell}` : cell);
  });
  return parts.join(". ");
};

// "js" read aloud is "jay ess". A fence's language is a word he says out loud, so it is spoken as
// one; anything unlisted is said as written, which is right for `go`, `rust`, `ruby`, `swift`.
const LANGS = {
  js: "JavaScript", jsx: "JavaScript", mjs: "JavaScript", cjs: "JavaScript",
  ts: "TypeScript", tsx: "TypeScript", py: "Python", rb: "Ruby", sh: "shell", bash: "shell",
  zsh: "shell", console: "shell", json: "JSON", yml: "YAML", yaml: "YAML", md: "markdown",
  scss: "CSS", css: "CSS", html: "HTML", sql: "SQL", diff: "diff", text: "", txt: "",
};
const sayLang = (l) => {
  const k = String(l || "").toLowerCase();
  return LANGS[k] !== undefined ? LANGS[k] : l;
};

const count = (n, one, many) => `${n} ${n === 1 ? one : many}`;

// A `who=a|b|c` list, said the way a person says a list.
const andList = (items) => {
  const xs = items.filter(Boolean);
  if (xs.length <= 1) return xs[0] || "";
  return `${xs.slice(0, -1).join(", ")} and ${xs[xs.length - 1]}`;
};

// ── what each block SAYS ───────────────────────────────────────────────────────────────────────
//
// One entry per name in the registry. `body` is the already-spoken contents of a container; `kind`
// is "inline" | "leaf" | "container". Returning "" means the block is silent — correct for anything
// whose entire content is a thing on screen with nothing to announce. An entry that is MISSING is
// not silent: the fallback below speaks the label, so a block added to the registry tomorrow reads
// as its own words rather than as its punctuation.
const SPOKEN = {
  // THE ONE THAT MATTERS MOST. `::ask` exists so a thing cannot be scrolled past; spoken as syntax
  // it would be the thing that cannot be HEARD past. The mark is inferred the way the block infers
  // it — ending in "?" is a question, anything else is a thing to do.
  ask: ({ label, attrs }) => {
    const t = String(label || "").trim();
    if (!t) return "";
    const head = t.endsWith("?") ? `A question. ${t}` : `One thing you need to do. ${t}`;
    return attrs.why ? `${head} Because ${attrs.why}.` : head;
  },
  // A callout is what he needs to KNOW, one weight down from ask. Same shape of announcement.
  callout: ({ body }) => (body ? `Worth knowing. ${body}` : ""),
  // THE LABEL AND THE ATTRIBUTE ARE THE SAME FIELD, and reading only one of them is how a block
  // goes silent. `::commit[the message]` and `::commit{message="the message"}` both render — the
  // component reads `label || attrs.message` — and this read only the attribute, so every commit
  // written in the label form spoke NOTHING. He found it by listening: *"nothing was said."*
  // Measured across the registry: branch, run, file, image, test and report have the same pair,
  // and every one of them is handled the same way below.
  commit: ({ label, attrs }) => {
    const message = label || attrs.message;
    return message ? `A commit you can press, with the message: ${message}.` : "";
  },
  // THE BODY OF A `:::cmd` IS NEVER SPOKEN. It is verbatim shell, which is the single least
  // speakable thing in the vocabulary — and he is the one who presses it, so what he needs in his
  // ear is that it is there and what it is for.
  cmd: ({ attrs }) =>
    attrs.title ? `A command you can run, for ${attrs.title}.` : "A command you can run.",
  run: ({ label, attrs, body }) => {
    const what = attrs.title || label || attrs.use;
    const head = what ? `A set of steps to run, ${what}.` : "A set of steps to run.";
    return body ? `${head} ${body}` : head;
  },
  branch: ({ label, attrs }) => {
    const name = label || attrs.name;
    return name ? `A branch offered for review, ${name}.` : "A branch offered for review.";
  },
  approval: ({ body }) => (body ? `Asking you to decide on this. ${body}` : "Asking you to decide."),
  question: ({ label, attrs }) => {
    const q = String(label || attrs.q || attrs.prompt || "").trim();
    const opts = attrs.options ? andList(String(attrs.options).split("|").map((s) => s.trim())) : "";
    const head = q ? `A decision to record. ${q}` : "A decision to record.";
    return opts ? `${head} The options are ${opts}.` : head;
  },
  members: ({ attrs }) => {
    const who = andList(String(attrs.who || "").split("|").map((s) => s.trim()));
    return who ? `On this document: ${who}.` : "";
  },
  // A thread is a conversation; its contents are the thing, the wrapper is just where they live.
  thread: ({ body }) => (body ? `In a thread. ${body}` : ""),
  reply: ({ attrs, body }) =>
    body ? `${attrs.author === "agent" ? "The agent" : attrs.author || "Someone"} replied. ${body}` : "",
  // A file is its name. Inline it is mid-sentence, so it stays a bare noun; as a block the whole
  // file is on screen and the name is the announcement.
  file: ({ label, attrs, kind }) => {
    const b = basename(label || attrs.path);
    if (!b) return "";
    return kind === "inline" ? b : `The file ${b}, shown here.`;
  },
  diff: ({ label, attrs }) => {
    const b = basename(label || attrs.path);
    return b ? `The changes to ${b}.` : "A diff.";
  },
  image: ({ label, attrs }) => {
    const b = basename(label || attrs.of);
    return attrs.caption ? `An image: ${attrs.caption}.` : `An image${b ? `, ${b}` : ""}.`;
  },
  chart: ({ attrs }) => (attrs.title ? `A chart: ${attrs.title}.` : "A chart."),
  test: ({ label, attrs }) => {
    const what = label || attrs.of;
    return what ? `A saved test, ${what}.` : "A saved test.";
  },
  logs: () => "The log viewer.",
  load: () => "A chart of the service load.",
  topology: () => "A map of the services.",
  report: ({ label, attrs, kind }) => {
    const what = label || attrs.path;
    return what ? (kind === "inline" ? what : `The report, ${what}.`) : "";
  },
  help: ({ label }) => (label ? `the help topic ${label}` : ""),
  // A namespace and a region of the window are both already words. They read mid-sentence as
  // themselves, which is how he says them out loud too.
  ns: ({ label }) => String(label || ""),
  ui: ({ label }) => String(label || ""),
  // Structure with nothing of its own to say — the contents ARE the content. A fold is the one
  // exception: its summary is the only thing visible until it is opened, so it is worth a word.
  details: ({ attrs, body }) => {
    const s = attrs.summary ? `A fold, ${attrs.summary}.` : "A fold.";
    return body ? `${s} ${body}` : s;
  },
  columns: ({ body }) => body,
  col: ({ body }) => body,
  tabs: ({ body }) => body,
  tab: ({ attrs, body }) => (attrs.label && body ? `${attrs.label}. ${body}` : body),
  carousel: ({ body }) => body,
  slide: ({ attrs, body }) => (attrs.label && body ? `${attrs.label}. ${body}` : body),
};

// ── WHAT A PERSON CAN CHOOSE TO HEAR ───────────────────────────────────────────────────────────
//
// The settings surface needs to offer blocks by NAME, and the names are not the words he uses:
// nobody ticks a box labelled `approval`. So each one carries the sentence it becomes — which is
// also the honest way to pick, because what you are choosing is the spoken form, not the block.
//
// IT LIVES HERE, BESIDE `SPOKEN`, FOR ONE REASON: a block that is offered and has no spoken form
// is a tick box that does nothing, and a block with a spoken form that is never offered is unheard
// work. One file, one list, and `spokenForm.test.js` asserts every offered name has an entry.
//
// `visual` is not a second-class group — it is the honest label. A chart, a diff and an image are
// ANNOUNCED ("a chart: landing order") rather than read, because the content is on screen and the
// only useful thing in the ear is whether to look. Offering them is right; pretending they read
// aloud would not be.
export const BLOCK_VOICES = [
  { name: "ask", label: "Ask", says: "the one thing I need from you", group: "says" },
  { name: "callout", label: "Callout", says: "a caveat that changes what you would do", group: "says" },
  { name: "question", label: "Question", says: "a decision, with its options", group: "says" },
  { name: "approval", label: "Approval", says: "something waiting on your decision", group: "says" },
  { name: "commit", label: "Commit", says: "a commit you can press, and its message", group: "says" },
  { name: "branch", label: "Branch", says: "a branch offered for review", group: "says" },
  { name: "cmd", label: "Command", says: "that there is a command to run, and what for", group: "says" },
  { name: "run", label: "Run", says: "a set of steps to run", group: "says" },
  { name: "thread", label: "Thread", says: "a conversation, and what is in it", group: "says" },
  { name: "reply", label: "Reply", says: "who replied, and what they said", group: "says" },
  { name: "details", label: "Fold", says: "the summary, and what is folded under it", group: "says" },
  { name: "members", label: "Members", says: "who is on the document", group: "says" },
  { name: "file", label: "File", says: "that a file is shown, by name", group: "visual" },
  { name: "diff", label: "Diff", says: "which file changed", group: "visual" },
  { name: "image", label: "Image", says: "its caption, or that there is one", group: "visual" },
  { name: "chart", label: "Chart", says: "its title", group: "visual" },
  { name: "test", label: "Test", says: "which saved test", group: "visual" },
  { name: "report", label: "Report", says: "which report", group: "visual" },
  { name: "logs", label: "Logs", says: "that the log viewer is here", group: "visual" },
  { name: "load", label: "Load", says: "that a service-load chart is here", group: "visual" },
  { name: "topology", label: "Topology", says: "that a service map is here", group: "visual" },
];

/** PROSE is a choice like any block — it is the text outside every block, and it is the lever
 *  between "read me the decisions" and "read me everything". Named rather than implied so the
 *  settings surface can list it in the same column as the rest. */
export const PROSE = "prose";

/** The set that reads a whole reply: every block plus the prose between them. */
export const EVERYTHING = [PROSE, ...BLOCK_VOICES.map((b) => b.name)];

/** The default, and it is deliberately narrow. Auto-speech that reads everything is a thing he
 *  turns off once and never turns back on; one that reads only what was aimed at him is one he
 *  leaves on. Widening it is a tick box away, which is the right direction for that door to open. */
export const AIMED_AT_YOU = ["ask", "callout", "question", "approval", "commit", "branch"];

// A block nobody has written a sentence for speaks its own label and never its colons. This is the
// line that keeps the feature from decaying every time the registry grows.
const sayBlock = ({ name, label, attrs, body, kind }) => {
  const f = SPOKEN[name];
  if (f) return String(f({ label, attrs: attrs || {}, body: body || "", kind }) || "").trim();
  return String(label || body || "").trim();
};

// ── the inline pass ────────────────────────────────────────────────────────────────────────────

const inlineSpoken = (src) => {
  let s = String(src || "");

  // Inline directives first — a `:file[…]` inside a sentence must become a word before anything
  // else starts deleting punctuation out from under it.
  s = s.replace(INLINE_RE, (_m, name, label, attrs) =>
    sayBlock({ name, label, attrs: parseAttrs(attrs), kind: "inline" }),
  );

  // An image's alt text is a description; a link's text is the sentence. Both beat the URL.
  s = s.replace(/!\[([^\]]*)\]\([^)]*\)/g, (_m, alt) => (alt ? `an image, ${alt}` : "an image"));
  s = s.replace(/\[([^\]]+)\]\([^)]*\)/g, (_m, text) => text);

  // A URL spoken aloud is the worst case in the file — protocol, slashes, hyphens, query string.
  s = s.replace(/<?\bhttps?:\/\/[^\s<>)]+>?/g, "a link");
  s = s.replace(/\bwww\.[^\s<>)]+/g, "a link");

  // Inline code before emphasis, so `**`localService`**` survives as a word.
  s = s.replace(/`([^`\n]+)`/g, (_m, code) => sayCode(code));

  // Emphasis is tone of voice on screen and has no spoken form. The words inside it are the point.
  s = s.replace(/\*\*([^*\n]+)\*\*/g, "$1");
  s = s.replace(/~~([^~\n]+)~~/g, "$1");
  s = s.replace(/(^|[\s(])[*_]([^\s*_][^*_\n]*)[*_](?=[\s.,;:!?)]|$)/g, "$1$2");

  // Any path that survived the code and directive passes — a bare `src/utils/voice.js` in prose.
  s = s.replace(/\S+/g, (w) => {
    const bare = w.replace(/^[("'[]+|[)"'\].,;:!?]+$/g, "");
    if (!looksLikePath(bare)) return w;
    const b = basename(bare);
    return b ? w.replace(bare, b) : w;
  });

  // A DASH IS A CLAUSE BREAK, NOT A GLYPH. Deleting it ran two thoughts together — "restart the
  // shell the origin fix is cached until then" — so it becomes the punctuation it already is.
  s = s.replace(/\s*[—–]\s*/g, ", ");
  s = s.replace(/(\s|^)-{2,}(\s|$)/g, ", ");
  s = s.replace(SYMBOLS, " ");
  // Leftover markdown furniture. Sentence punctuation stays — it is what makes an engine breathe.
  s = s.replace(/[`*_~#|<>\\]/g, " ");
  // Punctuation left floating by everything above: a space before a comma, a comma landing on a
  // full stop, the same mark twice. Each one is audible as a stumble.
  s = s.replace(/\s+([,.;:!?])/g, "$1");
  s = s.replace(/([,.;:])[\s]*(?=[,.;:])/g, "");
  return s.replace(/\s+/g, " ").trim();
};

// ── sentences ──────────────────────────────────────────────────────────────────────────────────

// A closing quote or bracket AFTER the full stop still ends the sentence — he quotes himself a
// lot, and `…there."` was getting a second period stapled on.
const ENDS = /[.!?:]["')\]]?$/;
// AN ELLIPSIS IS THE ONLY PAUSE AN ENGINE RELIABLY HONOURS that is longer than a full stop. A
// doubled period was the first attempt and bought nothing — every engine reads ".." as ".". This
// is what a heading becomes: the gap you hear instead of the whitespace you see. It is emitted
// only when something came before it, because a recital opening on a pause sounds like a fault.
export const PAUSE = "…";

// Every segment leaves here as a sentence, tidied. `tidy` runs HERE and not only on prose, because
// a block's label and attributes are authored text too: a `::ask` holding an em dash, a path or a
// URL arrives through `sayBlock`, never through the prose pass, and it has the same problems.
const sentence = (text) => {
  const t = inlineSpoken(text).replace(/[,;\s]+$/, "");
  if (!t) return "";
  return ENDS.test(t) ? t : `${t}.`;
};

// ── the walk ───────────────────────────────────────────────────────────────────────────────────

// `only` is null for "read all of it" — the press-to-listen path, unchanged. Otherwise it is
// { blocks: Set, prose: boolean } and this walk becomes a SIEVE.
//
// THE PART THAT IS NOT OBVIOUS: an unselected CONTAINER is descended into, not dropped. A
// `:::thread` he never ticked can hold the `::ask` he did, and a sieve that threw the thread away
// would silently swallow the one block the whole feature exists to deliver. So an unselected
// container contributes nothing of its own and its body is walked with the same sieve; a SELECTED
// container speaks in full, body and all, because ticking it means wanting what is in it.
function walk(lines, only = null) {
  const out = [];
  let para = [];
  const wantBlock = (name) => !only || only.blocks.has(name);
  const wantProse = !only || only.prose;
  const flushPara = () => {
    if (!para.length) return;
    const joined = para.join(" ");
    para = [];
    if (!wantProse) return;
    const s = sentence(joined);
    if (s) out.push(s);
  };
  const push = (text) => {
    flushPara();
    const s = sentence(text);
    if (s) out.push(s);
  };
  // Prose, headings, lists, tables and code all ride on the same choice — they are the reply's own
  // words rather than a block's, and `prose` is the single tick that governs them.
  const pushProse = (text) => {
    if (!wantProse) { flushPara(); return; }
    push(text);
  };

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];

    // FENCED CODE — announced by size and language, never read. A fence with no closer runs to the
    // end of the reply, the same way every markdown renderer treats it.
    const fence = line.match(FENCE_RE);
    if (fence) {
      const mark = fence[1][0];
      const lang = (fence[2] || "").trim();
      let j = i + 1;
      while (j < lines.length && !new RegExp(`^\\s*${mark}{3,}\\s*$`).test(lines[j])) j += 1;
      const n = j - i - 1;
      pushProse(`A ${lang ? `${sayLang(lang)} ` : ""}code block, ${count(n, "line", "lines")}`);
      i = j;
      continue;
    }

    // A CONTAINER — `:::name … :::`, closing on a fence of the same width. The body is walked, so
    // a thread wrapping a callout wrapping prose comes out as three nested sentences and not as
    // nine colons.
    // (a `:::name` WITH a closing fence below is a container; with none it falls through to the
    // leaf branch below and is spoken as a leaf — a half-written block still says something.)
    const open = line.match(OPEN_RE);
    if (open) {
      const colons = open[1];
      let j = i + 1;
      let close = -1;
      while (j < lines.length) {
        if (new RegExp(`^\\s*${colons}\\s*$`).test(lines[j])) { close = j; break; }
        j += 1;
      }
      if (close !== -1) {
        const inner = lines.slice(i + 1, close);
        if (wantBlock(open[2])) {
          // SELECTED: speak it whole. The body is walked UNFILTERED — ticking a thread means
          // wanting the thread, not wanting a sieved version of its contents.
          push(
            sayBlock({
              name: open[2],
              label: open[3],
              attrs: parseAttrs(open[4]),
              body: walk(inner).join(" "),
              kind: "container",
            }),
          );
        } else {
          // NOT selected: the wrapper says nothing, but whatever he DID tick inside it survives.
          flushPara();
          for (const s2 of walk(inner, only)) out.push(s2);
        }
        i = close;
        continue;
      }
    }

    // A LEAF — `::name[label]{attrs}` alone on its line.
    const leaf = line.match(LEAF_RE);
    if (leaf) {
      if (wantBlock(leaf[2]))
        push(sayBlock({ name: leaf[2], label: leaf[3], attrs: parseAttrs(leaf[4]), kind: "leaf" }));
      else flushPara();
      continue;
    }

    // A TABLE, and it is only a table once a separator row proves it — otherwise a sentence with a
    // pipe in it becomes a one-cell grid. The size is announced first (he needs to know what is
    // coming), and then a table small enough to follow by ear is READ — see `readableTable`.
    // Each row is pushed on its own, which also makes it its own seekable chunk in the transport.
    if (line.indexOf("|") !== -1 && isTableSep(lines[i + 1])) {
      const head = splitRow(line);
      const body = [];
      let j = i + 2;
      while (j < lines.length && lines[j].indexOf("|") !== -1 && lines[j].trim()) {
        body.push(splitRow(lines[j]));
        j += 1;
      }
      pushProse(
        `A table, ${count(head.length, "column", "columns")} and ${count(body.length, "row", "rows")}`
      );
      if (readableTable(head, body)) body.forEach((cells) => pushProse(sayRow(head, cells)));
      i = j - 1;
      continue;
    }

    if (HR_RE.test(line)) { flushPara(); continue; }

    const h = line.match(H_RE);
    if (h) {
      flushPara();
      const head = wantProse ? sentence(h[2]) : "";
      if (head) {
        if (out.length) out.push(PAUSE);
        out.push(head);
      }
      continue;
    }

    const task = line.match(TASK_RE);
    if (task) {
      const done = task[1].toLowerCase() === "x";
      pushProse(`${done ? "Done" : "Still to do"}, ${task[2]}`);
      continue;
    }

    const ul = line.match(UL_RE);
    const ol = line.match(OL_RE);
    // A LIST ITEM IS A SENTENCE OF ITS OWN. Run together they are one unbroken breath and he cannot
    // hear where one point ends — the bullet is visual, the sentence boundary is its spoken form.
    if (ul || ol) { pushProse((ul || ol)[ol ? 2 : 1]); continue; }

    const q = line.match(QUOTE_RE);
    if (q) { if (q[1].trim()) para.push(q[1]); else flushPara(); continue; }

    if (!line.trim()) { flushPara(); continue; }
    para.push(line);
  }

  flushPara();
  return out.filter(Boolean);
}

// ── the public surface ─────────────────────────────────────────────────────────────────────────

// A VERY LONG REPLY IS CUT, OUT LOUD. The budget is characters, not lines, because what costs him
// time is minutes and ~900 characters is roughly a minute at a normal rate — so the default is
// about four minutes of listening. The cut lands on a SENTENCE boundary, never mid-word, and it
// SAYS it was cut: a recital that just stops is indistinguishable from the engine dying, and he
// would sit waiting for the rest. The reply is still on screen, in full, which is why cutting is
// the right call and summarising would not be — this is a second way to take the message, not a
// replacement for it. (Stopping EARLY is the other half and it belongs to the player: the control
// is press-to-stop and `voice.js` speaks in chunks so a stop lands immediately.)
export const MAX_SPOKEN = 3600;
export const CUT_NOTICE = "That is as far as I will read. The rest of this reply is on screen.";

/**
 * `only` is what makes one reply two different recitals. Omitted (the press-to-listen path) the
 * whole reply is read, exactly as before. Given a list of names — block names plus the literal
 * `prose` — ONLY those are spoken, which is what auto-speech uses: he picks what is worth
 * interrupting him for, and everything else stays on screen where he reads it.
 *
 * An EMPTY list is a real answer and returns "", never the whole reply. "Read me nothing" has to
 * be expressible, or the only way to stop the reading is to turn the feature off — and `only: []`
 * arriving from a settings surface with every box unticked must not become "read everything",
 * which is the loudest possible interpretation of a request for silence.
 */
export function spokenForm(markdown, { maxChars = MAX_SPOKEN, only = null } = {}) {
  const sieve = Array.isArray(only)
    ? { blocks: new Set(only.filter((n) => n !== PROSE)), prose: only.includes(PROSE) }
    : null;
  const sentences = walk(String(markdown || "").split("\n"), sieve);
  if (!sentences.length) return "";

  let text = sentences.join(" ");
  if (text.length <= maxChars) return text;

  const kept = [];
  let used = 0;
  for (const s of sentences) {
    if (used + s.length + 1 > maxChars) break;
    kept.push(s);
    used += s.length + 1;
  }
  // A single sentence longer than the whole budget still has to be cut somewhere; a word boundary
  // is the worst acceptable place, and it is better than a syllable.
  if (!kept.length) {
    const head = text.slice(0, maxChars);
    kept.push(`${head.slice(0, head.lastIndexOf(" ") > 0 ? head.lastIndexOf(" ") : maxChars)}.`);
  }
  text = `${kept.join(" ")} ${CUT_NOTICE}`;
  return text;
}

// SPEAK IT IN PIECES, so a stop is instant. An engine handed one 3,000-character utterance cannot
// be interrupted on a boundary, and several builds truncate or stall on very long ones. Chunks are
// grouped WHOLE SENTENCES — splitting mid-clause is audible — and only a sentence that is itself
// over budget is broken at a word.
export function spokenChunks(text, { maxChars = 240 } = {}) {
  const src = String(text || "").trim();
  if (!src) return [];
  const pieces = src.match(/[^.!?]+[.!?]+\s*|[^.!?]+$/g) || [src];
  const out = [];
  let buf = "";
  const flush = () => { if (buf.trim()) out.push(buf.trim()); buf = ""; };
  for (const raw of pieces) {
    let p = raw.trim();
    if (!p) continue;
    while (p.length > maxChars) {
      const head = p.slice(0, maxChars);
      const at = head.lastIndexOf(" ");
      flush();
      out.push(head.slice(0, at > 0 ? at : maxChars).trim());
      p = p.slice(at > 0 ? at : maxChars).trim();
    }
    if (buf && `${buf} ${p}`.length > maxChars) flush();
    buf = buf ? `${buf} ${p}` : p;
  }
  flush();
  return out;
}

export default spokenForm;
