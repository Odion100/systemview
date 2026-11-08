// THE BOARD DOOR, mounted so a spec can call it.
//
// `api/board.js` exports `boardOn({ readFile, writeFile })` — a factory returning ONE async
// function, which is the whole of the board's published surface. The hub mounts it at
// `api/index.js:2379` with its own file layer and serves it as `Agent.board`; that module is not in
// the project connection tree, so a spec cannot resolve it there. This is the same mount, standing
// in the fixture service where a spec CAN reach it.
//
// IT IS TRANSCRIPTION AND NOTHING ELSE. One method, same argument object, the answer handed back
// exactly as the subject gave it — no defaults, no reshaping, and no opinion about whether the
// answer is good. A red here means the subject is wrong, or this one line is. Test-side logic (the
// board a spec is allowed to scribble on, and clearing it) lives in `Plugin`, never here.
const fs = require("fs");
const path = require("path");

const ROOT = process.cwd();

// The hub's own file layer, transcribed from api/index.js:902 — same signatures, same answers,
// including the refusal a missing folder gives, because `boardOn` reads that error text to tell an
// unknown project from an empty board.
const inside = (rel) => {
  const abs = path.resolve(ROOT, String(rel || ""));
  return abs.startsWith(ROOT) ? abs : null;
};

async function readFile(projectCode, { path: rel } = {}) {
  if (!projectCode) return { ok: false, error: "no folder for this project" };
  const abs = inside(rel);
  if (!abs) return { ok: false, error: "outside the project folder" };
  try {
    return { ok: true, path: rel, content: fs.readFileSync(abs, "utf8") };
  } catch (e) {
    return { ok: false, error: String(e.message || e) };
  }
}

async function writeFile(projectCode, { path: rel, content } = {}) {
  if (!projectCode) return { ok: false, error: "no folder for this project" };
  const abs = inside(rel);
  if (!abs) return { ok: false, error: "outside the project folder" };
  try {
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.writeFileSync(abs, String(content == null ? "" : content));
    return { ok: true, path: rel };
  } catch (e) {
    return { ok: false, error: String(e.message || e) };
  }
}

const door = require("../../../api/board").boardOn({ readFile, writeFile });

module.exports = {
  // One operation, because the subject publishes one. Every read and every write the board has is
  // this call with different arguments, which is exactly why an unrecognised argument mattered
  // enough to spec.
  board(args) {
    return door(args || {});
  },
};
