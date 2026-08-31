import { summarise, pathTouchedBy, isWrite } from "../../utils/hostAgent";
import { parseSvCommand, svStatus, svRoomLine } from "./svCommand";

// RFC-046 — EVENTS IN, ROWS OUT. Kept pure and away from the component for the reason the rest of
// this codebase keeps its rules out of render: the same fold has to run over `history()` when a view
// attaches late and over the live stream after that, and two implementations of "what does this feed
// look like" would drift the moment one of them was fixed.
//
// THE SHAPE OF THE PROBLEM is streaming. `text-delta` arrives character-group by character-group and
// is then RESTATED in full by a `text` event when the block settles. Appending both is how you get
// every sentence twice — so a delta OPENS a row and grows it, and the settled event CLOSES that same
// row by replacing its text rather than adding another.
//
// Row kinds: say · think · tool · ask · done · error
// THE HOST'S ACTUAL VOCABULARY. I built this against the hyphenated names autobot named early on
// (`text-delta`, `tool-start`, `permission-request`) and it shipped DOTTED (`assistant.text`,
// `tool.call`, `permission.request`) — so every tool line silently failed to render and his direct
// chat showed nothing where the browser's panel showed a clean list of commands and file reads.
// His words: *"the agent panel shows the bash commands and that they're reading files… yours, all
// you did was the wrong thing."* Both spellings are accepted, because a fold that only understands
// one dialect is how this broke in the first place.
const OPENERS = { "text-delta": "say", "thinking-delta": "think" };
// `assistant.text` WAS MISSING FROM HERE, and that is the duplicate he sees. The host streams a
// block as `assistant.text` chunks and CLOSES it with `assistant.text` carrying `done:true` and the
// full text — the same kind name for both halves. The grow branch above skips the close (it tests
// `done !== true`), and with no settler entry the close fell through and pushed a SECOND row: the
// streamed copy, then the finished copy, identical, one after the other. `assistant.thinking` was
// listed and its text twin was not, which is why thinking never doubled and speech always did.
const SETTLERS = { text: "say", thinking: "think", "assistant.text": "say", "assistant.thinking": "think" };
const IS_CALL = (k) => k === "tool.call" || k === "tool-start";
const IS_RESULT = (k) => k === "tool.result" || k === "tool-end";
const IS_ASK = (k) => k === "permission.request" || k === "permission-request";
const IS_DONE = (k) => k === "result" || k === "session.ended";

// THE CONVERSATION THAT WAS ALREADY THERE. A resumed session continues its transcript but does not
// re-emit it, so a resumed panel opened blank and he had to type "prove this is the same chat" —
// his words, and a fair test to have to invent. The host now seeds `initialEvents` with the prior
// messages marked `replay: true`, so the conversation is ON SCREEN the moment you attach.
// `user.prompt` is HIS, `assistant.text` is ours, and the seam between the replay and the live
// stream is drawn once so it is obvious where the past ends.
const REPLAY = { "user.prompt": "mine", "assistant.text": "say" };
const textOf = (ev) => ev.text || ev.content || ev.message || "";

// A COMPACTION, IN THE SDK'S OWN WORDS. Underneath every spelling the host might use, the fact is
// one record: Claude Code writes `{ type: "system", subtype: "compact_boundary", compactMetadata:
// { trigger: "manual"|"auto", preTokens, durationMs } }` into the session transcript. Accept the
// tidy name, the raw subtype, and our own local echo, because which one arrives depends on how much
// of it the host has chosen to translate — and a fold that understands one dialect is exactly how
// every tool line went missing the last time.
const IS_COMPACTED = (k) => k === "compaction" || k === "compact_boundary" || k === "compact.boundary";
const IS_COMPACTING = (k) => k === "compacting" || k === "compaction.start" || k === "pre_compact";
const IS_USAGE = (k) => k === "usage" || k === "token.usage";

// A STATUS IS ONE LINE. Whatever a host calls a tool call, the cooking line has room for a label and
// nothing more — his rule, plainly put: *"cooking messages are really short."* Newlines collapse
// first, because a status that wraps is a status that has already lost.
const STATUS_MAX = 60;
const clampTo = (max) => (text) => {
  const t = String(text || "").replace(/\s+/g, " ").trim();
  if (!t) return "";
  return t.length > max ? `${t.slice(0, max).trimEnd()}…` : t;
};
export const statusBrief = clampTo(STATUS_MAX);

// A CARD'S HEADLINE IS ALSO A LABEL — wider than the cooking line, still not a container for a
// payload. Autobot proved this one on themselves after I sent them the status version: their
// `toolSummary` clamped only the branch someone had already spot-fixed, and every file-path branch
// returned `path.basename(input)` — which bounds NOTHING when the string has no separators. Mine is
// the same shape: `summarise()` takes the last two path segments, so a pathological path is echoed
// whole into the row's headline. The RECORD is `input`, which the card unfolds and which stays
// untouched; this is only the line you read with it. Same one-exit rule as the status, so a new row
// kind added later inherits the bound without knowing it exists.
const ROW_LABEL_MAX = 140;
export const rowLabel = clampTo(ROW_LABEL_MAX);

// HIS PLAN LIMITS, READ OFF THE ONE PLACE THAT ALREADY KNOWS THEM. His ask: *"I need to be updated
// on my usage… like there's a bar at the top that shows compaction — but only if it's not extra
// work. If it's extra work I'll just wait until I ask for it."* So nothing here polls, calls, or
// costs a turn: `/usage` already prints the numbers, that printout already arrives in this feed as
// a slash-command record, and this reads the last one that went past. Zero new plumbing is the
// whole reason it is allowed to exist.
//
// The real shape, off the transcript rather than imagined:
//   Current session: 46% used · resets Aug 24 at 10:39am (America/New_York)
//   Current week (all models): 51% used · resets Aug 25 at 11:59pm (America/New_York)
//   Current week (Fable): 80% used · resets Aug 25 at 11:59pm (America/New_York)
//
// A READING THIS CHEAP IS ALSO A READING THAT GOES STALE — it is only as fresh as the last `/usage`
// — so the display carries its own timestamp and says so. Today's whole lesson, applied on the way
// in rather than after he catches it: a meter that cannot say AS OF WHEN has no business on screen.
const USAGE_LINE = /^(.+?):\s*(\d{1,3})%\s*used(?:\s*·\s*resets\s+(.+?))?$/;
// "Current week (all models)" is the printout's phrasing; on a one-line bar next to a context meter
// the word that matters is the span, not the sentence.
const usageLabel = (raw) => {
  const t = String(raw).trim();
  if (/^current session$/i.test(t)) return "session";
  const w = /^current week\s*\((.+)\)$/i.exec(t);
  if (w) return `week · ${w[1]}`;
  return t.replace(/^current\s+/i, "");
};
// The bars from a printout that has ALREADY been unwrapped — a `cmdret` row's `out`. The panel
// renders the fresh /usage from that row, so it needs the parser without the tag hunt.
export const parseUsageLines = (printout) => {
  const bars = [];
  String(printout || "").split("\n").forEach((line) => {
    const m = USAGE_LINE.exec(line.trim());
    if (!m) return;
    bars.push({
      label: usageLabel(m[1]),
      pct: Math.min(100, Number(m[2])),
      resets: String(m[3] || "").replace(/\s*\([^)]*\)\s*$/, "").trim(),
    });
  });
  return bars.length ? bars : null;
};
export const parseUsageReport = (text) => {
  const raw = String(text || "");
  const out = /<local-command-stdout>([\s\S]*?)<\/local-command-stdout>/.exec(raw);
  if (!out) return null;
  const bars = [];
  out[1].split("\n").forEach((line) => {
    const m = USAGE_LINE.exec(line.trim());
    if (!m) return;
    bars.push({
      label: usageLabel(m[1]),
      pct: Math.min(100, Number(m[2])),
      // The timezone in parentheses is his own machine's — true, and noise on a bar this size.
      resets: String(m[3] || "").replace(/\s*\([^)]*\)\s*$/, "").trim(),
    });
  });
  return bars.length ? bars : null;
};

// WHAT THE MODEL ACTUALLY READ THIS TURN. Cache reads are context — a cached prompt still occupies
// the window — so the honest number is everything that went IN, however the host spells it.
export const inputTokensOf = (ev) => {
  if (!ev) return 0;
  const u = ev.usage || ev;
  const n = (...keys) => keys.reduce((sum, k) => sum + (Number(u[k]) || 0), 0);
  return n(
    "inputTokens",
    "input_tokens",
    "cacheReadInputTokens",
    "cache_read_input_tokens",
    "cacheCreationInputTokens",
    "cache_creation_input_tokens"
  );
};

// The tokens a compaction started from. `preTokens` is the SDK's own field; the rest are the names a
// host might reasonably translate it into.
export const preTokensOf = (ev) => {
  if (!ev) return 0;
  const m = ev.compactMetadata || ev.metadata || ev;
  return Number(m.preTokens || m.preTokens === 0 ? m.preTokens : m.before || m.from || ev.preTokens || 0) || 0;
};

// "620k", "40k", "900" — the compaction line is a receipt he reads at a glance, not a ledger.
export const tokensShort = (n) => {
  const v = Number(n) || 0;
  if (v >= 1000000) return `${String((v / 1000000).toFixed(1)).replace(/\.0$/, "")}M`;
  if (v >= 1000) return `${Math.round(v / 1000)}k`;
  return `${v}`;
};

// THE LINE ITSELF. His description of what the browser's panel does, and why he wants it here:
// *"at the end of the compaction it shows compacted — how much it went from and went to."* Before
// the second number lands the line still has to be true, so it says what it knows and grows.
export const compactionText = (before, after, trigger) => {
  const tag = trigger === "auto" ? "auto-compacted" : "compacted";
  if (before > 0 && after > 0) return `${tag} — ${tokensShort(before)} → ${tokensShort(after)}`;
  if (before > 0) return `${tag} — from ${tokensShort(before)}`;
  return tag;
};

// ANOTHER AGENT JUMPED IN, AND IT SHOULD LOOK LIKE IT. A message from a peer session arrives down
// the same pipe as anything he types, wrapped in a machine envelope:
//
//   Another Claude session sent a message:
//   <cross-session-message from="uds:/tmp/cc-socks/51502.sock" from-name="autobot-1d">…</cross-session-message>
//   This came from another Claude session — not typed by your user…
//
// Rendered raw, that reads as HIM saying "Another Claude session sent a message" followed by XML —
// his catch: *"that's not rendering nicely… Autobot, just like identity. Come on now."* The room has
// always had the answer: a visiting agent gets a NAME TAG and never passes as the human. Same
// mechanism, different doorway. The envelope is machinery and comes off; the name is the point.
// The host's encoding for a terminal slash command inside a user record — one tag pair per
// section (name, args, printout, caveat). Backreferenced so a global strip removes whole sections.
const CMD_TAGS = /<(local-command-caveat|command-name|command-message|command-args|local-command-stdout)>[\s\S]*?<\/\1>/;

const XSESSION = /<cross-session-message\b([^>]*)>([\s\S]*?)<\/cross-session-message>/;
const ATTR = (s, k) => {
  const m = new RegExp(`${k}="([^"]*)"`).exec(s || "");
  return m ? m[1] : "";
};
// `autobot-1d` is a session; `autobot` is the identity. He asked for the identity, and the room has
// always spoken in project codes. The suffix only comes off when it IS the session suffix — two hex
// characters — so a project whose name genuinely ends in a dashed segment keeps it.
const identityOf = (name) => String(name || "").replace(/-[0-9a-f]{2}$/, "");

// The same short form the header chip uses, agreed with autobot: drop the `claude-` prefix and the
// trailing build date, KEEP the `[1m]` marker — a long-context variant is a different thing to be
// talking to, not a build detail.
export const shortModelName = (m) =>
  String(m || "")
    .replace(/^claude-/, "")
    .replace(/-\d{8}(?=(\[|$))/, "")
    .replace(/-latest(?=(\[|$))/, "");

export const parseVisitorTurn = (text) => {
  const raw = String(text || "");
  const m = XSESSION.exec(raw);
  if (m) {
    const who = identityOf(ATTR(m[1], "from-name")) || ATTR(m[1], "from") || "another agent";
    return { as: who, text: m[2].trim() };
  }
  // THE PANEL'S OWN WRAP, coming back around. A visitor message forwarded into the session goes
  // out as `[identity]: text` — and the host echoes that turn back as a user.prompt wearing the
  // raw prefix. Unparsed, it drew as HIS turn with "[systemview-test]:" in the text ("it looks
  // like I sent it but it says systemview-test at the front"). The wrap is ours, so reading it
  // back is not guessing — it is the other half of the same protocol.
  const b = raw.match(/^\[([A-Za-z0-9_-]+)\]:\s?([\s\S]*)$/);
  if (b) return { as: identityOf(b[1]), text: b[2].trim() };
  return null;
};

// A BASH ROW NAMES ITS FILE TOO. Nearly every row in a real feed is Bash — `sed -n '40,60p' x.js`,
// `cat x.js`, `awk 'NR>=10 && NR<=30' x.js`, `grep -n foo x.js` — because that is how agents read
// and edit. Keyed on Read/Edit/Write alone the embed had nothing to bite on: his report after a
// full day of rows, *"still haven't seen one command with any embedded thing."* So the command is
// read for the file it touched: the last path-looking argument, plus a line window when `sed -n`
// or `awk NR` name one. Writes (`sed -i`, `> file`, `tee file`) embed as a diff. A command that
// names nothing (a python heredoc, `git status`) stays a plain row — nothing invented.
const bashTouch = (cmd) => {
  const c = String(cmd || "").trim();
  if (!c) return null;
  // Only the LAST simple command matters — `cd x && sed -n … file` reads `file`. Split OUTSIDE
  // quotes: an awk program is full of `&&` (`'NR>=10 && NR<=30'`) and a naive split cut inside it,
  // leaving `NR<=30'` as the "verb" — the same trap svCommand hit on a `say` with a semicolon.
  const segs = [];
  let cur = "", q = null;
  for (let i = 0; i < c.length; i += 1) {
    const ch = c[i];
    if (q) { cur += ch; if (ch === q && c[i - 1] !== "\\") q = null; continue; }
    if (ch === '"' || ch === "'") { q = ch; cur += ch; continue; }
    if (ch === ";" || (ch === "&" && c[i + 1] === "&") || (ch === "|" && c[i + 1] === "|")) {
      if (ch !== ";") i += 1;
      segs.push(cur); cur = ""; continue;
    }
    cur += ch;
  }
  segs.push(cur);
  const last = segs.pop().trim();
  const words = last.match(/"[^"]*"|'[^']*'|\S+/g) || [];
  const verb = words[0] || "";
  // A SYSTEMVIEW COMMAND TOUCHES NO FILE. `systemview probe TestService.Math.add` — the namespace
  // looks like a path to the regex below (letters and dots), so the row grew a "code" button that
  // pointed at a namespace as if it were a file (his catch). Those lines carry their own meaning
  // (see parseSvCommand); nothing here applies to them.
  if (/^(systemview|sv)$/.test(verb) || /cli\/index\.js$/.test(verb) || /cli\/index\.js$/.test(words[1] || "")) return null;
  const pathLike = (w) => /^[A-Za-z0-9_./-]+\.[A-Za-z0-9]+$/.test(w) && !/^-/.test(w) && !/^\d+$/.test(w);
  const strip = (w) => w.replace(/^['"]|['"]$/g, "");
  let span = null;
  if (verb === "sed") {
    const m = last.match(/-n\s+'?(\d+),(\d+)p'?/);
    if (m) span = `${m[1]}-${m[2]}`;
  } else if (verb === "awk") {
    const m = last.match(/NR\s*>=\s*(\d+)\s*&&\s*NR\s*<=\s*(\d+)/);
    if (m) span = `${m[1]}-${m[2]}`;
  } else if (verb === "head" || verb === "tail") {
    const m = last.match(/-n?\s*(\d+)/);
    if (m && verb === "head") span = `1-${m[1]}`;
  }
  const wrote = /\bsed\s+-i\b/.test(last) || /(^|[^&>])>\s*\S/.test(last) || /\btee\s/.test(last);
  const READERS = new Set(["sed", "cat", "awk", "grep", "head", "tail", "less", "wc", "tee"]);
  if (!READERS.has(verb) && !wrote) return null;
  const files = words.slice(1).map(strip).filter(pathLike);
  const file = files[files.length - 1];
  return file ? { file, span, wrote } : null;
};

// Repo-relative path, or null when the file is not under the session's cwd.
const relTo = (cwd, p) => {
  if (!cwd || !p) return null;
  const base = String(cwd).replace(/\/+$/, "") + "/";
  return String(p).startsWith(base) ? String(p).slice(base.length) : null;
};
// A Read's window, as the `#Lfrom-to` a ::file block takes; null when it read the whole file.
const readSpan = (ev) => {
  const i = (ev && ev.input) || {};
  if ((ev.tool || ev.name) !== "Read" || !i.offset) return null;
  const from = Number(i.offset) || 1;
  const to = i.limit ? from + Number(i.limit) - 1 : null;
  return to ? `${from}-${to}` : `${from}`;
};

export function foldEvents(events) {
  const rows = [];
  const byToolId = new Map();
  let openRow = null; // the row a delta is currently growing

  const closeOpen = () => {
    openRow = null;
  };

  // WHICH ROW DOES THIS SETTLE BELONG TO? `closeOpen()` only drops the REFERENCE — it never marks
  // the row finished — so anything that closes a block mid-stream (a tool call between the chunks
  // and the close is the common one) left the settle with nothing to replace, and it pushed a
  // SECOND row carrying the same text. That is the duplicate he kept seeing after the SETTLERS fix:
  // that fix was dead code, because `assistant.text` is intercepted by the REPLAY branch above and
  // never reaches SETTLERS at all.
  //
  // It also answers the other doubling: a resumed session SEEDS its transcript into `history` and
  // the same message can arrive again live, identical and already settled. Same question, same
  // answer — the row already exists, so claim it instead of adding another.
  const claim = (kind, text) => {
    if (openRow && openRow.kind === kind && !openRow.settled) return openRow;
    for (let k = rows.length - 1; k >= 0 && rows.length - k <= 8; k -= 1) {
      const r = rows[k];
      if (r.kind !== kind) continue; // tool rows and the like sit between the stream and its close
      if (!r.settled && text.startsWith(r.text)) return r; // the stream this settle finishes
      if (r.settled && r.text === text) return r; // already recorded — replay meeting live
      break; // a different finished message: this settle opens a new one
    }
    return null;
  };

  let sawReplay = false;
  let seamDrawn = false;
  // The compaction receipt currently waiting for its second number (see the `compaction` branch).
  let openCompaction = null;
  // A slash-command receipt waiting for its printout (see the command branch below).
  let openCmd = null;
  // The model the conversation was last running on — a change in it is its own event.
  let lastModel = null;

  (events || []).forEach((ev, i) => {
    if (!ev || !ev.kind) return;
    const key = `${ev.ts || 0}-${i}`;

    // A PEER AGENT'S TURN — his shape, not his voice. Carries WHO so the chat can name them.
    if (ev.kind === "user.prompt" || ev.kind === "text") {
      const vis = parseVisitorTurn(textOf(ev));
      if (vis) {
        closeOpen();
        // The LOCAL ECHO of this same forward — the panel that relayed the visitor pushed the
        // words optimistically, and the host's echo is the same turn arriving back. Replace it,
        // never duplicate it: exactly the rule his own turns follow a few lines down.
        if (ev.kind === "user.prompt" && !ev.replay) {
          for (let k = rows.length - 1; k >= 0 && rows.length - k < 6; k -= 1) {
            if (rows[k].local && (rows[k].text || "").trim() === vis.text) {
              rows.splice(k, 1);
              break;
            }
          }
        }
        rows.push({ key, kind: "mine", text: vis.text, ts: ev.ts, as: vis.as, replay: !!ev.replay, settled: true });
        return;
      }
    }

    // A SLASH COMMAND IS A RECEIPT, NOT A SENTENCE. A terminal command arrives as two consecutive
    // user records — one carrying <command-name>/<command-args>, the next carrying
    // <local-command-stdout> — and drawn as "mine" bubbles they read as him pasting XML at the
    // agent (his ask, off /usage: *"make a nice display for commands like that that return"*).
    // The pair folds into ONE receipt: the command, then what it printed. Ground-truthed against
    // the transcript: the tags are the host's own encoding, and his own prose can share a record
    // with them — whatever is left once the tags are stripped is still HIS turn and keeps its row.
    if (ev.kind === "user.prompt") {
      const t = textOf(ev);
      if (CMD_TAGS.test(t)) {
        closeOpen();
        const nm = t.match(/<command-name>\s*([^<]+?)\s*<\/command-name>/);
        const out = t.match(/<local-command-stdout>([\s\S]*?)<\/local-command-stdout>/);
        const args = (t.match(/<command-args>([\s\S]*?)<\/command-args>/) || [, ""])[1].trim();
        const rest = t.replace(new RegExp(CMD_TAGS.source, "g"), "").trim();
        if (nm) {
          openCmd = { key, kind: "cmdret", name: nm[1], args, out: out ? out[1].replace(/\s+$/, "") : "", ts: ev.ts, replay: !!ev.replay, i };
          rows.push(openCmd);
        } else if (out) {
          // A printout with no command record of its own — a mistyped command answers this way.
          // It joins the receipt just above it when there is one, close by; otherwise it stands alone.
          const body = out[1].replace(/\s+$/, "");
          if (openCmd && !openCmd.out && i - openCmd.i <= 3) openCmd.out = body;
          else rows.push({ key, kind: "cmdret", name: "", args: "", out: body, ts: ev.ts, replay: !!ev.replay });
          openCmd = null;
        }
        if (rest) rows.push({ key: `${key}-said`, kind: "mine", text: rest, ts: ev.ts, as: null, replay: !!ev.replay, settled: true });
        return;
      }
    }

    // `/compact` IS NOT A MESSAGE HE SENT. It goes down the same pipe as a user turn, so left alone
    // it draws a bubble with "/compact" in it — a command wearing a sentence's clothes, and the same
    // mistake as a `systemview nav` line drawn as a shell command. It becomes the one thing it
    // actually is: the compaction starting. (It still drives the cooking line; see foldState.)
    if (ev.kind === "user.prompt" && /^\s*\/compact\b/.test(textOf(ev))) {
      if (!openCompaction) {
        openCompaction = { key, kind: "note", text: "compacting…", pending: true, ts: ev.ts };
        rows.push(openCompaction);
      }
      return;
    }

    // THE STREAM, in the bridge's own shape — read from the emitter (autobot sessions.cjs), not
    // guessed: a content_block_delta becomes {kind:"assistant.text", delta:"<increment>", done:false}
    // and the block's close carries the full `text` with done:true. `textOf` cannot see `delta`, so
    // every chunk read as an empty event and fell through — the panel dumped finished answers only.
    // His catch: *"the agent panel is streaming the chat in and yours I don't see it until it fully
    // comes in."* A chunk GROWS the open row; the settle below replaces it, never duplicates it.
    if ((ev.kind === "assistant.text" || ev.kind === "assistant.thinking") && ev.done !== true && !textOf(ev)) {
      if (!ev.delta) return; // an empty chunk grows nothing
      const grow = ev.kind === "assistant.text" ? "say" : "think";
      if (openRow && openRow.kind === grow && !openRow.settled) openRow.text += ev.delta;
      else {
        openRow = { key, kind: grow, text: ev.delta, ts: ev.ts, settled: false };
        rows.push(openRow);
      }
      return;
    }

    const replayKind = REPLAY[ev.kind];
    // A `user.prompt` that repeats the sentence this view just sent is the SAME turn arriving from
    // the host, not a second one. Drop the local copy rather than the event: the event is the one
    // every other view will also see.
    if (ev.kind === "user.prompt" && !ev.replay) {
      const t = textOf(ev).trim();
      for (let k = rows.length - 1; k >= 0 && rows.length - k < 6; k -= 1) {
        if (rows[k].local && (rows[k].text || "").trim() === t) {
          rows.splice(k, 1);
          break;
        }
      }
    }
    // A COMPACTION THAT NEVER HAPPENS. `/compact` on a short conversation is answered with a plain
    // sentence — "Not enough messages to compact." — and NO boundary event ever arrives. Left alone
    // the "compacting…" line sits there permanently claiming something is underway while the agent's
    // own reply says it isn't: the status-outliving-its-state bug, which this app has now hit five
    // times. The agent speaking is the proof it is not compacting, so the line comes down and its
    // reply stands in for it.
    if ((ev.kind === "assistant.text" || ev.kind === "text") && openCompaction && openCompaction.pending) {
      const at = rows.indexOf(openCompaction);
      if (at >= 0) rows.splice(at, 1);
      openCompaction = null;
    }

    if (replayKind) {
      sawReplay = true;
      const t = textOf(ev);
      // The settled text is the authority for the row its own chunks grew — REPLACE it, exactly
      // the rule the hyphenated settlers already follow. Pushing a second row here is how a
      // streamed answer would print itself twice the moment it finished.
      if (replayKind === "say") {
        const target = claim("say", t);
        if (target) {
          target.text = t || target.text;
          target.settled = true;
          closeOpen();
          return;
        }
      }
      closeOpen();
      if (t.trim())
        // `as: null` explicitly — a turn with nobody attached to it is HIS, and leaving the key off
        // makes "no visitor" and "we forgot to look" the same shape.
        rows.push({ key, kind: replayKind, text: t, ts: ev.ts, as: null, replay: !!ev.replay, settled: true });
      return;
    }
    // First live event after a replay: say where the past stopped, once.
    if (sawReplay && !seamDrawn) {
      seamDrawn = true;
      rows.push({ key: `${key}-seam`, kind: "seam", text: "resumed here", ts: ev.ts });
    }

    const opener = OPENERS[ev.kind];
    if (opener) {
      // Same kind still streaming → grow it. A different kind interrupts and starts its own row.
      if (openRow && openRow.kind === opener && !openRow.settled) openRow.text += ev.text || "";
      else {
        openRow = { key, kind: opener, text: ev.text || "", ts: ev.ts, settled: false };
        rows.push(openRow);
      }
      return;
    }

    // HIS OWN TURN, echoed locally by the panel that sent it. It must read as HIS — routed through
    // the assistant settler it wore our colour, so a conversation looked like the agent talking to
    // itself. Carries `local` so the host's own `user.prompt` can replace it when both views are
    // watching one session.
    if (ev.mine && (ev.text || "").trim()) {
      closeOpen();
      // A VISITOR'S TURN is his turn's shape but not his voice — another agent reached in through
      // the CLI. Same row, carrying WHO, so the chat can name them instead of letting an agent's
      // sentence pass as the human's.
      rows.push({ key, kind: "mine", text: ev.text, ts: ev.ts, local: !!ev.local, as: ev.as || null, settled: true });
      return;
    }
    const settler = SETTLERS[ev.kind];
    if (settler) {
      // The authoritative text for the block that was streaming. Replace, never append.
      const target = claim(settler, ev.text || "");
      if (target) {
        target.text = ev.text || target.text;
        target.settled = true;
        closeOpen();
      } else if ((ev.text || "").trim()) {
        // `toRoom` marks a message this agent SENT to its room rather than said in the session —
        // same text, different act, and the row says which.
        rows.push({ key, kind: settler, text: ev.text, ts: ev.ts, settled: true, toRoom: ev.toRoom || undefined });
      }
      return;
    }

    closeOpen();

    if (IS_CALL(ev.kind)) {
      // AN ACTION ON HIS WINDOW IS NOT A SHELL LINE. A `systemview nav …` moved the thing he is
      // looking at; drawn as `run: node cli/index.js nav …` it read like any other command, which
      // is backwards — it is the one kind of call whose effect he can actually see.
      const sv = parseSvCommand(ev.input && ev.input.command);
      // A MESSAGE TO ANOTHER AGENT IS CONVERSATION, NOT PLUMBING — his rule, and it is the name of
      // the app: *"it needs to be visible… I need to be able to go back and follow the conversation
      // — that's why it's called SystemView."* The harness's SendMessage went down this pipe as a
      // generic tool row with the words folded away behind a click. The mechanism can stay whatever
      // is easiest; the RECORD has to read like what it was: who we messaged, and what we said,
      // on screen, followable after the fact. (The other direction already is — an incoming
      // cross-session message renders as a named visitor turn.)
      const xsend =
        (ev.tool || ev.name) === "SendMessage" && ev.input
          ? { to: String(ev.input.to || "?"), msg: String(ev.input.message || ""), about: String(ev.input.summary || "") }
          : // A `systemview message-agent` IS a message — the sanctioned channel, and it was rendering
          // as a plain bash line while the discouraged socket got the proper row (his catch). Same
          // row for both: who it went to, the words on screen, the identity it spoke as.
          sv && sv.verb === "message-agent" && sv.project
          ? { to: sv.project, msg: String(sv.target || ""), about: sv.as ? `as ${sv.as}` : "" }
          : null;
      const row = {
        key,
        kind: "tool",
        id: ev.id,
        xsend,
        tool: ev.tool || ev.name,
        // THE HOST ALREADY WROTE THE LINE. It holds the tool schemas, so it says "reading
        // CodePane.js" or "run: yarn build" once, at the source — and every view that renders it
        // agrees for free. Ours is only the fallback for a host that doesn't.
        sv,
        // A SYSTEMVIEW ROW READS AS THE COMMAND — verb and arguments as typed, unclamped; the
        // "probed …" wording is for the cooking line, not the log (his rule).
        summary: xsend
          ? rowLabel(`message → ${xsend.to}${xsend.about ? ` — ${xsend.about}` : ""}`)
          : sv
          ? sv.line
          : rowLabel(ev.summary || summarise(ev) || ev.tool || ev.name),
        input: ev.input,
        path: pathTouchedBy(ev),
        // Whose repo — the event is stamped with it, and the open/diff door needs it: an absolute
        // path with no project behind it is exactly the click that opened nothing (his report).
        project: ev.projectCode || null,
        wrote: (isWrite(ev) && !!pathTouchedBy(ev)) || (!pathTouchedBy(ev) && !!(ev.input && typeof ev.input.command === "string" && (bashTouch(ev.input.command) || {}).wrote)),
        // WHAT TO EMBED WHEN THE ROW OPENS. The host hands absolute paths; the hub serves files by
        // project + relative path, so the row carries the path relative to the session's cwd (the
        // event stamps it) and, for a Read, the lines it looked at. A row whose path is outside the
        // repo gets no embed — the button still points at it, nothing is taken away.
        ...(() => {
          const direct = pathTouchedBy(ev);
          if (direct) return { rel: relTo(ev.cwd || ev.worktree, direct), span: readSpan(ev) };
          const t = ev.input && typeof ev.input.command === "string" ? bashTouch(ev.input.command) : null;
          if (!t) return { rel: null, span: null };
          // A relative path in a bash command is relative to the cwd already; an absolute one is
          // relativised like a Read's.
          const rel = t.file.startsWith("/") ? relTo(ev.cwd || ev.worktree, t.file) : t.file.replace(/^\.\//, "");
          return { rel, span: t.span, bashWrote: t.wrote };
        })(),
        state: "running",
        ts: ev.ts,
      };
      rows.push(row);
      if (ev.id) byToolId.set(ev.id, row);
      return;
    }

    if (IS_RESULT(ev.kind)) {
      // THE ROW RESOLVES IN PLACE — a call and its result are one thing that happened, not two
      // lines. An end with no start (a view that attached mid-call) still gets a row, because
      // silently dropping it makes the feed disagree with what the session actually did.
      const row = ev.id && byToolId.get(ev.id);
      const ok = ev.ok !== false;
      // The host (autobot's sessions.cjs) sends a result's text as `detail` — the first 400 chars
      // of what the tool returned. Reading `output`/`content` alone left every result row empty
      // (his catch: a probe row with no answer to pipe into its block).
      const out = ev.output != null ? ev.output : ev.content != null ? ev.content : ev.detail;
      if (row) {
        row.state = ok ? "ok" : "failed";
        row.output = out;
      } else {
        rows.push({ key, kind: "tool", id: ev.id, tool: "", summary: rowLabel(ev.summary) || "(result)", state: ok ? "ok" : "failed", output: out, ts: ev.ts });
      }
      return;
    }

    if (IS_ASK(ev.kind)) {
      rows.push({ key, kind: "ask", id: ev.id, title: ev.title || ev.tool || "permission", detail: ev.detail || ev.input, answered: null, ts: ev.ts });
      return;
    }

    if (IS_DONE(ev.kind)) {
      rows.push({
        key,
        kind: "done",
        ok: ev.ok !== false && !ev.error,
        turns: ev.turns,
        costUsd: ev.costUsd,
        durationMs: ev.durationMs,
        ts: ev.ts,
      });
      return;
    }

    // A COMPACTION IS A THING THAT HAPPENED, not a silence. It is the moment the conversation he is
    // reading loses its middle, so it belongs in the feed as its own receipt.
    // STOPPED, and COMPACTING — both are moments in the conversation, so both get a line. A note is
    // deliberately not a message: it is the thread saying what happened to it.
    if (ev.kind === "interrupted") {
      rows.push({ key, kind: "note", text: "interrupted", ts: ev.ts });
      return;
    }
    // THE MODEL CHANGED, AND THAT IS A MOMENT IN THE CONVERSATION. His ask, twice: *"I need an
    // event to show in the chat that the model is different."* And he is right that it belongs in
    // the thread rather than only in a chip — the chip tells you what is true NOW, the receipt tells
    // you WHERE it changed, which is the question you have when you are reading back and the answers
    // start sounding different. Same shape as the compaction receipt, for the same reason.
    //
    // The host repeats `session.started` with the new model when a switch takes effect (autobot
    // measured this: the SDK opens the next turn with a fresh `system:init`). A repeat with the SAME
    // model is just a re-init and says nothing worth a line.
    if (ev.kind === "session.started" && ev.model) {
      if (lastModel && ev.model !== lastModel) {
        rows.push({
          key,
          kind: "note",
          model: true,
          from: lastModel,
          to: ev.model,
          text: `model — ${shortModelName(lastModel)} → ${shortModelName(ev.model)}`,
          ts: ev.ts,
        });
      }
      lastModel = ev.model;
    }

    // A COMPACTION THAT FAILED SAYS WHY. ANNOUNCED, NOT YET SHIPPING: autobot has agreed to forward
    // the SDK's `system`/`subtype:"status"` record as `{ kind: "status", compactResult, compactError }`
    // and will tell us if the names change rather than let us discover it. Handled tolerantly here
    // because the alternative is the failure being a silence — and unlike their dead `status` path
    // this one is additive: the prompt-text heuristic beside it works today either way.
    if (ev.kind === "status" && ev.compactResult === "failed") {
      if (openCompaction && openCompaction.pending) {
        const at = rows.indexOf(openCompaction);
        if (at >= 0) rows.splice(at, 1);
      }
      openCompaction = null;
      rows.push({ key, kind: "error", text: `compaction failed — ${ev.compactError || "unknown reason"}`, ts: ev.ts });
      return;
    }

    if (IS_COMPACTING(ev.kind)) {
      // Our own optimistic line, replaced by the host's receipt the moment it lands. Kept as its own
      // row rather than folded into the receipt because the gap between the two is a real minute or
      // two of waiting, and a blank feed during it is the silence this whole surface exists to end.
      openCompaction = { key, kind: "note", text: "compacting…", pending: true, ts: ev.ts };
      rows.push(openCompaction);
      return;
    }
    if (IS_COMPACTED(ev.kind)) {
      // THE RECEIPT, in autobot's numbers, not ours. Their panel and this one now read the same
      // `preTokens`/`postTokens` off the same event, so the two windows he watches side by side say
      // the identical sentence — which is the entire point of taking their contract instead of
      // inventing one. `postTokens` is frequently absent (the SDK omits it on replayed transcripts),
      // and rather than printing autobot's "fresh" placeholder we leave the second number OPEN and
      // let the next turn's usage fill it in: the context after a compaction is a fact that arrives
      // a moment late, not a fact that doesn't exist.
      const before = preTokensOf(ev);
      const after = Number(ev.postTokens || ev.post_tokens || 0) || 0;
      const trigger = ev.trigger || (ev.compactMetadata && ev.compactMetadata.trigger) || null;
      const row = {
        key,
        kind: "note",
        text: ev.summary || compactionText(before, after, trigger),
        before,
        after,
        trigger,
        ts: ev.ts,
      };
      // Replace the "compacting…" line we put up rather than stacking a second row under it.
      if (openCompaction && openCompaction.pending) {
        const at = rows.indexOf(openCompaction);
        if (at >= 0) rows.splice(at, 1);
      }
      openCompaction = after > 0 ? null : row; // still waiting on the second number
      rows.push(row);
      return;
    }
    // `file.changed` and `usage` are facts for other surfaces (the diff door, the header), not lines
    // — with one exception: the first usage AFTER a compaction is the only place the post-compaction
    // context number exists when the SDK didn't send one, so it finishes the receipt above.
    if (IS_USAGE(ev.kind)) {
      if (openCompaction && !openCompaction.pending) {
        // A ZERO-TOKEN USAGE IS NOT AN ANSWER. Autobot's pump emits `usage` off every `result`
        // record unconditionally, and some turns close with `input_tokens: 0` and no cache reads —
        // a refused slash command is exactly that shape. Closing the receipt on one would freeze it
        // at "compacted — from 908k" forever, or worse, finish it with "→ 0k". Keep waiting: the
        // next real turn carries the real number, and the line stays true until it does.
        const after = Number(ev.contextTokens) || inputTokensOf(ev);
        if (after > 0) {
          openCompaction.after = after;
          openCompaction.text = compactionText(openCompaction.before, after, openCompaction.trigger);
          openCompaction = null;
        }
      }
      return;
    }
    if (ev.kind === "file.changed" || ev.kind === "session.started") return;

    if (ev.kind === "error") {
      rows.push({ key, kind: "error", text: ev.message || "the session errored", ts: ev.ts });
      return;
    }
    // `status` and `exit` are state, not feed rows — the header shows them.
  });

  return rows;
}

// THE HEADER'S FACTS, folded from the same stream so there is one source for "is it working".
export function foldState(events) {
  // `doing` is the COOKING LINE's words. His catch, once the direct chat replaced the room's:
  // *"you're not showing that we're cooking — the agent panel from you lost that functionality."*
  // Same rule the room's line always had: truth over theatre. It names the tool actually in flight,
  // and says plain "working" only when there genuinely isn't one.
  // `ctx` is the REAL context this conversation is carrying, not a count of records. SystemView's
  // room meter measures its own 300-record compaction rule, which says nothing about how full a
  // Claude conversation is — his complaint, and a fair one: *"I don't know how to trust the bar."*
  // A turn's INPUT tokens are the conversation as the model just saw it, so the newest one is the
  // honest number. Summing them would be nonsense: every turn re-sends the whole conversation.
  // `ctxWindow` is the size of the window `ctx` is measured against, and it is NOT a constant. A
  // hardcoded 200k is what the meter used to draw against, and it was simply wrong for his sessions:
  // a single turn in this very conversation read 907,478 cached input tokens, so the model is on a
  // 1M window and the bar had been pinned at 100% and screaming "compact" for hours. A gauge that
  // saturates is a gauge that means nothing. So: believe the host if it tells us the window, and
  // otherwise INFER it upward from what we have actually seen — a conversation that has held 907k
  // tokens is proof of a window that fits 907k, no matter what a constant claims.
  // `visitors` — every other agent that has spoken in this conversation, oldest first. The room used
  // to be the only place a visit could happen and the roster read off the hub's real holds; a peer
  // reaching into a SESSION leaves no hold anywhere, so the only honest record of who is here is who
  // has spoken. His standing rule either way: who is in whose chat is always on screen.
  const s = { state: "idle", model: null, exited: null, cost: 0, turns: 0, doing: null, ctx: 0, ctxWindow: 0, compactions: 0, visitors: [], usage: null, tokIn: 0, tokOut: 0, turnOut: 0, liveChars: 0, lastUsage: null };
  // ONE FIELD, ONE CONSUMER — autobot's synthesis after we each corrected the other's half-rule, and
  // it is better than either. They said clamp at the SOURCE; I said that shrinks the RECORD to fit
  // the label, so clamp at the STATUS; they answered that a rule every future call site has to
  // remember is a rule that eventually is not — and the three doorways I had just found were the
  // evidence. One unbounded field, three consumers, each expected to know.
  //
  // So the status is built into a LOCAL and clamped ONCE on the way out. Every branch below writes
  // to `doing` in whatever words it likes and none of them makes a clamp decision, because none of
  // them is the thing the panel reads. A new branch added next year inherits the bound without
  // knowing the rule exists. The rows from foldEvents stay whole — they are the RECORD, and the
  // record and the label were never the same field here, only the same variable.
  // His send has started a turn that nothing has finished yet — see the status branch.
  let pendingTurn = false;
  let doing = null;
  let hostWindow = 0;
  let ctxSeen = 0;
  // A COMPACTION IS A CEILING, and this is the third act of the receipt saga. `compactMetadata`
  // arrives with `preTokens` and NO `postTokens` (verified in the transcript: preTokens 783332,
  // no post half at all), so the boundary alone cannot say what the window now holds. Worse, the
  // host's snapshot is a variable that nothing resets at the boundary — so the very next `result`
  // re-emits the PRE-compaction number and the bar snaps straight back to where it was. His words,
  // right after compacting: *"the compaction bar still looks the same… same page, what's going on."*
  // The context after a compaction cannot be larger than it was before it. So the pre figure becomes
  // a ceiling: any snapshot at or above it is the stale one and is refused, until a smaller one — a
  // genuine post-compaction reading — arrives and disarms it.
  let staleAbove = 0;
  // Did the SESSION declare its model, or did we only overhear one on a usage line? See below.
  let modelDeclared = false;
  (events || []).forEach((ev) => {
    if (!ev) return;
    if (ev.kind === "user.prompt" || ev.kind === "text") {
      const vis = parseVisitorTurn(textOf(ev));
      if (vis && !s.visitors.includes(vis.as)) s.visitors.push(vis.as);
      // Read BEFORE the branches, not inside one: the printout rides a record the branches below
      // deliberately treat as "not a turn", and a fact worth keeping should not depend on which
      // branch happens to claim the record.
      const bars = parseUsageReport(textOf(ev));
      if (bars) s.usage = { bars, ts: ev.ts || 0 };
    }
    if (ev.kind === "status" || ev.kind === "session.started") {
      // A SEND THAT IS STILL IN FLIGHT OUTRANKS A "READY". He sends, the panel flips to cooking
      // instantly (the local-echo branch below) — and then the host's own `status: ready` or a
      // `session.started` lands a beat later and puts it straight back to idle. That is the flash
      // he sees: the line appears, vanishes, and stays gone until the first thinking event seconds
      // later, so the send looks like it went nowhere. Those events describe the SESSION being
      // alive, not the turn being over; only a real turn ending (a finished answer, a result, an
      // interrupt) may clear a turn that has started.
      if (ev.state && !(pendingTurn && ev.state === "ready")) s.state = ev.state;
      else if (ev.kind === "session.started" && !pendingTurn) s.state = "ready";
      if (ev.model) {
        // A MODEL SWITCH ENDS THE OLD OBSERVATIONS. `ctxSeen` is a high-water mark used to raise a
        // window we are unsure about — but it described a DIFFERENT model, and carrying it across a
        // switch is how a small window gets silently inflated by a big one's history.
        if (s.model && ev.model !== s.model) ctxSeen = 0;
        s.model = ev.model;
        // WHERE THE NAME CAME FROM decides whether we may size a window from it. Only the session
        // declaring its own model is authoritative; see contextWindowFor.
        modelDeclared = true;
      }
      const w = Number(ev.contextWindow || ev.context_window) || 0;
      if (w > 0) hostWindow = w;
      // ANNOUNCED, NOT YET SHIPPING (see the failure branch in foldEvents). When it arrives this is
      // what turns the narration on for an AUTO compaction, which the prompt-text heuristic below
      // structurally cannot see: nobody typed anything.
      if (ev.status === "compacting") {
        s.state = "working";
        doing = "compacting the conversation";
      } else if (ev.compactResult) {
        // A verdict ends the turn. Without this a failed compaction leaves the line spinning forever
        // — the same hole autobot has today, because `compactResult` is half of their working test.
        s.state = "ready";
        doing = null;
      }
    } else if (ev.kind === "text" && ev.mine) {
      pendingTurn = true;
      // HIS SEND, THE INSTANT HE SENDS IT. The panel's own send drops a local echo of kind "text"
      // — and this fold had no branch for it, so the state sat "idle" until the host's round-trip
      // or our first thinking event, a second-plus in which his message looked like it hadn't gone
      // through (his catch: *"it makes you wonder if the message even went through"*, while the
      // host's own panel flips to cooking immediately). The send IS the turn starting; nothing
      // needs to round-trip to know that.
      s.state = "working";
      doing = null;
    } else if (IS_CALL(ev.kind)) {
      s.state = "working";
      const sv = parseSvCommand(ev.input && ev.input.command);
      // Short by construction — see svStatus. The full body still lands in the feed row above.
      // The FALLBACK is clamped too, because a status has one line no matter who wrote it: the
      // host's own `summary` is whatever their toolSummary produced, and `SendMessage` hands it a
      // whole message. Same bug, other doorway — a cooking line reciting the thing it is announcing.
      doing = svStatus(sv) || ev.summary || summarise(ev) || ev.tool || ev.name;
      // A TOOL CALL IS GENERATED TOO. The live count used to move only while the answer's prose
      // streamed, so a turn spent in tool calls and thinking sat near zero — his: "what happened to
      // the token shown with the cooking message?… building up as the turn went on." The call's
      // input is output the model wrote; count it (chars, ~4 per token) unless this is a replay.
      if (!ev.replay && ev.input) {
        try { s.liveChars += JSON.stringify(ev.input).length; } catch {}
      }
    } else if (ev.kind === "assistant.thinking" || ev.kind === "thinking-delta") {
      s.state = "working";
      // Thinking is generated output as well — it climbs the same count.
      if (!ev.replay && !ev.done && ev.delta) s.liveChars += String(ev.delta).length;
      // THE AGENT NARRATES ITS OWN THINKING. RFC-048 gives `assistant.thinking` a `summary`, so the
      // line can say what is actually being turned over and CHANGE as that changes. Hardcoding the
      // word "thinking" was the bug: one frozen word for a whole turn is indistinguishable from stuck.
      // CLAMPED FOR THE SAME REASON, and found by applying the rule to my own file rather than
      // waiting to be shown it: `summary` is a short narration by design (RFC-048), but the
      // fallbacks are not — `text` on a SETTLED thinking block is the entire reasoning, which is
      // the flood he caught on `say` wearing different clothes. The clamp lives HERE, at the
      // status, not in the shared source: the same fields feed the feed row, and the row wants
      // every word. Clamping at the source would shrink the record to fit the label.
      doing = ev.summary || ev.text || ev.delta || "thinking";
    } else if (ev.kind === "assistant.text" || ev.kind === "text-delta" || ev.kind === "user.prompt") {
      // THE LAST COMMAND HOLDS THE LINE — his call, watching both panels side by side: *"the agent
      // panel always shows the last command as the cooking message, and you only sometimes show
      // that."* Writing used to blank it, so the line went generic exactly when it had something
      // real to say. Now only a NEW TURN (his prompt) or the turn ENDING clears it; mid-turn,
      // whatever was last named — a command, a thought — stays up until the next one replaces it.
      // The stale-status danger was never this: it was the name outliving the TURN, and every
      // turn-ending event (done, interrupted, compacted) still clears it.
      if (ev.kind === "user.prompt") doing = null;
      // …unless the turn IS a compaction. `/compact` goes in as an ordinary user turn and the host
      // says nothing more until the boundary lands a minute or two later, so without this the line
      // spends the whole wait cycling "stirring the pot" over a conversation that is being rewritten.
      // Autobot's panel reads the prompt text for exactly this reason and so does this one — same
      // heuristic, same words, so the two windows he watches side by side agree.
      // THE PLAN METERS, FROM THE ONE PLACE THEY EXIST. The terminal's /usage prints into the
      // transcript as a local-command printout; the host cannot run it on request. So the fold
      // keeps the LAST report it saw — bars and the time it was printed — and the ticker warns off
      // it, aged honestly ("as of 4:12 PM"). Replayed history counts: a report from an hour ago is
      // still the newest truth until he runs it again.
      if (ev.kind === "user.prompt" && /<command-name>\s*\/?usage\s*<\/command-name>/.test(textOf(ev))) {
        const bars = parseUsageReport(textOf(ev));
        if (bars) s.lastUsage = { bars, ts: ev.ts || 0 };
      }
      if (ev.kind === "user.prompt" && !ev.replay && /^\s*\/compact\b/.test(textOf(ev))) {
        doing = "compacting the conversation";
        s.state = "working";
        return;
      }
      // A SLASH COMMAND'S RECORD IS NOT A TURN. The host ran /usage and printed the answer itself
      // — the session never worked — but the record went down the user.prompt pipe and flipped the
      // panel to "working" with nothing in flight. If stripping the command tags leaves no prose,
      // nobody said anything, and the state stays exactly where it was.
      if (ev.kind === "user.prompt" && CMD_TAGS.test(textOf(ev))) {
        const bare = textOf(ev).replace(new RegExp(CMD_TAGS.source, "g"), "").trim();
        if (!bare) return;
      }
      // `done` on assistant.text IS the end of the turn (RFC-048). Not honouring it is why the line
      // still said "thinking" after the answer had finished printing: a status outliving the state it
      // describes, the same bug class as the stale dictation draft and the ReportsTab poll.
      s.state = ev.done ? "ready" : "working";
      // TOKENS AS IT COOKS. Every streamed chunk adds to a live count (chars, ~4 per token) so the
      // ticker can move while the answer is being written — his ask, from the harness he had
      // before: "I could see tokens being generated as you cooked." The exact figure replaces it
      // when the turn's receipt lands.
      if (!ev.done && ev.delta) s.liveChars += String(ev.delta).length;
      if (ev.done) {
        doing = null;
        pendingTurn = false; // the answer finished — this turn is genuinely over
      }
    } else if (IS_RESULT(ev.kind)) {
      // The command's name OUTLIVES its result on purpose — see the writing branch above. Nulling
      // here was what made the line drop to a generic cooking word between commands while the
      // other panel kept saying the real thing.
    } else if (IS_ASK(ev.kind)) {
      s.state = "waiting";
      doing = ev.title || ev.tool || "asking permission";
    } else if (ev.kind === "interrupted") {
      // The turn is over because he ended it. Nothing is in flight, so nothing may claim to be.
      pendingTurn = false;
      s.state = "ready";
      doing = null;
    } else if (IS_COMPACTING(ev.kind)) {
      // Named, and not cycled — compacting is a specific thing happening and the line should say so
      // rather than reach for "stirring the pot".
      s.state = "working";
      doing = "compacting the conversation";
    } else if (IS_COMPACTED(ev.kind)) {
      s.state = "ready";
      doing = null;
      s.compactions += 1;
      // The window just emptied. `postTokens` is the honest new number when the SDK sends it; when it
      // doesn't, zero is still closer to the truth than the pre-compaction figure, and the next
      // `usage` corrects it within one turn. `preTokens` also counts as a sighting for the ruler
      // below — a conversation that reached 908k proves a window that holds 908k.
      const pre = preTokensOf(ev);
      ctxSeen = Math.max(ctxSeen, pre);
      // The ceiling is what the bar was ALREADY SHOWING, not `preTokens`. They are not the same
      // number — the transcript's boundary said 783332 while the host's last snapshot was 776000,
      // so a preTokens ceiling sits above the stale value and lets it straight through (it did).
      // What we held a moment ago is exact and is the honest bound: whatever a compaction leaves
      // behind is smaller than what it started with.
      const held = s.ctx;
      s.ctx = Number(ev.postTokens || ev.post_tokens || 0) || 0;
      // Arm only when the boundary did not tell us where it landed. One carrying both numbers
      // needs no defending.
      staleAbove = s.ctx ? 0 : held || pre || 0;
    } else if (IS_USAGE(ev.kind)) {
      // A RULER TICK IS NOT A BILL. Autobot now emits `usage{snapshot:true}` off every parent
      // assistant message so the bar can move DURING a turn (their commit 81c6213, my ask). Those
      // carry the window reading only — but the ledger below adds any `costUsd` it is handed, and
      // a ruler tick that ever grew a cost field would quietly multiply the running total by the
      // number of messages in a turn. The receipt is the only thing that may pay: it is the one
      // carrying `turns`. Their trap warning was about the turn-CLOSE path (we are immune there —
      // nothing in this branch touches `state` or `doing`); this is the same shape one door over.
      if (!ev.snapshot && typeof ev.costUsd === "number") s.cost += ev.costUsd;
      // THE SESSION'S OWN USAGE — tokens in and out, summed off the same receipts that carry cost.
      // This is what the usage view draws, because the host cannot run the terminal's /usage:
      // sending "/usage" through the SDK delivers the text to the model (he pressed it twice and
      // watched "running…" forever). These numbers are real, live, and need no command.
      if (!ev.snapshot) {
        s.tokIn += Number(ev.inputTokens || 0) || 0;
        const out = Number(ev.outputTokens || 0) || 0;
        s.tokOut += out;
        if (out) { s.turnOut = out; s.liveChars = 0; }
      }
      // `contextTokens` is autobot's own sum — fresh input plus everything read from cache — and it
      // is the number their meter rides, so taking it verbatim is what makes the two bars agree.
      // The hand-rolled sum stays as the fallback for a host that only sends the raw fields.
      //
      // THE RECEIPT SAGA, in two acts, because this line has now been wrong in both directions.
      // Act one: the bridge emitted the SDK result's OWN usage as contextTokens — cumulative
      // across the run — and the bar read "2M / 1M · fable" on a 177k conversation at every stop
      // (the second half of the red-bar mystery; he caught it by reading the numbers off the bar).
      // I guarded: any usage carrying `turns`/`ok` was a receipt, cost ledger only, never the
      // ruler. Act two: autobot fixed their emitter (crediting the find) — the receipt now carries
      // `s.lastCtxSnapshot`, the honest per-assistant number — and since live sessions emit usage
      // ONLY on that path, my guard froze this panel's ruler while theirs moved: HIS catch,
      // "agentci's context used to be aligned, now it's misaligned." A defense against an extinct
      // shape is itself the stale belief. The receipt is trusted again; the one thing still
      // refused is `contextTokens: null` — the fixed bridge's explicit "no snapshot yet", which
      // must not fall back to the cumulative inputTokens beside it.
      // Act three: the ceiling (see `staleAbove`). A snapshot at or above the figure the last
      // compaction started from is the pre-compaction reading arriving late, not the new one.
      const inTok = ev.contextTokens === null ? 0 : Number(ev.contextTokens) || inputTokensOf(ev);
      if (inTok > 0 && !(staleAbove && inTok >= staleAbove)) {
        s.ctx = inTok;
        ctxSeen = Math.max(ctxSeen, inTok);
        staleAbove = 0;
      }
      // THE SESSION'S MODEL, NOT THIS TURN'S. `usage` carries a model name, and a subagent turn
      // carries the SUBAGENT's — so a single Task running on a small-window model would redefine the
      // whole conversation's window and paint the bar red. `session.started` is the authority; usage
      // only fills the gap when the host never said.
      if (ev.model && !s.model) s.model = ev.model;
      const w = Number(ev.contextWindow || ev.context_window) || 0;
      if (w > 0) hostWindow = w;
    } else if (IS_DONE(ev.kind)) {
      pendingTurn = false;
      s.state = "ready";
      doing = null;
      if (typeof ev.costUsd === "number") s.cost += ev.costUsd;
      if (typeof ev.turns === "number") s.turns += ev.turns;
      if (ev.kind === "session.ended") s.exited = ev.reason || "ended";
    } else if (ev.kind === "exit") s.exited = ev.reason || "ended";
  });
  // AN UNKNOWN MODEL MUST NOT PRODUCE A RED BAR. He has reported twice that interrupting a turn
  // makes the meter jump to "compact now"; I could not reproduce it against a stub, so I stopped
  // guessing at the trigger and closed the one path that can produce a FALSE red. It is this: a
  // model name overheard on a `usage` line — which may be a subagent's, or simply a name the table
  // does not know — sized the whole conversation's window, and guessing SMALL turns an ordinary
  // 190k conversation into an emergency. The costs are not symmetric: a false "compact now" is an
  // alarm he will act on, a late warning is recoverable and the real number is always in the
  // tooltip. So the model table is consulted ONLY when the session declared the model itself;
  // otherwise we size from what we have actually watched this conversation carry.
  s.doing = statusBrief(doing) || null;
  s.ctxWindow = contextWindowFor(modelDeclared ? s.model : null, ctxSeen, hostWindow);
  return s;
}

// THE RULER. Copied deliberately from autobot's panel rather than invented here, because two bars
// measuring the same conversation with different rulers is worse than one bar being slightly off —
// he has both windows open at once and they must agree. The rule, in their words: the 5-family runs
// a 1M window, the older models 200k, and an unrecognised model gets a ruler that grows past
// anything the conversation has already sailed past, so the bar can never read over 100%.
// A window the host states outright always wins; nothing states one today.
export const CTX_WINDOW_SMALL = 200000;
export const CTX_WINDOW_LARGE = 1000000;
const SMALL_WINDOW_MODELS = /haiku|-3-|sonnet-4-5|opus-4-5/;
export const contextWindowFor = (model, seen = 0, stated = 0) => {
  // A WINDOW THE HOST STATES IS THE TRUTH, FULL STOP. I used to `max()` it against what we had
  // seen, on the theory that a window cannot be smaller than a number already carried — which is
  // sound for a GUESSED window and wrong for a stated one. Caught by a model switch: 300k observed
  // on opus-5's 1M window, then a switch to haiku whose stated window is 200k, and the max() quietly
  // inflated haiku's window to 300k so the bar read comfortable. "300k of 200k", clamped at 100% and
  // red, is TRUE and is exactly what he needs to see — that context is about to be cut.
  if (stated > 0) return stated;
  // NO MODEL NAMED. This branch used to add 15% headroom over whatever had been seen — which meant
  // the ratio could never exceed 1/1.15 = 0.87, and the red line is 0.9. I had built a bar that was
  // STRUCTURALLY INCAPABLE of ever saying "compact now", and it is why his two panels disagreed:
  // autobot's said compaction needed and mine said healthy about the same conversation. A gauge
  // that cannot reach its own alarm is worse than a wrong one, because it looks like it is working.
  //
  // Assume the modern window instead and let observation raise it. Under-warning a genuinely small
  // model is recoverable and the numbers are on the bar either way; never alarming at all is not.
  if (!model) return Math.max(CTX_WINDOW_LARGE, seen);
  const byModel = SMALL_WINDOW_MODELS.test(model) ? CTX_WINDOW_SMALL : CTX_WINDOW_LARGE;
  // OBSERVATION BEATS THE MODEL TABLE. A conversation that has demonstrably held 907k tokens is not
  // running in a 200k window, whatever the model string says — and the model string is exactly the
  // thing most likely to be wrong here, because a subagent turn can report a different one. Without
  // this the bar clamps at 100% and screams "compact now" at a healthy conversation, which is the
  // failure it already had once with a hardcoded constant. The claim "this bar can never read over
  // 100%" is only true if something enforces it; this is that something.
  return seen > byModel ? Math.max(CTX_WINDOW_LARGE, seen) : byModel;
};

// WHEN A COMPACTION IS DUE — autobot's thresholds, same reason as the ruler. Amber is "soon", red is
// "now"; below that the conversation is simply healthy and the bar should say nothing at all.
export const CTX_WARN = 0.75;
export const CTX_DUE = 0.9;

// EVERY PATH THIS SESSION WROTE, newest last — what the diff surface subscribes to. Reads are
// excluded on purpose: looking at a file is not changing it, and lighting the diff for a read is
// the kind of lie that makes the whole surface untrustworthy.
export const pathsWritten = (events) => {
  const out = [];
  const push = (p) => {
    if (p && out[out.length - 1] !== p) out.push(p);
  };
  (events || []).forEach((ev) => {
    if (!ev) return;
    // THE WATCHER'S HALF. `file.changed` catches what no tool schema names — a shell `sed`, a git
    // checkout, an MCP tool writing files — which is the case the schema half structurally cannot
    // see. This is the answer to the question I asked autobot: it isn't paths on `tool.result`,
    // it's its own event, which is better.
    if (ev.kind === "file.changed") return push(ev.path);
    push(isWrite(ev) && pathTouchedBy(ev));
  });
  return out;
};
