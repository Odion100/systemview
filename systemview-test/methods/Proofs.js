// systemview-test/methods/Proofs.js — THE LIVING SPECS for RFC-075's claims.
//
// A claim's proof can be a screenshot or a `:::cmd`, and both are review facilitation: they help a
// human confirm, once, and then they rot quietly. A LIVING SPEC is the other obligation — a defence
// that rides the change loop, so breaking a claim's contract next month goes red in front of
// whoever broke it rather than six weeks later in front of nobody. RFC-075 invented the doctrine
// and carried fourteen `:::cmd`s and zero specs; this file is the repair.
//
// WHAT THESE ASSERT. The law, wherever the law is what the claim claims: "absence reads
// behavioural", not "there are twenty claims". Numbers appear in two honest places — inside a
// FIXTURE this file wrote (a four-claim document must count 4), and `owed`, asserted to be ZERO,
// which is the document defending itself. A number about a document that can drift is reported,
// never asserted; where one is asserted anyway it says why, in its own comment.
//
// REACHING `src/` FROM NODE. The authoritative claims module is ES-module source consumed by the
// browser bundle, and a spec that re-implemented its rules would prove only that two copies agree.
// So the real file is read off disk and transformed to CommonJS with the babel plugin the build
// already depends on. Consequences, both wanted: the spec exercises the SAME source the window
// runs, and if that file grows an import this loader cannot resolve, the spec goes RED instead of
// quietly testing a stale copy.
const fs = require("fs");
const path = require("path");

const REPO = path.resolve(__dirname, "..", "..");
const AUTOBOT = path.join(path.dirname(REPO), "..", "autobot");
const read = (p) => fs.readFileSync(p, "utf8");

// RELATIVE IMPORTS RESOLVE THROUGH THIS LOADER; packages go to the real `require`. A module that
// cannot be loaded at all (a browser-only dependency, a stylesheet) becomes an empty stub AND IS
// NAMED in `stubbed` — a spec that silently stubbed half a module would be asserting against
// scaffolding, so the list is part of every answer that uses one.
function loadEsm(relative, stubbed = []) {
  const abs = path.isAbsolute(relative) ? relative : path.join(REPO, relative);
  const { transformSync } = require("@babel/core");
  const { code } = transformSync(read(abs), {
    babelrc: false,
    configFile: false,
    filename: abs,
    // JSX TOO, so a module that holds both pure rules and a component is reachable. The component
    // is never rendered here — transforming it is only what makes the file parse, so the pure
    // exports beside it can be exercised from the REAL file instead of a copy.
    plugins: [
      require.resolve("@babel/plugin-transform-modules-commonjs"),
      [require.resolve("@babel/plugin-transform-react-jsx"), { runtime: "automatic" }],
    ],
  });
  const here = path.dirname(abs);
  const localRequire = (spec) => {
    if (!spec.startsWith(".")) return require(spec);
    const base = path.resolve(here, spec);
    for (const candidate of [base, `${base}.js`, `${base}.jsx`, path.join(base, "index.js")]) {
      if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
        try {
          return loadEsm(candidate, stubbed);
        } catch (err) {
          // THE FILE, then the reason — truncating the message used to cut the path mid-filename,
          // so even a named stub did not name what got stubbed.
          stubbed.push(`${path.relative(REPO, candidate)}: ${String(err.message).split("\n")[0].slice(0, 120)}`);
          return {};
        }
      }
    }
    stubbed.push(spec);
    return {};
  };
  const module = { exports: {} };
  // eslint-disable-next-line no-new-func
  new Function("exports", "require", "module", "__filename", "__dirname", code)(
    module.exports,
    localRequire,
    module,
    abs,
    here,
  );
  return module.exports;
}

// AND THE STUB IS A THROW HERE, not a note nobody reads. `claims.js` is a pure module by design
// (its own header says so), so anything it cannot resolve means this spec would be exercising
// scaffolding instead of the window's rules — measured: a module importing a stylesheet loaded
// GREEN with the stub recorded in an array the caller threw away. Nine specs read this module;
// they all go red together now, which is what the loader's promise was always supposed to mean.
const claimsModule = () => {
  const stubbed = [];
  const mod = loadEsm("src/atoms/Markdown/claims.js", stubbed);
  if (stubbed.length)
    throw new Error(
      `claims.js grew a dependency this spec cannot load (${stubbed.join("; ")}) — refusing to ` +
        `assert against a partly-stubbed module`,
    );
  return mod;
};

// A skill on disk. Named rather than inlined because five specs read one, and a missing skill must
// read as `theSkillWasFound: false` rather than as every other field quietly going false.
const skillText = (name) => {
  try {
    return read(path.join(process.env.HOME, ".claude/skills", name, "SKILL.md"));
  } catch {
    return "";
  }
};

// Is this folder inside a corpus that indexes markdown? A chapter nothing indexes answers nobody.
const corpusCovers = (relFolder) => {
  try {
    const corpora = JSON.parse(read(path.join(process.env.HOME, ".autobot/corpora.json")));
    return corpora.some(
      (c) => path.resolve(REPO, relFolder).startsWith(path.resolve(c.root || "")) && /md/.test(c.glob || ""),
    );
  } catch {
    return false;
  }
};

// A document, written the way the window writes one. Indented nowhere — a claim line is matched
// from the start of its line, so a fixture that pretty-prints itself tests something else.
const doc = (...lines) => lines.join("\n");

module.exports = {
  // c16 — A CLAIM DECLARES ITS KIND, and silence is the strict side. The only exemption is the
  // written word, read from four spellings; absence and every other value read behavioural.
  async claimKind() {
    const { normalizeKind, parseClaims } = claimsModule();
    const exempt = ["experiential", "experience", "judgment", "judgement"];
    const marked = (attrs) => parseClaims(`::claim[a statement]{${attrs}}`)[0] || {};
    return {
      absenceReadsBehavioral: normalizeKind(undefined) === "behavioral" && normalizeKind("") === "behavioral",
      fourSpellingsExempt: exempt.every((s) => normalizeKind(s) === "experiential"),
      caseAndSpaceTolerated: normalizeKind("  Experiential ") === "experiential",
      // The failure this guards: a typo buying an exemption. `kind=experential` must NOT.
      everyOtherValueReadsBehavioral: ["vibes", "experential", "judgemental", "spec", "0"].every(
        (s) => normalizeKind(s) === "behavioral",
      ),
      kindIsReadOffTheLine: marked("id=c1 kind=experiential").kind === "experiential",
      unwrittenKindOnALineIsBehavioral: marked("id=c1").kind === "behavioral",
      // OWED is the consequence of the declaration: a behavioural claim marked with no spec in its
      // fold is a commitment nothing defends. An experiential one is never asked.
      markedBehavioralWithNoSpecIsOwed: marked("id=c1 state=met by=you note=x").owed === true,
      markedExperientialIsNeverOwed: marked("id=c1 kind=experiential state=met by=you note=x").owed === false,
      unmarkedBehavioralIsNotYetOwed: marked("id=c1").owed === false,
    };
  },

  // c17 — WHAT COUNTS AS CARRYING A SPEC: `::test` or `:::run` in the fold, and nothing else. A
  // `:::cmd` is excluded on purpose (a cmd running the suite and a cmd running grep are
  // indistinguishable at parse level), and a FENCED example of a spec block cannot fake one.
  async specDetection() {
    const { parseClaims } = claimsModule();
    const one = (...body) => parseClaims(doc(":::claim[s]{id=c1}", ...body, ":::"))[0] || {};
    const fencedExample = parseClaims(
      doc(":::claim[s]{id=c1}", "```markdown", "::test{SystemViewCore.Proofs.claimKind}", "```", ":::"),
    )[0] || {};
    // The nesting case: a claim holding a `::::`-fenced child still finds its own close, because
    // normalizeFences guarantees the outer fence is longer than every inner one.
    const nested = parseClaims(
      doc("::::claim[s]{id=c1}", ":::cmd", "echo hi", ":::", "::test{SystemViewCore.Proofs.claimKind}", "::::"),
    )[0] || {};
    return {
      testCountsAsSpec: one("::test{SystemViewCore.Proofs.claimKind}").hasSpec === true,
      runCountsAsSpec: one(":::run", "steps", ":::").hasSpec === true,
      cmdDoesNot: one(":::cmd", "yarn test", ":::").hasSpec === false,
      proseDoesNot: one("Look at the bar at the top of this document.").hasSpec === false,
      fencedExampleCannotFakeOne: fencedExample.hasSpec === false,
      leafCarriesNoSpecByConstruction: parseClaims("::claim[s]{id=c1}")[0].hasSpec === false,
      foundPastALongerInnerFence: nested.hasSpec === true,
    };
  },

  // c18 — THE BAR'S THIRD AXIS. `spec'd` is a fraction of the BEHAVIOURAL claims — an experiential
  // claim is not a shortfall — and the MET count is untouched by any of it (which is c8, still
  // true, just narrower).
  async barAxes() {
    const { claimsOf } = claimsModule();
    const d = doc(
      ":::claim[spec'd and met]{id=c1 state=met by=you note=x}",
      "::test{SystemViewCore.Proofs.claimKind}",
      ":::",
      "::claim[met, nothing behind it]{id=c2 state=met by=you note=x}",
      "::claim[by eye]{id=c3 kind=experiential state=met by=you note=x}",
      "::claim[nobody looked]{id=c4}",
    );
    const bar = claimsOf(d);
    return {
      totalCountsEveryClaim: bar.total === 4,
      metCountsMarksOnly: bar.met === 3,
      uncheckedIsTheRemainder: bar.unchecked === 1,
      behavioralExcludesTheExempt: bar.behavioral === 3 && bar.experiential === 1,
      // 1 of the 3 behavioural claims carries a spec — never 1 of 4.
      specdDenominatorIsBehavioral: bar.specd === 1,
      // only c2: marked, behavioural, nothing in its fold. c4 is unmarked, c3 is exempt.
      owedIsMarkedBehavioralWithoutASpec: bar.owed === 1,
    };
  },

  // c8 — `::claims` COUNTS MARKS, NOT PROOFS. Two claims with the same mark count identically
  // whether one carries a proof and the other carries nothing. (The spec'd axis above reports the
  // gap separately, which is why c8 survives the amendment instead of being retracted.)
  async countsMarksNotProofs() {
    const { claimsOf } = claimsModule();
    const proofed = claimsOf(
      doc(":::claim[a]{id=c1 state=met by=you note=x}", ":::cmd", "echo proof", ":::", ":::"),
    );
    const bare = claimsOf("::claim[a]{id=c1 state=met by=you note=x}");
    return {
      sameMetCount: proofed.met === bare.met && proofed.met === 1,
      sameTotal: proofed.total === bare.total && proofed.total === 1,
      // THERE WAS A THIRD FIELD HERE AND IT WAS A STRAWMAN: `!keys.includes("proofed")`. The object
      // it inspected carries `specd` AND `owed` — two proof-derived columns — so the field asserted
      // the opposite of what the code contains and passed on a name nobody ever used. The two
      // counts above are c8, honestly: identical marks count identically.
    };
  },

  // c4 — THE RETROFIT. A leaf grows its container form in place: the statement and any existing
  // mark survive verbatim, the fence lands under an empty body, and a line that is already a
  // container (or holds no claim) is a no-op rather than a mangle.
  async growProof() {
    const { growProof, parseClaims } = claimsModule();
    const line = "::claim[the statement → what should happen]{id=c9 state=met by=you note=\"kept\"}";
    const before = doc("# doc", line, "after");
    const after = growProof(before, 2);
    const grown = parseClaims(after)[0] || {};
    const original = parseClaims(before)[0] || {};
    const container = doc(":::claim[s]{id=c1}", "body", ":::");
    return {
      leafBecomesContainer: /^:::claim\[/.test(after.split("\n")[1]),
      statementSurvivesVerbatim: grown.statement === original.statement,
      markSurvivesVerbatim:
        grown.state === original.state && grown.by === original.by && grown.note === original.note,
      bodyIsEmptyAndFenced: after.split("\n")[2] === "" && after.split("\n")[3] === ":::",
      whatFollowedIsStillThere: after.split("\n")[4] === "after",
      aContainerIsANoOp: growProof(container, 1) === null,
      aNonClaimIsANoOp: growProof(doc("# doc", "prose"), 2) === null,
      offTheEndIsANoOp: growProof(before, 99) === null,
    };
  },

  // RFC-075 DEFENDS ITSELF — the one assertion about this document's own numbers, and the only one
  // worth making: **nothing is owed**. Every behavioural claim that carries a mark carries a spec
  // the change loop runs. Add a marked behavioural claim with nothing in its fold and this goes red
  // with that claim's id in the failure, which is precisely the hole §1.5 was written about.
  async rfc075OwesNothing() {
    const { claimsOf } = claimsModule();
    const src = read(path.join(REPO, "RFCs/RFC-075-a-claim-carries-its-proof.md"));
    const bar = claimsOf(src);
    // AND THE SPECS IT POINTS AT HAVE TO EXIST. `hasSpec` is purely structural — a line matching
    // `::test` inside a fold — so `21/21 spec'd` and `owed: 0` are reachable with twenty-one
    // FABRICATED namespaces, and this document's own headline self-defence would still read green.
    // That is the sharpest hole a reviewer found in this file. So: every namespace the document
    // names must resolve to a saved spec on disk, and the misses are named.
    const refs = [...src.matchAll(/^::test\[([^\]]+)\]/gm)].map((m) => m[1].trim());
    const unresolved = [...new Set(refs)].filter((ref) => {
      const [serviceId, moduleName, methodName] = ref.split(":")[0].split(".");
      if (!serviceId || !moduleName || !methodName) return true;
      return !fs.existsSync(path.join(REPO, "systemview-test/specs/tests", `${moduleName}.${methodName}.json`));
    });
    return {
      everySpecItNamesResolves: unresolved.length === 0,
      unresolved,
      specsNamed: [...new Set(refs)].length,
      theDocumentHasClaims: bar.total > 0,
      owedIsZero: bar.owed === 0,
      // named, so a red says WHICH claim lost its defence rather than only that one did
      owing: bar.claims.filter((c) => c.owed).map((c) => c.id || `#${c.n}`),
      // reported, never asserted: these move with the walk and an assertion on them would be a
      // spec that fails for being honest.
      total: bar.total,
      met: bar.met,
      unmet: bar.unmet,
      specd: bar.specd,
      behavioral: bar.behavioral,
    };
  },

  // c5, the live half — THE TRAIL READS THE REGISTRY, and this document has a row in it. The render
  // law is pinned by the jest suite (Window.lifecycleTrail); what that suite mocks is the registry,
  // so this is the other half: the real row exists, and the station the REAL `stateOf` derives from
  // it is one of the kind's own stations. Delete the row and this goes red; rename a station and it
  // goes red; neither is reachable from a mocked suite.
  async registryLightsThisDocument() {
    const stubbed = [];
    const { stateOf, TRAILS } = loadEsm("src/atoms/Markdown/blocks/lifecycle.js", stubbed);
    const registry = require(path.join(AUTOBOT, "electron/markdown/registry.cjs"));
    const row = (registry.list() || []).find((r) => r.id === "RFC-075") || registry.get("RFC-075");
    const station = row ? stateOf(row.kind, row) : "";
    return {
      theRowExists: !!row,
      itIsAnRfc: !!row && row.kind === "rfc",
      itPointsAtThisFile: !!row && /RFC-075-a-claim-carries-its-proof\.md$/.test(String(row.path || "")),
      // the state is DERIVED by the shell's parse — the row carries the verdict the approval block holds
      itsStateCameFromTheParse: !!row && !!(row.state && row.state.parsed),
      theDerivedStationIsOneOfTheKinds: TRAILS.rfc.includes(station),
      station,
      stubbed,
    };
  },


  // c1, SECOND SENTENCE — "every leaf claim in RFC-073 and RFC-074 renders exactly as it did
  // before; no row changed." The note excused this as a whole-document render nobody can assert,
  // and a reviewer called the excuse a convenience: the RENDER cannot be asserted here, but the
  // thing that would actually break can. The container form changed the claim REGEX, so the
  // failure mode is a leaf that stops parsing, loses its statement, or starts reading as a
  // container. That is one parse over both documents.
  async leavesInTheOtherRfcsStillParse() {
    const { parseClaims } = claimsModule();
    const out = {};
    let leaves = 0;
    let broken = [];
    for (const file of [
      "RFCs/RFC-073-a-document-state-lives-in-the-system.md",
      "RFCs/RFC-074-karaoke.md",
    ]) {
      let src = "";
      try {
        src = read(path.join(REPO, file));
      } catch {
        out[`missing:${file}`] = true;
        continue;
      }
      const lines = src.split("\n");
      const claims = parseClaims(src);
      for (const c of claims) {
        const line = lines[c.line - 1] || "";
        const fence = ((/^\s*(:+)/.exec(line) || [, ""])[1] || "").length;
        if (fence !== 2) continue; // a grown container is not a leaf
        leaves += 1;
        // a leaf must keep its statement, carry no spec by construction, and still be numbered
        if (!c.statement || c.hasSpec || !c.n) broken.push(`${file}#${c.id || c.n}`);
      }
    }
    return {
      bothDocumentsStillParse: !Object.keys(out).length,
      // the number is REPORTED (it moves when he marks or grows a claim); what is asserted is that
      // there are leaves at all and that not one of them is broken
      leavesFound: leaves,
      thereAreStillLeaves: leaves > 0,
      everyLeafKeepsItsStatementAndCarriesNoSpec: broken.length === 0,
      broken,
    };
  },

  // c6, HALF ONE — A PROOF ANNOUNCES NOTHING. Read what this asserts precisely, because the first
  // version of it overreached: the FIRING table governs what a block ANNOUNCES to a document's
  // audience, so the absence of the result blocks from it proves no proof run reaches anybody's
  // feed — it does NOT prove no write happens. The no-write half is asserted where a write would
  // come from: `Window.liveCmdInTheFold.runningAProofWritesNothing` runs a proof to its exit, pass
  // and fail, with a write door in scope and watches the door stay unused. Two halves, two specs,
  // and this comment exists because collapsing them was a non-sequitur a reviewer had to catch.
  async resultBlocksNeverAnnounce() {
    const blocks = require(path.join(AUTOBOT, "electron/markdown/blocks.cjs"));
    const table = blocks.FIRING || blocks.firing || {};
    const kinds = Object.keys(table);
    // FOUR, in the file's own vocabulary — `branch` was missing from this list, which is the kind
    // of omission that makes a spec quietly narrower than the thing it defends.
    const resultBlocks = ["cmd", "run", "test", "branch"];
    return {
      theFiringTableWasFound: kinds.length > 0,
      noResultBlockFires: resultBlocks.every((k) => !kinds.includes(k)),
      // the mark path IS in the table — so the absence above is a decision, not an empty table
      claimStillFires: kinds.includes("claim"),
      firingKinds: kinds,
    };
  },

  // c7 — NOTHING RUNS A PROOF BUT A PRESS. No scheduler, no watcher, no runner in the document
  // machinery: a proof is a button, and a document that re-ran itself would be a document that
  // marks itself.
  async noProofRunner() {
    const dir = path.join(AUTOBOT, "electron/markdown");
    const files = fs.readdirSync(dir).filter((f) => /\.(c?js)$/.test(f));
    // EVERY WAY SOMETHING RE-RUNS ITSELF, not two spellings. The first version looked for
    // `setInterval(` and `fs.watch(` only, so a poll written with setTimeout, a destructured
    // `watch()`, `watchFile` or a file-watching library would all have read as "none".
    const SCHEDULERS = /setInterval\s*\(|setTimeout\s*\(|fs\.watch(?:File)?\s*\(|\bwatch\s*\(|chokidar|cron/;
    const hits = [];
    const scanned = [...files.map((f) => path.join(dir, f)), path.join(AUTOBOT, "electron/apps/documentUpdate.cjs")];
    for (const f of scanned) {
      const src = read(f);
      if (SCHEDULERS.test(src)) hits.push(path.relative(AUTOBOT, f));
    }
    return {
      filesScanned: scanned.length,
      noSchedulerOrWatcher: hits.length === 0,
      hits,
    };
  },

  // c14b — THE COUNT NEVER STOPS THE NUDGING, and this is the claim that went FALSE under a mark
  // nobody was asking about. It is asserted against the real selector now: past the cap the cycle
  // wraps and still nudges, and the ONLY excuse is a declared abandonment WITH a report attached —
  // either half alone is no excuse at all.
  async nudgeNeverGivesUp() {
    const nudge = require(path.join(AUTOBOT, "electron/agents/nudge.cjs"));
    const cfg = { giveUpAfter: 3, cooldownMin: 1, idleMin: 1 };
    // THE RECORD'S REAL SHAPES, and getting them wrong is how a fixture goes vacuously green: the
    // count lives at `nudges.count` (a bare number reads as zero, so every cycle looked like the
    // first), the declaration at `status.text`, and the progress line off `done/total/active`.
    const run = (n, extra = {}) => ({
      id: "r1",
      source: "skill:x",
      done: 1,
      total: 2,
      active: "a",
      nudges: { count: n },
      ...extra,
    });
    const at = (n) => nudge.cycleOf(run(n), cfg);
    const excused = (text, attachments) =>
      nudge.excusedOf(run(9, { status: { text, by: "systemview-test" }, attachments }));
    return {
      firstIsOneOfThree: at(0).nth === 1 && at(0).of === 3 && at(0).finalNotice === false,
      thirdIsTheFinalNotice: at(2).finalNotice === true,
      // the wrap: past the cap it is notice 1 of 3 again, never a stop
      pastTheCapItWraps: at(3).nth === 1 && at(3).finalNotice === false,
      everyCycleReachesAFinalNotice: [2, 5, 8, 11].every((n) => at(n).finalNotice === true),
      // and the text names the exit only there — an ordinary nudge never mentions the report
      ordinaryNudgeNeverMentionsTheExit: !/abandon/i.test(nudge.nudgeText(run(0), cfg)),
      finalNoticeNamesReportAndAbandoned: /report/i.test(nudge.nudgeText(run(2), cfg)) &&
        /abandon/i.test(nudge.nudgeText(run(2), cfg)),
      // THE ONLY EXCUSE, and it takes both halves
      bothHalvesExcuse: excused("abandoned — blocked on his review", [{ kind: "report", ref: "r" }]) === true,
      theWordAloneIsNoExcuse: excused("abandoned — ran out of road", []) === false,
      theReportAloneIsNoExcuse: excused("waiting on a rebase", [{ kind: "report", ref: "r" }]) === false,
      anotherAttachmentIsNoExcuse:
        excused("abandoned — see the branch", [{ kind: "branch", ref: "lane/x" }]) === false,
      // AND THE SELECTOR, not just the label. Everything above is `cycleOf`, which is arithmetic on
      // a count and structurally cannot see a stop — so all ten fields would stay green if somebody
      // put `if (count >= giveUpAfter) return false` back into the candidate filter tomorrow. The
      // claim's replacement law lives in `pickNudge`; this is the field that would go red.
      pickedAgainLongPastTheCap: (() => {
        const settings = nudge.normalizeSettings({ on: true, idleMin: 20, cooldownMin: 30, giveUpAfter: 3 });
        const stale = {
          id: "r9",
          source: "skill:x",
          session: "systemview-test",
          done: 1,
          total: 2,
          active: "a",
          nudges: { count: 9 },
        };
        const got = nudge.pickNudge({ runs: [stale], session: "systemview-test", now: 1793000000000, quietMin: 30, settings });
        return !!got && got.nth === 1 && got.finalNotice === false;
      })(),
      // the one boundary the claim's words do not state: the knob at ZERO is the feature off, and
      // that IS a stop. Said here so "the count never stops the nudging" has its edge written down.
      zeroIsTheFeatureOffNotACap: (() => {
        const off = nudge.normalizeSettings({ on: true, idleMin: 20, cooldownMin: 30, giveUpAfter: 0 });
        return nudge.pickNudge({
          runs: [{ id: "r9", source: "skill:x", session: "s", done: 1, total: 2, nudges: { count: 0 } }],
          session: "s",
          now: 1793000000000,
          quietMin: 30,
          settings: off,
        }) === null;
      })(),
    };
  },

  // c3 — A CONTAINER CLAIM MARKS AND ANNOUNCES EXACTLY LIKE A LEAF. One table entry, one write
  // path: the mark lands on the OPENING line (never in the proof body), and the fire reads the
  // state off that same line. Asserted through the host's own parse → fires → write chain, so a
  // second code path for containers breaks this rather than passing quietly.
  async claimFiresOffItsOpeningLine() {
    const { parse } = require(path.join(AUTOBOT, "electron/markdown/parse.cjs"));
    const { firesOf } = require(path.join(AUTOBOT, "electron/markdown/fires.cjs"));
    const { setAttr } = require(path.join(AUTOBOT, "electron/markdown/write.cjs"));
    const src = (attrs) =>
      doc(
        "::members{who=you|systemview-test}",
        "",
        `:::claim[the statement → what should happen]{${attrs}}`,
        ":::cmd",
        "echo the proof",
        ":::",
        ":::",
      );
    const firesFor = async (attrs) => firesOf(await parse(src(attrs)), src(attrs));
    const met = await firesFor("id=c3 state=met");
    const unmet = await firesFor("id=c3 state=unmet");
    const unmarked = await firesFor("id=c3");
    const covered = await firesFor("id=c3 state=met told=you|systemview-test");
    // the write half: the mark goes on line 3 — the opening line — and the body is untouched
    const written = setAttr(src("id=c3"), 3, { state: "met", by: "you", at: 1793 });
    const lines = String(written || "").split("\n");
    return {
      aMarkedContainerFires: met.length === 1,
      summaryIsTheClaimAndItsState: met.length === 1 && met[0].summary === "c3 met — the statement → what should happen",
      unmetAnnouncesAsNotMet: unmet.length === 1 && /c3 not met —/.test(unmet[0].summary),
      audienceIsTheDocumentsMembers:
        met.length === 1 && met[0].audience.join("|") === "you|systemview-test",
      uncheckedNeverFires: unmarked.length === 0,
      aCoveredBlockIsSilence: covered.length === 0,
      markLandsOnTheOpeningLine: /^:::claim\[.*state=met/.test(lines[2] || ""),
      theProofBodyIsUntouched: lines[3] === ":::cmd" && lines[4] === "echo the proof",
    };
  },

  // c14 — AN IDLE AGENT IS NUDGED BACK TO ITS OPEN RUN, and the message carries the three things
  // that make it actionable: the source, the item left active, and how far the run got. Asserted
  // against the real selector with settings handed in, so no disk and no clock are involved.
  async nudgeSelectsAndNames() {
    const nudge = require(path.join(AUTOBOT, "electron/agents/nudge.cjs"));
    // NORMALIZED, as the selector receives them. A hand-built settings object is missing the knobs
    // the selector reads (`sources` first of all) — and a partial one made this throw rather than
    // answer, which is the honest failure: the contract is "normalized settings", not "an object".
    const settings = nudge.normalizeSettings({ on: true, idleMin: 20, cooldownMin: 30, giveUpAfter: 3 });
    const now = 1793000000000;
    const open = {
      id: "r1",
      source: "skill:rfc-execution",
      session: "systemview-test",
      done: 4,
      total: 6,
      active: "walk the claims",
      items: [{ text: "walk the claims", state: "active" }],
      at: now - 60 * 60 * 1000,
    };
    const pick = (runs, over = {}) =>
      nudge.pickNudge({ runs, session: "systemview-test", now, quietMin: 30, settings, ...over });
    const picked = pick([{ ...open }]);
    const text = picked ? picked.text : "";
    return {
      anOpenRunIsSelected: !!picked,
      itNamesTheSource: /skill:rfc-execution/.test(text),
      itNamesTheItemLeftActive: /walk the claims/.test(text),
      itNamesHowFarTheRunGot: /4\/6/.test(text),
      itSaysItIsNotFromTheHuman: /not the human/i.test(text),
      itCarriesTheMantra: /WORK TO COMPLETION/.test(text),
      aClosedRunIsNeverSelected: pick([{ ...open, done: 6, items: [{ text: "a", state: "done" }], closed: true }]) === null,
      quietBelowTheFloorIsNeverSelected: pick([{ ...open }], { quietMin: 1 }) === null,
      theKnobOffMeansOff: pick([{ ...open }], { settings: { ...settings, on: false } }) === null,
      // THE SECOND HALF OF THE STATEMENT — "the count lives on the run record and MOVEMENT RESETS
      // IT" — which the first version of this spec never touched. Run against a scratch worklists
      // directory: a spec that wrote a probe run into his live store would be a spec that edits
      // what the surface he is reading says.
      ...(() => {
        const os = require("os");
        const scratch = fs.mkdtempSync(path.join(os.tmpdir(), "worklist-spec-"));
        const was = process.env.AUTOBOT_WORKLISTS_DIR;
        const abs = path.join(AUTOBOT, "electron/agents/worklist.cjs");
        try {
          process.env.AUTOBOT_WORKLISTS_DIR = scratch;
          delete require.cache[require.resolve(abs)]; // DIR is read at module load
          const W = require(abs);
          const id = W.newRunId();
          W.writeRun(id, "systemview-test", [{ text: "a", state: "active" }], "skill:spec-probe");
          const owner = `run:${id}`;
          W.markNudged(owner, { ts: 1793000000000 });
          const file = path.join(W.DIR, `run-${id}.json`);
          const afterNudge = JSON.parse(read(file));
          W.write(owner, [{ text: "a", state: "done" }], "skill:spec-probe"); // the movement
          const afterMove = JSON.parse(read(file));
          return {
            theCountLivesOnTheRunRecord: !!(afterNudge.nudges && afterNudge.nudges.count === 1),
            movementResetsTheCount: !afterMove.nudges,
          };
        } catch (err) {
          return { theCountLivesOnTheRunRecord: false, movementResetsTheCount: false, worklistProbeError: String(err.message).slice(0, 160) };
        } finally {
          if (was === undefined) delete process.env.AUTOBOT_WORKLISTS_DIR;
          else process.env.AUTOBOT_WORKLISTS_DIR = was;
          try { delete require.cache[require.resolve(abs)]; } catch {}
          try { fs.rmSync(scratch, { recursive: true, force: true }); } catch {}
        }
      })(),
    };
  },

  // c15 — THE COG'S DOOR. Two halves: the knobs' contract (what the cog writes through — defaults
  // with no file at all, a round-trip that reads back what was written) and the door itself being
  // registered in the shell, so the cog renders knobs instead of "no nudge door yet".
  //
  // The round-trip runs against a SCRATCH file. A spec that read his live `nudge.json` would be a
  // spec that edits the thing it is measuring — and one that wrote to it would change how his own
  // sessions get nudged, from a test.
  async nudgeSettingsDoor() {
    const nudge = require(path.join(AUTOBOT, "electron/agents/nudge.cjs"));
    const scratch = path.join(require("os").tmpdir(), `nudge-spec-${Date.now()}.json`);
    const was = process.env.AUTOBOT_NUDGE_FILE;
    const d = nudge.normalizeSettings({});
    let roundTripped = false;
    let defaultsWithNoFile = false;
    try {
      process.env.AUTOBOT_NUDGE_FILE = scratch;
      defaultsWithNoFile = nudge.readSettings().idleMin === nudge.DEFAULTS.idleMin;
      nudge.writeSettings({ idleMin: 7, cooldownMin: 11, giveUpAfter: 2, on: true });
      const back = nudge.readSettings();
      roundTripped = back.idleMin === 7 && back.cooldownMin === 11 && back.giveUpAfter === 2;
    } finally {
      if (was === undefined) delete process.env.AUTOBOT_NUDGE_FILE;
      else process.env.AUTOBOT_NUDGE_FILE = was;
      try { fs.unlinkSync(scratch); } catch {}
    }
    const host = read(path.join(AUTOBOT, "electron/apps/files-host.cjs"));
    return {
      defaultsNeedNoFile: defaultsWithNoFile,
      everyKnobHasADefault: ["on", "idleMin", "cooldownMin", "giveUpAfter"].every((k) => d[k] !== undefined),
      garbageFallsBackToTheDefault: nudge.normalizeSettings({ idleMin: "soon" }).idleMin === nudge.DEFAULTS.idleMin,
      aRoundTripReadsBackWhatWasWritten: roundTripped,
      // the door the cog writes through — registered in the shell, which is what makes the knobs
      // render at all
      theDoorIsRegistered: /nudge:settings/.test(host),
      // `/nudgePicks|picks/` was near-vacuous — the second alternative matches the word anywhere in
      // a 2,000-line host file. The door answers with the selector's own verb or it does not.
      itAnswersWithThePicks: /nudgePicks\s*\(/.test(host),
    };
  },

  // c9 — RFC-073's load-bearing claims carry their proofs, asserted structurally: every grown
  // container in that document holds a result block in its own fold, so "eight proofs" is a count
  // of real proofs rather than a count of fences.
  async rfc073ProofsStand() {
    const { parseClaims } = claimsModule();
    const src = read(path.join(REPO, "RFCs/RFC-073-a-document-state-lives-in-the-system.md"));
    const lines = src.split("\n");
    const grown = parseClaims(src).filter((c) => /^\s*:{3,}claim\[/.test(lines[c.line - 1]));
    const withBody = grown.filter((c) => {
      const fence = ((/^\s*(:+)/.exec(lines[c.line - 1]) || [, ""])[1] || "").length;
      const close = new RegExp(`^\\s*:{${fence}}\\s*$`);
      for (let j = c.line; j < lines.length; j += 1) {
        if (close.test(lines[j])) return false;
        if (/^\s*:{2,}(cmd|test|run)\b/.test(lines[j])) return true;
      }
      return false;
    });
    // THE EIGHT, BY NAME. Counting grown claims lets the denominator select itself: if somebody
    // un-grew a claim back to a leaf, "every grown claim holds a proof" would still be true of the
    // seven that remained. These are the ids the proofs were written onto, so losing one is a red
    // with the id in it.
    const LOAD_BEARING = ["c17", "c36", "c40", "c41", "c42", "c44", "c45", "c47"];
    const held = LOAD_BEARING.filter((id) => withBody.some((c) => c.id === id));
    return {
      proofsGrown: grown.length,
      everyGrownClaimHoldsAResultBlock: grown.length > 0 && withBody.length === grown.length,
      theEightNamedClaimsEachHoldOne: held.length === LOAD_BEARING.length,
      lostTheirProof: LOAD_BEARING.filter((id) => !held.includes(id)),
      withoutAProof: grown.filter((c) => !withBody.includes(c)).map((c) => c.id || `#${c.n}`),
    };
  },

  // ------------------------------------------------------------------------------------------
  // THE DOCTRINE, ONE SPEC PER CLAIM. This was a single method pointed at by five claims — fifteen
  // assertions of which exactly one bore on c12, so five rows read "spec'd" off a shared green and
  // a red could not say which claim had lost its defence. Split, because a claim's spec has to be
  // addressable BY THAT CLAIM.
  // ------------------------------------------------------------------------------------------

  // c10 — the chapter answers the question an agent actually asks: the SEQUENCE (verify → mark →
  // proof, written for the human) and the APPROACH. Asserted sentence by sentence; the first
  // version tested one heading and the note still claimed "everything a spec can reach".
  async chapterAnswersTheProofQuestion() {
    const chapter = read(path.join(REPO, "docs/how-we-work/rfcs.md"));
    const heading = (text) => new RegExp(`^#{2,3} .*${text}`, "mi").test(chapter);
    return {
      theProofSectionExists: heading("A claim can carry its proof"),
      theApproachSectionExists: heading("Writing a proof — the approach"),
      theSequenceIsSaid: /The sequence is verify → mark → proof/.test(chapter),
      theProofIsForTheHuman: /the proof is written for the human/i.test(chapter),
      theLiveSystemIsTheFixture: /The live system is the fixture/.test(chapter),
      aClaimThatResistsIsAFinding: /A claim that RESISTS a proof is a finding/.test(chapter),
      readableFirst: /Readable-first/.test(chapter),
      // and the chapter is INSIDE the corpus that answers — words on disk that nothing indexes
      // answer nobody, so `context("…")` would come back empty with the section right there
      theCorpusCoversTheChapter: corpusCovers("docs/how-we-work"),
    };
  },

  // c11 — ONE paragraph in rfc-authoring, pointing at the chapter. And the assertion is about
  // rfc-AUTHORING: the first version checked a sentence in rfc-EXECUTION and the note claimed it
  // for this claim, which is a spec defending the wrong file.
  async authoringPointsAtTheChapter() {
    const authoring = skillText("rfc-authoring");
    const chapter = read(path.join(REPO, "docs/how-we-work/rfcs.md"));
    return {
      theSkillWasFound: authoring.length > 0,
      itCarriesTheProofLine: /leave the PROOF/.test(authoring),
      itPointsAtTheChapter: /claims chapter|context\(/.test(authoring),
      // The other half of the claim: the SHAPES and the APPROACH stay out of the skill. Note what
      // this corrected — the claim says "the shapes TABLE lives in the chapter", and the table is
      // actually in RFC-075 §1.4; the chapter carries the shapes in prose. So the assertable thing
      // is the one that matters: the skill does not carry a second copy of either.
      theShapesAreInTheChapterAndNotTheSkill:
        /`:::cmd` holds its exit and log/.test(chapter) && !/holds its exit and log/.test(authoring),
      theApproachIsInTheChapterAndNotTheSkill:
        /The live system is the fixture/.test(chapter) && !/The live system is the fixture/.test(authoring),
    };
  },

  // c12 — the chapter PERMITS a delegated proof, and fixes the brief. The first version asserted
  // the substring "delegated", which matched a HEADING: the whole permission paragraph could be
  // deleted and the spec stayed green. These are the three things the claim actually says.
  async chapterPermitsADelegatedProof() {
    const chapter = read(path.join(REPO, "docs/how-we-work/rfcs.md"));
    return {
      permissionIsStated: /Proof-writing may be delegated; verification may not/.test(chapter),
      theBriefIsTheClaimItsMarkAndItsNote: /briefed with the claim, its mark, its `note=`/.test(chapter),
      neverToolsAlone: /never\s*\n?\s*tools alone/.test(chapter),
      itIsPermissionNotProcedure: /permitted, never required/.test(chapter),
    };
  },

  // c13 — the execution skill exists AND describes the procedure the claim commits to. The first
  // version asserted a file was non-empty and contained two phrases; the claim names five steps,
  // and four of them are literal headings in the skill.
  async executionSkillWalksAnRfc() {
    const execution = skillText("rfc-execution");
    const heading = (text) => new RegExp(`^#{2,3} .*${text}`, "mi").test(execution);
    return {
      theSkillWasFound: execution.length > 0,
      itOpensItsOwnSourcedRun: /source: "skill:rfc-execution"/.test(execution),
      itReadsTheRfcAndChecksTheVerdict: heading("The verdict is the gate"),
      itLandsTheSlicesInOrder: heading("Land the slices, in the RFC's order"),
      itWalksTheClaimsWithMarks: heading("Walk the claims"),
      itClosesWithStatus: heading("Close with STATUS"),
      itCarriesTheLivingSpecDoctrine: /living spec/i.test(execution),
      itAsksForASecondOpinionBeforeStatus: /second opinion/i.test(execution),
    };
  },

  // c20 — the doctrine reaches BOTH readers: the corpus answers an agent who asks, and the skill
  // carries the deciding paragraph — and neither restates the other.
  async doctrineReachesBothReaders() {
    const chapter = read(path.join(REPO, "docs/how-we-work/rfcs.md"));
    const secondOpinion = read(path.join(REPO, "docs/how-we-work/second-opinion.md"));
    const execution = skillText("rfc-execution");
    const heading = (src, text) => new RegExp(`^#{2,3} .*${text}`, "mi").test(src);
    return {
      twoObligations: heading(chapter, "two obligations"),
      whoWritesTheSpec: heading(chapter, "Who writes the living spec"),
      testVersusRun: heading(chapter, "a test is addressable, a run lives only in its fold"),
      theChangeLoopConsequence: /change loop/.test(chapter),
      routesToALiveDoor: heading(chapter, "live door"),
      livingIsSaidOutLoud: /living spec/i.test(chapter),
      // the second reader's half
      executionCarriesTheDecidingParagraph: /a run lives in its document|a test rides the change loop|A RUN ONLY LIVES IN ITS DOCUMENT/i.test(execution),
      // NEITHER RESTATES THE OTHER — the skill carries the decision and the query; the routes stay
      // in the chapter. One definition, or it drifts into two, and a copy pasted into the skill
      // reads perfectly well, which is exactly why this is asserted rather than trusted.
      theSkillPointsRatherThanRestates:
        /context\("where does a living spec live"\)/.test(execution) && !/^#{2,3} .*live door/im.test(execution),
      // and the companion chapter, with the rule that makes a second opinion worth anything
      secondOpinionChapterExists: /blind/i.test(secondOpinion),
      disagreementIsTheProduct: /disagreement is the product/i.test(secondOpinion),
      theCorpusCoversBoth: corpusCovers("docs/how-we-work"),
    };
  },
};
