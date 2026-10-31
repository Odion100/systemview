// WHAT A DRIVE COMMAND POINTS AT — the whole of it, as one pure function, so the one rule that
// matters here can be checked instead of described.
//
// THE RULE: NAVIGATION POINTS AT NOTHING. Pulling a file up, switching a tab, opening stats — the
// view has already changed to the thing, and the bot walking over to stand beside what you are
// now looking at, box drawing around it, is the system narrating its own tab change. He asked for
// it gone twice. The commands that remain are the ones that name something you are NOT already
// staring at: `show` puts a document on the TV across the room, `act` presses something in a pane
// that may be off to the side. `refresh` names a chore, not a thing, so it has never pointed.
//
// The one exception is the agent's own sentence. `say` is the agent talking — the deliberate half
// of this vocabulary, not the ambient half — and the dialogue box is the only place that sentence
// is rendered, so silencing the gesture would silence the agent. A navigation with no `say` is the
// system; a navigation with one is somebody speaking.
export function pointTargetOf({ cmd, args = {}, say } = {}) {
  // The path and the range arrive in SEPARATE fields, so putting them back together is what tells
  // the difference between "point at the file" and "point at these lines in it". Without it a
  // `--file x#L20-30` resolved to the pane and drew a dashed box around the whole centre panel.
  const fileTarget = args.lines
    ? `${args.file}#L${args.lines[0]}-${args.lines[1] || args.lines[0]}`
    : args.file;
  if (cmd === "nav") {
    if (!say) return null;
    if (args.stats) return { region: "reports" };
    if (args.file) return { file: fileTarget };
    if (args.report) return args.lines ? { docLines: args.lines } : { region: "center" };
    if (args.tab) return { region: args.tab };
    if (args.namespace) return { namespace: args.namespace };
    return null;
  }
  if (cmd === "show") return { region: "tv" };
  if (cmd === "act") return { region: args.run ? "center" : "scratchpad" };
  return null;
}

export default pointTargetOf;
