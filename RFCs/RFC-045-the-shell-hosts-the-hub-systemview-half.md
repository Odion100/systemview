# RFC-045 — The shell hosts the hub: SystemView's half

**Status**: co-drafted 2026-08-20 with autobot, not started. The full plan is autobot's
`RFCs/RFC-001-the-shell-hosts-the-hub.md` (three lanes: SystemView as a shell-owned local app, the
terminal under each codebase, and hosting agent sessions). This file is SystemView's half of it,
kept here so the two repos cannot drift.

**Packaging, settled between us**: no fork, no special build. `systemview` stays the app + CLI every
repo installs — Electron never enters it, or ~100MB lands in every CI run. `systemview-plugin`
unchanged. The Electron main process, preload and pty host live in **autobot's shell**, because that
shell already exists and Odion's product is the browser with SystemView built in, not a
SystemView-branded wrapper; a package gets extracted only if a second consumer appears. The piece
that stays in SystemView either way is the `<Terminal>` component and the transport contract below —
that is the part that must never be forked.

**Supersedes the open half of** `RFC-043-a-real-terminal.md`: the renderer decision (xterm.js) and
the substrate (`screen`, with its three hard-won details) both survive; what changes is WHO runs the
process. RFC-043 had the hub exec on Express routes because the SystemLynx module surface is
callable by every agent in every room. In a host-owned pty that problem does not exist, so the rule
holds by construction instead of by discipline.

---

### A. The `<Terminal>` transport contract

The host owns the process; SystemView owns the pixels. The whole seam:

```js
// window.systemview.terminal — injected by the host's preload, absent in a plain browser
open({ projectCode, cwd, cols, rows }) -> Promise<Transport>

Transport = {
  onData(cb)            // cb(chunk: string) — RAW bytes through, escape codes included.
                        // Returns an unsubscribe function.
  onExit(cb)            // cb({ code, signal }) — a shell exiting is normal, not an error.
  write(data)           // keystrokes and pastes, exactly as typed
  resize(cols, rows)    // the component measures; the host follows
  history()             // optional -> Promise<string>: scrollback for a re-mounted pane
  dispose()             // detach this view. NOT "kill the session" — see lifetime below
}
```

Five rules, each one a thing that broke before:

1. **Bytes, not lines.** The transport never strips, parses, trims or appends. RFC-042 died of a
   stripping layer, and any "helpful" normalisation in the transport recreates it one level down.
2. **The component measures, the host follows.** xterm+fit knows the real cols/rows; a host that
   sizes the pty from window geometry will always be one repaint behind. Resize is one-way.
3. **The session outlives the view.** Identity is the host's, keyed by `(projectCode, sessionId)`.
   `dispose()` detaches a view; closing a tab, folding the card or navigating away must not kill a
   running build. Re-mounting calls `open()` with the same key and repaints from `history()`.
4. **Absent host is a rendered fact.** No `window.systemview.terminal` → the section renders
   "no terminal host here" and nothing else. It never half-works, and it never renders a fake input.
5. **SystemView never carries an exec path.** The component receives a transport, never a command,
   a shell name or a path to run. Whatever agents can reach through the SystemLynx module surface
   still cannot start a process — the rule holds by construction rather than by discipline.

## Status — SystemView's half of lane 2 is BUILT (2026-08-20)

`src/organisms/Terminal/host.js` (the seam), `src/organisms/Terminal/Terminal.js` (xterm against the
transport), `src/organisms/CodebaseNav/TerminalSection.js` (the fold in the card, last section).
Lazy-imported, so the ~250KB is paid by whoever opens a terminal and by nobody else.

**One clarification the build settled: the HOST resolves `cwd`.** The component passes
`{ projectCode, cols, rows }` and leaves `cwd` null — the browser is deliberately not told any
project's absolute root (`getProjects` does not carry it), and the host can ask the hub. `cwd` stays
in the contract as optional for a host that wants to be told.

**Proven against a fake host** implementing the contract exactly: xterm mounts; `open()` receives the
component's measured cols/rows; `history()` repaints scrollback; keystrokes go straight through with
no input line anywhere; output repaints; **colour and escape sequences survive** — the exact thing
RFC-042's strip destroyed; a viewport change reports new cols/rows; unmount calls `dispose()` once and
re-mounting repaints from `history()` — the session is never killed by a fold. With no host injected,
the section renders "no terminal host here — a shell runs in the desktop app" and mounts no emulator.

### E. Dictation, when a host offers it (added 2026-08-20)

The Web Speech API is a *Chrome service*, not a Chromium feature: inside Electron
`webkitSpeechRecognition` constructs and never produces a result, so every `supported` check in this
app is a false positive there and the mic reads as broken rather than absent. The host takes the half
it can do — the page records with plain `getUserMedia`/`MediaRecorder`, the host transcribes:

```js
window.systemview.dictation.transcribe(bytes /* Uint8Array */, mimeType) -> { text }
```

**Host-first wherever a mic exists** — all three of SystemView's recorders (the chat mic, the board's
recorder, and the `useDictation` hook every other input uses) check for the host before touching SR,
so no surface is left on the broken path. `utils/hostDictation.js` is the single implementation.

**Pause-commits — the shape he actually wanted (2026-08-21).** Drafts alone were not it: *"it used to
populate the input as I spoke… for those slight pauses, it would populate the input and the send
button would be ready"*, and *"I can't even use the recorder when the chat is closed anymore"* — the
closed-bot recorder shows words but its send button reads `input`, which stayed empty until you
pressed stop. So a recording is no longer one take that pays out at the end; it is a run of SEGMENTS
split on the pauses you already make when you talk. An analyser on the same stream watches RMS;
700ms of quiet after speech stops the recorder, transcribes that segment at full quality, commits it
through `onSegment` (straight into the input), and starts a fresh recorder on the same stream — the
mic light never blinks. Drafts paint between pauses and clear the moment a segment lands.

`flush()` is what makes SEND work mid-sentence: it forces the in-progress segment to commit and hands
the text back, so pressing send mid-breath cannot silently drop your last few words. Both send buttons
are enabled while the mic is live for the same reason — an `input`-only check greys them out exactly
when you have something to say.

Measured with a synthetic mic (a tone speaking 1.5s, quiet 1.2s, repeating — Chromium's fake device is
a *continuous* beep and cannot test a pause): segments committed at 2.3s / 5.3s / 8.3s / 11.4s, the
input accumulating "sentence1 sentence2 sentence3 sentence4" while recording continued, drafts
painting between them.

**The trade, and how it was closed the same evening.** A recorder has nothing to show until it stops,
so the first version had no interim words — and that was the one thing he missed immediately: *"the
previous one used to show my text as I talk."* The host added a fast draft pass
(`transcribe(bytes, mime, { draft: true })`), so the recorder now takes a 1s timeslice and
re-transcribes the WHOLE buffer every 1.2s, painting the same interim line speech recognition used to
stream into. Three rules that keep it honest: only ONE draft in flight at a time (ticks outrun the
model on a long buffer, and an out-of-order draft reads as the text going backwards while you talk);
a draft REPLACES the interim line rather than appending, because each one is the whole buffer; and
what gets committed is always the final clean pass on stop, never a draft someone happened to see.
`cancel()` exists so a changed mind costs neither a round trip nor a bill.

Verified with a deliberately SLOW fake model (2s per draft against a 1.2s tick): four drafts over a
nine-second recording with **zero overlapping calls**, the buffer growing 2.7KB → 42KB as expected of
whole-buffer passes, the interim line moving "listening…" → draft → draft, one final call with no
draft flag, and no draft text left behind afterwards.

Verified against a fake host with Chromium's fake audio device: 8.9KB of real `audio/webm;codecs=opus`
handed over as a `Uint8Array` with its mime type, transcript landed in the chat input and in the
board's note box — with `webkitSpeechRecognition` present on the page, i.e. the host won exactly where
the false positive lives.

### B. Port: 3000 now, `SYSTEMVIEW_URL` as its own small RFC

`cli/index.js` sets `const UI_URL = "http://localhost:3000"` as a module constant. Every verb except
`start`/`shutdown` (which take a port argument) resolves against it, in every repo, plus every
generated skill and every doc that tells an agent what to type.

So the migration, when he wants it, is: read `process.env.SYSTEMVIEW_URL` (falling back to the
constant) plus a `--url` flag; make the plugin's connect URL read the same variable; publish; let
projects pick it up. Until that ships, a shell on a private port produces a working window and an
ecosystem that cannot see it. **Own 3000.**

### C. Presence: assert it, but let it expire

Today presence is *derived from the transport* — a held poll IS the fact, so it cannot lie and it
cannot leak: kill the agent and the hold dies with it. A supervisor asserting presence gives that up,
so it has to be replaced deliberately rather than by a boolean.

- **Heartbeat with a TTL, never a flag.** `chatPresent(pc, { as, ttlMs })` called every `ttlMs/2`.
  The hub computes the roster from *whichever arrived most recently* — a hold or a heartbeat — and
  a supervisor that dies takes its agents off the ring by expiry, exactly like an abandoned hold.
  No "present: true" that outlives the process that set it.
- **Hosted and unhosted must be indistinguishable in the room.** Same roster, same ring, same
  visitor badge. If the UI can tell, someone will start treating one kind as second-class.
- **Two different facts, already two states.** "In the room" (ring) and "working" (the cooking
  status line) exist; a supervised session should drive both — present continuously, busy while a
  turn runs. That is the part that reads as "as good as the existing harnesses".
- **Evidence, not theory:** my own ring says *"hears you at its next turn"* rather than "agent is
  in", because my hold is `join --once` and dies the instant it fires. Odion read that today as "you
  are not connected properly", and he was reading it correctly. A supervised session is the only
  thing that makes that ring honest.

### D. `shutdown()` — attribution beats a lock

`shutdown = () => process.exit(0)` sits on the agent-callable module surface. Anyone in any room can
stop the hub, and today it happens silently — the hub is simply gone and nothing says why.

My position: **keep the verb, name the caller.** It is the only way to restart a wedged hub from
outside, several agents' scripts use it, and taking it away buys less than it costs. What is missing
is a record: the hub should write a system line into the room naming who called it before it exits,
so a hub that dies has a name attached instead of being a mystery. The shell should still stop its
own child with SIGTERM, because that is a lifecycle it owns rather than a request it makes.

The stricter option — gate it behind a setting, or refuse it from anything but loopback — is a
change to what every agent is allowed to do, so it is **his call, not ours**: see open question 5.

