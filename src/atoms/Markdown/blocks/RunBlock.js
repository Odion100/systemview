import React, { useContext, useEffect, useMemo, useRef, useState } from "react";
import loadServiceWithHeaders from "../../../utils/loadService";
import ServiceContext from "../../../ServiceContext";
import { SavedTestItem } from "../../../organisms/SavedTests/SavedTests";
import { useMarkdownScope } from "../context";
import { resolveNamespace } from "../nsResolve";

// RFC-025 §4.2 — `::run`, in two forms, and the difference matters:
//
//   AD-HOC (the point):  steps written ON THE FLY in the document, for you to press Run on.
//     :::run{title="Seed and chain"}
//     - Math.add { "a": 2, "b": 3 }
//     - use: seedSum                                   ← pull a saved action in as a step
//     - Math.chainUse { "base": tv(test.main[0].results.sum) }
//     :::
//
//   SAVED (a reference):  ::run[seedSum] — replays a saved action by name, unchanged.
//
// Neither is a new engine. Both build the same step list a saved test carries and hand it to the
// SAME `SavedTestItem` the Test Panel and story panes run, so evaluations, `tv(…)` references and
// result rendering are identical wherever a run happens.

// STEP GRAMMAR — a method takes as many arguments as a real function does, so the call form is the
// primary one and the bare-object form is the shorthand:
//
//   - Math.combine(2, "two", [3], { "k": 1 })          ← FOUR arguments, positional
//   - Math.add { "a": 1, "b": 2 }                      ← shorthand: one object argument
//   - TestService.Math.add(1, 2)                       ← name the service
//   - systemview-test.TestService.Math.add(1, 2)       ← name the project too
//   - use: seedSum                                     ← a SHARED ACTION, kept as an action
//
// A namespace is 2–4 segments; whatever you leave off comes from the document's own scope, so a doc
// filed on a service can say `Math.add` and a doc that isn't can spell the whole path.
//
// ASSERTIONS hang under their step as a NESTED LIST — the ordinary markdown way to say "these things
// must be true about that call", and the form to reach for:
//
//   - Math.combine({ "a": 2 }, { "b": 3 })
//     - results.sum = 5                              ← plain nested bullet
//     - expect results.inputs.a.label = "first"       ← `expect` / `assert` read fine too
//     - ✓ results.ok = true                           ← ✓ is ACCEPTED, never required
//
// (`✓` was the original form. It reads well in a rendered document but nobody wants to type it, so
// the parser takes any of them and the docs lead with the plain bullet.)
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
      const m = body.match(/^([A-Za-z0-9_$.\-]+)\s*(.*)$/);
      if (!m) return;
      cur = { ns: m[1], rest: m[2] || "" };
    } else if (cur && raw.trim()) {
      // A bare indented line: an assertion if it's marked as one, otherwise the continuation of a
      // call that spans lines.
      const check = raw.match(/^\s+(?:✓|✔|expect|assert)\s+(.+)$/i);
      if (check) addCheck(check[1]);
      else cur.rest += "\n" + raw;
    }
  });
  flush();
  return steps;
}

// Split on TOP-LEVEL commas only: quotes, braces, brackets and nested parens (a `tv(…)` reference is
// full of them) must not be split through.
export function splitArgs(text) {
  const out = [];
  let depth = 0, quote = null, buf = "";
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quote) {
      buf += c;
      if (c === quote && text[i - 1] !== "\\") quote = null;
      continue;
    }
    if (c === '"' || c === "'") { quote = c; buf += c; continue; }
    if (c === "{" || c === "[" || c === "(") depth++;
    if (c === "}" || c === "]" || c === ")") depth--;
    if (c === "," && depth === 0) { out.push(buf.trim()); buf = ""; continue; }
    buf += c;
  }
  if (buf.trim()) out.push(buf.trim());
  return out.filter((a) => a !== "");
}

// A `tv(…)` reference is NOT just a string in the payload — the engine resolves it from an argument's
// `targetValues`, each entry pointing at where in the input the value belongs (`source_map`). So an
// authored reference has to be lifted out of the JSON exactly the way the Test Panel stores it:
//   whole value   → input holds the bare namespace, targetValues records it at that path
//   embedded      → the string stays, targetValues records `tv(…)` plus its offset in the string
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

// `tv(…)` is written bare, the way you'd say it — quote it before parsing so the payload stays JSON.
const quoteRefs = (text) => text.replace(/(^|[^"'\w])(tv\([^)]*\))/g, (m, pre, ref) => `${pre}"${ref}"`);

// The engine roots every reference at `test.` — a saved test IS the thing being run there, so
// `test.before[0]` reads fine. In a DOCUMENT that word is just noise ("why is everything scoped
// under test?"), so the `test.` is optional here: write `tv(steps[0].results.sum)` or
// `tv(seedSum[0].results.sum)` and it's normalised to what the engine wants. Both forms work.
export const normalizeRefs = (text) => String(text).replace(/tv\(\s*(?!test\.)(?=[A-Za-z_])/g, "tv(test.");

// One argument's literal → the shape the runner wants. Anything that isn't JSON stays a STRING, which
// is what makes `"user-random(6)@test.com"` work: the engine resolves those at run time.
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
  return {
    name: "argument:",
    input,
    input_type: type === "object" ? "object" : type,
    data_type: "",
    targetValues,
  };
}

// `project.Service.Module.method` → as much as was written; the rest comes from scope.
function toNamespace(ns, scope) {
  const segs = ns.split(".").filter(Boolean);
  if (segs.length >= 4)
    return { projectCode: segs[0], serviceId: segs[1], moduleName: segs[2], methodName: segs.slice(3).join(".") };
  if (segs.length === 3)
    return { projectCode: scope.projectCode, serviceId: segs[0], moduleName: segs[1], methodName: segs[2] };
  if (segs.length === 2)
    return { projectCode: scope.projectCode, serviceId: scope.serviceId, moduleName: segs[0], methodName: segs[1] };
  return null;
}

// `✓ results.total = 5` · `expect results.label = "first-second"` · `✓ results.ok = true`
// · `✓ results.name ~ ser_` (a regex-ish "is like"). Evaluations are what make a RUN legible: you see
// pass/fail per step instead of squinting at a response body.
export function toEvaluations(checks = []) {
  return checks
    .map((raw) => {
      const m = normalizeRefs(raw).match(/^(\S+)\s*(=|==|~)\s*(.+)$/);
      if (!m) return null;
      const [, ns, op, rhs] = m;
      let value = rhs.trim();
      let type = "string";
      let name = "strEquals";
      if (op === "~") {
        name = "isLike";
        value = value.replace(/^["']|["']$/g, "");
      } else {
        try {
          const parsed = JSON.parse(value);
          if (typeof parsed === "number") { type = "number"; name = "numEquals"; value = parsed; }
          else if (typeof parsed === "boolean") { type = "boolean"; name = "boolEquals"; value = parsed; }
          else { value = String(parsed); }
        } catch {
          // Not JSON — a bare string, or a tv() reference the engine resolves at run time.
          value = value.replace(/^["']|["']$/g, "");
          if (/^tv\(/.test(value)) { type = "number"; name = "numEquals"; }
        }
      }
      return { namespace: ns, expected_type: type, validations: [{ name, value }], save: true };
    })
    .filter(Boolean);
}

export function toStep(parsed, scope, services) {
  let namespace = toNamespace(parsed.ns, scope);
  if (!namespace || !namespace.methodName) return null;
  // A two-segment step in a document with no service in scope (a PROJECT doc, the hub, a help topic)
  // has to find its service the way an `:ns[…]` chip does — by asking the live connection tree which
  // service in the project actually has that Module.method. Without this the step ran with an empty
  // serviceId and failed silently with "connection data" in the console.
  if (!namespace.serviceId && services) {
    const found = resolveNamespace(namespace, services);
    if (!found) return null;
    namespace = { ...namespace, ...found };
  }
  const rest = (parsed.rest || "").trim();
  let args = [];
  if (rest.startsWith("(")) {
    // Call form: everything inside the outermost parens, split into positional arguments.
    const inner = rest.slice(1, rest.lastIndexOf(")") > 0 ? rest.lastIndexOf(")") : undefined);
    args = splitArgs(inner).map(toArg);
  } else if (rest) {
    args = [toArg(rest)];
  }
  const shown = args.length ? `(${args.map((a) => JSON.stringify(a.input)).join(", ").slice(0, 70)})` : "()";
  const savedEvaluations = toEvaluations(parsed.checks);
  // An assertion the parser couldn't read used to disappear, which reads as "it passed". Count them
  // so the block can say what it dropped.
  const dropped = (parsed.checks || []).length - savedEvaluations.length;
  return { title: `${parsed.ns}${shown}`, namespace, args, savedEvaluations, dropped };
}

const RunBlock = ({ kind, label, attrs = {}, src }) => {
  const scope = useMarkdownScope();
  const { connectedServices = [] } = useContext(ServiceContext);
  const firstProject = connectedServices.length ? connectedServices[0].projectCode : null;
  const projectCode = attrs.project || scope.projectCode || firstProject;
  const savedName = (label || attrs.use || attrs.action || "").trim();
  const inline = kind === "container";

  const [actions, setActions] = useState(null);
  // SavedTestItem shows pass/fail from a `status` prop its PARENT owns (the scratchpad keeps a results
  // map). Without it a run completes silently, so the block keeps its own one-test result.
  const [status, setStatus] = useState(null);
  const services = connectedServices.filter((s) => s.projectCode === projectCode);

  // Saved actions are needed for BOTH forms: the saved form replays one, the ad-hoc form can pull one
  // in as a step via `use:`.
  useEffect(() => {
    let dead = false;
    (async () => {
      if (!services.length) return;
      const all = [];
      for (const s of services) {
        try {
          const svc = loadServiceWithHeaders(s.system.connectionData, s.headers, s.credentials);
          const got = svc && svc.Plugin ? await svc.Plugin.getActions({}) : [];
          (got || []).forEach((a) => a && all.push(a));
        } catch {
          /* no plugin here — fine */
        }
      }
      if (!dead) setActions(all);
    })();
    return () => {
      dead = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectCode, services.map((s) => s.serviceId).join(",")]);

  // Build the SAME shape a saved test has: inline steps become Main, and every `use:` becomes a NAMED
  // SECTION holding a `{ use }` reference — so a shared action renders and behaves exactly as it does
  // in the Scratch Pad (its own titled section), instead of being flattened into anonymous steps.
  const { main, sections, order, problems, stepCount } = useMemo(() => {
    const mainSteps = [];
    const sectionMap = {};
    const pre = [];
    const post = [];
    const bad = [];
    if (inline) {
      parseSteps(src).forEach((p) => {
        if (p.use) {
          const key = sectionMap[p.use] ? `${p.use}_${Object.keys(sectionMap).length + 1}` : p.use;
          sectionMap[key] = { use: p.use };
          (mainSteps.length ? post : pre).push(key);
          if (actions && !actions.find((a) => a.name === p.use)) bad.push(`no saved action "${p.use}"`);
          return;
        }
        const st = toStep(p, scope, services);
        if (st) {
          if (st.dropped > 0)
            bad.push(`${st.dropped} assertion${st.dropped > 1 ? "s" : ""} under "${p.ns}" couldn't be read — write path = value or path ~ text`);
          mainSteps.push(st);
        }
        else if (toNamespace(p.ns, scope))
          bad.push(`no connected service in ${projectCode} has "${p.ns}" — name the service, e.g. Service.${p.ns}`);
        else bad.push(`can't read "${p.ns}" — write Module.method(args) or Service.Module.method(args)`);
      });
    } else if (savedName) {
      sectionMap[savedName] = { use: savedName };
      pre.push(savedName);
      if (actions && !actions.find((a) => a.name === savedName)) bad.push(`no saved action "${savedName}"`);
    } else {
      bad.push("name an action — ::run[seedSum] — or write steps inside a :::run block");
    }
    const ord = [...pre, ...(mainSteps.length ? ["main"] : []), ...post];
    const count =
      mainSteps.length +
      Object.values(sectionMap).reduce((n, v) => {
        const act = (actions || []).find((a) => a.name === v.use);
        return n + ((act && act.steps && act.steps.length) || 0);
      }, 0);
    return { main: mainSteps, sections: sectionMap, order: ord, problems: bad, stepCount: count };
    // `services` is in the deps by identity string — steps can't resolve until connections land, so a
    // block rendered before they do has to rebuild when they arrive.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inline, src, savedName, actions, scope, projectCode, services.map((s) => s.serviceId).join(",")]);

  // RFC-029 `act` — the agent can press THIS block's play by its title (`systemview act <pc> run
  // "<title>"`): same run, same visible stepping, pressed remotely.
  const actRef = useRef(null);
  useEffect(() => {
    const myTitle = attrs.title || (inline ? "steps" : savedName);
    const onAct = (e) => {
      const d = (e && e.detail) || {};
      if (d.kind !== "run" || !d.target) return;
      if (String(d.target).toLowerCase() !== String(myTitle || "").toLowerCase()) return;
      if (actRef.current) {
        if (actRef.current.expand) actRef.current.expand();
        if (actRef.current.run) actRef.current.run();
      }
    };
    window.addEventListener("sv:act", onAct);
    return () => window.removeEventListener("sv:act", onAct);
  }, [attrs.title, inline, savedName]);

  if (!projectCode) return <div className="md-embed md-embed--dead">::run — no project in scope</div>;

  const title = attrs.title || (inline ? "steps" : savedName);
  // Sections carry `{ use }` REFERENCES, so they resolve through the same path a saved test uses and
  // the shared action keeps its identity in the UI.
  const resolvedSections = {};
  Object.entries(sections).forEach(([key, val]) => {
    const act = (actions || []).find((a) => a.name === val.use);
    resolvedSections[key] = act ? act.steps || [] : [];
  });
  // An ad-hoc run is NOT a test: there is no Main, no Before/After, nothing being saved under a
  // namespace. It's a list of steps, the same thing a shared action is — so its steps go in a NAMED
  // section (`steps`) alongside any `use:` action, and nothing in the UI says "Main". The engine runs
  // named sections as peers of the built-ins (RFC-020), so this needs no special case.
  // The built-in SECTION of a run, exactly like `main` is the built-in section of a test — and like
  // any section, its name is the reference root: `tv(steps[0].results.sum)`, beside `tv(seedSum[0]…)`
  // for a shared action pulled in by name. Nothing about the engine's reference logic changed here.
  const ownKey = sections.steps ? "written-here" : "steps";
  if (inline && main.length) resolvedSections[ownKey] = main;
  const runOrder = inline ? order.map((n) => (n === "main" ? ownKey : n)) : order;
  const test = {
    title,
    namespace: (main[0] && main[0].namespace) || {},
    Main: inline ? [] : main,
    sections: resolvedSections,
    sectionRefs: Object.fromEntries(Object.entries(sections).map(([k, v]) => [k, v.use])),
    run: runOrder.length ? runOrder : [inline ? ownKey : "main"],
  };
  const ready = actions != null || (inline && !Object.keys(sections).length);

  return (
    <div className={`md-embed md-embed--run${inline ? " md-embed--run-adhoc" : ""}`}>
      <div className="md-embed__head">
        {/* OUTER = the block in the document: a RUN. The card inside it is badged ACTIONS — the two
            must never say the same word, which is what "test inside test" was doing. */}
        <span className="md-embed__kind">{inline ? "run" : "saved action"}</span>
        <span className="md-embed__title">{title}</span>
        <span className="md-embed__scope">
          {inline ? "written here" : "from specs/actions"} · {stepCount} step{stepCount === 1 ? "" : "s"}
          {Object.keys(sections).length ? ` · ${Object.keys(sections).length} shared action${Object.keys(sections).length === 1 ? "" : "s"}` : ""}
        </span>
      </div>
      {!ready ? (
        <div className="report-chart-empty">loading…</div>
      ) : stepCount || main.length ? (
        <SavedTestItem
          test={test}
          index={0}
          storyRef={(el) => (actRef.current = el)}
          // The card inside the block — the slot where a saved test says "test". It holds the
          // sections (`steps`, plus any shared action by name), so it's badged ACTIONS, in its own
          // colour, and carries NO namespace: a run is filed nowhere.
          kindLabel={inline ? "actions" : "action"}
          kindTone={inline ? "run" : "action"}
          nsLabel={inline ? null : savedName}
          showTitle={false}
          status={status}
          onResult={(_i, st) => setStatus(st === undefined ? _i : st)}
          connectedServices={connectedServices}
        />
      ) : (
        <div className="report-chart-empty">{problems[0] || "no steps"}</div>
      )}
      {problems.length && (stepCount || main.length) ? (
        <div className="md-embed__problems">{problems.join(" · ")}</div>
      ) : null}
    </div>
  );
};

export default RunBlock;
