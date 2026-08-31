import React, { useEffect, useState } from "react";
import ReactJson from "react-json-view";
import { useAppDark, jsonTheme } from "../../atoms/appTheme";
import { initializeSavedTests } from "../SavedTests/transformTests";
import FullTestController from "../TestPanel/components/FullTestController";
import { resolveTargetValue } from "../TestPanel/components/test-helpers";
import "./test-story.scss";

// Objects can be arbitrarily large, so args/responses render through react-json-view (expandable) —
// the same way the existing test panel + logs do. Theme follows the APP theme (dark = readable tree).
const Json = ({ src }) => {
  const [appDark] = useAppDark();
  return (
  <ReactJson
    src={src}
    name={false}
    theme={jsonTheme(appDark)}
    displayObjectSize={false}
    displayDataTypes={false}
    collapsed={1}
    collapseStringsAfterLength={80}
    style={{
      fontSize: "11.5px",
      fontFamily: "monospace",
      background: "transparent",
      maxWidth: "100%",
    }}
    enableClipboard={(copy) => {
      try {
        navigator.clipboard.writeText(
          typeof copy.src === "string" ? copy.src : JSON.stringify(copy.src, null, 2),
        );
      } catch {
        /* ignore */
      }
    }}
  />
  );
};
const isObj = (v) => v !== null && typeof v === "object";
// An Error instance has non-enumerable message/stack, so ReactJson would show it empty — normalize to
// a plain object so a thrown error's fields actually render.
const errToObj = (e) => {
  if (e instanceof Error) {
    const o = { message: e.message };
    Object.keys(e).forEach((k) => {
      o[k] = e[k];
    });
    if (e.status) o.status = e.status;
    return o;
  }
  return e;
};

// Evaluations read as natural sentences (mirrors testing-utilities/validtionMessages.js) so a saved
// assertion says "expecting results.cookie to be a string, to equal X" — not a raw `strEquals` token.
const vowels = ["a", "e", "i", "o", "u"];
const an = (w) =>
  w == null || w === "undefined"
    ? ""
    : vowels.includes(String(w)[0].toLowerCase())
      ? "an"
      : "a";
const show = (v) => (typeof v === "object" ? JSON.stringify(v) : String(v));
// Each rule → connective words (`lead`) + the expected value (rendered in its own color), and an
// optional `tail` for units. Equality drops "to equal" entirely — just "to be «value»".
const RULE = {
  strEquals: (v) => ({ lead: "to be", value: v }),
  numEquals: (v) => ({ lead: "to be", value: v }),
  boolEquals: (v) => ({ lead: "to be", value: v }),
  dateEquals: (v) => ({ lead: "to be", value: v }),
  lengthEquals: (v) => ({ lead: "to have a length of", value: v }),
  maxLength: (v) => ({ lead: "to have at most", value: v, tail: "characters" }),
  minLength: (v) => ({ lead: "to have at least", value: v, tail: "characters" }),
  includes: (v) => ({ lead: "to include", value: v }),
  isLike: (v) => ({ lead: "to match", value: v }),
  isOneOf: (v) => ({ lead: "to be one of", value: v }),
  max: (v) => ({ lead: "to be less than", value: v }),
  min: (v) => ({ lead: "to be greater than", value: v }),
  minDate: (v) => ({ lead: "to be after", value: v }),
  maxDate: (v) => ({ lead: "to be before", value: v }),
};
// One saved evaluation → SEPARATE clauses (they ARE separate assertions): the type check first, then
// each validation. `ruleName` maps back to the error name so each clause shows its own pass/fail.
const evalClauses = (e) => {
  const out = [];
  if (e.expected_type)
    out.push({
      lead: `to be ${an(e.expected_type)}`,
      value: e.expected_type,
      ruleName: "typeError",
      kind: "type",
    });
  (e.validations || []).forEach((v) => {
    // Value stays RAW here — the renderer needs the real type so a string gets wrapped in visible
    // quotes ("" for an empty string) while numbers/booleans render bare.
    const built = RULE[v.name] ? RULE[v.name](v.value) : { lead: v.name, value: v.value };
    out.push({ ...built, ruleName: v.name, kind: "value" });
  });
  return out;
};

// A clause value: an evaluation that asserts against a REFERENCE — value is `tv(<path>)` — renders as a
// reference chip (the path, its own color, no quotes) so you can SEE it's a live reference, not a literal
// string. A plain string wears QUOTES (empty string shows visibly as «""»); everything else renders bare.
const TV_RE = /^tv\((.+)\)$/;
const ValText = ({ v }) => {
  const ref = typeof v === "string" && v.match(TV_RE);
  if (ref) return <span className="test-clause__ref">{ref[1]}</span>;
  return typeof v === "string" ? (
    <>
      <span className="test-clause__quote">"</span>
      {v}
      <span className="test-clause__quote">"</span>
    </>
  ) : (
    <>{show(v)}</>
  );
};

// RFC-018 — a saved test rendered as a compact, readable STORY for the AI Window (not the full
// SavedTests scratchpad UI, which is built for editing and sprawls here). Setup → call → args →
// response → the assertions that pin it, with a Run that shows inline pass/fail. Reuses the proven
// runner (initializeSavedTests + FullTestController); the presentation is purpose-built for this spot.

const argVals = (action, ran) => {
  try {
    return (action.args || []).map((a) => {
      // After a run: the resolved values — what the call actually received.
      if (ran && typeof a.value === "function") return a.value();
      // BEFORE a run: overlay each target-value REFERENCE at its spot in the input, so you can see what
      // feeds the arg (test.seedSum[0].results.sum) instead of the raw placeholder (0) or a null.
      if (a && a.targetValues && a.targetValues.length && a.input !== undefined) {
        try {
          const clone = JSON.parse(JSON.stringify({ input: a.input }));
          a.targetValues.forEach(({ source_map, target_namespace }) => {
            let ptr = clone;
            for (let i = 0; i < source_map.length - 1; i++) ptr = ptr[source_map[i]];
            const key = source_map[source_map.length - 1];
            const cur = ptr[key];
            // A string arg embeds its tv(...) token in the text already — leave it visible as-is.
            if (!(typeof cur === "string" && cur.indexOf(target_namespace) !== -1))
              ptr[key] = target_namespace;
          });
          return clone.input;
        } catch {
          return a.input;
        }
      }
      return a && a.input !== undefined ? a.input : a;
    });
  } catch {
    return [];
  }
};
const errsOf = (action) => {
  try {
    return typeof action.getErrors === "function" ? action.getErrors() : [];
  } catch {
    return [];
  }
};

const evalsOf = (action) => {
  try {
    return (action.savedEvaluations || []).filter((e) => e.save);
  } catch {
    return [];
  }
};

// Exported — the per-step card (title, call, args, returns, evaluations) is shared presentation: TestStory
// phases use it, and the ActionsPanel's ActionCard renders an action's steps with it (RFC-020).
export function TestAction({ action, ran, phaseSig, phaseCollapsed, autoExpand }) {
  const ns = action.namespace || {};
  const errs = ran ? errsOf(action) : [];
  const passed = ran && !errs.length;
  const args = argVals(action, ran);
  const evals = evalsOf(action);
  const [openAction, setOpenAction] = useState(false);
  const [showEvals, setShowEvals] = useState(evals.length <= 4);
  // Per (namespace, rule) failure lookup so each clause — type check or a specific validation — shows
  // its OWN pass/fail, not a whole-evaluation verdict. Map (not Set): a failed clause reads out what it
  // actually RECEIVED — "…to be a string, but received undefined" — like validtionMessages always did.
  const errMap = new Map(errs.map((e) => [`${e.namespace}::${e.name}`, e]));

  // Collapsed to a one-line preview by default. On run: a FAILED action always auto-expands (you need to
  // see what broke); a PASSED action stays collapsed unless the caller opts in (autoExpand). Not run ⇒
  // collapsed. Keeps passing runs calm (and not fighting the auto-scroll) while never hiding a failure.
  React.useEffect(() => {
    if (!ran) {
      setOpenAction(false);
      return;
    }
    const failedThis = errs.length > 0;
    setOpenAction(failedThis || !!autoExpand);
    // If it FAILED, open the evaluations too — the failing assertion is the whole point of expanding.
    if (failedThis) setShowEvals(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ran, autoExpand]);
  // Folding a PHASE cascades to its actions: collapse → all actions drop to previews (still visible,
  // just title + call); expand → all open. Only fires on a real toggle (phaseSig starts at 0).
  React.useEffect(() => {
    if (phaseSig) setOpenAction(!phaseCollapsed); // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phaseSig]);

  return (
    <div
      className={`test-action ${ran ? (passed ? "test-action--pass" : "test-action--fail") : ""} ${openAction ? "" : "test-action--collapsed"}`}
    >
      {/* The action itself folds — collapsed shows just its title + the method call; expand for the
          args, what it returned, and the assertions that pin it. */}
      <button
        type="button"
        className="test-action__head"
        onClick={() => setOpenAction((o) => !o)}
      >
        <span className="test-action__caret">{openAction ? "▾" : "▸"}</span>
        {ran && (
          <span className={`test-action__badge ${passed ? "is-pass" : "is-fail"}`}>
            {passed ? "✓" : "✗"}
          </span>
        )}
        {action.title && <span className="test-action__title">{action.title}</span>}
        {/* Collapsed only: title + the call sit together on one line as a compact preview. */}
        {!openAction && (
          <code className="test-action__call">
            {ns.serviceId ? `${ns.serviceId}.` : ""}
            {ns.moduleName}.<b>{ns.methodName}</b>({args.length ? "…)" : ")"}
          </code>
        )}
      </button>
      {openAction && (
        <>
          {/* Expanded: the call drops to its OWN line (below the title), then the args beneath it. */}
          <div className="test-action__row">
            <code className="test-action__call">
              {ns.serviceId ? `${ns.serviceId}.` : ""}
              {ns.moduleName}.<b>{ns.methodName}</b>({args.length === 0 ? ")" : ""}
            </code>
          </div>
          {/* Args ARE the method's arguments — each object an expandable JSON, each on its own indented
          line, the closing paren dropped to its own line so it reads like a real call (not floating
          off at the end of a stretched row). */}
          {args.length > 0 && (
            <>
              <div className="test-action__args-list">
                {args.map((a, i) => (
                  <div key={i} className="test-action__arg">
                    {isObj(a) ? (
                      <Json src={a} />
                    ) : (
                      <code className="test-action__lit">{JSON.stringify(a)}</code>
                    )}
                    {/* A multi-line object's separator drops to its own line under the closing brace;
                        a literal keeps it inline, where it reads as `2, 3`. */}
                    {i < args.length - 1 && (
                      <code className={`test-action__comma${isObj(a) ? " test-action__comma--own" : ""}`}>,</code>
                    )}
                  </div>
                ))}
              </div>
              <code className="test-action__paren test-action__paren--close">)</code>
            </>
          )}
          {ran && action.results !== undefined && action.results !== null && (
            <div
              className={`test-action__returns ${action.response_type === "error" ? "is-error" : ""}`}
            >
              {/* Distinguish a THROW from a normal return — a divide-by-zero shows as an error, not a value
              (a test can still PASS by asserting the error; this just shows what actually happened). */}
              {/* Labelled with the KEY you reference it by (results / error) — e.g. tv(test.main[0].results). */}
              <span className="test-action__arrow">
                {action.response_type === "error" ? "error" : "results"}
              </span>
              {isObj(action.results) ? (
                <Json src={errToObj(action.results)} />
              ) : (
                <code className="test-action__lit">{String(action.results)}</code>
              )}
            </div>
          )}
          {/* Evaluations = clauses, and EXPANDABLE — they can get long. */}
          {evals.length > 0 && (
            <div className="test-action__evals">
              <button
                type="button"
                className="test-action__evals-toggle"
                onClick={() => setShowEvals((s) => !s)}
              >
                <span className="test-action__caret">{showEvals ? "▾" : "▸"}</span>
                evaluations
                <span className="test-action__evals-count">{evals.length}</span>
              </button>
              {showEvals &&
                evals.flatMap((e, i) =>
                  evalClauses(e).map((c, j) => {
                    const err = ran
                      ? errMap.get(`${e.namespace}::${c.ruleName}`)
                      : undefined;
                    const failed = !!err;
                    const state = !ran ? "" : failed ? "is-fail" : "is-pass";
                    return (
                      <div key={`${i}-${j}`} className={`test-clause ${state}`}>
                        <span className="test-clause__box">
                          {ran ? (failed ? "✗" : "✓") : "▢"}
                        </span>
                        <span className="test-clause__sentence">
                          expecting <span className="test-clause__ns">{e.namespace}</span>{" "}
                          {c.lead}{" "}
                          <span
                            className={`test-clause__val test-clause__val--${c.kind}`}
                          >
                            {/* A type name renders bare; a concrete string value gets visible quotes. */}
                            {c.kind === "value" ? <ValText v={c.value} /> : c.value}
                          </span>
                          {/* After a run, a REFERENCE value shows what it RESOLVED to — a bare `tv(path)`
                              is opaque; "= 2" is what actually makes the assertion readable. */}
                          {ran &&
                            (() => {
                              const m = typeof c.value === "string" && c.value.match(TV_RE);
                              if (!m || !action.FullTest) return null;
                              let r;
                              try { r = resolveTargetValue(m[1], action.FullTest); } catch { return null; }
                              return <span className="test-clause__resolved">: {show(r)}</span>;
                            })()}
                          {c.tail ? ` ${c.tail}` : ""}
                          {/* A failed clause reads out what it actually got — the whole point of the sentence. */}
                          {failed && (
                            <>
                              , but received{" "}
                              <span className="test-clause__received">
                                {c.ruleName === "typeError" ? (
                                  `${an(err.received)} ${show(err.received)}`.trim()
                                ) : (
                                  <ValText v={err.received} />
                                )}
                              </span>
                            </>
                          )}
                        </span>
                      </div>
                    );
                  }),
                )}
            </div>
          )}
        </>
      )}
    </div>
  );
}

const freshTest = (test, connectedServices) => {
  try {
    return initializeSavedTests([test], connectedServices)[0];
  } catch {
    return null;
  }
};

const TestStory = React.forwardRef(
  ({ test, connectedServices, index, onResult, autoExpand, chromeless, recorded }, ref) => {
    const [ft, setFt] = useState(() => freshTest(test, connectedServices));
    const [running, setRunning] = useState(false);
    const [ran, setRan] = useState(false);

    // RFC-029 — ALREADY-RAN. `recorded` carries a completed run's per-step results (from a run
    // file an agent wrote): the instances hydrate with those responses and re-validate against
    // them, so the test displays exactly as if it had just run in this window — statuses,
    // responses, verdicts — without executing anything. Play still re-runs fresh (run() always
    // rebuilds from the saved definition). Hydration happens ONCE per mount — otherwise Clear
    // can never clear (un-run state would just re-hydrate on the next render, his catch).
    const hydratedRef = React.useRef(false);
    useEffect(() => {
      if (!recorded || ran || hydratedRef.current) return;
      const fresh = freshTest(test, connectedServices);
      if (!fresh) return; // services not landed yet — keep the flag clean so a later render can hydrate
      const recSections = {
        before: recorded.Before,
        main: recorded.Main,
        events: recorded.Events,
        after: recorded.After,
      };
      // NAMED sections ride the record as their own keys (`seedSum: [...]` — the CLI reports each
      // section under its own label), so any array-valued key that isn't meta is a section.
      const META = new Set(["title", "serviceId", "moduleName", "methodName", "status", "Before", "Main", "Events", "After", "ranAt", "by"]);
      Object.entries(recorded).forEach(([k, v]) => {
        if (!META.has(k) && Array.isArray(v)) recSections[k] = v;
      });
      // Hydrate ONLY when the record covers every step — a half-hydrated test would re-validate
      // steps whose references point at un-hydrated ones and show false failures. No record for
      // some section (e.g. a run file that didn't capture named sections) → stay un-run, honest.
      const covered = (fresh.order || []).every(
        (name) => (fresh.sections[name] || []).length === (recSections[name] || []).length,
      );
      if (!covered) return;
      try {
        (fresh.order || []).forEach((name) => {
          const insts = fresh.sections[name] || [];
          const recs = recSections[name] || [];
          insts.forEach((inst, i) => {
            const rec = recs[i];
            if (!rec || !("response" in rec)) return;
            inst.results = rec.response;
            inst.response_type = "results";
            inst.test_start = recorded.ranAt || null;
            inst.test_end = recorded.ranAt || null;
            if (inst.shouldValidate) {
              try { inst.validate(); } catch {}
            }
          });
        });
        setFt({ ...fresh });
        setRan(true);
        hydratedRef.current = true; // flag ONLY on real hydration — Clear stays cleared, but a
        // not-ready block (no services / uncovered record) may still hydrate on a later render
        const all = (fresh.order || []).reduce((a, n) => a.concat(fresh.sections[n] || []), []);
        if (onResult) onResult(all.some((a) => errsOf(a).length) ? "fail" : "pass");
      } catch {}
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [recorded, test, connectedServices]);
    const [collapsed, setCollapsed] = useState({});
    const [phaseSig, setPhaseSig] = useState({});
    // Chromeless (scratchpad) tests start COLLAPSED — just the header. Story panes keep their open
    // default — and so does anything that ASKED to be open (autoExpand: a one-step run, a run that
    // arrived already ran). His catch: the recorded run block showed "passed" and hid the step and
    // its response under this fold.
    const [open, setOpen] = useState(!chromeless || !!autoExpand);
    // Toggling a phase flips its collapsed flag AND bumps a per-phase signal so its actions cascade
    // (collapse to previews / expand) — the actions stay VISIBLE either way, never hidden.
    const toggle = (phase) => {
      setCollapsed((c) => ({ ...c, [phase]: !c[phase] }));
      setPhaseSig((s) => ({ ...s, [phase]: (s[phase] || 0) + 1 }));
    };

    const run = React.useCallback(async () => {
      setRunning(true);
      if (onResult) onResult("running");
      // Rebuild the test from its saved definition every run so "run again" always starts clean — no
      // pass/fail or response state carried over from the previous run.
      const fresh = freshTest(test, connectedServices);
      if (!fresh) {
        setRunning(false);
        if (onResult) onResult("error");
        return;
      }
      try {
        const { runFullTest } = new FullTestController({
          FullTest: fresh,
          connectedServices,
        });
        const ran = await runFullTest();
        const all = (ran.order || []).reduce(
          (a, n) => a.concat(ran.sections[n] || []),
          [],
        );
        const didFail = all.some((a) => errsOf(a).length);
        setFt({ ...fresh, sections: ran.sections, order: ran.order });
        setRan(true);
        if (onResult) onResult(didFail ? "fail" : "pass");
      } catch {
        if (onResult) onResult("error");
      }
      setRunning(false);
    }, [test, connectedServices, onResult]);

    // Reset back to un-run (clears pass/fail + responses) so the whole set can be run fresh again.
    const clear = React.useCallback(() => {
      setRan(false);
      setFt(freshTest(test, connectedServices));
      if (onResult) onResult("pending");
    }, [test, connectedServices, onResult]);

    // Run-all / Clear-all: the parent calls these via ref, in SEQUENCE (never concurrently) — the exact
    // same discipline as the scratchpad's runAllTests. `run` is awaitable so the parent runs one test at
    // a time, so there's no session/cookie drift between running here and running in the scratchpad.
    React.useImperativeHandle(
      ref,
      () => ({ run, clear, expand: () => setOpen(true), collapse: () => setOpen(false) }),
      [run, clear],
    );

    if (!ft)
      return <div className="test-story test-story--error">Couldn’t load this test.</div>;

    const allActions = (ft.order || []).reduce(
      (a, n) => a.concat((ft.sections || {})[n] || []),
      [],
    );
    const failed = ran && allActions.some((a) => errsOf(a).length);

    return (
      <div
        className={`test-story ${running ? "test-story--running" : ran ? (failed ? "test-story--fail" : "test-story--pass") : ""}`}
      >
        {/* Chromeless (scratchpad): the surrounding card provides the header + Run/Edit/×, so we skip our
          own head entirely and render just the phases. */}
        {!chromeless && (
          <div className="test-story__head">
            {/* The whole test folds — click the title. */}
            <button
              type="button"
              className="test-story__fold"
              onClick={() => setOpen((o) => !o)}
            >
              <span className="test-story__caret">{open ? "▾" : "▸"}</span>
              <span className="test-story__title">
                {ft.title ||
                  `${(ft.namespace || {}).moduleName}.${(ft.namespace || {}).methodName}`}
                {typeof index === "number" && (
                  <span className="test-story__idx"> #{index}</span>
                )}
              </span>
            </button>
            {running ? (
              <span className="test-story__status test-story__status--running">
                <span className="test-story__spinner" />
                RUNNING…
              </span>
            ) : ran ? (
              <span
                className={`test-story__status test-story__status--${failed ? "fail" : "pass"}`}
              >
                {failed ? "FAILED" : "PASSED"}
              </span>
            ) : null}
            {ran && (
              <button
                type="button"
                className="test-story__clear1"
                onClick={clear}
                disabled={running}
              >
                Clear
              </button>
            )}
            <button
              type="button"
              className="test-story__run"
              onClick={run}
              disabled={running}
            >
              {running ? "Running…" : "▶ Run"}
            </button>
          </div>
        )}
        {/* RFC-020 — render each section in the test's run-order. Built-ins get their capitalized label; a
          named-action section (e.g. seedSum) shows its own name and a distinct style so it reads as its
          own section, not part of Before/Main. */}
        {open &&
          (ft.order || []).map((name) => {
            const actions = (ft.sections || {})[name] || [];
            if (!actions.length) return null;
            const builtIn = {
              before: "Before",
              main: "Main",
              events: "Events",
              after: "After",
            };
            const label = builtIn[name] || name;
            const isNamed = !builtIn[name];
            const isCollapsed = collapsed[name];
            return (
              <div
                key={name}
                className={`test-story__phase ${isNamed ? "test-story__phase--named" : ""}`}
              >
                <button
                  type="button"
                  className="test-story__phase-name"
                  onClick={() => toggle(name)}
                >
                  <span className="test-story__caret">{isCollapsed ? "▸" : "▾"}</span>
                  {/* {isNamed && <span className="test-story__phase-tag">action</span>} */}
                  {label}
                  <span className="test-story__count">{actions.length}</span>
                </button>
                {actions.map((a, i) => (
                  <TestAction
                    key={i}
                    action={a}
                    ran={ran}
                    phaseSig={phaseSig[name] || 0}
                    phaseCollapsed={isCollapsed}
                    autoExpand={autoExpand}
                  />
                ))}
              </div>
            );
          })}
      </div>
    );
  },
);

export default TestStory;
