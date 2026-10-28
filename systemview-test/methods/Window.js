// systemview-test/methods/Window.js — THE LIVING SPECS FOR WINDOW-ALTITUDE CLAIMS.
//
// RFC-075 §1.5 left one question open: whether a claim about what the WINDOW renders can carry a
// living spec at all. Its claims are render behaviour — a row that says `no spec`, a fold that
// hides without tearing down, a mark that lands on the opening line — and the suites that pin them
// are jest, which `::test` cannot address: `::test` takes a service namespace.
//
// THE ANSWER IS AN ADAPTER, not a new block. A method is a door, so the suite becomes one: this
// module runs the real jest suites and asserts the NAMED cases that pin each claim. That buys the
// two things a living spec is for — the claim is addressable (`::test{SystemViewCore.Window.…}`,
// run from the document, from the CLI, from an agent) and it rides the change loop, because the
// same suite the window's own tests run is what answers.
//
// AND IT ASSERTS NAMES, NEVER A COUNT. "34 tests passed" goes green after somebody deletes the one
// case that mattered; `containerRowKeepsTheStatement` cannot — delete that case and the spec says
// the claim lost its defence, by name. A green count is the exact failure the doctrine is about.
//
// THE TRADE THIS MAKES, stated rather than discovered: a fragment is matched as a SUBSTRING of the
// case title, so renaming a case for clarity does not break the spec — and the same property means
// a case kept by name with its body emptied would still read green. Only review catches that. The
// alternative (pinning exact titles) trades a real cost — every clarification breaks every spec —
// for a failure mode nobody has ever hit here.
//
// WHAT IS NOT ASSERTED, deliberately: the suite's OVERALL pass. An unrelated red in a 48-case file
// would otherwise manufacture a "failing proof" on four different claims, and under this doctrine a
// failing proof on a met claim is a finding — so the gate would generate false findings. The named
// fragments are the verdict; `failed` is reported beside them for whoever is reading.
const path = require("path");
const { spawnSync } = require("child_process");

const REPO = path.resolve(__dirname, "..", "..");

// One jest run per method call, over the narrowest pattern that covers the claims asked about.
// `--json` on stdout, progress on stderr — react-scripts keeps them apart, which is what makes
// this parseable rather than scraped.
function jest(pattern) {
  const res = spawnSync(
    path.join(REPO, "node_modules/.bin/react-scripts"),
    ["test", "--watchAll=false", "--json", "--testPathPattern", pattern],
    { cwd: REPO, env: { ...process.env, CI: "true" }, encoding: "utf8", maxBuffer: 64 * 1024 * 1024, timeout: 300000 },
  );
  let report = null;
  try {
    report = JSON.parse(res.stdout);
  } catch {
    // A SUITE THAT NEVER LOADED MUST NOT READ AS SILENCE. react-scripts answers with no JSON at all
    // when the pattern matches nothing or the transform throws, and an empty report would make
    // every `passed()` below false for the right reason by accident — so say what happened.
    return { ok: false, why: (res.stderr || (res.error && res.error.message) || "no JSON from the runner").slice(-400), cases: {} };
  }
  const cases = {};
  for (const suite of report.testResults || [])
    for (const a of suite.assertionResults || []) cases[a.fullName] = a.status;
  return {
    ok: report.numFailedTests === 0 && (report.numTotalTests || 0) > 0,
    suites: report.numTotalTestSuites,
    tests: report.numTotalTests,
    failed: report.numFailedTests,
    cases,
  };
}

// A case passes when a case whose name CONTAINS this fragment passed. `pending` (an `it.skip`) is
// not `passed`, so skipping a case is caught rather than counted.
const passed = (run, fragment) =>
  Object.entries(run.cases).some(([name, status]) => name.includes(fragment) && status === "passed");

module.exports = {
  // c1, c3 (the window half), c6 (its second sentence), c18 (the bar's render), c19 — the claim row
  // itself: what it draws, what it marks, what it says it owes, and what the bar reports.
  async claimRow() {
    const run = jest("blocks/Claim\\.test");
    return {
      suiteProducedResults: (run.tests || 0) > 0,
      failed: run.failed || 0,
      whyNot: run.why || "",
      // c1 — the container renders as the same one-line row, the statement lifted onto it, the
      // proof folded under its own header; and a leaf grows no affordance it did not have before.
      containerIsOneRowWithTheStatement: passed(run, "renders the statement from the label, the proof folded away"),
      leafShowsNoProofAffordance: passed(run, "a leaf claim shows no proof affordance at all"),
      // c3 — the mark lands on the OPENING line for a container exactly as for a leaf. (Thin on its
      // own — it asserts Claim forwards its line — which is why c3's real defence is
      // Proofs.claimFiresOffItsOpeningLine, driving the host's parse and write.)
      containerMarksOnItsOpeningLine: passed(run, "the mark still writes to the OPENING line"),
      // c6's second sentence — TWO SIGNATURES STAY TWO. The mark is additive: countersigning grows
      // `by=` and moves nothing else, stepping off leaves the other standing, a flip stashes.
      countersigningGrowsByAndMovesNothingElse: passed(run, "countersigns — by= grows, nothing else moves"),
      steppingOffLeavesTheOtherSignature: passed(run, "leaves it standing on the other signature"),
      aFlipStashesRatherThanErases: passed(run, "flipping the state STASHES the outgoing signatures"),
      // c19 — what a claim says it owes, all four rows
      saysNoSpecOnAnUndefendedBehavioralClaim: passed(run, "says `no spec` on a behavioural claim"),
      silentWhenTheFoldCarriesASpec: passed(run, "stays silent when the fold carries a spec"),
      saysByEyeOnAnExperientialClaim: passed(run, "says `by eye` on an experiential claim"),
      byEyeRidesTheKindAloneUnmarked: passed(run, "says `by eye` with no mark anywhere"),
      asksNothingOfAnUnmarkedClaim: passed(run, "asks nothing of an UNMARKED claim"),
      // c18's render half — the bar REPORTS the axis, over the behavioural denominator
      theBarReportsSpecdOverBehavioral: passed(run, "spec'd counts over the BEHAVIOURAL claims"),
      nothingOwedDrawsNoTag: passed(run, "nothing owed draws no owed tag at all"),
      theBarStillReportsReviewed: passed(run, "the reviewed count shows"),
      cases: run.tests || 0,
    };
  },

  // c2, and c6's first sentence — THE PROOF IS THE LIVE BLOCK, and running it writes nothing.
  // Two suites, because the claim lives across both: CmdBlock standing on its own (what a block
  // does with each answer a host can give) and the COMPOSITION — a real CmdBlock inside a claim's
  // fold, expanded, run, collapsed mid-run, re-expanded.
  async liveCmdInTheFold() {
    const run = jest("blocks/(CmdBlock|claimProof)\\.test");
    return {
      suiteProducedResults: (run.tests || 0) > 0,
      failed: run.failed || 0,
      whyNot: run.why || "",
      // the block's own law
      neverRunsOnItsOwn: passed(run, "never runs it on its own"),
      runsExactlyWhatIsWritten: passed(run, "hands the shell exactly the command in the block"),
      keepsItsExit: passed(run, "exit 0 reads as a success"),
      keepsTheOutputThatExplainsAFailure: passed(run, "keeps the output that explains it"),
      adoptsARunThatOutlivedTheView: passed(run, "adopts a surviving session on mount"),
      neverInventsAResult: passed(run, "stays honestly cold when nothing survived"),
      // c6's first sentence, asserted where the write would come FROM: a proof run to its exit,
      // pass and fail, with a write door in scope and the door never used.
      runningAProofWritesNothing: passed(run, "running a proof writes NOTHING into the document"),
      // c2 — the composition, which neither suite used to cover
      theFoldHoldsTheRealBlockUnrun: passed(run, "the fold holds the REAL block"),
      expandAndPressRunsItInTheFold: passed(run, "it runs where it stands and keeps its exit and output IN the fold"),
      collapseAfterARunKeepsTheExit: passed(run, "COLLAPSE AFTER A RUN and the exit survives"),
      aRunInFlightSurvivesACollapse: passed(run, "a run still IN FLIGHT survives a collapse"),
      cases: run.tests || 0,
    };
  },

  // c15 — THE COG SHOWS THE DOOR. The claim is a render claim and its first defence was not: a
  // registered IPC channel in the shell is not a rendered cog, and `nudgeSettings.test` — fourteen
  // cases, including the one that matters most here — was wired to no spec at all. A suite nothing
  // addresses defends nothing; this is the wire.
  async nudgeCog() {
    const run = jest("AgentChat/nudgeSettings\\.test");
    return {
      suiteProducedResults: (run.tests || 0) > 0,
      failed: run.failed || 0,
      whyNot: run.why || "",
      // the claim's own sentence: knobs, not "no nudge door yet" — and the honest opposite when
      // there really is no door, which is the line the claim was written against
      namesWhatCountsAndTheCadence: passed(run, "names what counts, the wait, the cadence and the limit"),
      saysPlainlyWhenThereIsNoDoor: passed(run, "says plainly when there is no door"),
      // the knobs write through the door rather than guessing
      sendsOnlyWhatChanged: passed(run, "sends only what actually changed"),
      noWriteWhenNothingChanged: passed(run, "returns null when the edit changes nothing"),
      clampsRatherThanTrusting: passed(run, "clamps rather than trusting"),
      zeroIsHowYouTurnItOff: passed(run, "lets give-up go to zero"),
      refusesAFieldItDoesNotHave: passed(run, "refuses a field it does not have"),
      onlyKeysTheHarnessStores: passed(run, "names only keys the harness actually stores"),
      cases: run.tests || 0,
    };
  },

  // c5 — the lifecycle trail reads the REGISTRY, and the absence of a row is an absence, never a
  // guess: no row means no trail, and a rejected RFC shows its real ending rather than the happy
  // path with a station lit. (The suite MOCKS the registry — the live row behind it is
  // Proofs.registryLightsThisDocument, and neither half covers the other.)
  async lifecycleTrail() {
    const run = jest("blocks/lifecycle\\.test");
    return {
      suiteProducedResults: (run.tests || 0) > 0,
      failed: run.failed || 0,
      whyNot: run.why || "",
      everyKindWalksItsOwnStations:
        passed(run, "an rfc walks draft") && passed(run, "arc, gap and report each speak their own"),
      lightsTheStationOffTheRegistryRow: passed(run, "lights the current station off the registry row"),
      noRowMeansNoTrail: passed(run, "no registry row → no trail at all"),
      noHubMeansNothingBroken: passed(run, "no hub at all → nothing, no error"),
      rejectedShowsItsRealEnding: passed(run, "a rejected RFC shows its real ending"),
      cases: run.tests || 0,
    };
  },

  // THE STATION IS A PRESS, and these are the named cases that pin it. Written for the claim about
  // clicking the lifecycle: a press must WRITE THE DECLARATION INTO THE DOCUMENT (no second state
  // store), going back must CLEAR it, a station a press cannot reach must say where the state comes
  // from instead of sitting dead, and the LEAF must beat the registry row — which is the defect he
  // found by changing the file and watching the trail not move.
  async lifecyclePress() {
    const control = jest("blocks/lifecycle\\.test");
    const law = jest("blocks/lifecycleState\\.test");
    const writer = jest("Markdown/attrBag\\.test");
    return {
      suitesProducedResults:
        (control.tests || 0) > 0 && (law.tests || 0) > 0 && (writer.tests || 0) > 0,
      failed: (control.failed || 0) + (law.failed || 0) + (writer.failed || 0),
      whyNot: control.why || law.why || writer.why || "",
      // the press writes the document, and writes it on the leaf's own line
      writesTheDeclarationOntoTheLeafsLine: passed(control, "writes the declaration onto the leaf"),
      goingBackClearsItRatherThanStoringAState: passed(control, "going BACK clears the declaration"),
      builtAppendsTheStatusHeading: passed(control, "appends the STATUS heading"),
      // no dead controls
      anUnreachableStationSaysWhereTheStateComesFrom: passed(control, "REFUSED and says where from"),
      anArcsDoneIsRefused: passed(control, "an arc's done is refused"),
      aReadOnlySurfaceDrawsNoControls: passed(control, "draws plain text, not controls"),
      // HIS DEFECT: the row is a cache, the leaf is the document on screen
      theLeafBeatsAStaleRegistryRow: passed(control, "draws the station the LEAF says"),
      andThePressStillWritesAgainstAStaleRow: passed(control, "pressing settled WRITES"),
      anAbsentAttributeDeclaresFalseNotNothing: passed(law, "declares FALSE, not nothing"),
      // the writer every press walks through — untestable until it was moved out of Markdown.js
      theWriterLandsInTheBracesAtTheEndOfTheLine: passed(writer, "braces at the END of the line"),
      theWriterIgnoresAKeyInsideAQuotedValue: passed(writer, "inside a QUOTED value"),
      aNullValueRemovesTheAttribute: passed(writer, "a null value REMOVES the attribute"),
      theWriteTouchesThatLineAndNothingElse: passed(writer, "touches the leaf line and nothing else"),
      cases: (control.tests || 0) + (law.tests || 0) + (writer.tests || 0),
    };
  },
};
