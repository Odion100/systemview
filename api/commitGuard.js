// NO AGENT SIGNS HIS COMMITS, AND THIS IS THE PART THAT ENFORCES IT.
//
// His rule: *"never in your life put your name on my commits."* It was already written into the
// system context every agent loads — and it had already been written into the harness's own
// instructions the other way, which is exactly the problem. The `claude_code` preset tells every
// agent to end a commit message with a `Co-Authored-By: Claude` trailer; two subagents added one
// tonight without being asked, from that instruction alone, in a session where nobody had
// mentioned authorship. Ten commits on main carried it before anyone looked.
//
// SO THE RULE CANNOT LIVE ONLY IN A DOCUMENT. A sentence in a loaded layer competes with a
// sentence in the preset, and the preset is closer to the model's hands. A refusal at the door
// does not compete with anything: the commit simply does not happen, and the agent is told why in
// words it can act on. This is the same principle as everywhere else here — a surface that
// enforces beats a surface that asks.
//
// IT REFUSES, IT NEVER STRIPS. Silently removing the line would let an agent keep adding it
// forever while the tree looked clean, and the next person to read this file would not know the
// pressure was still there. A refusal is visible, countable, and tells you the instruction
// upstream is still wrong.

// WHAT COUNTS AS SIGNING. Three shapes, and they are separate patterns rather than one clever one
// because each has its own false-positive risk:
//
//   1. a co-author trailer naming the model or its address — the preset's exact output
//   2. the "Generated with Claude Code" advertisement, with or without the robot and the link
//   3. a bare `Co-Authored-By:` naming anything that is not a person's email at a real domain is
//      NOT matched — a human pair-programming trailer is legitimate and must not be refused
const SIGNATURES = [
  {
    // `Co-Authored-By: Claude <noreply@anthropic.com>` and every spelling of it. Anchored to the
    // start of a line, because the words can legitimately appear INSIDE a message — a commit that
    // fixes this very guard has to be able to say "co-authored-by" in its own prose.
    re: /^[ \t]*co[-_ ]?authored[-_ ]?by:.*(claude|anthropic|noreply@anthropic\.com)/im,
    says: "a Co-Authored-By trailer naming the model",
  },
  {
    re: /generated with \[?claude code\]?/i,
    says: 'the "Generated with Claude Code" advertisement',
  },
  {
    // The robot emoji the same template ships with, when it leads a line — on its own it is just
    // an emoji and a message about subagents may well use it mid-sentence.
    re: /^[ \t]*🤖[ \t]*generated/im,
    says: "the generated-with stamp",
  },
];

/**
 * What in this message is an agent signing the user's work.
 *
 * Returns `[]` for a clean message, or one entry per signature found:
 * `{ says, line }` — `line` being the offending text, so the refusal can quote it rather than
 * making the author hunt for what tripped it.
 */
function authorshipIn(message) {
  const text = String(message || "");
  const found = [];
  // ONE ENTRY PER OFFENDING LINE, NOT PER PATTERN. `🤖 Generated with [Claude Code](…)` trips both
  // the advertisement rule and the robot rule — it is one thing wrong, and naming it twice makes
  // the refusal read as two separate problems to fix.
  const seen = new Set();
  for (const sig of SIGNATURES) {
    const m = sig.re.exec(text);
    if (!m) continue;
    // THE WHOLE LINE, not the match — "claude" on its own is not the useful thing to print back.
    const at = text.lastIndexOf("\n", m.index) + 1;
    const end = text.indexOf("\n", m.index);
    const line = text.slice(at, end === -1 ? undefined : end).trim();
    if (seen.has(line)) continue;
    seen.add(line);
    found.push({ says: sig.says, line });
  }
  return found;
}

/**
 * The refusal, as the message a caller shows. `null` when the commit may proceed.
 *
 * It names the upstream instruction on purpose. An agent that reads "not allowed" will try a
 * variant; an agent that reads "your harness told you to do this and it is wrong here" stops.
 */
function refuseAuthorship(message) {
  const found = authorshipIn(message);
  if (!found.length) return null;
  return (
    `this commit message signs the work and will not be made — ${found.map((f) => f.says).join(", and ")}:\n` +
    found.map((f) => `    ${f.line}`).join("\n") +
    `\nRemove those lines and commit again. He is the author of every commit in this tree. ` +
    `If you added this because your harness told you to: that instruction is the claude_code ` +
    `preset's, it is void in these repos, and it is countermanded in ~/.autobot/system-context.md.`
  );
}

module.exports = { authorshipIn, refuseAuthorship, SIGNATURES };
