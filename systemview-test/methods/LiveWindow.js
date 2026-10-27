// systemview-test/methods/LiveWindow.js — RENDER CLAIMS DEFENDED FROM THE REAL PAGE.
//
// Every other spec here reaches its subject with `require`: the claims parser, the host's FIRING
// table, the nudge selector are modules on disk. A claim about what the WINDOW draws has no module
// to require — it lives in a browser — so its best defence was jsdom, one altitude below the thing
// it claimed.
//
// This module is a CONSUMER: it loads the shell's own SystemLynx service with the client and asks
// the live page. `AutobotShell` runs inside the Electron main process, so `Window.read` is the
// rendered DOM in the window he is looking at.
//
// THE PRICE, stated because it decides how a red is read: this needs a claims document OPEN. So
// `aClaimsDocumentIsOpen` is an ASSERTED field, never a precondition that quietly skips — a proof
// that passes having checked nothing is the lie the whole doctrine exists to stop. Red means "could
// not look", which is true, and it is why this is the LIVE half beside the headless specs rather
// than a replacement for them.
//
// AND IT ASSERTS AGREEMENT, NOT APPEARANCE. "A chip is on screen" is weak. What is worth pinning is
// that the row chips and the document bar CANNOT DISAGREE: if the bar says three are owed, exactly
// three rows say `no spec`. Two independent derivations of one fact, checked against each other on
// the real page — a disagreement neither surface could show alone.
const { createClient } = require("systemlynx");

const SHELL = process.env.AUTOBOT_SHELL_SERVICE_URL || "http://localhost:6110/autobotshell/api";

// "12 owed" -> 12 · "20/21 met" -> 20. The bar renders numbers as text, so the spec reads them the
// way he does.
const num = (text, re) => {
  const m = re.exec(String(text || ""));
  return m ? Number(m[1]) : null;
};

module.exports = {
  // THE DOOR ITSELF — and this one IS a change-loop defence, because it holds whatever he has on
  // screen. The shell serves, the window is reachable, and the hold is observable: `bundle.holding`
  // answers the question that once cost him his tabs six times in one session, so a regression that
  // made the swap unobservable again would go red here.
  //
  // Kept apart from `claimsAsRendered` deliberately. That one needs a specific document open and is
  // therefore red whenever he is elsewhere, which makes it an on-demand live check and NOT a claim's
  // spec — wiring it to a claim would manufacture a failing proof every time he scrolled away, and
  // under this doctrine a failing proof on a met claim is a finding. One of these two can ride the
  // loop; the other cannot, and saying which is the whole point.
  async shellDoorAnswers() {
    let svc;
    try {
      svc = await createClient().loadService(SHELL);
    } catch (err) {
      return {
        shellServiceReachable: false,
        why: `could not load ${SHELL}: ${String((err && (err.message || (err[0] && err[0].message))) || err).slice(0, 200)}`,
      };
    }
    const tabs = await svc.Window.tabs();
    const open = (tabs.tabs || []).map((t) => t.appId).filter(Boolean);
    const bundle = await svc.Window.bundle({});
    const corpora = await svc.Docs.corpora();
    const hit = await svc.Docs.search({ q: "the proof doctrine — living spec versus review facilitation", limit: 1 });
    return {
      shellServiceReachable: true,
      why: "",
      itAnswersAboutItsOwnTabs: tabs.ok === true && Array.isArray(tabs.tabs),
      theWindowIsOpen: open.includes("systemview"),
      // the hold, observable rather than inferred — holding true or false are both fine; what must
      // never come back is "cannot tell"
      theHoldIsObservable: bundle.ok === true && typeof bundle.holding === "boolean",
      itNamesWhatIsRunningAndWhatIsServed:
        !!bundle.running && Array.isArray(bundle.running.js) && !!bundle.served && !bundle.served.error,
      // c10's retrieval half, through a door a spec can actually call
      theCorporaAreReachable: corpora.ok === true && (corpora.corpora || []).length > 0,
      theDoctrineAnswersFromTheCorpus:
        hit.ok === true && hit.count > 0 && /living spec|review facilitation/i.test((hit.hits[0] || {}).text || ""),
      openApps: open,
    };
  },
  // c1, c18, c19 — the LIVE half: what the row draws, what the bar reports, and the fact that the
  // two cannot disagree, read off the page in his window.
  async claimsAsRendered() {
    let svc;
    try {
      svc = await createClient().loadService(SHELL);
    } catch (err) {
      // A SHUT DOOR IS NOT A PASS. No shell service means this claim went undefended this run, and
      // it says so rather than reporting an absence as agreement.
      return {
        shellServiceReachable: false,
        aClaimsDocumentIsOpen: false,
        why: `could not load ${SHELL}: ${String(
          (err && (err.message || (err[0] && err[0].message))) || err,
        ).slice(0, 200)}`,
      };
    }

    const [rows, owedChips, byEyeChips, proofHeads, statements, bars, bundle] = await Promise.all([
      svc.Window.count({ selector: ".md-claim" }),
      svc.Window.count({ selector: ".md-claim__owed" }),
      svc.Window.count({ selector: ".md-claim__kind" }),
      svc.Window.count({ selector: ".md-claim__proofhead" }),
      svc.Window.count({ selector: ".md-claim__statement" }),
      svc.Window.read({ selector: ".md-claims", limit: 1 }),
      svc.Window.bundle({}),
    ]);

    const barText = ((bars.nodes || [])[0] || {}).text || "";
    const barOwed = num(barText, /(\d+)\s+owed/) || 0;
    const specd = num(barText, /(\d+)\/\d+ spec'd/);
    const behavioral = num(barText, /\d+\/(\d+) spec'd/);
    const rowCount = rows.found || 0;

    return {
      shellServiceReachable: true,
      why: "",
      // Asserted, so this can never pass having looked at nothing.
      aClaimsDocumentIsOpen: rowCount > 0 && !!barText,
      // c1 — every claim is ONE row carrying its statement, container or leaf alike
      everyRowCarriesItsStatement: rowCount > 0 && statements.found === rowCount,
      // c1 — only a grown claim offers the fold
      proofsOfferedOnlyWhereGrown: (proofHeads.found || 0) <= rowCount,
      // c19 + c18 — THE TWO DERIVATIONS AGREE. The bar derives `owed` from the source; each row
      // derives its own chip. Nothing holds them in step but both being derived.
      owedChipsMatchTheBar: (owedChips.found || 0) === barOwed,
      // c19 — experiential claims are counted apart, never as a shortfall: the `by eye` chips are
      // exactly what the bar left out of its behavioural denominator.
      byEyeChipsAreTheNonBehavioralOnes:
        behavioral != null && rowCount - behavioral === (byEyeChips.found || 0),
      // c18 — the axis is rendered, over the behavioural count
      theBarReportsTheSpecdAxis: specd != null && behavioral != null && specd <= behavioral,
      // the page is running what is served — not a bundle from before the change under test
      theWindowIsRunningWhatIsServed: bundle.ok === true && bundle.holding === false,
      bar: barText.replace(/\s+/g, " ").slice(0, 160),
      rows: rowCount,
      owedChips: owedChips.found || 0,
      byEyeChips: byEyeChips.found || 0,
    };
  },
};
