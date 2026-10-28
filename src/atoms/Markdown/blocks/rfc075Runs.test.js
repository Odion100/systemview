import fs from "fs";
import path from "path";
import { parseSteps } from "./runSteps";
import { toStep } from "./RunBlock";

// EVERY INLINE :::run IN RFC-075, PARSED — because a dropped assertion reads exactly like a passing
// one, and a step whose namespace cannot be read is a step that silently does not run. RFC-075
// argues that a claim carries a proof the change loop executes; four of its own claims are defended
// by a run block living in the document, and nothing was checking that those blocks are even
// legible. His: *"shouldn't you be checking the runs syntax"*.
//
// This does NOT execute them — they call live doors (the shell, the hub) and a unit suite has
// neither. It checks the half a unit suite CAN own: every step resolves to a namespace, every
// assertion parses into a validation, and every step carries an author's label rather than the call
// signature standing in for one.
const SRC = fs.readFileSync(
  path.join(__dirname, "../../../../RFCs/RFC-075-a-claim-carries-its-proof.md"),
  "utf8"
);
const blocks = [...SRC.matchAll(/^:::run\{title="([^"]*)"\}\n([\s\S]*?)\n:::$/gm)];

describe("RFC-075's own run blocks are legible to the parser", () => {
  it("the document still carries run blocks to check", () => {
    expect(blocks.length).toBeGreaterThanOrEqual(4);
  });

  blocks.forEach(([, title, body]) => {
    describe(`run: ${title.slice(0, 60)}`, () => {
      const parsed = parseSteps(body);

      it("has steps", () => expect(parsed.length).toBeGreaterThan(0));

      parsed.forEach((p, i) => {
        it(`step ${i + 1} (${p.ns}) resolves, asserts something, and carries its own label`, () => {
          const st = toStep(p, { projectCode: "systemview-test" }, null);
          expect(st).not.toBeNull();
          // An assertion the parser could not read used to vanish, which reads as a pass.
          expect(st.dropped).toBe(0);
          expect(st.savedEvaluations.length).toBeGreaterThan(0);
          // The label is the author's sentence, never the call signature filled in for them.
          expect(st.title).toBe(p.title);
          expect(st.title).toBeTruthy();
        });
      });
    });
  });
});
