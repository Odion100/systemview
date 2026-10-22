import {
  spokenForm,
  spokenChunks,
  PAUSE,
  CUT_NOTICE,
  BLOCK_VOICES,
  PROSE,
  EVERYTHING,
  AIMED_AT_YOU,
} from "./spokenForm";

// THE FAILURE EVERY CLAIM HERE IS ABOUT. He asked to be able to press a reply and hear it instead
// of reading it, and the way that feature dies is not a missing voice — it is a voice reading
// "colon colon ask bracket should the corpus point at agents slash or docs slash question mark".
// A block means something; the sentence a person would say in its place is what has to come out.
// So these are not "it renders" claims: each one names a thing that would be unlistenable and
// states what he hears instead.

describe("the blocks speak their intent, never their syntax", () => {
  it("says a question is a question, and says why it matters", () => {
    expect(
      spokenForm('::ask[Should the corpus point at agents/ or docs/?]{why="both touch the same file"}'),
    ).toBe("A question. Should the corpus point at agents/ or docs/? Because both touch the same file.");
  });

  // `::ask` infers its own mark — text ending in "?" is a question, anything else is a thing to do —
  // and the spoken form has to infer the same one, or "restart the shell" arrives as a question he
  // tries to answer.
  it("says an ask that is NOT a question is a thing to do", () => {
    expect(spokenForm("::ask[Restart the shell — the origin fix is cached until then]")).toBe(
      "One thing you need to do. Restart the shell, the origin fix is cached until then.",
    );
  });

  it("offers a commit as something to press, with the message as the message", () => {
    expect(spokenForm('::commit{message="feat(voice): hear a reply"}')).toBe(
      "A commit you can press, with the message: feat(voice): hear a reply.",
    );
  });

  // THE BODY OF A `:::cmd` IS VERBATIM SHELL and it is the least speakable string in the
  // vocabulary. The title is what the command is FOR, and that is the whole announcement.
  it("announces a command by its purpose and never reads the shell", () => {
    const spoken = spokenForm(
      ':::cmd{title="Rebuild the bundle"}\n' +
        "BUILD_PATH=build.next NODE_OPTIONS=--max-old-space-size=4096 ./node_modules/.bin/react-scripts build\n" +
        ":::",
    );
    expect(spoken).toBe("A command you can run, for Rebuild the bundle.");
    expect(spoken).not.toMatch(/max-old-space-size/);
  });

  it("names a file instead of reciting its path", () => {
    expect(spokenForm("::file[src/utils/voice.js]")).toBe("The file voice.js, shown here.");
  });

  it("reads a callout as the thing worth knowing, with its emphasis as plain words", () => {
    expect(spokenForm(":::callout\nPercentiles stay **all-time** under a time range.\n:::")).toBe(
      "Worth knowing. Percentiles stay all-time under a time range.",
    );
  });

  // A container nests by gaining colons, so the thing most likely to leak as punctuation is a
  // thread wrapping something. Four colons, three colons, and not one of them is audible.
  it("speaks what is inside a thread, and none of the colons that hold it", () => {
    const spoken = spokenForm(
      "::::thread{id=extraction}\nA point.\n\n:::callout\nAnd a warning.\n:::\n::::",
    );
    expect(spoken).toBe("In a thread. A point. Worth knowing. And a warning.");
    expect(spoken).not.toMatch(/:/);
  });

  it("attributes a reply in the thread to whoever wrote it", () => {
    expect(spokenForm(":::reply{author=agent ts=2}\nI took the second one.\n:::")).toBe(
      "The agent replied. I took the second one.",
    );
  });

  it("reads a membership list the way a person says a list", () => {
    expect(spokenForm("::members{who=buapi|systemlynx|autobot}")).toBe(
      "On this document: buapi, systemlynx and autobot.",
    );
  });

  // The registry grows. A block nobody has written a sentence for must degrade to its own words,
  // because the alternative is that the feature rots silently every time someone adds one.
  it("falls back to a block's own label when nobody has taught it a sentence", () => {
    expect(spokenForm("::sparkle[the label]{a=1}")).toBe("the label.");
  });

  it("is silent about a block with nothing in it to say", () => {
    expect(spokenForm("::ask[]")).toBe("");
  });
});

describe("what cannot be spoken is announced, not read", () => {
  // The claim is the NEGATIVE one: the code is gone. The size is what he needs — it tells him
  // whether to go and look at the screen.
  it("announces a code fence by language and length instead of reading it", () => {
    const spoken = spokenForm("Look at this:\n\n```js\nconst a = 1;\nconst b = 2;\n```\n\nThat is all.");
    expect(spoken).toBe("Look at this: A JavaScript code block, 2 lines. That is all.");
    expect(spoken).not.toMatch(/const/);
  });

  // A TABLE IS READ NOW, AND IT DID NOT USED TO BE. It was announced and skipped — "a table, three
  // columns and two rows" — on the reasoning that a grid is for eyes. His correction: *"there's no
  // reason we should be skipping over a table instead of reading the table."* The old reasoning
  // survives for the OTHER kind of table, below: four hundred lines of cells read aloud is still
  // the thing this file exists to prevent. The size decides, and the size is announced either way.
  it("reads a small table row by row, each cell under its own column heading", () => {
    const spoken = spokenForm(
      "Results:\n\n| name | lang | local |\n| :--- | :-: | ---: |\n| Samantha | en-US | yes |\n| Albert | en-US | yes |\n\nDone.",
    );
    expect(spoken).toMatch(/A table, 3 columns and 2 rows/);
    expect(spoken).toMatch(/Samantha\. lang: en-US\. local: yes/);
    expect(spoken).toMatch(/Albert\. lang: en-US\. local: yes/);
    expect(spoken.endsWith("Done.")).toBe(true);
  });

  // THE LABEL-COLUMN IDIOM, which is how most tables in this system are actually written: the first
  // heading is deliberately blank because the first cell IS the label. So the first cell is said
  // bare — reading it under the word "blank" would be reading the formatting.
  it("says the first cell bare when its column has no heading", () => {
    expect(
      spokenForm("| | what it is |\n| --- | --- |\n| slice | a landing unit |\n| claim | a statement you check |"),
    ).toBe(
      "A table, 2 columns and 2 rows. slice. what it is: a landing unit. claim. what it is: a statement you check.",
    );
  });

  // AND THE ONE THAT STAYS ANNOUNCED. Past the point where a person could hold it by ear it is a
  // dataset, and the useful thing to say about a dataset is how big it is.
  it("announces a table too large to follow by ear and reads no cells", () => {
    const rows = Array.from({ length: 14 }, (_, k) => `| row${k} | ${k} |`).join("\n");
    const spoken = spokenForm(`| name | n |\n| --- | --- |\n${rows}`);
    expect(spoken).toBe("A table, 2 columns and 14 rows.");
    expect(spoken).not.toMatch(/row0/);
  });

  // Width counts too: five columns is unfollowable however few rows there are.
  it("announces a table that is too wide, however short it is", () => {
    expect(spokenForm("| a | b | c | d | e |\n| - | - | - | - | - |\n| 1 | 2 | 3 | 4 | 5 |")).toBe(
      "A table, 5 columns and 1 row.",
    );
  });

  // INLINE CODE IS PART OF THE SENTENCE. The old rule required `^[\w.$-]+$`, which every term in
  // this system's own vocabulary fails — so a paragraph about blocks came out as "some code, some
  // code, some code" and the subject of each clause was gone. His correction: an inline span is
  // inline, and that is not the same thing as a code block.
  it("reads an inline code span as the word it is, not as 'some code'", () => {
    expect(spokenForm("The `::objective` block carries `state=open` and `{kind, ref, project}`.")).toBe(
      "The objective block carries state equals open and kind, ref, project.",
    );
    // An underscore has no spoken form, so a tool name loses its separators and gains spaces —
    // "mcp worklist attach" is how a person says this out loud, and that is the right answer.
    expect(spokenForm("Call `mcp__worklist__attach` on any list.")).toBe(
      "Call mcp worklist attach on any list.",
    );
    expect(spokenForm("An `attachments[]` field on the run.")).toBe("An attachments field on the run.");
  });

  // AND THE ONE THAT STAYS ANNOUNCED, because the original reasoning holds for an invocation:
  // forty characters of flags read aloud is a minute of noise nobody can act on.
  it("still announces an inline span that is really a shell invocation", () => {
    expect(
      spokenForm("Run `BUILD_PATH=build.next NODE_OPTIONS=--max-old-space-size=4096 react-scripts build` first."),
    ).toBe("Run some code first.");
    expect(spokenForm("Use `yarn test --watchAll=false` here.")).toBe("Use some code here.");
  });

  // A path in backticks was already right and must stay right — the basename is the part a person
  // would say out loud.
  it("keeps saying a path's basename when the span is a path", () => {
    expect(spokenForm("See `src/utils/spokenForm.js` for it.")).toBe("See spokenForm.js for it.");
  });

  // A sentence with a pipe in it is not a table — the separator row is what proves one, the same
  // rule the chat renderer works under.
  it("leaves a sentence that merely contains a pipe as a sentence", () => {
    expect(spokenForm("The attribute is who=a|b, split on the pipe.")).toBe(
      "The attribute is who=a b, split on the pipe.",
    );
  });

  it("turns a URL into the word 'a link' and keeps a link's text", () => {
    expect(spokenForm("See https://developer.mozilla.org/en-US/docs/Web/API and [the spec](https://x.y/z).")).toBe(
      "See a link and the spec.",
    );
  });

  // "s r c slash utils slash voice dot j s" is the sound of this going wrong.
  it("says a path's filename rather than spelling the path", () => {
    expect(spokenForm("I touched src/utils/voice.js and ~/.autobot/presence.md.")).toBe(
      "I touched voice.js and presence.md.",
    );
  });

  // The guard on the path rule, and it cost a real bug: the loose version of the test turned
  // `fix(api/reports):` into "reports):" and would call "and/or" a folder named "or".
  it("does not mistake a slash inside ordinary text for a path", () => {
    expect(spokenForm('::commit{message="fix(api/reports): a dead pointer is not a report"}')).toBe(
      "A commit you can press, with the message: fix(api/reports): a dead pointer is not a report.",
    );
    expect(spokenForm("It is one and/or the other.")).toBe("It is one and/or the other.");
  });

  it("speaks a short identifier in backticks and refuses a shell invocation", () => {
    expect(spokenForm("Run `yarn test`, not `BUILD_PATH=build.next NODE_OPTIONS=--max-old-space-size=4096 build`.")).toBe(
      "Run yarn test, not some code.",
    );
  });

  // The marks, chevrons and status dots the UI speaks with. Some engines spell them out, which is
  // worse than dropping them, and none of them mean anything in the ear.
  it("drops the glyphs the interface talks in", () => {
    expect(spokenForm("✓ done · ⚙ running → next 📺")).toBe("done running next.");
  });
});

describe("prose keeps its shape, because shape is how it is heard", () => {
  // A heading is whitespace on screen. In the ear it has to be a gap, and an ellipsis is the only
  // pause an engine honours that is longer than a full stop — a doubled period reads as one.
  it("gives a heading a pause before it and then says the heading", () => {
    expect(spokenForm("Here is the opening line.\n\n## The finding\n\nIt is local.")).toBe(
      `Here is the opening line. ${PAUSE} The finding. It is local.`,
    );
  });

  it("opens on the heading with no pause, because a recital starting on silence reads as a fault", () => {
    expect(spokenForm("# The finding\n\nIt is local.")).toBe("The finding. It is local.");
  });

  // Run together, a list is one unbroken breath and he cannot hear where a point ends. The bullet
  // is visual; the sentence boundary is its spoken form.
  it("makes every list item a sentence of its own", () => {
    expect(spokenForm("- the first thing\n- the second thing\n1. and an ordered one")).toBe(
      "the first thing. the second thing. and an ordered one.",
    );
  });

  it("says whether a checklist item is done", () => {
    expect(spokenForm("- [x] shipped\n- [ ] not yet")).toBe("Done, shipped. Still to do, not yet.");
  });

  it("keeps bold, italic and strikethrough as the words they wrap", () => {
    expect(spokenForm("It is **really** *quite* ~~bad~~ good.")).toBe("It is really quite bad good.");
  });

  it("collapses the whitespace a paragraph was wrapped with", () => {
    expect(spokenForm("one line\nwrapped   onto\n\n   another")).toBe("one line wrapped onto. another.");
  });

  it("does not staple a second full stop onto a quotation that already ended", () => {
    expect(spokenForm('> He said: *"send whatever words are there."*')).toBe(
      'He said: "send whatever words are there."',
    );
  });
});

describe("the edges that make it stoppable and finite", () => {
  it("an empty reply is silence, not a noise", () => {
    expect(spokenForm("")).toBe("");
    expect(spokenForm("   \n\n  ")).toBe("");
    expect(spokenForm(null)).toBe("");
    expect(spokenForm(undefined)).toBe("");
  });

  it("a reply that is ONLY a block is that block's sentence and nothing else", () => {
    expect(spokenForm("::ask[Which do you want first?]")).toBe("A question. Which do you want first?");
  });

  // A LONG REPLY IS CUT, AND IT SAYS SO. A recital that merely stops is indistinguishable from the
  // engine dying, and he would sit there waiting for the rest of it.
  it("stops a very long reply at a sentence boundary and says that it stopped", () => {
    const long = Array.from(
      { length: 60 },
      (_, i) => `Sentence number ${i} says something reasonably long about the matter at hand.`,
    ).join("\n\n");
    const spoken = spokenForm(long);
    expect(spoken.length).toBeLessThan(long.length);
    expect(spoken.endsWith(CUT_NOTICE)).toBe(true);
    expect(spoken.slice(0, -CUT_NOTICE.length).trim()).toMatch(/hand\.$/);
  });

  it("leaves a reply inside the budget completely alone", () => {
    expect(spokenForm("Short enough.")).toBe("Short enough.");
    expect(spokenForm("Short enough.")).not.toMatch(/as far as I will read/);
  });
});

// Chunking is what makes a stop land immediately: an engine handed one 3,000-character utterance
// cannot be interrupted on a boundary, and several builds stall on very long ones.
describe("spokenChunks — whole sentences, so a stop lands between them", () => {
  it("groups sentences up to the budget and never splits one that fits", () => {
    expect(spokenChunks("One. Two is a bit longer than one.", { maxChars: 60 })).toEqual([
      "One. Two is a bit longer than one.",
    ]);
  });

  it("breaks a single over-long sentence at a word, because a syllable is worse", () => {
    const chunks = spokenChunks(
      "Three is the longest of all of them by a margin that exceeds the budget comfortably.",
      { maxChars: 40 },
    );
    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks.every((c) => c.length <= 40)).toBe(true);
    expect(chunks.join(" ")).toBe(
      "Three is the longest of all of them by a margin that exceeds the budget comfortably.",
    );
  });

  it("has nothing to say about nothing", () => {
    expect(spokenChunks("")).toEqual([]);
    expect(spokenChunks(null)).toEqual([]);
  });
});

// ── CHOOSING WHAT GETS READ ────────────────────────────────────────────────────────────────────
//
// His design, his words: *"I could say read this, read this, read that, read everything."* The
// vocabulary already carries intent — that is what the blocks are FOR — so the selection is over
// the vocabulary rather than over one block somebody judged important.
describe("spokenForm({ only })", () => {
  const reply = [
    "Here is some ordinary prose.",
    "",
    ":::callout",
    "A caveat you should know.",
    ":::",
    "",
    "::ask[Should I land the lanes?]",
    "",
    "::commit[feat(voice): a thing]",
  ].join("\n");

  it("reads the whole reply when nothing is chosen — the press-to-listen path is untouched", () => {
    const all = spokenForm(reply);
    expect(all).toContain("ordinary prose");
    expect(all).toContain("Worth knowing");
    expect(all).toContain("Should I land the lanes");
  });

  it("reads only what was ticked", () => {
    const out = spokenForm(reply, { only: ["ask"] });
    expect(out).toContain("Should I land the lanes");
    expect(out).not.toContain("ordinary prose");
    expect(out).not.toContain("Worth knowing");
    expect(out).not.toContain("commit");
  });

  it("takes several, because one block was never the point", () => {
    const out = spokenForm(reply, { only: ["ask", "callout"] });
    expect(out).toContain("Worth knowing");
    expect(out).toContain("Should I land the lanes");
    expect(out).not.toContain("ordinary prose");
  });

  it("adds the reply's own words only when prose is ticked", () => {
    expect(spokenForm(reply, { only: [PROSE] })).toContain("ordinary prose");
    expect(spokenForm(reply, { only: ["ask"] })).not.toContain("ordinary prose");
  });

  it("EVERYTHING reads the same thing as choosing nothing at all", () => {
    expect(spokenForm(reply, { only: EVERYTHING })).toBe(spokenForm(reply));
  });

  // "Read me nothing" has to be expressible, or the only way to stop it is to turn the feature off.
  it("answers with silence for an empty choice, never with the whole reply", () => {
    expect(spokenForm(reply, { only: [] })).toBe("");
  });

  // THE TRAP THIS DESIGN HAS: a container he never ticked can hold the block he did. Dropping the
  // wrapper would silently swallow the one thing the feature exists to deliver.
  it("finds a chosen block inside a container that was not chosen", () => {
    const nested = ["::::thread{id=t1}", "", ":::callout", "Buried.", ":::", "", "::::"].join("\n");
    const out = spokenForm(nested, { only: ["callout"] });
    expect(out).toContain("Buried");
    expect(out).not.toContain("In a thread");
  });

  it("speaks a chosen container WHOLE, contents and all", () => {
    const nested = ["::::thread{id=t1}", "", "Inside the thread.", "", "::::"].join("\n");
    const out = spokenForm(nested, { only: ["thread"] });
    expect(out).toContain("In a thread");
    expect(out).toContain("Inside the thread");
  });

  it("drops a chosen block's own prose when prose is not ticked but keeps the block", () => {
    const out = spokenForm(reply, { only: ["callout"] });
    expect(out).toContain("Worth knowing");
    expect(out).not.toContain("ordinary prose");
  });
});

describe("BLOCK_VOICES — the list the settings surface offers", () => {
  it("offers nothing it cannot actually speak", () => {
    const silent = BLOCK_VOICES.filter((b) => !b.name || !b.label || !b.says);
    expect(silent).toEqual([]);
  });

  it("has no duplicate names", () => {
    expect(new Set(BLOCK_VOICES.map((b) => b.name)).size).toBe(BLOCK_VOICES.length);
  });

  // The defaults must be a subset of what is offered, or a preset ticks a box that is not there.
  it("defaults to blocks that are actually on the list", () => {
    const offered = new Set(BLOCK_VOICES.map((b) => b.name));
    expect(AIMED_AT_YOU.every((n) => offered.has(n))).toBe(true);
  });

  it("EVERYTHING is prose plus every offered block", () => {
    expect(EVERYTHING).toHaveLength(BLOCK_VOICES.length + 1);
    expect(EVERYTHING).toContain(PROSE);
  });
});

// ── THE LABEL AND THE ATTRIBUTE ARE ONE FIELD ──────────────────────────────────────────────────
//
// He found this by listening to a commit and hearing nothing: *"nothing was said."* Every one of
// these blocks renders from `label || attrs.<x>` — both forms are valid markdown — and the spoken
// forms read only the attribute, so the label form was SILENT. A block that renders and says
// nothing is the worst shape of this bug, because the screen says it worked.
describe("a block speaks whichever form it was written in", () => {
  const both = (a, b) => {
    const x = spokenForm(a);
    const y = spokenForm(b);
    expect(x).toBeTruthy();
    expect(x).toBe(y);
    return x;
  };

  it("commit — the message", () => {
    expect(both('::commit[feat: a thing]', '::commit{message="feat: a thing"}')).toContain("feat: a thing");
  });

  it("branch — the branch name", () => {
    expect(both("::branch[lane/x]", "::branch{name=lane/x}")).toContain("lane/x");
  });

  it("file — the basename", () => {
    expect(both("::file[src/utils/voice.js]", "::file{path=src/utils/voice.js}")).toContain("voice.js");
  });

  it("diff — the file that changed", () => {
    expect(both("::diff[src/utils/voice.js]", "::diff{path=src/utils/voice.js}")).toContain("voice.js");
  });

  it("test — which saved test", () => {
    expect(both("::test[Math.add]", "::test{of=Math.add}")).toContain("Math.add");
  });

  it("report — which report", () => {
    // QUOTED, because an unquoted attribute value stops at whitespace — that is the grammar, not
    // a bug, and an attribute with a space in it kills the directive silently.
    expect(both("::report[the landing order]", '::report{path="the landing order"}')).toContain(
      "the landing order",
    );
  });

  it("image — which image", () => {
    expect(both("::image[shots/a.png]", "::image{of=shots/a.png}")).toContain("a.png");
  });

  // The one that has to stay silent: a commit with no message at all has nothing to say, and
  // announcing "a commit you can press" with no message would be worse than nothing.
  it("says nothing for a commit carrying no message either way", () => {
    expect(spokenForm("::commit[]")).toBe("");
    expect(spokenForm("::commit{}")).toBe("");
  });
});
