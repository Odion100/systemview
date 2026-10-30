// THE RUN GRAMMAR, HEADLESS — a `:::run` block turned into the saved-test shape the engine already
// runs, in plain CJS, with no React and no window.
//
// WHY IT EXISTS. Running a document's proofs was something only the window could do: the grammar
// lived inside `src/atoms/Markdown/blocks/RunBlock.js`, which is a React component, and the hub
// could not reach it. That made the agent who runs these most often the one party who could not —
// "just make sure that you're able to run the test outside of the visual window for yourself,
// because you will be the one who's really running these tests most of the time."
//
// Mirrors `src/atoms/Markdown/blocks/RunBlock.js` + `blocks/runSteps.js` + `atoms/Markdown/nsResolve.js`,
// the same way `transformTests.js` and `test-helpers.js` here mirror their `src/` halves: webpack's
// module scope forbids `src/` importing above itself, and `src/` is not in the package's `files`, so
// neither side can require the other. The agreement is held by a TEST rather than by care —
// `api/proofs.test.js` runs this builder over the same fixtures the window's own tests assert, so a
// drift between the two halves fails the suite instead of surfacing as a proof that runs differently
// headless than it does on screen.
//
// NOT A SECOND ENGINE. This only BUILDS; `initializeSavedTests` + `runFullTest` execute, exactly as
// they do for a saved test. A run block is a saved test nobody saved.

// ---- the step grammar -------------------------------------------------------------------------
// A step's label — `{title="…"}` on the end of the step, disambiguated from the object shorthand
// (`- Math.add { "a": 1 }`) by the separator: attributes are `key=`, JSON is `"key":`.
const ATTR_TAIL = /\{\s*([A-Za-z_][\w-]*)\s*=\s*([\s\S]*?)\s*\}\s*$/;

function splitStepAttrs(body) {
  const m = ATTR_TAIL.exec(String(body || ""));
  if (!m) return { body, attrs: {} };
  const value = m[2].replace(/^["']|["']$/g, "");
  return { body: String(body).slice(0, m.index).trim(), attrs: { [m[1]]: value } };
}

function parseSteps(src) {
  const lines = String(src || "").split("\n");
  const steps = [];
  let cur = null;
  let stepIndent = 0;
  const flush = () => {
    if (cur) steps.push(cur);
    cur = null;
  };
  const addCheck = (text) => {
    const body = String(text)
      .replace(/^(?:✓|✔|expect|assert)\s+/i, "")
      .trim();
    if (cur && body) (cur.checks || (cur.checks = [])).push(body);
  };
  lines.forEach((raw) => {
    const bullet = raw.match(/^(\s*)[-*]\s+(.*)$/);
    if (bullet) {
      const indent = bullet[1].length;
      const body = bullet[2];
      // Indented DEEPER than the step it sits under ⇒ one of that step's assertions, not the next step.
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
      const { body: callBody, attrs: stepAttrs } = splitStepAttrs(body);
      const m = callBody.match(/^([A-Za-z0-9_$.\-]+)\s*(.*)$/);
      if (!m) return;
      cur = { ns: m[1], rest: m[2] || "" };
      if (stepAttrs.title) cur.title = stepAttrs.title;
    } else if (cur && raw.trim()) {
      const check = raw.match(/^\s+(?:✓|✔|expect|assert)\s+(.+)$/i);
      const result = raw.match(/^\s+=\s*(.+)$/);
      if (check) addCheck(check[1]);
      else if (result) {
        try {
          cur.result = JSON.parse(result[1]);
          cur.hasResult = true;
        } catch {
          cur.rest += "\n" + raw;
        }
      } else cur.rest += "\n" + raw;
    }
  });
  flush();
  return steps;
}

// ---- arguments --------------------------------------------------------------------------------
// Split on TOP-LEVEL commas only: quotes, braces, brackets and nested parens (a `tv(…)` reference is
// full of them) must not be split through.
function splitArgs(text) {
  const out = [];
  let depth = 0;
  let quote = null;
  let buf = "";
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quote) {
      buf += c;
      if (c === quote && text[i - 1] !== "\\") quote = null;
      continue;
    }
    if (c === '"' || c === "'") {
      quote = c;
      buf += c;
      continue;
    }
    if (c === "{" || c === "[" || c === "(") depth++;
    if (c === "}" || c === "]" || c === ")") depth--;
    if (c === "," && depth === 0) {
      out.push(buf.trim());
      buf = "";
      continue;
    }
    buf += c;
  }
  if (buf.trim()) out.push(buf.trim());
  return out.filter((a) => a !== "");
}

// A `tv(…)` reference is not just a string in the payload — the engine resolves it from an argument's
// `targetValues`, each entry pointing at where in the input the value belongs (`source_map`).
function liftRefs(value, path, out) {
  if (typeof value === "string") {
    const whole = value.match(/^tv\((.+)\)$/);
    if (whole) {
      out.push({ target_namespace: whole[1], source_map: path, source_index: 0 });
      return whole[1];
    }
    const at = value.indexOf("tv(");
    if (at >= 0) {
      const inner = value.slice(at).match(/^tv\(([^)]*)\)/);
      if (inner) out.push({ target_namespace: `tv(${inner[1]})`, source_map: path, source_index: at });
    }
    return value;
  }
  if (Array.isArray(value)) return value.map((v, i) => liftRefs(v, [...path, String(i)], out));
  if (value && typeof value === "object") {
    const o = {};
    Object.entries(value).forEach(([k, v]) => {
      o[k] = liftRefs(v, [...path, k], out);
    });
    return o;
  }
  return value;
}

const quoteRefs = (text) => text.replace(/(^|[^"'\w])(tv\([^)]*\))/g, (m, pre, ref) => `${pre}"${ref}"`);

// The engine roots every reference at `test.`; in a document that word is noise, so both forms work.
const normalizeRefs = (text) => String(text).replace(/tv\(\s*(?!test\.)(?=[A-Za-z_])/g, "tv(test.");

// One argument's literal → the shape the runner wants. Anything that isn't JSON stays a STRING,
// which is what makes `"user-random(6)@test.com"` work: the engine resolves those at run time.
function toArg(raw) {
  const text = normalizeRefs(raw);
  let input = text;
  let type = "string";
  try {
    input = JSON.parse(quoteRefs(text));
    type = Array.isArray(input) ? "array" : input === null ? "string" : typeof input;
  } catch {
    input = text.replace(/^["']|["']$/g, "");
    type = "string";
  }
  const targetValues = [];
  input = liftRefs(input, ["input"], targetValues);
  return { name: "argument:", input, input_type: type === "object" ? "object" : type, data_type: "", targetValues };
}

// ---- namespaces -------------------------------------------------------------------------------
// `project.Service.Module.method` → as much as was written; the rest comes from scope.
function toNamespace(ns, scope = {}) {
  const segs = String(ns || "").split(".").filter(Boolean);
  if (segs.length >= 4)
    return { projectCode: segs[0], serviceId: segs[1], moduleName: segs[2], methodName: segs.slice(3).join(".") };
  if (segs.length === 3)
    return { projectCode: scope.projectCode, serviceId: segs[0], moduleName: segs[1], methodName: segs[2] };
  if (segs.length === 2)
    return { projectCode: scope.projectCode, serviceId: scope.serviceId, moduleName: segs[0], methodName: segs[1] };
  return null;
}

/**
 * Resolve against the LIVE connection tree — what lets a stale document say so instead of lying. A
 * reference with no service in scope searches every service in the project. Null when nothing answers.
 *
 * `services` are hub connection records, so the serviceId is read off `connectionData` the way
 * `api/runTests.js` reads it — not off a `serviceId` property the window happens to flatten on.
 */
const idOf = (s) =>
  (s && s.serviceId) || (s && s.system && s.system.connectionData && s.system.connectionData.serviceId) || "";

function resolveNamespace(target, services = []) {
  if (!target) return null;
  const candidates = services.filter(
    (s) =>
      (!target.projectCode || s.projectCode === target.projectCode) &&
      (!target.serviceId || idOf(s) === target.serviceId),
  );
  for (const s of candidates) {
    const modules = (s.system && s.system.connectionData && s.system.connectionData.modules) || [];
    const mod = modules.find((m) => m.name === target.moduleName);
    if (!mod) continue;
    if (!target.methodName) return { projectCode: s.projectCode, serviceId: idOf(s), moduleName: mod.name };
    const method = (mod.methods || []).find((m) => (m.fn || m.name) === target.methodName);
    if (method)
      return {
        projectCode: s.projectCode,
        serviceId: idOf(s),
        moduleName: mod.name,
        methodName: method.fn || method.name,
      };
  }
  return null;
}

// ---- assertions -------------------------------------------------------------------------------
// `✓ results.total = 5` · `expect results.label = "x"` · `✓ results.name ~ ser_` · `>=` / `<=` bounds.
const BOUNDS = { ">=": "min", "<=": "max" };

function toEvaluations(checks = []) {
  return checks
    .map((raw) => {
      const m = normalizeRefs(raw).match(/^(\S+)\s*(>=|<=|==|=|~)\s*(.+)$/);
      if (!m) return null;
      const [, ns, op, rhs] = m;
      let value = rhs.trim();
      let type = "string";
      let name = "strEquals";
      if (BOUNDS[op]) {
        const num = Number(value);
        if (!Number.isFinite(num)) return null;
        return { namespace: ns, expected_type: "number", validations: [{ name: BOUNDS[op], value: num }], save: true };
      }
      if (op === "~") {
        name = "isLike";
        value = value.replace(/^["']|["']$/g, "");
      } else {
        try {
          const parsed = JSON.parse(value);
          if (typeof parsed === "number") {
            type = "number";
            name = "numEquals";
            value = parsed;
          } else if (typeof parsed === "boolean") {
            type = "boolean";
            name = "boolEquals";
            value = parsed;
          } else value = String(parsed);
        } catch {
          value = value.replace(/^["']|["']$/g, "");
          if (/^tv\(/.test(value)) {
            type = "number";
            name = "numEquals";
          }
        }
      }
      return { namespace: ns, expected_type: type, validations: [{ name, value }], save: true };
    })
    .filter(Boolean);
}

// ---- one step ---------------------------------------------------------------------------------
function toStep(parsed, scope, services) {
  let namespace = toNamespace(parsed.ns, scope);
  if (!namespace || !namespace.methodName) return null;
  // A two-segment step in a document with no service in scope has to find its service the way an
  // `:ns[…]` chip does — by asking the connection tree which service actually has that Module.method.
  if (!namespace.serviceId && services) {
    const found = resolveNamespace(namespace, services);
    if (!found) return null;
    namespace = { ...namespace, ...found };
  }
  const rest = (parsed.rest || "").trim();
  let args = [];
  if (rest.startsWith("(")) {
    const inner = rest.slice(1, rest.lastIndexOf(")") > 0 ? rest.lastIndexOf(")") : undefined);
    args = splitArgs(inner).map(toArg);
  } else if (rest) {
    args = [toArg(rest)];
  }
  const shown = args.length
    ? `(${args
        .map((a) => JSON.stringify(a.input))
        .join(", ")
        .slice(0, 70)})`
    : "()";
  const savedEvaluations = toEvaluations(parsed.checks);
  // An assertion the parser couldn't read used to disappear, which reads as "it passed". Counted, so
  // the caller can say what it dropped rather than reporting a thinner run as a clean one.
  const dropped = (parsed.checks || []).length - savedEvaluations.length;
  return { title: parsed.title || `${parsed.ns}${shown}`, namespace, args, savedEvaluations, dropped };
}

/**
 * A `:::run` block → the saved-test shape `initializeSavedTests` takes.
 *
 *   specFromRun({ src, label, attrs, kind }, scope, services)
 *     → { title, namespace, Main, sections, run, problems, dropped }
 *
 * Inline steps become `Main`; every `use:` becomes its OWN named section holding a `{ use }`
 * reference, so a shared action runs as its own titled section rather than being flattened into
 * anonymous steps. `run` is the order: the `use:` sections written before the first call, then main,
 * then the ones written after.
 *
 * PROBLEMS ARE RETURNED, NEVER SWALLOWED. A step whose namespace no connected service answers, and
 * an assertion that could not be read, are both reasons a run is thinner than the document looks —
 * reporting an incomplete run as a pass is the one outcome worth more than a failure.
 */
function specFromRun({ src, label, attrs = {}, kind = "container" } = {}, scope = {}, services = []) {
  const mainSteps = [];
  const sections = {};
  const pre = [];
  const post = [];
  const problems = [];
  const savedName = String(label || attrs.use || attrs.action || "").trim();
  const inline = kind === "container";

  if (inline) {
    parseSteps(src).forEach((p) => {
      if (p.use) {
        const key = sections[p.use] ? `${p.use}_${Object.keys(sections).length + 1}` : p.use;
        sections[key] = { use: p.use };
        (mainSteps.length ? post : pre).push(key);
        return;
      }
      const st = toStep(p, scope, services);
      if (st) {
        if (st.dropped > 0)
          problems.push(
            `${st.dropped} assertion${st.dropped > 1 ? "s" : ""} under "${p.ns}" couldn't be read — write path = value or path ~ text`,
          );
        mainSteps.push(st);
      } else if (toNamespace(p.ns, scope))
        problems.push(`no connected service in ${scope.projectCode} has "${p.ns}" — name the service, e.g. Service.${p.ns}`);
      else problems.push(`can't read "${p.ns}" — write Module.method(args) or Service.Module.method(args)`);
    });
  } else if (savedName) {
    sections[savedName] = { use: savedName };
    pre.push(savedName);
  } else {
    problems.push("name an action — ::run[seedSum] — or write steps inside a :::run block");
  }

  const run = [...pre, ...(mainSteps.length ? ["main"] : []), ...post];
  return {
    title: String(attrs.title || "").trim() || savedName || "steps",
    // The namespace a ROW is reported under. A run block calls many methods and belongs to none, so
    // the first step's is used as its address and `null` when there are no steps — rather than the
    // "undefined.undefined.undefined" a missing namespace printed on every row before.
    namespace: mainSteps.length ? mainSteps[0].namespace : null,
    Main: mainSteps,
    sections,
    run,
    problems,
  };
}

module.exports = {
  splitStepAttrs,
  parseSteps,
  splitArgs,
  liftRefs,
  normalizeRefs,
  toArg,
  toNamespace,
  resolveNamespace,
  toEvaluations,
  toStep,
  specFromRun,
};
