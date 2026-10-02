// RUNNING ONE COMMAND — over the terminal host seam, because that is where process execution
// already lives and there is nowhere else it could honestly go.
//
// WHY NOT THE HUB. `src/organisms/Terminal/host.js` states the rule this file works under: SystemView
// renders a terminal, it never runs one, and "there is no exec path in this codebase to reach, so
// nothing on the SystemLynx module surface — which every agent in every room can call — can start a
// process." A `Shell.run` verb on the hub would be exactly that exec path, handed to every agent in
// every room, and it would undo the structural half of that guarantee to save one round trip. So a
// `:::cmd` block runs through the SAME pty the terminal pane uses, from the SAME host, and a surface
// with no terminal host cannot run a command at all — it says so instead.
//
// WHAT THAT COSTS, honestly: a pty is one stream. stdout and stderr are interleaved exactly as they
// are in a terminal, and cannot be told apart here. What a pty gives back for that is streaming for
// free, a real tty (so `react-scripts build` prints its progress rather than detecting a pipe), and
// an exit code.
//
// THE SCRIPT. One line, whatever the command, so the shell prints one prompt and performs one read:
//
//   stty -echo …; printf BEGIN; eval "$(… | base64 -d)"; printf EXIT:$?; exit $?
//
// The command rides base64-encoded, which is what makes "one line" possible for a multi-line body
// and removes every quoting question at once. The markers are written with an empty-string splice
// (`'__sv_cmd'""'_begin__'`) so that the tty's ECHO of this line — which arrives before the shell has
// run any of it — cannot be mistaken for the markers the shell actually prints.
import { terminalHost } from "../organisms/Terminal/host";

export const BEGIN_MARK = "__sv_cmd_begin__";
export const EXIT_RE = /__sv_cmd_exit:(-?\d+)__/;
// The echo of our own script carries this, and the real output never can.
const ECHO_TELL = "__sv_cmd'";

// btoa() is Latin-1 only and a command may hold anything — a path with an accent, a message with an
// em dash. Encode the UTF-8 bytes.
export function toBase64(text) {
  const bytes =
    typeof TextEncoder !== "undefined"
      ? new TextEncoder().encode(String(text))
      : Uint8Array.from(unescape(encodeURIComponent(String(text))), (c) => c.charCodeAt(0));
  let bin = "";
  bytes.forEach((b) => {
    bin += String.fromCharCode(b);
  });
  return typeof btoa === "function" ? btoa(bin) : Buffer.from(bytes).toString("base64");
}

// `-d` is what both GNU and current macOS take; `-D` is the older BSD spelling, kept because being
// wrong here fails the whole block rather than one flag.
export function scriptFor(command) {
  const b64 = toBase64(command);
  const decode = `printf %s '${b64}' | base64 -d 2>/dev/null || printf %s '${b64}' | base64 -D`;
  return [
    "stty -echo 2>/dev/null",
    `printf '\\n__sv_cmd'""'_begin__\\n'`,
    `eval "$(${decode})"`,
    `__svx=$?`,
    `printf '\\n__sv_cmd'""'_exit:%s__\\n' "$__svx"`,
    "exit $__svx",
  ].join("; ");
}

// A pty speaks in escape codes; this block is a transcript, not an emulator (the terminal pane is
// the emulator, and its rule is to never touch a byte). Three things, and nothing clever:
//   CSI/OSC sequences out — colour and cursor motion have no meaning in a <pre>
//   \r\n normalised, and a lone \r treated as the overwrite it is, so a progress line that
//     repainted itself two hundred times is ONE line here instead of two hundred
//   the markers, and any echo of our own script, removed
// Built from char codes rather than written as a literal: ESC and BEL inside a regex literal are
// exactly what `no-control-regex` exists to complain about, and a disable comment reads worse.
const ESC = String.fromCharCode(27);
const BEL = String.fromCharCode(7);
const ANSI = new RegExp(
  [
    ESC + "\\][^" + BEL + ESC + "]*(?:" + BEL + "|" + ESC + "\\\\)", // OSC — titles, hyperlinks
    ESC + "\\[[0-9;?]*[ -/]*[@-~]", //                                     CSI — colour, cursor, erase
    ESC + "[@-Z\\\\-_]", //                                              the single-character escapes
  ].join("|"),
  "g",
);

export function stripAnsi(text) {
  return String(text || "").replace(ANSI, "");
}

function collapseCr(line) {
  if (line.indexOf("\r") < 0) return line;
  const parts = line.split("\r");
  return parts[parts.length - 1] || parts[parts.length - 2] || "";
}

// The whole raw buffer in, what the human should read out. Pure, and the only place that knows the
// marker protocol — so a test can assert "ran and failed" reads differently from "never ran".
export function readTranscript(raw) {
  const clean = stripAnsi(raw).replace(/\r\n/g, "\n");
  const at = clean.indexOf(BEGIN_MARK);
  // NOT STARTED is its own state, and it is the one the brief cares about most: a block that never
  // reached the shell must not look like a command that ran and printed nothing.
  if (at < 0) return { started: false, text: "", exit: null };
  let body = clean.slice(at + BEGIN_MARK.length);
  const m = body.match(EXIT_RE);
  const exit = m ? Number(m[1]) : null;
  if (m) body = body.slice(0, m.index);
  const text = body
    .split("\n")
    .filter((l) => l.indexOf(ECHO_TELL) < 0)
    .map(collapseCr)
    .join("\n")
    .replace(/^\n+/, "")
    .replace(/\s+$/, "");
  return { started: true, text, exit };
}

// A build prints a lot and a runaway prints forever. Keep the tail — the end of a transcript is the
// part that says what happened.
const CAP = 400000;

// THE RUNNER. Returns immediately with a handle: `done` settles once, `cancel()` is the human's stop
// button. Nothing here auto-runs and nothing here retries.
export function runCommand({ terminal, projectCode, cwd, command, onOutput }) {
  let raw = "";
  let settled = false;
  let transport = null;
  let offData = null;
  let offExit = null;
  let settle = () => {};
  const done = new Promise((res) => {
    settle = res;
  });

  const finish = (result) => {
    if (settled) return;
    settled = true;
    try {
      offData && offData();
      offExit && offExit();
    } catch {
      /* an unsubscribe that throws must not swallow the result */
    }
    try {
      transport && transport.dispose && transport.dispose();
    } catch {
      /* the session ended on its own — disposing a dead view is not a failure */
    }
    settle(result);
  };

  (async () => {
    if (!terminal || typeof terminal.open !== "function")
      return finish({ started: false, error: "this surface has no terminal host" });
    try {
      // Wide on purpose: at 80 columns a build's output hard-wraps in the pty and no amount of CSS
      // can put it back together.
      transport = await terminal.open({ projectCode, cwd, cols: 200, rows: 50 });
    } catch (e) {
      return finish({ started: false, error: (e && (e.message || String(e))) || "the host refused to open a shell" });
    }
    if (!transport) return finish({ started: false, error: "the host returned no shell" });

    offData = transport.onData((chunk) => {
      raw += chunk;
      // Trimming the head would throw away the BEGIN marker and the block would flip back to
      // "never ran" halfway through a long build — so the marker is re-planted on the tail.
      if (raw.length > CAP) raw = `${BEGIN_MARK}\n… earlier output trimmed …\n${raw.slice(raw.length - CAP)}`;
      const state = readTranscript(raw);
      if (onOutput) onOutput(state);
      // The sentinel is the authority and it arrives before the session teardown does, so the block
      // stops saying "running" the moment the command is actually over.
      if (state.exit !== null) finish({ started: true, code: state.exit });
    });

    if (typeof transport.onExit === "function")
      offExit = transport.onExit((info = {}) => {
        const state = readTranscript(raw);
        // A shell that died before printing the marker never ran the command — say that, rather than
        // reporting its exit code as the command's.
        if (!state.started)
          finish({ started: false, error: `the shell exited (code ${info.code == null ? "?" : info.code}) before the command ran` });
        else finish({ started: true, code: state.exit !== null ? state.exit : info.code, signal: info.signal });
      });

    try {
      transport.write(`${scriptFor(command)}\n`);
    } catch (e) {
      finish({ started: false, error: (e && (e.message || String(e))) || "could not write to the shell" });
    }
  })();

  return {
    done,
    // Ctrl-C first — the command's own chance to stop — and the shell exits on its own once it has.
    // If it doesn't, the host's optional killSession ends the session; disposing alone would only
    // detach the view and leave the process running, which is the contract's explicit warning.
    cancel: () => {
      try {
        transport && transport.write(String.fromCharCode(3));
        transport && transport.write("exit\n");
      } catch {
        /* nothing to interrupt */
      }
      setTimeout(() => {
        if (settled) return;
        try {
          if (terminal && typeof terminal.killSession === "function") terminal.killSession(projectCode);
        } catch {
          /* optional verb */
        }
        finish({ started: readTranscript(raw).started, cancelled: true });
      }, 1500);
    },
  };
}

// RFC-053 — SystemView's implementation of the `shell` capability. A projectCode and a terminal host
// or nothing: absent means this surface genuinely cannot run a command, and the block says so.
export const commandRunner = (projectCode) => {
  const terminal = terminalHost();
  if (!projectCode || !terminal) return null;
  // `cwd` is left to the host on purpose — it resolves a project's root from the hub, and the
  // browser is deliberately not told where projects live.
  return {
    run: ({ command, onOutput }) => runCommand({ terminal, projectCode, command, onOutput }),
  };
};

export default commandRunner;
