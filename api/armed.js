// IS THE CODE YOU COMMITTED ACTUALLY THE CODE THAT IS RUNNING?
//
// WHY THIS EXISTS. Nothing in this system said which committed work was not live in the running
// processes, and the cost is always the same shape: a fix is written, committed, green in every
// suite, and the door still answers with the old behaviour — so the next hour goes on the code
// rather than on the process. Measured twice. 2026-11-07: two `api/` fixes and five autobot commits
// were all dead at once, and the only thing that said so was `ps`. 2026-11-11: working out that an
// owed shell restart would arm FIVE commits and not seven took reading the electron main's start
// time out of the process table and diffing it against seven commit stamps by hand.
//
// THE COMPARISON IS ONE SUBTRACTION, which is the whole reason this is a read and not a watcher:
// a process has a start time, and git knows when each tracked file last changed. Everything else
// here is about saying what was compared.
//
// IT IS PARAMETERIZED ON `since` ON PURPOSE. A surface that tried to know about every process would
// need to find each one and guess which files it loads; instead the caller brings the start time of
// the process it is asking about. The hub defaults to its OWN start, because that is the single
// process it can speak for without guessing — and the shell, which knows when it started, can ask
// the same question about `electron/`.
//
// WHAT IT IS NOT. Not a prompt to restart anything (his line on the card: "the answer is a line
// somebody can read when a fix looks dead, not a prompt to restart"), and not a claim about what a
// process has LOADED — a long-running node process holds whatever it required at startup, and this
// answers the much cheaper question of whether anything has changed since then. A `src/` change is
// the counter-example worth knowing: the window self-updates, so `src` being "newer" is normal and
// says nothing is wrong.

// A FILE IS IN A GROUP WHEN THE GROUP IS ITS DIRECTORY PREFIX — never a substring. `api` must not
// match `apiary/x.js`, which is what a bare `startsWith` would do and what would make this count
// quietly wrong rather than visibly wrong.
const inGroup = (file, group) => {
  const f = String(file || "");
  const g = String(group || "");
  if (!g) return true; // the whole repo
  return f === g || f.startsWith(g.endsWith("/") ? g : g + "/");
};

/**
 * What is newer than a moment. `commits` is `[{sha, subject, at, files}]` with `at` in ms — the
 * caller has already filtered to commits after `since`, because git does that far better than we
 * can. `groups` is the path prefixes to split by; `[]` means one group for the whole repo.
 * `uncommitted` is the paths `git status` reports, which is the OTHER way work fails to be live.
 *
 * Pure — the hub owns the IO, same split as commitLinks, so this is testable without a server.
 */
function armed({ since = null, groups = [], commits = [], uncommitted = [] } = {}) {
  // NO BASELINE IS A REFUSAL, NOT A ZERO. `since = 0` would make every commit in history "newer"
  // and report a catastrophe in a confident voice — the precise failure mode this whole file is a
  // reaction to. A check with no baseline says so instead of answering.
  const at = Number(since);
  if (!Number.isFinite(at) || at <= 0) {
    return { ok: false, error: "no baseline: `since` must be the ms timestamp a process started" };
  }
  const keys = Array.isArray(groups) && groups.length ? groups.map(String) : [""];
  const cs = (Array.isArray(commits) ? commits : []).filter((c) => c && Number(c.at) > at);
  const us = Array.isArray(uncommitted) ? uncommitted.map(String) : [];

  const out = keys.map((g) => {
    const mine = cs.filter((c) => (Array.isArray(c.files) ? c.files : []).some((f) => inGroup(f, g)));
    return {
      path: g,
      newer: mine.length,
      commits: mine.map((c) => ({ sha: String(c.sha || ""), subject: String(c.subject || ""), at: Number(c.at) })),
      uncommitted: us.filter((f) => inGroup(f, g)),
    };
  });

  return {
    ok: true,
    // THE BASELINE TRAVELS WITH THE ANSWER. A count of "3 newer" means nothing without the moment
    // it is newer THAN, and a door that reports the count alone is the same fault as one that
    // reports clean without saying how far back it looked.
    since: at,
    groups: out,
    // ONE COMMIT TOUCHING TWO GROUPS IS COUNTED IN BOTH, so the per-group numbers add up to more
    // than the commits involved. This total is distinct shas, which is the number a reader means
    // when they ask how far behind a process is.
    newer: new Set(cs.map((c) => String(c.sha))).size,
    uncommitted: us.length,
    // Nothing committed and nothing on disk is newer than the process: what it loaded is what is
    // written down. Says nothing about whether the process is HEALTHY.
    live: cs.length === 0 && us.length === 0,
  };
}

module.exports = { armed, inGroup };
