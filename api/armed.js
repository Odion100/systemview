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

  // A COMMIT WITH NO FILE LIST IS UNKNOWABLE, NOT EMPTY — an empty merge, or `--name-only` output
  // the caller could not read. It belongs to the repo-wide group and to no NAMED one, because
  // "this did not touch api/" is a claim its file list cannot support. That distinction is what
  // lets the scoped verdict below be both narrow and honest.
  const touches = (c, g) => {
    const files = Array.isArray(c.files) ? c.files : [];
    if (!files.length) return g === "";
    return files.some((f) => inGroup(f, g));
  };

  const out = keys.map((g) => {
    const mine = cs.filter((c) => touches(c, g));
    return {
      path: g,
      newer: mine.length,
      commits: mine.map((c) => ({ sha: String(c.sha || ""), subject: String(c.subject || ""), at: Number(c.at) })),
      uncommitted: us.filter((f) => inGroup(f, g)),
    };
  });

  // THE VERDICT IS ABOUT WHAT WAS ASKED ABOUT, AND IT USED TO BE ABOUT THE WHOLE REPO.
  //
  // `newer` and `live` were computed off `cs` — every commit after the baseline — whatever paths
  // the caller named. So asking this door its whole question, "is my api/ fix live?", answered:
  //
  //     groups: api newer 0 · cli newer 0 · testing-utilities newer 0
  //     newer: 3, live: false
  //
  // Every group asked about said zero while the headline said not-live, because three unrelated
  // markdown commits had landed. The true answer was in the array directly above the line a reader
  // actually reads. Measured on the live hub 2026-11-11, the night after this file was written.
  //
  // THE OTHER HALF OF THE RULE CAME FIRST AND STILL HOLDS: a commit the grouping cannot place must
  // not silently become zero, "or the group lines would disagree with the total and the reader
  // would trust the group line". Both are honesty rules and one number was serving them both. So
  // the scoped question gets a scoped answer, and everything the scope excluded is still COUNTED
  // and named — `outside` for what touched none of the asked paths, `unknown` for what could not
  // be placed at all. Narrowing a number without saying what left is the fault this door exists to
  // report, which makes it a poor place to commit it.
  const scoped = cs.filter((c) => keys.some((g) => touches(c, g)));
  const usScoped = us.filter((f) => keys.some((g) => inGroup(f, g)));
  const named = !(keys.length === 1 && keys[0] === "");
  const unknown = named ? cs.filter((c) => !(Array.isArray(c.files) ? c.files : []).length).length : 0;

  return {
    ok: true,
    // THE BASELINE TRAVELS WITH THE ANSWER. A count of "3 newer" means nothing without the moment
    // it is newer THAN, and a door that reports the count alone is the same fault as one that
    // reports clean without saying how far back it looked.
    since: at,
    groups: out,
    // ONE COMMIT TOUCHING TWO GROUPS IS COUNTED IN BOTH, so the per-group numbers add up to more
    // than the commits involved. This total is distinct shas among the paths that were ASKED
    // about, which is the number a reader means when they ask how far behind a process is.
    newer: new Set(scoped.map((c) => String(c.sha))).size,
    uncommitted: usScoped.length,
    // WHAT THE SCOPE LEFT OUT, so no number here can shrink in silence. Absent on an unscoped call
    // because there is no outside, and a zero there would only invite the question of what it
    // could ever be counting.
    ...(named
      ? {
          outside: {
            commits: new Set(cs.filter((c) => !scoped.includes(c)).map((c) => String(c.sha))).size,
            uncommitted: us.length - usScoped.length,
            // COULD NOT BE PLACED EITHER WAY. Counted here rather than hidden, and it is why
            // `live` below is not a plain "nothing in your paths".
            unknown,
          },
        }
      : {}),
    // Nothing committed and nothing on disk is newer than the process WITHIN WHAT WAS ASKED ABOUT:
    // what it loaded is what is written down. An UNPLACEABLE commit blocks this too — it cannot be
    // shown to have missed the named paths, and an unknown must never read as a no. Says nothing
    // about whether the process is HEALTHY.
    live: scoped.length === 0 && usScoped.length === 0 && unknown === 0,
  };
}

module.exports = { armed, inGroup };
