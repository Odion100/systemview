import React, { useCallback, useContext, useEffect, useMemo, useState } from "react";
import { getAgent } from "../../utils/hub";
import { run as runProofs, list as listProofs, subscribe } from "../../utils/proofsBus";
import SavedTests from "../SavedTests/SavedTests";
import { parseSteps, toStep } from "../../atoms/Markdown/blocks/RunBlock";
import ServiceContext from "../../ServiceContext";
import { openAddress } from "../../atoms/Markdown/openRef";
import useEffectiveProject from "../../utils/effectiveProject";
import { listRows, summaryOf, scopeLabel } from "./proofRows";

// THE PROOFS TAB — a project's documents run their own specs, outside any document.
//
// HIS DESIGN: "In the document it already works… When you're not in the document, it runs in the
// side panel. Add another tab and make it the default tab, since we're probably not using the
// ability to write tests and actions anymore — that's where tests will pop up when running, and you
// can see them run just like saved tests run. Test is for saved tests only; this one runs run
// blocks."
//
// IT DOES NOT COLLECT, PARSE, OR OWN THE RUN. The hub collects and executes (`api/proofs.js`), off
// the registry inventory the shell's parse already recorded; `utils/proofsBus` owns the run itself.
// This panel subscribes and draws. That is what lets a run started from the arc diagram with this
// panel CLOSED still be here when he opens it — his requirement: "you can go back and open it if
// you want and see if anything goes wrong, from wherever you ran it."
// IT IS THE SAVED-TEST AREA, not something like it. Asked twice and right both times: "why isn't
// the proof area very similar with the components, with the behavior?" Because I had grown a second
// toolbar, a second run-all and a second way of drawing a result beside one that already did all
// three. `SavedTests` is the section — its header, its ⊞/⊟, its Clear, its ▶ Run all in sequence,
// its pass/fail filter, its auto-track, its cards — and a collected spec is just another entry in
// the list it renders. The only difference the proofs need is that a spec lives in a DOCUMENT, so
// there is no saved slot to edit and no file to delete: `editable={false}` withholds those two
// handlers and SavedTestItem already draws them only when it is given them.
// A saved test's namespace as the dotted string a `::test[…]` label is matched against.
const nsOf = (t) => {
  const n = (t && t.namespace) || {};
  return [n.projectCode, n.serviceId, n.moduleName, n.methodName].filter(Boolean).join(".");
};

// ONE CLICK: OPEN THE DOCUMENT AND GO STRAIGHT TO THE BLOCK.
//
// His ask, and the whole of it: "to pull up a claim, to pull up a proof, all you need to do is go
// into the document and go directly to it." BOTH halves, every time. Opening a file and leaving you
// to find the thing is not the feature; neither is a scroll that only lands when the right document
// already happened to be open.
//
// The renderer hangs `data-md-start` on every block and `data-claim-id` on every claim, so the
// target is a querySelector once the document is rendered. Already on screen — which is the common
// case, since the panel loads the open document's specs — and this is just a scroll. Not on screen
// (an arc- or project-scoped run naming a sibling document) and the document is opened through
// `openAddress`, the only thing openRef.js permits to dispatch `sv:openFileInNav`, and THEN we wait
// for the block, because the open is asynchronous and scrolling before the render finds nothing.
//
// The wait is bounded and gives up quietly: an id that moved or a file that failed to open must not
// leave a timer running. The document is open either way — only the landing is best-effort.
const find = (selector) => (selector && typeof document !== "undefined" ? document.querySelector(selector) : null);

const land = (el) => {
  el.scrollIntoView({ behavior: "smooth", block: "center" });
  // A brief ring, so the eye catches WHICH block answered — arriving in the middle of a long
  // document without saying what moved leaves you hunting the thing you just asked for.
  el.classList.add("is-found");
  window.setTimeout(() => el.classList.remove("is-found"), 1600);
};

const goTo = (projectCode, path, selector, line, end) => {
  const here = find(selector);
  if (here) return land(here);
  if (!path) return;
  openAddress({ projectCode, path, language: "markdown", lines: line ? [line, end || line] : undefined });
  let tries = 0;
  const tick = window.setInterval(() => {
    const el = find(selector);
    if (el) {
      window.clearInterval(tick);
      land(el);
    } else if (++tries > 40) window.clearInterval(tick);
  }, 50);
};

const ProofsPanel = ({ projectCode: routeCode, services: givenServices = [], savedTests = [] }) => {
  // THE PROJECT IN VIEW, not the route segment. `useParams` hands back the literal `@none` when no
  // project is selected, and the real one rides in `fproj` — so this panel was asking the hub about
  // a project that exists nowhere, getting zero back with no error, and announcing that the document
  // had no specs while the hub was answering 1 for that very document.
  const projectCode = useEffectiveProject(routeCode);
  // THE SERVICES OF THE PROJECT IN VIEW. The ones handed down are filtered by the ROUTE's project,
  // which is `@none` whenever nothing is selected — so the list arrived empty, every two-segment
  // step (`Math.add`) had no service to resolve against, `toStep` dropped it, and the panel reported
  // that the HUB had sent no source. It had; there was simply nothing here to resolve the steps with.
  const { connectedServices = [] } = useContext(ServiceContext) || {};
  const services = useMemo(() => {
    const mine = connectedServices.filter((s) => s.projectCode === projectCode);
    return mine.length ? mine : givenServices;
  }, [connectedServices, projectCode, givenServices]);
  const [{ listed, ran, running, scope }, setState] = useState({ listed: null, ran: null, running: false, scope: null });
  const absent = !getAgent() || typeof getAgent().listProofs !== "function";
  // NO PROJECT IS ITS OWN STATE, and it has to be said. `projectCode` comes from the ROUTE
  // (`useParams` in pages/SystemView) and this panel is mounted in the scratchpad, so on a route
  // with no project in it there is nothing to collect FOR — and asking anyway got back
  // "projectCode required", which the summary then rendered as "no run or test blocks in scope".
  // Measured live: the panel claimed the project had no specs while the hub was answering 39.
  //
  // It does NOT fall back to a connected project. That is the `firstProject` mistake RunBlock.js
  // already paid for — an arbitrary entry off the connected list, related to nothing, varying with
  // connection order and with whatever happens to be up.
  const noProject = !String(projectCode || "").trim();

  // THE BUS FIRES IMMEDIATELY on subscribe, so mounting after a diagram-started run shows it rather
  // than an empty tab.
  useEffect(() => subscribe((s) => setState(s)), []);

  // The listing for THIS project, when there is nothing to show yet. A run already on the bus is
  // left alone — re-listing over it would replace the thing he opened the tab to look at.
  useEffect(() => {
    if (!absent && !noProject && !listed && !ran) listProofs(projectCode);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectCode, absent, noProject]);

  const go = useCallback((next) => runProofs(projectCode, next || {}), [projectCode]);

  const rows = useMemo(() => listRows(listed), [listed]);

  // EACH COLLECTED SPEC AS A TEST OBJECT — the same shape a saved test has, built with the same
  // grammar a `:::run` block in a document is built with (`parseSteps` + `toStep`, imported rather
  // than reimplemented), so the list `SavedTests` renders cannot drift from what the document shows.
  //
  // A `::test[ns]` spec is a REFERENCE to a saved test, so it resolves to that saved test itself —
  // the document is pointing at the library, and the library's own entry is the honest thing to run.
  const built = useMemo(() => {
    const out = [];
    for (const r of rows) {
      if (r.specKind === "test") {
        const hit = (savedTests || []).filter((t) => nsOf(t).includes(r.label));
        hit.forEach((t) => out.push({ ...t, __at: `${r.document}#L${r.line}`, __doc: r.document, __claim: r.claim || "", __path: r.path, __line: r.line, __end: r.end || r.line, __claimLine: r.claimLine || 0 }));
        continue;
      }
      if (!r.src) continue; // no body yet — the hub answers the inventory before the source
      const steps = parseSteps(r.src)
        .filter((p) => !p.use)
        .map((p) => toStep(p, { projectCode }, services))
        .filter(Boolean);
      if (!steps.length) continue;
      // THE SHAPE RunBlock PROVES, copied rather than invented. An inline run block does NOT put
      // its steps in `Main`: they go in a NAMED SECTION (`steps`) with `run` naming it, which is
      // what the runner walks. Built with `Main` instead, every card rendered and nothing ran when
      // you pressed play — the list looked right and was inert.
      out.push({
        title: (r.attrs && r.attrs.title) || r.name,
        namespace: steps[0].namespace || {},
        Main: [],
        sections: { steps },
        sectionRefs: {},
        run: ["steps"],
        __at: `${r.document}#L${r.line}`,
        __doc: r.document,
        __claim: r.claim || "",
        __path: r.path,
        __line: r.line,
        __end: r.end || r.line,
        __claimLine: r.claimLine || 0,
      });
    }
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, projectCode, services, savedTests]);
  const head = summaryOf({ listed, ran, running });
  const scoped = !!(scope && !scope.project);

  if (noProject && !ran)
    return (
      <div className="test-panel__proofs">
        <div className="test-panel__proofs-empty">
          No project in view. Open a project and its specs load here.
        </div>
      </div>
    );

  if (absent)
    // ABSENCE STATED, never a stale copy shown — a hub older than this feature has no door, and a
    // panel of buttons that reach nothing is worse than a sentence saying so.
    return (
      <div className="test-panel__proofs">
        <div className="test-panel__proofs-absent">
          This hub has no proofs door yet — restart it to pick up <code>Agent.runProofs</code>.
          Nothing here would be read.
        </div>
      </div>
    );

  return (
    <div className="test-panel__proofs">
      <div className="row test-panel__proofs-bar">
        <span className="test-panel__proofs-scope" title="what is in scope">
          {scopeLabel(scope)}
        </span>
        <span className="test-panel__proofs-sum">{head}</span>
        <span className="test-panel__proofs-acts">
          {scoped && (
            <button type="button" className="test-panel__icon-btn" title="widen to the whole project" onClick={() => go({})}>
              ⤢ all
            </button>
          )}
          {/* RECOLLECT, not re-run — a different verb, so it gets a different word. It re-asks the
              hub what is in scope; ▶ Run all below re-runs what is already on screen. */}
          <button type="button" className="test-panel__icon-btn" disabled={running} onClick={() => listProofs(projectCode, scopeArgs(scope))}>
            {running ? "collecting…" : "⟳"}
          </button>
        </span>
      </div>

      <SavedTests
        savedTests={built}
        connectedServices={services}
        label="Proofs"
        helpTopic="saved-tests"
        editable={false}
        kindLabel="proof"
        kindTone="run"
        // THE PROOF'S OWN IDENTITY, kept through the shared card: where it lives. A saved test is
        // "test <namespace>"; a proof is "proof <document>#L<line>", because that is the only
        // address it has and the thing a reader needs to go and open.
        // WHERE IT LIVES AND WHAT IT DEFENDS, both pressable. A proof saves nowhere, so its address
        // is its identity — and when it sits inside a claim, the claim is half of that address. His
        // ask: "it should say proof, RFC, and it should say its claim… so when something fails I can
        // look at the test and look at the claim." Reading a red proof means reading the sentence it
        // just broke, and making you hunt for that is the difference between a result and a finding.
        nsLabelOf={(t) =>
          t.__doc ? (
            <span className="test-panel__proof-where">
              <button
                type="button"
                className="test-panel__proof-link"
                title={`open ${t.__doc} at this proof`}
                onClick={() => goTo(projectCode, t.__path, `[data-md-start="${t.__line}"]`, t.__line, t.__end)}
              >
                {t.__doc}
              </button>
              {t.__claim ? (
                <button
                  type="button"
                  className="test-panel__proof-link test-panel__proof-link--claim"
                  title={`open the claim ${t.__claim} this defends`}
                  onClick={() => goTo(projectCode, t.__path, `[data-claim-id="${t.__claim}"]`, t.__claimLine || t.__line)}
                >
                  {t.__claim}
                </button>
              ) : null}
            </span>
          ) : (
            t.__at || null
          )
        }
        emptyNote={
          // TWO DIFFERENT EMPTIES, and saying the wrong one is how this surface confused him: the
          // panel collected a spec, got no BODY back for it, dropped it, and then announced "no run
          // blocks in scope" — an absence claimed over a completely different truth, which sent him
          // looking at his document for a block that was there all along.
          rows.length ? (
            // WHICH HALF IS MISSING, because they are different problems with different cures and
            // guessing sent him to restart a hub that was answering correctly. No source is the
            // hub; source with no runnable step is a service this window cannot reach.
            <div className="test-panel__proofs-empty">
              {rows.some((r) => r.src) ? (
                <>
                  Collected {rows.length} spec{rows.length === 1 ? "" : "s"}, but none of their steps
                  resolve to a connected service in <code>{projectCode || "this project"}</code>.
                  {services.length ? "" : " Nothing is connected for it."}
                </>
              ) : (
                <>
                  Collected {rows.length} spec{rows.length === 1 ? "" : "s"} — the hub sent no source
                  for {rows.length === 1 ? "it" : "them"}, so there is nothing to build.
                </>
              )}
            </div>
          ) : (
            // IN HIS WORDS, NOT THE BLOCK VOCABULARY. This used to read "No :::run or ::test block
            // in scope. A :::cmd is not a spec…" — the parser's own names, shown to the person
            // reading the document. "You're the one dealing with markdown. We're not dealing with
            // markdown." What he needs to know is that this document has nothing to run.
            <div className="test-panel__proofs-empty">Nothing to run in this document.</div>
          )
        }
      />

      {/* WHAT COULD NOT BE BUILT, beside the results and never instead of them. A run of four with a
          fifth unbuilt is not a clean run of four. */}
      {ran && (ran.problems || []).length > 0 && (
        <ul className="test-panel__proofs-problems">
          {ran.problems.map((p, i) => (
            <li key={i}>
              <code>
                {p.document}
                {p.line ? `#L${p.line}` : ""}
              </code>{" "}
              {p.problem}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

// The scope back as the arguments that produced it.
const scopeArgs = (s) => {
  const x = s || {};
  return x.document ? { document: x.document } : x.objective ? { objective: x.objective } : x.arc ? { arc: x.arc } : {};
};

export default ProofsPanel;
