import { scriptFor, toBase64, stripAnsi, readTranscript, runCommand, BEGIN_MARK } from "./hostCommand";

const ESC = String.fromCharCode(27);
// What the tty echoes back: the script as written, markers still spliced with `""`, so nothing in it
// can be mistaken for a marker the shell actually printed.
const echoOf = (command) => `${ESC}[32m❯${ESC}[0m ${scriptFor(command)}\r\n`;
const begun = () => `\r\n${BEGIN_MARK}\r\n`;
const ended = (code) => `\r\n__sv_cmd_exit:${code}__\r\n`;

describe("scriptFor", () => {
  it("is ONE line, whatever the command — one prompt, one read", () => {
    expect(scriptFor("a\nb\nc").indexOf("\n")).toBe(-1);
  });

  it("carries the command base64-encoded, decoding back to exactly what was written", () => {
    const cmd = "echo 'it\\'s \"quoted\"' && rm -rf build";
    const b64 = (scriptFor(cmd).match(/printf %s '([A-Za-z0-9+/=]+)'/) || [])[1];
    expect(Buffer.from(b64, "base64").toString("utf8")).toBe(cmd);
  });

  it("survives non-Latin-1 text, which btoa alone would throw on", () => {
    expect(Buffer.from(toBase64("echo — ünïcode"), "base64").toString("utf8")).toBe("echo — ünïcode");
  });
});

describe("stripAnsi", () => {
  it("drops colour, cursor motion and window titles, keeping the words", () => {
    expect(stripAnsi(`${ESC}[1;32mdone${ESC}[0m${ESC}[2K`)).toBe("done");
    expect(stripAnsi(`${ESC}]0;a title${String.fromCharCode(7)}text`)).toBe("text");
  });
});

describe("readTranscript", () => {
  it("says NEVER STARTED while only our own echo has come back", () => {
    expect(readTranscript(echoOf("yarn test"))).toEqual({ started: false, text: "", exit: null });
  });

  it("reads output with no exit code yet as started and still running", () => {
    const state = readTranscript(echoOf("yarn test") + begun() + "Compiling...\r\n");
    expect(state).toEqual({ started: true, text: "Compiling...", exit: null });
  });

  it("reports exit 0 and exit 1 differently, and keeps the output of both", () => {
    const ok = readTranscript(echoOf("x") + begun() + "all good\r\n" + ended(0));
    expect(ok).toEqual({ started: true, text: "all good", exit: 0 });
    const bad = readTranscript(echoOf("x") + begun() + "boom\r\n" + ended(1));
    expect(bad).toEqual({ started: true, text: "boom", exit: 1 });
  });

  it("does not mistake the echoed script's markers for the shell's", () => {
    // The echo contains `__sv_cmd""_exit:%s__`. If that matched, every block would read as exit 0
    // before it had run a thing.
    const state = readTranscript(echoOf("yarn build"));
    expect(state.started).toBe(false);
    expect(state.exit).toBe(null);
  });

  it("filters an echoed script line that lands AFTER the marker", () => {
    const state = readTranscript(begun() + `printf '\\n__sv_cmd'""'_exit:%s__\\n' "$__svx"\r\n` + "real\r\n" + ended(0));
    expect(state.text).toBe("real");
  });

  it("collapses a carriage-return progress line to the last thing it said", () => {
    const state = readTranscript(begun() + "10%\r55%\r100% done\r\n" + ended(0));
    expect(state.text).toBe("100% done");
  });

  it("strips escape codes out of the transcript", () => {
    const state = readTranscript(begun() + `${ESC}[31mFAILED${ESC}[0m\r\n` + ended(2));
    expect(state).toEqual({ started: true, text: "FAILED", exit: 2 });
  });
});

// A fake host implementing the RFC-045 transport contract, so the runner can be driven end to end
// without a pty.
function fakeHost({ openFails = false } = {}) {
  const writes = [];
  const data = [];
  const exits = [];
  const transport = {
    disposed: false,
    onData: (cb) => {
      data.push(cb);
      return () => {};
    },
    onExit: (cb) => {
      exits.push(cb);
      return () => {};
    },
    write: (d) => writes.push(d),
    dispose: () => {
      transport.disposed = true;
    },
  };
  const terminal = {
    open: async () => {
      if (openFails) throw new Error("no shell today");
      return transport;
    },
  };
  return {
    terminal,
    writes,
    emit: (chunk) => data.forEach((cb) => cb(chunk)),
    exit: (info) => exits.forEach((cb) => cb(info)),
    transport,
  };
}

const settle = () => new Promise((r) => setTimeout(r, 0));

describe("runCommand", () => {
  it("writes the script, streams the transcript, and resolves the exit code", async () => {
    const host = fakeHost();
    const seen = [];
    const handle = runCommand({
      terminal: host.terminal,
      projectCode: "systemview",
      command: "yarn test",
      onOutput: (s) => seen.push(s),
    });
    await settle();
    expect(host.writes).toHaveLength(1);
    expect(host.writes[0]).toBe(`${scriptFor("yarn test")}\n`);

    host.emit(echoOf("yarn test"));
    host.emit(begun() + "running\r\n");
    host.emit(ended(1));
    const result = await handle.done;
    expect(result).toEqual({ started: true, code: 1 });
    // The caller saw it as NOT started, then started, before it ever saw a code.
    expect(seen[0].started).toBe(false);
    expect(seen[1]).toEqual({ started: true, text: "running", exit: null });
    expect(host.transport.disposed).toBe(true);
  });

  it("falls back to the shell's own exit code when the command exits the shell itself", async () => {
    // Verified against real zsh and bash: a body ending in `exit 7` never reaches the marker printf,
    // so the marker is absent and the session's exit code is the only truth left.
    const host = fakeHost();
    const handle = runCommand({ terminal: host.terminal, projectCode: "p", command: "exit 7" });
    await settle();
    host.emit(begun() + "on my way out\r\n");
    host.exit({ code: 7 });
    expect(await handle.done).toEqual({ started: true, code: 7, signal: undefined });
  });

  it("calls a shell that died before the marker NEVER RAN, not exit 1", async () => {
    const host = fakeHost();
    const handle = runCommand({ terminal: host.terminal, projectCode: "p", command: "nope" });
    await settle();
    host.exit({ code: 1 });
    const result = await handle.done;
    expect(result.started).toBe(false);
    expect(result.error).toMatch(/before the command ran/);
  });

  it("says so when the host has no terminal at all", async () => {
    const handle = runCommand({ terminal: null, projectCode: "p", command: "yarn test" });
    expect(await handle.done).toEqual({ started: false, error: "this surface has no terminal host" });
  });

  it("reports a host that refuses to open a shell in the host's own words", async () => {
    const host = fakeHost({ openFails: true });
    const handle = runCommand({ terminal: host.terminal, projectCode: "p", command: "yarn test" });
    expect(await handle.done).toEqual({ started: false, error: "no shell today" });
  });

  it("cancel interrupts, then exits the shell", async () => {
    const host = fakeHost();
    const handle = runCommand({ terminal: host.terminal, projectCode: "p", command: "sleep 99" });
    await settle();
    handle.cancel();
    expect(host.writes[1]).toBe(String.fromCharCode(3));
    expect(host.writes[2]).toBe("exit\n");
    // …and the shell exiting is what settles it, not a timer.
    host.exit({ code: 130 });
    expect((await handle.done).started).toBe(false);
  });
});
