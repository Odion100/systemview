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
  const segs = command.split(/&&|\|\||;|\|/);
  let idx = 0;
  while (idx < segs.length && /^\s*(?:export\s+\S+=\S*|\w+=(?:"[^"]*"|'[^']*'|\S*)|cd\s+\S+)\s*$/.test(segs[idx])) idx += 1;
  const head = segs[idx] || "";
  const benign = /^\s*(?:tail|head|grep|wc|jq|cat|sort|uniq|cut|tee \/tmp\/)\b/;
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

export { VERBS };
