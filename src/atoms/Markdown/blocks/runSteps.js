// THE RUN GRAMMAR, on its own — pure parsing, no React, no client — so the feed and the tests can
// read `:::run` steps without pulling the whole block (and the SystemLynx client behind it) in.
// See RunBlock.js for the grammar's documentation.
// A STEP'S LABEL — `{title="…"}` on the end of the step, the same `{…}` attribute shape every other
// block in this vocabulary uses (`::claim[…]{id=}`, `:::run{title=}`, `::test[…]{project=}`).
//
// WHY IT EXISTS. A saved spec's step carries a `title` and it is the label printed over the call, in
// the runner's output and in the window; an inline step had no way to say one, so `toStep` filled it
// with the call signature — `AutobotShell.Window.count({"selector":".md-claim"})`. Not blank, and
// blank to a reader, which is the same thing. (His, twice: *"the action is missing a description…
// it looks blank in places"*.)
//
// DISAMBIGUATED FROM THE OBJECT SHORTHAND, which also ends in braces. `- Math.add { "a": 1 }` is one
// argument; `- Math.add({ "a": 1 }){title="adds two"}` is an argument and a label. The test is the
// separator: attributes are `key=`, JSON is `"key":`. A trailing group that parses as JSON, or that
// does not open with a bare word and an `=`, is left alone as data.
const ATTR_TAIL = /\{\s*([A-Za-z_][\w-]*)\s*=\s*([\s\S]*?)\s*\}\s*$/;
export function splitStepAttrs(body) {
  const m = ATTR_TAIL.exec(String(body || ""));
  if (!m) return { body, attrs: {} };
  const value = m[2].replace(/^["']|["']$/g, "");
  return { body: String(body).slice(0, m.index).trim(), attrs: { [m[1]]: value } };
}

export function parseSteps(src) {
  const lines = String(src || "").split("\n");
  const steps = [];
  let cur = null;
  let stepIndent = 0;
  const flush = () => {
    if (cur) steps.push(cur);
    cur = null;
  };
  const addCheck = (text) => {
    const body = String(text).replace(/^(?:✓|✔|expect|assert)\s+/i, "").trim();
    if (cur && body) (cur.checks || (cur.checks = [])).push(body);
  };
  lines.forEach((raw) => {
    const bullet = raw.match(/^(\s*)[-*]\s+(.*)$/);
    if (bullet) {
      const indent = bullet[1].length;
      const body = bullet[2];
      // Indented DEEPER than the step it sits under ⇒ it's one of that step's assertions, not the
      // next step.
      if (cur && indent > stepIndent) {
        addCheck(body);
        return;
      }
      flush();
      stepIndent = indent;
      const useMatch = body.match(/^use:\s*(\S+)/i);
      if (useMatch) {
        steps.push({ use: useMatch[1] });
        return;
      }
      // Pull a trailing `{title="…"}` off the step before the call is parsed, so the arg parser
      // never sees it and a label can never be mistaken for an argument.
      const { body: callBody, attrs: stepAttrs } = splitStepAttrs(body);
      const m = callBody.match(/^([A-Za-z0-9_$.\-]+)\s*(.*)$/);
      if (!m) return;
      cur = { ns: m[1], rest: m[2] || "" };
      if (stepAttrs.title) cur.title = stepAttrs.title;
    } else if (cur && raw.trim()) {
      // A bare indented line: an assertion if it's marked as one, a RECORDED RESULT if it starts
      // with `=`, otherwise the continuation of a call that spans lines.
      //   - Math.add { "a": 2, "b": 3 }
      //     = { "sum": 5 }
      // The `=` line is what the call returned when it was run elsewhere (a probe in the feed, a
      // CLI run an agent pasted). A block whose every step carries one renders ALREADY RAN —
      // responses shown, verdicts computed, honestly badged — and play re-runs fresh.
      const check = raw.match(/^\s+(?:✓|✔|expect|assert)\s+(.+)$/i);
      const result = raw.match(/^\s+=\s*(.+)$/);
      if (check) addCheck(check[1]);
      else if (result) {
        try { cur.result = JSON.parse(result[1]); cur.hasResult = true; } catch { cur.rest += "\n" + raw; }
      }
      else cur.rest += "\n" + raw;
    }
  });
  flush();
  return steps;
}

