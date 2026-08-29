import React, { useState, useRef, useLayoutEffect } from "react";
import { visStyle } from "./visitorColor";
import "./styles.scss";

// RFC-046 — THE FEED ITSELF, with no chrome around it, because it has to sit in two places: the
// agent's CHAT (where he actually talks to us, and where the silence between messages is the thing
// he complained about) and a standalone pane. His correction, when I built the pane first:
// *"there's a new agent in a section in a navigation, and that's not what I meant by anything I
// said"* — he said he does not see the agents work IN THE CONVERSATIONS. So this component owns the
// rows and nothing else; whoever mounts it owns the header, the input and the arrangement.
export const CLASSNAME = "agent-wb";

// DO NOT BUILD A RUNNING COST METER ON THIS NUMBER. Measured on the wire by autobot over a live
// 3-turn session (2026-08-24): `total_cost_usd` on subscription hosting was 0 on turn one and then
// FROZEN at 0.000941 across turns two and three — neither per-turn nor cleanly cumulative, it simply
// stops moving. So this is a per-turn footnote on a receipt that already says what it is, and that
// is the only weight it can carry; a header meter reading "$" beside the context bar would be the
// fourth meter lie of the same day. `num_turns` beside it WAS measured trustworthy — 1 on every
// result, per-turn, not cumulative — which is what makes "only the receipt pays" (feedRows) a
// structural discriminator rather than a lucky one. Anyone wanting real money: re-measure on a
// Console/API-key session first, and say on the face of it which one you measured.
const money = (n) => (typeof n === "number" && n > 0 ? `$${n < 0.01 ? n.toFixed(4) : n.toFixed(2)}` : "");

// WHEN, next to every turn — his ask: *"I need to see a timestamp next to the chats."* Today's
// messages carry just the clock; older ones say the day too, because a resumed conversation
// replays yesterday and "3:41 PM" alone would lie about which yesterday.
export const timeOf = (ts) => {
  if (!ts) return "";
  const d = new Date(ts);
  if (isNaN(d.getTime())) return "";
  const hm = d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  return d.toDateString() === new Date().toDateString() ? hm : `${d.getMonth() + 1}/${d.getDate()} ${hm}`;
};
const When = ({ ts }) => (ts ? <span className={`${CLASSNAME}__ts`}>{timeOf(ts)}</span> : null);

// A COMMAND FOLDS AWAY BY DEFAULT. I opened them first — he asked for that — and then saw it and
// said the opposite: *"my bad, don't make the commands open by default, way better closed in this
// scenario."* He is right, and it is obvious once you look: a chat is a conversation with receipts
// in it, and a receipt that unrolls itself buries the sentence it belongs to.
//
// AND CLOSING IS THE SAME CONTROL THAT OPENED IT — *"why the fuck would you make them not
// closeable?"* My fold sign only appeared on hover, so it read as expand-only. The whole header is
// the toggle now, and the sign is always visible, because a control you cannot see is a control
// that is not there.


const Block = ({ kind, children }) => (
  <pre className={`${CLASSNAME}__blk ${CLASSNAME}__blk--${kind}`}>{children}</pre>
);

// A MESSAGE TO ANOTHER AGENT READS LIKE A MESSAGE — his rule: inter-agent traffic must be
// followable in the chat after the fact, whatever mechanism carried it. Who it went to on the
// header line, the words themselves on screen below it — never folded behind a click, because
// "follow the conversation" means reading it, not excavating it. The reply comes back as a named
// visitor row, so the two directions read as one thread.
const SentRow = ({ row }) => (
  <div className={`${CLASSNAME}__row ${CLASSNAME}__row--tool ${CLASSNAME}__row--sent ${CLASSNAME}__row--${row.state}`}>
    <When ts={row.ts} />
    <div className={`${CLASSNAME}__tool-head`}>
      <span className={`${CLASSNAME}__dot ${CLASSNAME}__dot--${row.state}`} />
      <span className={`${CLASSNAME}__tool-sum`}>
        <span className={`${CLASSNAME}__sent-kind`}>message</span>
        <span className={`${CLASSNAME}__sent-to`}>→ {row.xsend.to}</span>
        {row.xsend.about && <span className={`${CLASSNAME}__sent-about`}>{row.xsend.about}</span>}
      </span>
    </div>
    {/* THE SAME MEASURED FOLD HIS OWN LONG MESSAGES GET — his catch, the day this row shipped:
        a long briefing to another agent is a wall exactly like "my long ass chat", and it was
        bypassing the clamp. Short messages stay exactly as they are; only a body that genuinely
        runs past the line grows a See more. */}
    {row.xsend.msg && (
      <div className={`${CLASSNAME}__sent-body`}>
        <Said row={{ text: row.xsend.msg }} clamp />
      </div>
    )}
  </div>
);

const ToolRow = ({ row, renderText = null }) => {
  const [open, setOpen] = useState(false);
  // THE FILE IS IN THE ROW. His ask, verbatim: the rows that show what an agent ran carry buttons
  // that POINT at things — open, diff — when expanding the row should SHOW them, embedded, the
  // same blocks the chat already renders. So an opened row draws the file it read (at the lines
  // it read), or the diff of what it wrote, right here. The button and the fold stay exactly as
  // they were — this is added under them, not instead of them.
  const embed =
    renderText && row.rel
      ? row.wrote
        ? `::diff[${row.rel}]`
        : `::file[${row.rel}${row.span ? `#L${row.span}` : ""}]`
      : null;
  // THE DOOR CARRIES THE ADDRESS. This dispatched `{ path }` alone — an ABSOLUTE path with no
  // project behind it — and the code pane, which is addressed by project + repo path, opened
  // nothing. His report: *"I clicked on diff and that shit didn't bring up the diffs."* Now it
  // sends the project the event was stamped with, the repo-relative path, the lines a Read looked
  // at, and asks for the diff side when the row wrote.
  const openPath = (e) => {
    e.stopPropagation();
    // "diff" MEANS THE DIFF. The pane treats diff as a MODE it remembers (`sv.diffMode`), not a
    // per-open flag — so the diff button turns the mode on before it opens the file, and the pane
    // comes up side-by-side instead of on the plain source with a toggle you then have to find.
    if (row.wrote) { try { localStorage.setItem("sv.diffMode", "true"); } catch {} }
    const lines = row.span ? row.span.split("-").map(Number) : null;
    window.dispatchEvent(
      new CustomEvent("sv:openFileInNav", {
        detail: {
          projectCode: row.project || undefined,
          path: row.rel || row.path,
          lines: lines && lines[0] ? (lines.length > 1 ? lines : [lines[0], lines[0]]) : undefined,
          // The nav's two sides of the index are "staged" and "unstaged"; a write lands unstaged.
          ...(row.wrote ? { side: "unstaged" } : {}),
        },
      }),
    );
  };
  const cmd = row.input && typeof row.input.command === "string" ? row.input.command : null;
  const out = row.output == null ? "" : String(row.output);
  // The rest of the arguments, minus the one already shown as the command — printing `command`
  // twice under its own heading is the "Edit edited CodePane.js" mistake in another costume.
  const rest = (() => {
    if (!row.input || typeof row.input !== "object") return null;
    const { command, ...others } = row.input;
    return Object.keys(others).length ? others : null;
  })();

  const has = !!(cmd || out || rest || embed);

  return (
    <div
      className={`${CLASSNAME}__row ${CLASSNAME}__row--tool ${CLASSNAME}__row--${row.state}${
        row.sv ? ` ${CLASSNAME}__row--sv` : ""
      }${has ? ` ${CLASSNAME}__row--can` : ""}`}
      // THE WHOLE ROW IS THE HANDLE, not the words on it — his: "why do you got to actually click
      // on the name in the row?" A click anywhere on the row that isn't a button toggles it; the
      // open/diff button stops its own click so it never doubles as a fold.
      onClick={(e) => { if (has && !open && !e.target.closest("button, a, .agent-wb__tool-body")) setOpen(true); }}
    >
      <div
        className={`${CLASSNAME}__tool-head${has ? ` ${CLASSNAME}__tool-head--can` : ""}`}
        role={has ? "button" : undefined}
        tabIndex={has ? 0 : undefined}
        onClick={(e) => { if (has) { e.stopPropagation(); setOpen(!open); } }}
        onKeyDown={(e) => has && (e.key === "Enter" || e.key === " ") && setOpen(!open)}
      >
        {row.sv ? (
          // Its own mark instead of a state dot: this is SystemView doing something, and which
          // something is the first thing worth knowing.
          <span className={`${CLASSNAME}__sv-icon`}>{row.sv.icon}</span>
        ) : (
          <span className={`${CLASSNAME}__dot ${CLASSNAME}__dot--${row.state}`} />
        )}
        {/* THE SUMMARY IS THE WHOLE LINE. Printing the tool name beside it read "Edit edited
            CodePane.js" — the same thing twice, in a feed whose only job is to be skimmable. */}
        <span className={`${CLASSNAME}__tool-sum`}>
          {/* SAY THE TOOL'S NAME. A bash row reads "run …"; a SystemView row read only its summary,
              so it looked like any other command in the feed — his catch: *"why doesn't mine just
              say systemview as the first word, so you know it's a SystemView command."* */}
          {(row.sv || row.tool === "Bash") && (
            <span className={`${CLASSNAME}__sv-kind${row.sv ? "" : ` ${CLASSNAME}__sv-kind--sh`}`}>
              {row.sv ? "systemview" : "bash"}
            </span>
          )}
          {row.summary}
          {/* The subject, in its own ink — the title of the show, the place it navigated to. */}
          {row.sv && row.sv.target && <span className={`${CLASSNAME}__sv-target`}>{row.sv.target}</span>}
          {/* Whose window. Silent for this project, named when an agent reached into another's. */}
          {row.sv && row.sv.project && <span className={`${CLASSNAME}__sv-proj`}>{row.sv.project}</span>}
        </span>
        {/* THE PATH IS A DOOR. An agent editing a file is the moment you most want to look at the
            file, and the diff for it is already a click away in the codebase panel. */}
        {row.path && (
          <button type="button" className={`${CLASSNAME}__tool-open`} title={`Open ${row.path}`} onClick={openPath}>
            {row.wrote ? "diff" : "open"}
          </button>
        )}
        {/* SAY WHAT'S INSIDE. A bare "+" gave no hint that a file or a diff was waiting under the
            row — his: "there should be some sort of indication if there's an embedded thing." The
            fold names it: `file ▾` / `diff ▾`, and folds back to "−" when open. */}
        {has && (
          <span
            className={`${CLASSNAME}__tool-fold${embed ? ` ${CLASSNAME}__tool-fold--embed` : ""}`}
            title={open ? "Fold it away" : embed ? (row.wrote ? "Show the diff here" : "Show the file here") : "Show what it ran and what came back"}
          >
            {open ? "−" : embed ? (row.wrote ? "diff ▾" : "file ▾") : "+"}
          </span>
        )}
      </div>
      {open && has && (
        <div className={`${CLASSNAME}__tool-body`}>
          {/* The command reads like a prompt, because that is what it is. */}
          {cmd && (
            <Block kind="cmd">
              {cmd.split("\n").map((line, i) => (
                <div key={i} className={`${CLASSNAME}__cmd-line`}>
                  <span className={`${CLASSNAME}__cmd-sign`}>{i === 0 ? "$" : " "}</span>
                  {line}
                </div>
              ))}
            </Block>
          )}
          {rest && <Block kind="args">{JSON.stringify(rest, null, 2)}</Block>}
          {/* STILL RUNNING is a state worth drawing — a command with no output yet is not a command
              that printed nothing. */}
          {!out && row.state === "running" && <div className={`${CLASSNAME}__tool-wait`}>running…</div>}
          {out && <Block kind={row.state === "failed" ? "err" : "out"}>{out}</Block>}
          {embed && <div className={`${CLASSNAME}__tool-embed`}>{renderText(embed)}</div>}
        </div>
      )}
    </div>
  );
};

// A LONG MESSAGE DOES NOT GET TO OWN THE WHOLE CHAT — but only HIS. His correction once he saw it
// applied to both sides: *"that's for my long ass chat. Your messages should be shown. Sometimes I
// dump long messages."* He dumps context; the answer is the thing he came for, and folding it away
// hides the reply behind a click. So the fold rides `mine` and nothing else. The
// fold is MEASURED, not guessed from character count: a code block and a paragraph of the same
// length are nowhere near the same height, so only a body that genuinely runs past the line gets a
// control. Everything short stays exactly as it was — no button, no chrome, no change.
const CLAMP = 260;

const Said = ({ row, render, clamp = false }) => {
  const [open, setOpen] = useState(false);
  const [over, setOver] = useState(false);
  const ref = useRef(null);
  // Re-measured on every text change, because a streaming answer crosses the line mid-flight and a
  // fold that only checked once would either never appear or appear and then be wrong.
  useLayoutEffect(() => {
    const el = ref.current;
    if (el) setOver(clamp && el.scrollHeight > CLAMP + 24);
  }, [row.text, clamp]);
  const body = render ? render(row.text) : row.text;
  return (
    <>
      <div
        ref={ref}
        className={`${CLASSNAME}__said${over && !open ? ` ${CLASSNAME}__said--clamped` : ""}`}
        style={over && !open ? { maxHeight: CLAMP } : undefined}
      >
        {body}
      </div>
      {over && (
        <button type="button" className={`${CLASSNAME}__more`} onClick={() => setOpen((v) => !v)}>
          {open ? "See less" : "See more"}
        </button>
      )}
    </>
  );
};

const Feed = ({ rows, answered = {}, onAnswer = null, renderText = null }) =>
  rows.map((r) =>
    r.kind === "tool" ? (
      r.xsend ? <SentRow key={r.key} row={r} /> : <ToolRow key={r.key} row={r} renderText={renderText} />
    ) : r.kind === "think" ? (
      // Reasoning is quiet by design: it is context for what it did, not the thing it did.
      <div key={r.key} className={`${CLASSNAME}__row ${CLASSNAME}__row--think`}>{r.text}</div>
    ) : r.kind === "ask" ? (
      <div
        key={r.key}
        className={`${CLASSNAME}__row ${CLASSNAME}__row--ask${
          answered[r.id] === undefined ? "" : ` ${CLASSNAME}__row--answered`
        }`}
      >
        <span className={`${CLASSNAME}__ask-title`}>{r.title}</span>
        {answered[r.id] === undefined ? (
          <>
            <button type="button" className={`${CLASSNAME}__ask-yes`} onClick={() => onAnswer && onAnswer(r.id, true)}>allow</button>
            <button type="button" className={`${CLASSNAME}__ask-no`} onClick={() => onAnswer && onAnswer(r.id, false)}>deny</button>
          </>
        ) : (
          <span className={`${CLASSNAME}__ask-was`}>{answered[r.id] ? "allowed" : "denied"}</span>
        )}
      </div>
    ) : r.kind === "done" ? (
      <div key={r.key} className={`${CLASSNAME}__row ${CLASSNAME}__row--done`}>
        {`${r.ok ? "done" : "stopped"}${r.turns ? ` · ${r.turns} turns` : ""}${
          r.durationMs ? ` · ${Math.round(r.durationMs / 1000)}s` : ""
        }${money(r.costUsd) ? ` · ${money(r.costUsd)}` : ""}`}
      </div>
    ) : r.kind === "mine" ? (
      // His own turns, so a resumed conversation reads like a conversation and not a monologue.
      <div
        key={r.key}
        // The address a "spoke" chip jumps to. A visitor's turn is the one row you go looking for
        // after the fact — "who was that and what did they say" — so it has to be addressable.
        data-row={r.key}
        className={`${CLASSNAME}__row ${CLASSNAME}__row--mine${r.as ? ` ${CLASSNAME}__row--visit` : ""}`}
        style={visStyle(r.as)}
      >
        {/* WHO JUMPED IN, always on screen. An agent reaching into this conversation through the
            CLI must never read as the human — his standing rule for visiting, carried over from the
            room: you can always see who is in whose chat. */}
        <When ts={r.ts} />
        {r.as && (
          <span className={`${CLASSNAME}__visitor`} style={visStyle(r.as)}>
            {r.as}
          </span>
        )}
        <Said row={r} render={renderText} clamp={!r.as} />
      </div>
    ) : r.kind === "cmdret" ? (
      // A TERMINAL COMMAND'S RECEIPT — /usage, /model, whatever the host ran and answered itself.
      // His ask: *"make a nice display for commands like that that return — it should be showing
      // nice bars."* The command reads like the tool rows' header; the printout keeps its lines,
      // and any line that states a percentage draws it as a thin bar under the words, in the
      // meter's own colour language (calm, then amber past 75, red past 90) — the same thresholds
      // the context ruler uses, so a number that means "getting full" looks like getting full.
      <div key={r.key} className={`${CLASSNAME}__row ${CLASSNAME}__row--cmdret`}>
        <div className={`${CLASSNAME}__cmdret-head`}>
          <span className={`${CLASSNAME}__cmdret-name`}>{r.name || "command"}</span>
          {r.args ? <span className={`${CLASSNAME}__cmdret-args`}>{r.args}</span> : null}
        </div>
        {r.out ? (
          <div className={`${CLASSNAME}__cmdret-out`}>
            {r.out.split("\n").map((line, i) => {
              const m = line.match(/(\d{1,3})%/);
              const pct = m ? Math.min(100, Number(m[1])) : null;
              return line.trim() ? (
                <div key={i} className={`${CLASSNAME}__cmdret-line`}>
                  <span className={`${CLASSNAME}__cmdret-text`}>{line}</span>
                  {pct !== null && (
                    <span className={`${CLASSNAME}__cmdret-bar`}>
                      <span
                        className={`${CLASSNAME}__cmdret-bar-fill${
                          pct >= 90
                            ? ` ${CLASSNAME}__cmdret-bar-fill--due`
                            : pct >= 75
                            ? ` ${CLASSNAME}__cmdret-bar-fill--warn`
                            : ""
                        }`}
                        style={{ width: `${pct}%` }}
                      />
                    </span>
                  )}
                </div>
              ) : (
                <div key={i} className={`${CLASSNAME}__cmdret-gap`} />
              );
            })}
          </div>
        ) : null}
      </div>
    ) : r.kind === "note" ? (
      // A compaction — the moment the conversation he is reading lost its middle. It is an event,
      // not a silence, so it says so. The receipt gets its own mark and colour, matching the browser
      // panel's line exactly (⦿, green): he watches both windows at once, and a moment that reads
      // as two different things in two views is worse than a moment shown in only one.
      <div
        key={r.key}
        className={`${CLASSNAME}__row ${CLASSNAME}__row--note${
          r.before !== undefined ? ` ${CLASSNAME}__row--compaction` : ""
        }${r.model ? ` ${CLASSNAME}__row--model` : ""}`}
      >
        {(r.before !== undefined || r.model) && <span className={`${CLASSNAME}__note-mark`}>⦿</span>}
        {r.text}
      </div>
    ) : r.kind === "seam" ? (
      <div key={r.key} className={`${CLASSNAME}__row ${CLASSNAME}__row--seam`}>{r.text}</div>
    ) : r.kind === "error" ? (
      <div key={r.key} className={`${CLASSNAME}__row ${CLASSNAME}__row--error`}>{r.text}</div>
    ) : (
      <div
        key={r.key}
        className={`${CLASSNAME}__row ${CLASSNAME}__row--say${r.toRoom ? ` ${CLASSNAME}__row--toroom` : ""}`}
      >
        {/* SENT, NOT SAID. A message this agent put in its own room arrives here through `showSaid`
            — shown, never fed back, because feeding an agent its own words has it answering itself.
            Drawn as plain speech it was indistinguishable from a sentence in the session, which is
            exactly what Odion reported: the agent appears, the message doesn't. The mark says where
            it went. (systemlynx traced this from the other side: a room's own agent carries no `as`
            field, correctly, so there was nothing left to key on by the time it got here.) */}
        {r.toRoom && (
          <span className={`${CLASSNAME}__toroom`} title={`sent to the ${typeof r.toRoom === "string" ? r.toRoom : "project"} room`}>
            ↗ room
          </span>
        )}
        {r.settled && <When ts={r.ts} />}
        <Said row={r} render={renderText} />
      </div>
    ),
  );

export { money };
export default Feed;
