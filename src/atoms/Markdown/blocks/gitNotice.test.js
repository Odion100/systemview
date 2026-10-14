// What the commit block SAYS when it cannot show a tree. Every claim here is about honesty: the
// block used to assert two different things it had not read.
import { gitNotice } from "./gitNotice";

describe("gitNotice", () => {
  it("never reports a hub refusal as 'not a git repository'", () => {
    // THE BUG, EXACTLY. This is what the hub returns for a project code it cannot resolve, and the
    // block rendered "not a git repository" about a folder nothing had ever found.
    const n = gitNotice({ repo: false, ok: false, error: "no folder for this project" }, null, "systemview");
    expect(n.kind).toBe("refused");
    expect(n.text).not.toMatch(/not a git repository/);
    expect(n.text).toMatch(/no folder for this project/);
  });

  it("points an unresolvable project code at the registry instead of the hub", () => {
    const n = gitNotice({ repo: false, ok: false, error: "no folder for this project" }, null, "systemview");
    expect(n.text).toMatch(/systemview/);
    expect(n.text).toMatch(/registry, not the hub/);
  });

  it("passes a refusal that is NOT about resolution through in the hub's own words", () => {
    const n = gitNotice({ repo: false, ok: false, error: "git could not spawn (EBADF)" }, null, "bu1");
    expect(n.kind).toBe("refused");
    expect(n.text).toBe("git could not spawn (EBADF)");
    expect(n.text).not.toMatch(/registry/);
  });

  it("still says 'not a git repository' when that is actually what the hub found", () => {
    const n = gitNotice({ repo: false, ok: true }, null, "buapp");
    expect(n.kind).toBe("not-repo");
    expect(n.text).toMatch(/not a git repository/);
  });

  it("keeps what threw instead of flattening every cause to 'the hub didn't answer'", () => {
    const n = gitNotice(null, new Error("no gitState"), "buapp");
    expect(n.kind).toBe("unanswered");
    expect(n.text).toMatch(/no gitState/);
  });

  it("only blames the hub when nothing came back and nothing said why", () => {
    const n = gitNotice(null, null, "buapp");
    expect(n.text).toMatch(/the hub didn't answer/);
  });

  it("says nothing at all when there is a tree to show", () => {
    expect(gitNotice({ repo: true, ok: true, staged: [] }, null, "buapp")).toBeNull();
  });

  it("refuses silently-shaped refusals out loud rather than rendering a confident zero", () => {
    // ok:false with no error at all — the block must not fall through to the file list, which
    // would be an offer to commit an empty tree on a repo it never read.
    const n = gitNotice({ repo: false, ok: false }, null, "");
    expect(n.kind).toBe("refused");
    expect(n.text).toMatch(/said nothing about why/);
  });
});
