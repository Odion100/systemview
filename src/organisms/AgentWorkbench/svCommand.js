// A SYSTEMVIEW COMMAND IS NOT "ANOTHER BASH LINE" — his question, and the right one to ask:
// *"run a systemview command like navigate, I want to see how that renders… or is it just going to
// look like another command?"*
//
// It was. An agent driving his window arrives as `Bash` with `node cli/index.js nav …` inside it,
// which the feed summarised as a shell command like any other — so the one class of action he can
// actually SEE happen on screen read like the one class he can't. This recognises them and hands
// the feed enough to draw them as what they are: something that moved his window.
//
// DETECTION IS DELIBERATELY NARROW. `systemview <verb>` or `node …/cli/index.js <verb>`, first
// command on the line, and only verbs the CLI actually has — anything looser starts dressing up
// ordinary shell lines as app actions, which is worse than not doing this at all.
const VERBS = {
  say: { icon: "✎", what: "said" },
  tell: { icon: "✎", what: "messaged" },
  "message-agent": { icon: "✎", what: "messaged" },
  leave: { icon: "◌", what: "left the room" },
  kick: { icon: "✕", what: "cleared from the room" },
  show: { icon: "📺", what: "put on the TV" },
  tv: { icon: "📺", what: "read the TV" },
  nav: { icon: "↦", what: "moved the window" },
  refresh: { icon: "⟳", what: "refreshed" },
  act: { icon: "▸", what: "acted" },
  highlight: { icon: "◈", what: "highlighted" },
  reply: { icon: "↳", what: "replied in a thread" },
  thread: { icon: "↳", what: "started a thread" },
  status: { icon: "◌", what: "set its status" },
  board: { icon: "📋", what: "the board" },
  test: { icon: "✓", what: "ran tests" },
  probe: { icon: "◎", what: "probed a method" },
  logs: { icon: "▤", what: "read logs" },
  log: { icon: "▤", what: "read logs" },
  open: { icon: "↗", what: "opened the UI" },
  comments: { icon: "💬", what: "comments" },
  stats: { icon: "▦", what: "stats" },
  join: { icon: "◍", what: "joined the room" },
  connect: { icon: "⇄", what: "connected a service" },
};

// Split a command line into words, keeping quoted runs whole — the label of a `show` is the very
// thing that lives inside quotes, so a naive split loses exactly what is worth showing.
const words = (line) => {
  const out = [];
  const re = /"([^"]*)"|'([^']*)'|(\S+)/g;
  let m;
  while ((m = re.exec(line))) out.push(m[1] !== undefined ? m[1] : m[2] !== undefined ? m[2] : m[3]);
  return out;
};

// SHELL SEPARATORS ONLY WHERE THE SHELL SEES THEM — outside quotes. A plain `.split(/;|\|\|…/)`
// cuts inside the message body too, and a `say` whose text merely CONTAINS a semicolon then looked
// like two commands: the second "command" was just prose, it failed the safety check below, and the
// whole line was demoted to a bash row. That is exactly what he caught — *"there is a trace, the
// trace is that they ran a bash command"* — on autobot's first message through the new model.
// One character of English punctuation must never change what a command IS.
const splitOutsideQuotes = (line) => {
  const out = [];
  let cur = "";
  let quote = null;
  for (let i = 0; i < line.length; i += 1) {
    const c = line[i];
    if (quote) {
      cur += c;
      if (c === quote && line[i - 1] !== "\\") quote = null;
      continue;
    }
    if (c === '"' || c === "'") {
      quote = c;
      cur += c;
      continue;
    }
    if (c === ";" || c === "|" || (c === "&" && line[i + 1] === "&")) {
      if (c === "&") i += 1;
      if (c === "|" && line[i + 1] === "|") i += 1;
      out.push(cur);
      cur = "";
      continue;
    }
    cur += c;
  }
  out.push(cur);
  return out;
};

export function parseSvCommand(command) {
  if (typeof command !== "string" || !command.trim()) return null;
  // THE REAL COMMAND, not the throat-clearing before it. Every agent shell here opens with
  // `export PATH=… &&` (the sandbox forgets the PATH between calls), and cutting at the first
  // `&&` meant every systemview command wearing that prefix rendered as a plain bash line — his
  // catch: *"now that you're using the right mechanism, I don't see a command when you actually
  // sent those messages."* Leading environment setup is skipped; the segment after it is the act.
  // SAFETY KEPT, and tightened: anything after the act must be a read-only output filter (tail,
  // grep, …) or the whole line renders plain — `systemview nav; rm -rf` must never hide behind a
  // friendly row.
  const segs = splitOutsideQuotes(command);
  let idx = 0;
  while (idx < segs.length && /^\s*(?:export\s+\S+=\S*|\w+=(?:"[^"]*"|'[^']*'|\S*)|cd\s+\S+)\s*$/.test(segs[idx])) idx += 1;
  const head = segs[idx] || "";
  // What may ride BEHIND the act without changing what it was: output filters and reporting.
  // `echo "exit: $?"` is the single most common thing an agent appends — it prints the exit code
  // and touches nothing — and leaving it out demoted autobot's whole message to a bash row on its
  // first live send. An allowlist that omits the most common harmless case is a broken allowlist.
  const benign = /^\s*(?:tail|head|grep|wc|jq|cat|sort|uniq|cut|echo|printf|true|date|tee \/tmp\/)\b/;
  if (segs.slice(idx + 1).some((s) => s.trim() && !benign.test(s))) return null;
  const w = words(head).filter((t) => !/^(?:PATH=|export|2>)/.test(t));
  let i = w.findIndex((t) => /(^|\/)systemview$/.test(t) || /cli\/index\.js$/.test(t));
  if (i === -1) return null;
  // `node cli/index.js` — the verb is after the script, not after `node`.
  const verb = w[i + 1];
  const spec = verb && Object.prototype.hasOwnProperty.call(VERBS, verb) ? VERBS[verb] : null;
  if (!spec) return null;

  const args = w.slice(i + 2).filter((a) => a !== "--json" && a !== "--once");
  const project = args[0] && !args[0].startsWith("-") ? args[0] : null;
  // What the line is ABOUT: the first real argument after the project, or the value of the flag
  // that carries the content. Flags themselves are never the subject.
  let target = null;
  for (let k = 1; k < args.length; k += 1) {
    const a = args[k];
    if (a === "--text" || a === "--file" || a === "--reply" || a === "--add") {
      target = args[k + 1] || null;
      break;
    }
    if (!a.startsWith("-")) {
      target = a;
      break;
    }
  }
  // WHO IT SPOKE AS — a say's signature, checked by the CLI at the front door; carrying it here is
  // what lets the feed draw the message properly attributed.
  const ai = args.indexOf("--as");
  const as = ai !== -1 ? args[ai + 1] || null : null;
  return { verb, icon: spec.icon, what: spec.what, project, target, as, raw: head.trim() };
}

// THE COOKING LINE IS A LABEL, NOT THE PAYLOAD. His catch: *"when you send a message, your whole
// message gets put into the cooking message. Cooking messages are really short, and usually the
// command lines you put are really short — how is it you're copying the entire message?"* Right, and
// the cause is that `target` means "what the line is ABOUT", which for a `say` is the entire body.
// That is the correct answer for the FEED ROW — the message he wants to read and follow after the
// fact — and the wrong one for a status, which has one short line and has to say what is happening
// rather than recite it.
//
// So a status names the DESTINATION for anything whose subject is prose, and clamps everything else.
// `show --text "Title"` keeps its title: a title is short and it IS the thing you want named.
const BODY_VERBS = new Set(["say", "tell", "message-agent", "reply", "thread"]);
// A ROOM VERB NAMES ITS ROOM — his spec, verbatim: "the join command log should point to a project
// code… shows join the room and then hashtag and project code, like a project code tag." A bare
// "joined the room" is a row about nothing; the room IS the information.
const ROOM_VERBS = new Set(["join", "leave", "kick"]);
const SHORT = 40;

// The one formatter for a room verb's line, shared by the status and the row so they can never
// disagree: `joined the room #buAPI`, `cleared intruder from the room #buAPI`.
export const svRoomLine = (sv) => {
  if (!sv || !ROOM_VERBS.has(sv.verb)) return null;
  const tag = sv.project ? ` #${sv.project}` : "";
  if (sv.verb === "kick" && sv.target) return `cleared ${sv.target} from the room${tag}`;
  return `${sv.what}${tag}`;
};

export const svStatus = (sv) => {
  if (!sv) return null;
  if (BODY_VERBS.has(sv.verb)) return `${sv.what}${sv.project ? ` → ${sv.project}` : ""}`;
  const room = svRoomLine(sv);
  if (room) return room;
  const t = String(sv.target || "").replace(/\s+/g, " ").trim();
  if (!t) return sv.what;
  return `${sv.what} ${t.length > SHORT ? `${t.slice(0, SHORT).trimEnd()}…` : t}`;
};

export { VERBS };
