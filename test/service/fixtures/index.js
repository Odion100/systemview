// TEST-SIDE LOGIC — handed to systemview-plugin's `module` option, which `Object.assign`s it onto
// the `Plugin` module every decorated service already publishes (systemview-plugin/SystemViewModule.js:33).
// That is why `Plugin.createMockUsers` exists in other projects: `Plugin` is not a module you declare,
// it is the one you extend. Declaring a second module by that name publishes it and leaves it
// uncallable — the service answers with both and the built client resolves only the plugin's.
//
// A door may not decide whether an answer is good; this is where the judgment a door is forbidden
// may live, one inch away — so each function owes one sentence saying what a red in it is ambiguous
// between.
const fs = require("fs");
const path = require("path");

// THE BOARD A SPEC MAY SCRIBBLE ON. His real board is `.systemview/boards/board.md` and a spec must
// never touch it — so every board case passes `name: "spec"`, which the subject resolves to
// `.systemview/boards/spec.md`, and this clears that file.
//
// A SPEC WITHOUT THIS PASSES EXACTLY ONCE: it adds its own fixtures and then counts them, so the
// second run finds four cards where it asserted two, and no cleanup written later can reach them.
//
// A red here is ambiguous between: the filesystem, or this reset.
const SPEC_BOARD = ".systemview/boards/spec.md";

module.exports = {
  resetSpecBoard() {
    const abs = path.resolve(process.cwd(), SPEC_BOARD);
    const existed = fs.existsSync(abs);
    if (existed) fs.unlinkSync(abs);
    return { ok: true, cleared: existed, board: "spec" };
  },
};
