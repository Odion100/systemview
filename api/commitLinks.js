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
function audit({ commits = [], documents = [] } = {}) {
  const byId = new Map(documents.map((d) => [String(d.id), d]));
  const docShas = documents.map((d) => ({ doc: d, shas: shasIn(d.text) }));
  const unlinked = [];
  const dangling = [];
  const oneWay = [];

  for (const c of commits) {
    const serves = servesOf(c.message);
    if (!serves.length) {
      unlinked.push({ sha: c.sha, subject: c.subject || "" });
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
  for (const { doc, shas } of docShas) {
    for (const sha of shas) {
      const c = commits.find((x) => sameSha(x.sha, sha));
      if (!c) continue; // not in the window we were handed — absence here is not evidence
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
    crossed,
    agreed: !dangling.length && !oneWay.length && !unclaimed.length && !crossed.length,
  };
}

module.exports = { TRAILER, servesOf, shasIn, sameSha, audit };
