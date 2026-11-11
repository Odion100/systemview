// WHICH COMMIT SERVED WHICH DOCUMENT — both directions, and whether they agree.
//
// WHAT WAS WRONG. Agents commit their own work now, and nothing connected a commit to the thing it
// was for. Measured 2026-11-01 across forty commits: `RFC-072`, `ARC-004` and claim ids appear in
// commit bodies as PROSE — no field, no trailer, nothing a parser could pick up — while the other
// direction, `::commit{sha=}` inside the document, appeared in two files in the whole repo. So the
// record could not answer the first question anybody asks of landed work: which plan was this.
//
// HIS DESIGN, and the reason the trailer carries an ID rather than a path: *"you probably just got
// to point back to the ID that's made with the leaf, just in a way that's parsable so that you can
// work programmatically, backwards and forwards."* A registration id is already globally unique —
// the registry keys rows by id across every project — so `ARC-004-O2` names one thing from any
// repo, and a document that moves keeps its id while every path to it changes.
//
// WHY A GIT TRAILER AND NOT A CONVENTION IN THE SUBJECT. Git parses trailers itself
// (`%(trailers:key=Serves,valueonly)`), they survive rebase and cherry-pick, and they are the one
// place in a commit message that is already agreed to be machine-readable. A subject-line
// convention would have to be re-parsed by every reader with its own regex, which is how one fact
// becomes three spellings.
//
//     Serves: ARC-004-O2        an objective — the work it commissioned
//     Serves: RFC-073           the plan being executed
//     Serves: G-12              the gap being closed
//     Serves: <report id>       the account it belongs to
//
// ONE ID PER LINE; repeat the trailer for work that serves several. The value is the whole line
// because a report's id is its title and carries spaces and commas. One commit serving nothing is not an error
// here — a typo fix serves nothing — but a commit on a lane, or one landing a slice, that serves
// nothing is exactly what the audit below is for.

const TRAILER = "Serves";

// A TRAILER IS THE LAST BLOCK OF THE MESSAGE, and only the last: `Serves:` written in the middle of
// a paragraph is prose that happens to have a colon in it, which is precisely the un-parsable thing
// this replaces. Git's own rule, and worth following exactly rather than approximately — a lenient
// parser would read the example lines in THIS comment out of a commit that quoted them.
const TRAILER_LINE = new RegExp(`^${TRAILER}:[ \\t]*(.+?)[ \\t]*$`, "i");
const ANY_TRAILER = /^[A-Za-z][A-Za-z0-9-]*:[ \t]*\S/;

/**
 * The ids a commit message says it serves, in order, de-duplicated. Reads only the final trailer
 * block — a run of `Key: value` lines at the very end, after a blank line.
 */
function servesOf(message) {
  const lines = String(message == null ? "" : message).replace(/\r/g, "").split("\n");
  while (lines.length && !lines[lines.length - 1].trim()) lines.pop();
  const block = [];
  for (let i = lines.length - 1; i >= 0; i -= 1) {
    const line = lines[i];
    if (!line.trim()) break;
    if (!ANY_TRAILER.test(line)) return []; // a non-trailer line inside it means there is no block
    block.unshift(line);
  }
  const out = [];
  for (const line of block) {
    const m = line.match(TRAILER_LINE);
    if (!m) continue;
    // ONE ID PER LINE, AND NO INLINE LISTS — repeat the trailer for work that serves several.
    // Splitting the value looks friendlier and cannot be done safely: a report's id is its TITLE
    // ("Do the skills match the infrastructure?"), so it carries spaces, and plenty carry commas
    // too. A parser guessing between "a list of two ids" and "one id with a comma in it" is
    // exactly the ambiguity a machine-readable field exists to remove, and it would guess wrong
    // on the kind of document this convention most needs to reach.
    const id = m[1].trim();
    if (id && !out.includes(id)) out.push(id);
  }
  return out;
}

/**
 * The ids a message MEANT to serve with a `Serves:` line that is not in the trailer block.
 *
 * Deliberately narrow: only lines whose whole content is the trailer, so a sentence mentioning the
 * word in prose cannot become a link. `servesOf` stays strict about the block — that is what makes
 * the convention mean something — and this says what a near-miss was trying to say.
 */
function strayServes(message) {
  const inBlock = new Set(servesOf(message));
  const out = [];
  for (const line of String(message == null ? "" : message).replace(/\r/g, "").split("\n")) {
    const m = line.match(TRAILER_LINE);
    if (!m) continue;
    const id = m[1].trim();
    if (id && !inBlock.has(id) && !out.includes(id)) out.push(id);
  }
  return out;
}

/** The shas a DOCUMENT claims, off its `::commit{sha=…}` blocks — the other direction. */
function shasIn(text) {
  const out = [];
  const re = /::+commit\{([^}]*)\}/g;
  let m;
  while ((m = re.exec(String(text || "")))) {
    const sha = (m[1].match(/\bsha=("?)([0-9a-fA-F]{4,40})\1/) || [])[2];
    if (sha && !out.includes(sha)) out.push(sha);
  }
  return out;
}

/** Two shas name the same commit when either is a prefix of the other — git abbreviates. */
const sameSha = (a, b) => {
  const x = String(a || "").toLowerCase();
  const y = String(b || "").toLowerCase();
  if (!x || !y) return false;
  return x.startsWith(y) || y.startsWith(x);
};

/**
 * Do the two directions agree? `commits` is `[{sha, subject, message}]`, `documents` is
 * `[{id, kind, path, text}]` — both injected, so this is pure and the hub owns the IO.
 *
 * Four findings, and each one is a different kind of wrong:
 *   unlinked  — a commit naming nothing. Honest for a typo; a hole for a slice.
 *   dangling  — a commit serving an id no registered document has. A rename, or a guess.
 *   oneWay    — the commit says it served X and X does not carry its sha. The usual case, and the
 *               one that makes a document unable to show what built it.
 *   unclaimed — a document carries a sha whose commit does not point back. Either the commit
 *               predates the convention or somebody pasted the wrong sha.
 *   crossed   — ONE mistake that used to be reported as two: the commit's trailer names document A
 *               while document B carries its sha. Found by using this door on my own night's work,
 *               2026-11-07: three commits in a row named the PREVIOUS sitting's report, because a
 *               trailer is written at COMMIT time and a report's id is decided at the END of a
 *               sitting — so the title already in hand is last sitting's. Each read as an unrelated
 *               `oneWay` plus an unrelated `unclaimed` in two different sections, which is why it
 *               took three repeats to see. A crossed pair is therefore reported once and withheld
 *               from both halves: the count of findings should be the count of mistakes.
 */
// WHICH DOCUMENTS COMMISSION WORK — the question `unclaimed` is really asking.
//
// A `Serves:` trailer answers "what asked for this work". An ARC, an RFC and a GAP all asked for
// something: the commit owes them the line, and a record on one of them with no trailer behind it
// is a genuine hole. AN ACCOUNT ASKED FOR NOTHING. A report is written AFTER the work it accounts
// for, so its commits CANNOT carry `Serves: <report id>` — the id did not exist when they were
// made — while report-authoring requires a `::commit{sha=}` record per commit. Every honest account
// therefore manufactured findings: 17 of them on this repo on 2026-11-11, eight from one report,
// growing every night. A door whose output is mostly noise stops being read, and then it is worth
// less than nothing, because it looks like a check.
//
// THE DEFAULT IS STRICT. An unknown or missing kind is still checked: noise is visible and silence
// is not, so a new document kind must not quietly lose its teeth by not being listed here.
const COMMISSIONS = (kind) => !["report"].includes(String(kind || "").toLowerCase());

function audit({ commits = [], documents = [] } = {}) {
  const byId = new Map(documents.map((d) => [String(d.id), d]));
  const docShas = documents.map((d) => ({ doc: d, shas: shasIn(d.text) }));
  const unlinked = [];
  const dangling = [];
  const oneWay = [];
  // A `Serves:` LINE THAT IS NOT IN THE TRAILER BLOCK, which this door used to answer about
  // wrongly in both directions. Measured 2026-11-07: a commit put its trailer on the line after
  // the subject (character 82 of 1343), so `servesOf` — which reads the block at the END, and must,
  // or a prose mention of "Serves:" would become a link — saw nothing. The commit then read as
  // UNLINKED and the document carrying its sha read as UNCLAIMED with "that commit does not serve
  // it", which is a sentence the message plainly contradicts. A reader following that advice edits
  // a document that was already right.
  //
  // So the intent is reported instead of being guessed at or denied: the id it MEANT to serve, and
  // the one move that fixes it. Both false halves are withdrawn below, the same way a cross is —
  // one mistake, one finding.
  const misplaced = [];

  for (const c of commits) {
    const serves = servesOf(c.message);
    if (!serves.length) {
      const stray = strayServes(c.message);
      if (stray.length) misplaced.push({ sha: c.sha, subject: c.subject || "", ids: stray });
      else unlinked.push({ sha: c.sha, subject: c.subject || "" });
      continue;
    }
    for (const id of serves) {
      const doc = byId.get(id);
      if (!doc) {
        dangling.push({ sha: c.sha, subject: c.subject || "", id });
        continue;
      }
      const claimed = (docShas.find((d) => d.doc === doc) || { shas: [] }).shas;
      if (!claimed.some((s) => sameSha(s, c.sha))) {
        oneWay.push({ sha: c.sha, subject: c.subject || "", id, path: doc.path || "" });
      }
    }
  }

  const unclaimed = [];
  // NOT A FINDING, AND NOT DROPPED EITHER. Records carried by a document that commissioned nothing
  // are counted and named here, so the door can say what it did not check instead of going quiet
  // about it — the same rule the window facts answer to. A check that narrows itself in silence is
  // the thing it was built to catch.
  const noted = [];
  for (const { doc, shas } of docShas) {
    for (const sha of shas) {
      const c = commits.find((x) => sameSha(x.sha, sha));
      if (!c) continue; // not in the window we were handed — absence here is not evidence
      if (!COMMISSIONS(doc.kind)) {
        // Still only counted when the commit is in the window, so this number means the same thing
        // the findings do: records this run could actually see.
        noted.push({ sha, id: doc.id, path: doc.path || "", kind: String(doc.kind || "") });
        continue;
      }
      // A MISPLACED TRAILER IS NOT A MISSING ONE. If the commit meant to serve this document and
      // put the line in the wrong place, that is reported once as `misplaced`; saying "does not
      // serve it" here as well would be the second false half of one mistake.
      if (strayServes(c.message).includes(String(doc.id))) continue;
      if (!servesOf(c.message).includes(String(doc.id))) {
        unclaimed.push({ sha, id: doc.id, path: doc.path || "" });
      }
    }
  }

  // THE CROSS. A commit serving A whose sha is carried by B is not two problems — it is one wrong
  // label, and naming it as one is what makes it recognisable. Both halves are withdrawn so nothing
  // is counted twice; `says` is what the trailer claims and `carriedBy` is the document that
  // actually accounts for the work, which is the pair a reader needs side by side.
  const crossed = [];
  for (const o of [...oneWay]) {
    // A MULTI-SERVE IS NOT A CROSS, and the claim for that case is what caught this: one commit may
    // legitimately serve two documents, and when only one of them carries the record the finding is
    // a plain `oneWay` on the other — the trailer is right and a record is missing. So the document
    // holding the sha only makes this a cross when the commit does NOT also name it.
    const c = commits.find((x) => sameSha(x.sha, o.sha));
    const mine = c ? servesOf(c.message).map(String) : [];
    const other = docShas.find(
      ({ doc, shas }) => String(doc.id) !== o.id && !mine.includes(String(doc.id)) && shas.some((x) => sameSha(x, o.sha)),
    );
    if (!other) continue;
    crossed.push({
      sha: o.sha,
      subject: o.subject,
      says: o.id,
      carriedBy: String(other.doc.id),
      path: other.doc.path || "",
    });
    oneWay.splice(oneWay.indexOf(o), 1);
    const half = unclaimed.findIndex((u) => sameSha(u.sha, o.sha) && u.id === String(other.doc.id));
    if (half > -1) unclaimed.splice(half, 1);
  }

  return {
    checked: commits.length,
    documents: documents.length,
    linked: commits.length - unlinked.length,
    unlinked,
    dangling,
    oneWay,
    unclaimed,
    noted,
    misplaced,
    crossed,
    agreed: !dangling.length && !oneWay.length && !unclaimed.length && !crossed.length && !misplaced.length,
  };
}

// WHAT THE WINDOW WAS, AND WHETHER ANYTHING LIES BEHIND IT.
//
// `audit` is honest about what it was HANDED; it cannot be honest about what it was not. The
// commits arrive from `git log --max-count=N`, and a completeness check whose default is a window
// is a check that reports clean by not looking — its most dangerous output is "the two directions
// agree", produced by stopping early.
//
// THE ONE INFERENCE, and it is the whole mechanism: `git log --max-count=N` answers FEWER than N
// records when it runs out of history. So `read < window` means the window reached the beginning
// of the repository and the answer is about EVERYTHING; `read === window` means there are older
// commits this run never saw, and any "clean" has to be said about the window rather than about
// the project.
//
// `oldest` is the floor the reader can quote — the last commit this run could see — so "raise the
// window" is a concrete instruction rather than a shrug.
function windowFacts({ requested, commits = [], max = 2000, fallback = 200 } = {}) {
  const window = Math.min(Math.max(Number(requested) || fallback, 1), max);
  const read = commits.length;
  const exhausted = read < window;
  const last = read ? commits[read - 1] : null;
  return {
    window,
    read,
    exhausted,
    // A WINDOW THAT IS ALREADY THE CAP CANNOT BE RAISED, and saying "raise it" there would be
    // advice that cannot be taken. The reader is told to narrow the question instead.
    atCap: !exhausted && window >= max,
    oldest: last ? { sha: String(last.sha || ""), subject: String(last.subject || "") } : null,
  };
}

module.exports = { TRAILER, servesOf, strayServes, shasIn, sameSha, audit, windowFacts };
