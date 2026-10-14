// WHAT THE COMMIT BLOCK SAYS WHEN IT CANNOT SHOW A TREE — one pure decision, extracted so it can be
// claimed in tests without standing a component up.
//
// IT EXISTS BECAUSE THE BLOCK USED TO TESTIFY. Two separate failures, both of them a surface
// asserting something it had not read:
//
//   1. `gitState` RETURNS a refusal — `{ repo: false, ok: false, error: "no folder for this
//      project" }` is what the hub answers for a project code it cannot resolve. The block read
//      `state.repo` and never `state.ok`, so that rendered as **"not a git repository"**: a
//      confident, false claim about a folder nothing had ever found. Odion hit it on 2026-10-13
//      with `project="systemview"` (the real code is `systemview-test`) and we both went looking at
//      the hub, because the screen said the folder was not a repo.
//   2. The catch DISCARDED the thrown error and printed "the hub didn't answer" for every cause.
//      The hub had answered. It said it had no folder for that project.
//
// So: a refusal carries the hub's own words, an unresolvable code names itself as the likely cause,
// a genuine non-repo still says so, and only a real absence of an answer blames the hub.
export function gitNotice(state, caught, projectCode) {
  const where = projectCode ? ` for "${projectCode}"` : "";

  // THE HUB ANSWERED AND SAID NO. Its sentence beats anything written here, because it is the only
  // one that knows which of the refusals happened.
  if (state && state.ok === false) {
    const said = String((state && state.error) || "").trim();
    const unresolved = /no folder|not known|unknown project/i.test(said);
    return {
      kind: "refused",
      text: said
        ? unresolved
          ? `${said}${where} — check the project code against the registry, not the hub`
          : said
        : `git refused${where}, and said nothing about why`,
    };
  }

  // NOTHING CAME BACK AT ALL. Only here is blaming the hub honest — and the thrown message is kept,
  // because "no gitState" and a dropped socket are different problems with the same old wording.
  if (!state) {
    const why = String((caught && caught.message) || caught || "").trim();
    return {
      kind: "unanswered",
      text: why
        ? `couldn't read git${where} — ${why}`
        : `couldn't read git${where} — the hub didn't answer`,
    };
  }

  // The hub answered, successfully, and the folder genuinely is not a repository. The one case where
  // the old sentence was true.
  if (!state.repo) return { kind: "not-repo", text: `not a git repository${where}` };

  return null; // there is a tree to show
}
