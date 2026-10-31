// WHAT `::cue{call="…"}` MEANS — the drive commands, reachable from inside a sequence.
//
// THE REASON IT HAD TO BECOME REAL. Every other cue verb resolves a selector and draws, so a walk
// could only ever point at what was ALREADY on screen; getting the subject there happened out of
// band, by an agent calling the hub before it wrote the sequence. Which means replaying the walk
// tomorrow narrates whatever document happens to be open — the cue rows survive, the thing they
// were about does not. His ruling: navigation belongs IN the queue, as a beat, so a sequence
// replays from anywhere and does its own navigating.
//
// SO `call` IS ONE DOOR TO THE COMMANDS, not a second vocabulary. `nav`, `act`, `show` and
// `refresh` are the window's command surface and an agent already drives them through the hub;
// this is the same four reached from a cue, written the way a person would say them:
//
//   ::cue{call="nav report=meetings/2026-10-31-x.md"}
//   ::cue{call="nav file=api/index.js#L40-55"}
//   ::cue{call="nav namespace=TestService.Math.add"}
//   ::cue{call="nav stats=coverage range=24h"}
//   ::cue{call="act run=yarn test"}
//   ::cue{call="refresh scope=docs"}
//
// The namespace call the verb was originally sketched for is already `nav namespace=…`, so nothing
// is lost by giving the word to the commands — one door, four verbs, and no second thing to learn.
//
// IT REFUSES RATHER THAN GUESSES. An unknown verb, an unknown key, or a verb with nothing to act
// on answers `{ error }`, because a cue that silently performs nothing is the failure the whole
// walkthrough procedure is written against: the sequence keeps going and narrates thin air with
// full confidence. A refusal can be rendered on the row; a no-op cannot.

// Per verb, the keys it accepts — mirrored from api/drive.js, which is the half that validates
// against the live tree. This is the SHAPE check only: "is this a sentence the window can act on",
// never "does that namespace exist", which only the hub can answer.
export const CALL_KEYS = {
  nav: ["file", "report", "namespace", "stats", "range", "service", "tab", "topic", "agents", "lines"],
  act: ["test", "run"],
  show: ["report", "path", "text", "clear"],
  refresh: ["scope"],
};

// `#L40-55` and `#L40-L55` are the same address — the same split the hub does, because a cue that
// addressed lines differently from the command would be a second answer to one question.
const splitRange = (value) => {
  const m = String(value).match(/^(.*?)#L(\d+)(?:-L?(\d+))?$/i);
  if (!m) return { path: String(value) };
  return { path: m[1], lines: [Number(m[2]), Number(m[3] || m[2])] };
};

// `key=value`, with quotes respected, so a value may hold spaces (`act run="yarn test --watch"`).
const pairs = (rest) => {
  const out = [];
  const re = /([A-Za-z_][\w-]*)=("[^"]*"|'[^']*'|\S+)/g;
  let m;
  while ((m = re.exec(rest))) out.push([m[1], m[2].replace(/^["']|["']$/g, "")]);
  return out;
};

const TRUEISH = /^(true|yes|on|open|1)$/i;

/**
 * Parse a cue's `call=` into the command record the window's executor already takes.
 * `{ cmd, args, label }` on success, `{ error }` on anything it cannot act on.
 */
export function callCommand(raw) {
  const s = String(raw || "").trim();
  if (!s) return { error: "call needs a command" };
  const [verb, ...restParts] = s.split(/\s+/);
  const cmd = String(verb || "").toLowerCase();
  if (!CALL_KEYS[cmd])
    return { error: `call: "${verb}" is not a command — ${Object.keys(CALL_KEYS).join(", ")}` };
  const rest = restParts.join(" ");
  const args = {};
  for (const [k, v] of pairs(rest)) {
    if (!CALL_KEYS[cmd].includes(k)) return { error: `call ${cmd}: "${k}" is not one of ${CALL_KEYS[cmd].join(", ")}` };
    // A FILE OR REPORT CARRIES ITS RANGE IN A SEPARATE FIELD, which is what tells "point at the
    // file" apart from "point at these lines in it" everywhere downstream.
    if (k === "file" || k === "report") {
      const r = splitRange(v);
      args[k] = r.path;
      if (r.lines) args.lines = r.lines;
    } else if (k === "agents" || k === "clear") {
      args[k] = TRUEISH.test(v);
    } else {
      args[k] = v;
    }
  }
  // A BARE VERB IS ONLY MEANINGFUL FOR ONE OF THEM. `refresh` names a chore and defaults to
  // everything; the other three name a destination or a press, and with nothing named there is
  // nothing to do — which is a refusal, not a silent beat.
  if (cmd === "refresh" && !args.scope) args.scope = "all";
  if (!Object.keys(args).length) return { error: `call ${cmd}: nothing to act on — give it ${CALL_KEYS[cmd].slice(0, 3).join(", ")}…` };
  return { cmd, args, label: labelFor(cmd, args) };
}

// WHAT THE ROW SAYS AND THE VOICE READS when the cue carries no words of its own. The command's
// own sentence is the honest narration of a beat that moves the window — "pulled up api/index.js"
// — and it is what the hub's commands already say about themselves, so a cue and a command
// describe the same action the same way.
export function labelFor(cmd, args = {}) {
  const at = args.lines ? `#L${args.lines[0]}${args.lines[1] && args.lines[1] !== args.lines[0] ? `-${args.lines[1]}` : ""}` : "";
  if (cmd === "nav") {
    if (args.stats) return `opened stats${TRUEISH.test(String(args.stats)) ? "" : ` — ${args.stats}`}`;
    if (args.report) return `opened report ${String(args.report).split("/").pop()}${at}`;
    if (args.file) return `pulled up ${args.file}${at}`;
    if (args.agents) return "opened the agents page";
    if (args.tab) return `switched to the ${args.tab} tab`;
    if (args.topic) return `opened help: ${args.topic}`;
    if (args.namespace) return `navigated to ${args.namespace}`;
  }
  if (cmd === "act") return args.run ? `pressed play on "${args.run}"` : `ran ${args.test}`;
  if (cmd === "show") return args.clear ? "cleared the TV" : `put ${args.report || args.path || "it"} on the TV`;
  if (cmd === "refresh") return `refreshed ${args.scope === "all" ? "everything" : args.scope}`;
  return cmd;
}

export default callCommand;
