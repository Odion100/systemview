import React, { useState } from "react";
import ReactJson from "react-json-view";
import { initializeSavedTests } from "../SavedTests/transformTests";
import FullTestController from "../TestPanel/components/FullTestController";
import "./test-story.scss";

// Objects can be arbitrarily large, so args/responses render through react-json-view (expandable) —
// the same way the existing test panel + logs do. Default (light) theme to sit on the white pane.
const Json = ({ src }) => (
  <ReactJson
    src={src}
    name={false}
    displayObjectSize={false}
    displayDataTypes={false}
    collapsed={1}
    collapseStringsAfterLength={80}
    style={{ fontSize: "11.5px", fontFamily: "monospace", background: "transparent", maxWidth: "100%" }}
    enableClipboard={(copy) => { try { navigator.clipboard.writeText(typeof copy.src === "string" ? copy.src : JSON.stringify(copy.src, null, 2)); } catch { /* ignore */ } }}
  />
);
const isObj = (v) => v !== null && typeof v === "object";
// An Error instance has non-enumerable message/stack, so ReactJson would show it empty — normalize to
// a plain object so a thrown error's fields actually render.
const errToObj = (e) => {
  if (e instanceof Error) {
    const o = { message: e.message };
    Object.keys(e).forEach((k) => { o[k] = e[k]; });
    if (e.status) o.status = e.status;
    return o;
  }
  return e;
};

// Evaluations read as natural sentences (mirrors testing-utilities/validtionMessages.js) so a saved
// assertion says "expecting results.cookie to be a string, to equal X" — not a raw `strEquals` token.
const vowels = ["a", "e", "i", "o", "u"];
const an = (w) => (w == null || w === "undefined" ? "" : vowels.includes(String(w)[0].toLowerCase()) ? "an" : "a");
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
    out.push({ lead: `to be ${an(e.expected_type)}`, value: e.expected_type, ruleName: "typeError", kind: "type" });
  (e.validations || []).forEach((v) => {
    const built = RULE[v.name] ? RULE[v.name](show(v.value)) : { lead: v.name, value: show(v.value) };
    out.push({ ...built, ruleName: v.name, kind: "value" });
  });
  return out;
};

// RFC-018 — a saved test rendered as a compact, readable STORY for the AI Window (not the full
// SavedTests scratchpad UI, which is built for editing and sprawls here). Setup → call → args →
// response → the assertions that pin it, with a Run that shows inline pass/fail. Reuses the proven
// runner (initializeSavedTests + FullTestController); the presentation is purpose-built for this spot.
const PHASES = ["Before", "Main", "Events", "After"];

const argVals = (action) => {
  try { return (action.args || []).map((a) => (typeof a.value === "function" ? a.value() : a.input)); }
  catch { return []; }
};
const errsOf = (action) => {
  try { return typeof action.getErrors === "function" ? action.getErrors() : []; }
  catch { return []; }
};

const evalsOf = (action) => {
  try { return (action.savedEvaluations || []).filter((e) => e.save); }
  catch { return []; }
};

function TestAction({ action, ran, phaseSig, phaseCollapsed, autoExpand }) {
  const ns = action.namespace || {};
  const errs = ran ? errsOf(action) : [];
  const passed = ran && !errs.length;
  const args = argVals(action);
  const evals = evalsOf(action);
  const [openAction, setOpenAction] = useState(false);
  const [showEvals, setShowEvals] = useState(evals.length <= 4);
  // Per (namespace, rule) failure lookup so each clause — type check or a specific validation — shows
  // its OWN pass/fail, not a whole-evaluation verdict.
  const errSet = new Set(errs.map((e) => `${e.namespace}::${e.name}`));

  // Collapsed to a one-line preview by default. On run: a FAILED action always auto-expands (you need to
  // see what broke); a PASSED action stays collapsed unless the caller opts in (autoExpand). Not run ⇒
  // collapsed. Keeps passing runs calm (and not fighting the auto-scroll) while never hiding a failure.
  React.useEffect(() => {
    if (!ran) { setOpenAction(false); return; }
    const failedThis = errs.length > 0;
    setOpenAction(failedThis || !!autoExpand);
    // If it FAILED, open the evaluations too — the failing assertion is the whole point of expanding.
    if (failedThis) setShowEvals(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ran, autoExpand]);
  // Folding a PHASE cascades to its actions: collapse → all actions drop to previews (still visible,
  // just title + call); expand → all open. Only fires on a real toggle (phaseSig starts at 0).
  React.useEffect(() => { if (phaseSig) setOpenAction(!phaseCollapsed); // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phaseSig]);

  return (
    <div className={`test-action ${ran ? (passed ? "test-action--pass" : "test-action--fail") : ""} ${openAction ? "" : "test-action--collapsed"}`}>
      {/* The action itself folds — collapsed shows just its title + the method call; expand for the
          args, what it returned, and the assertions that pin it. */}
      <button type="button" className="test-action__head" onClick={() => setOpenAction((o) => !o)}>
        <span className="test-action__caret">{openAction ? "▾" : "▸"}</span>
        {ran && <span className={`test-action__badge ${passed ? "is-pass" : "is-fail"}`}>{passed ? "✓" : "✗"}</span>}
        {action.title && <span className="test-action__title">{action.title}</span>}
        {/* Collapsed only: title + the call sit together on one line as a compact preview. */}
        {!openAction && (
          <code className="test-action__call">
            {ns.serviceId ? `${ns.serviceId}.` : ""}{ns.moduleName}.<b>{ns.methodName}</b>({args.length ? "…)" : ")"}
          </code>
        )}
      </button>
      {openAction && (
      <>
      {/* Expanded: the call drops to its OWN line (below the title), then the args beneath it. */}
      <div className="test-action__row">
        <code className="test-action__call">
          {ns.serviceId ? `${ns.serviceId}.` : ""}{ns.moduleName}.<b>{ns.methodName}</b>({args.length === 0 ? ")" : ""}
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
                {isObj(a) ? <Json src={a} /> : <code className="test-action__lit">{JSON.stringify(a)}</code>}
                {i < args.length - 1 && <code className="test-action__comma">,</code>}
              </div>
            ))}
          </div>
          <code className="test-action__paren test-action__paren--close">)</code>
        </>
      )}
      {ran && action.results !== undefined && action.results !== null && (
        <div className={`test-action__returns ${action.response_type === "error" ? "is-error" : ""}`}>
          {/* Distinguish a THROW from a normal return — a divide-by-zero shows as an error, not a value
              (a test can still PASS by asserting the error; this just shows what actually happened). */}
          {/* Labelled with the KEY you reference it by (results / error) — e.g. tv(test.main[0].results). */}
          <span className="test-action__arrow">{action.response_type === "error" ? "error" : "results"}</span>
          {isObj(action.results)
            ? <Json src={errToObj(action.results)} />
            : <code className="test-action__lit">{String(action.results)}</code>}
        </div>
      )}
      {/* Evaluations = clauses, and EXPANDABLE — they can get long. */}
      {evals.length > 0 && (
        <div className="test-action__evals">
          <button type="button" className="test-action__evals-toggle" onClick={() => setShowEvals((s) => !s)}>
            <span className="test-action__caret">{showEvals ? "▾" : "▸"}</span>
            evaluations
            <span className="test-action__evals-count">{evals.length}</span>
          </button>
          {showEvals && evals.flatMap((e, i) =>
            evalClauses(e).map((c, j) => {
              const failed = ran && errSet.has(`${e.namespace}::${c.ruleName}`);
              const state = !ran ? "" : failed ? "is-fail" : "is-pass";
              return (
                <div key={`${i}-${j}`} className={`test-clause ${state}`}>
                  <span className="test-clause__box">{ran ? (failed ? "✗" : "✓") : "▢"}</span>
                  <span className="test-clause__sentence">
                    expecting <span className="test-clause__ns">{e.namespace}</span> {c.lead}{" "}
                    <span className={`test-clause__val test-clause__val--${c.kind}`}>{c.value}</span>
                    {c.tail ? ` ${c.tail}` : ""}
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
  try { return initializeSavedTests([test], connectedServices)[0]; }
  catch { return null; }
};

const TestStory = React.forwardRef(({ test, connectedServices, index, onResult, autoExpand, chromeless }, ref) => {
  const [ft, setFt] = useState(() => freshTest(test, connectedServices));
  const [running, setRunning] = useState(false);
  const [ran, setRan] = useState(false);
  const [collapsed, setCollapsed] = useState({});
  const [phaseSig, setPhaseSig] = useState({});
  // Chromeless (scratchpad) tests start COLLAPSED — just the header. Story panes keep their open default.
  const [open, setOpen] = useState(!chromeless);
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
    if (!fresh) { setRunning(false); if (onResult) onResult("error"); return; }
    try {
      const { runFullTest } = new FullTestController({
        FullTest: [fresh.Before, fresh.Main, fresh.Events, fresh.After],
        connectedServices,
      });
      const [Before, Main, Events, After] = await runFullTest();
      const didFail = [...Before, ...Main, ...Events, ...After].some((a) => errsOf(a).length);
      setFt({ ...fresh, Before, Main, Events, After });
      setRan(true);
      if (onResult) onResult(didFail ? "fail" : "pass");
    } catch { if (onResult) onResult("error"); }
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
    [run, clear]
  );

  if (!ft) return <div className="test-story test-story--error">Couldn’t load this test.</div>;

  const allActions = [...ft.Before, ...ft.Main, ...ft.Events, ...ft.After];
  const failed = ran && allActions.some((a) => errsOf(a).length);

  return (
    <div className={`test-story ${running ? "test-story--running" : ran ? (failed ? "test-story--fail" : "test-story--pass") : ""}`}>
      {/* Chromeless (scratchpad): the surrounding card provides the header + Run/Edit/×, so we skip our
          own head entirely and render just the phases. */}
      {!chromeless && (
        <div className="test-story__head">
          {/* The whole test folds — click the title. */}
          <button type="button" className="test-story__fold" onClick={() => setOpen((o) => !o)}>
            <span className="test-story__caret">{open ? "▾" : "▸"}</span>
            <span className="test-story__title">
              {ft.title || `${(ft.namespace || {}).moduleName}.${(ft.namespace || {}).methodName}`}
              {typeof index === "number" && <span className="test-story__idx"> #{index}</span>}
            </span>
          </button>
          {running ? (
            <span className="test-story__status test-story__status--running">
              <span className="test-story__spinner" />RUNNING…
            </span>
          ) : ran ? (
            <span className={`test-story__status test-story__status--${failed ? "fail" : "pass"}`}>
              {failed ? "FAILED" : "PASSED"}
            </span>
          ) : null}
          {ran && (
            <button type="button" className="test-story__clear1" onClick={clear} disabled={running}>
              Clear
            </button>
          )}
          <button type="button" className="test-story__run" onClick={run} disabled={running}>
            {running ? "Running…" : "▶ Run"}
          </button>
        </div>
      )}
      {open && PHASES.map((phase) => {
        const actions = ft[phase] || [];
        if (!actions.length) return null;
        const isCollapsed = collapsed[phase];
        return (
          <div key={phase} className="test-story__phase">
            <button type="button" className="test-story__phase-name" onClick={() => toggle(phase)}>
              <span className="test-story__caret">{isCollapsed ? "▸" : "▾"}</span>
              {phase}
              <span className="test-story__count">{actions.length}</span>
            </button>
            {actions.map((a, i) => (
              <TestAction key={i} action={a} ran={ran} phaseSig={phaseSig[phase] || 0} phaseCollapsed={isCollapsed} autoExpand={autoExpand} />
            ))}
          </div>
        );
      })}
    </div>
  );
});

export default TestStory;
