import React, { useContext, useEffect, useMemo, useRef, useState } from "react";
import ServiceContext from "../../ServiceContext";
import moment from "moment";
import { MarkdownScopeProvider } from "../../atoms/Markdown/context";
import { hasHostDictation, startHostRecording } from "../../utils/hostDictation";
import { hostFiles, hasHostFiles } from "../../utils/hostFiles";
// A DELIBERATE CYCLE, and a safe one: AgentChat imports Board (the floating popup wraps this), and
// this imports the chat's own light markdown pass back, because a board note must draw EXACTLY like
// a bubble — two renderers of one grammar is how the collector and the chat once drifted apart.
// `renderChatMessage` is a hoisted function declaration, so the cycle resolves at call time.
// eslint-disable-next-line import/no-cycle
import { renderChatMessage } from "../AgentChat/AgentChat";
// The board's styles still live in the chat's sheet under `.agent-chat__board-*` — MOVED here they
// would be a rename of ~60 selectors for zero behaviour; imported here so the tab can stand alone.
import "../AgentChat/styles.scss";
import { parseBoard, parseTitle, serializeBoard, DONE, stateOf } from "./boardFormat";

const CLASSNAME = "agent-chat";

// THE BOARD — his, not the app's. Notes to himself, things to tell an agent later, a running list
// of what is wrong with something while he looks at it. One board per project, one markdown file
// beside the project (`.systemview/boards/board.md`), so every block this app has works inside it.
//
// EXTRACTED FROM AgentChat (2026-10-14), where it was born as a floating panel, because of his
// ruling that day: *"I don't want the board to show up on the side with the chat — I want it to pop
// up like a document."* One component, two containers now: the chat's floating popup (which passes
// `headerDrag`/`onClose`), and the centre's board TAB (which passes neither). The logic moved
// whole; nothing here is new behaviour.
//
// `onHandToChat` is optional on purpose — in the tab there is no chat in scope, so 💬 falls back to
// a window event the chat listens for, and the note still lands in the input box either way.
export default function Board({ projectCode, headerDrag, onClose, onHandToChat, chrome }) {
  const { SystemViewService } = useContext(ServiceContext);
  const micSupported =
    !!(window.SpeechRecognition || window.webkitSpeechRecognition) || hasHostDictation();
  const hand = (handed) => {
    if (onHandToChat) return onHandToChat(handed);
    window.dispatchEvent(new CustomEvent("sv:boardHand", { detail: { projectCode, text: handed } }));
  };
  const [board, setBoard] = useState(null); // null = not read yet · else [{ ts, text }]
  const [boardSaved, setBoardSaved] = useState(true);
  const boardSavedRef = useRef(true);
  boardSavedRef.current = boardSaved;
  const [boardDraft, setBoardDraft] = useState("");
  // AN OPTIONAL TITLE. His: "sometimes I want a title so you know something" — the board is where he
  // accumulates thoughts for an agent to be pointed at later, and a word at the top is the cheapest
  // context there is. Subtle and skippable: with none it just says `board`.
  const [boardTitle, setBoardTitle] = useState("");
  const [titling, setTitling] = useState(false); // the title is a word until it is clicked
  const [boardRec, setBoardRec] = useState(false);
  const boardRecRef = useRef(null);
  const boardHostRef = useRef(null); // { rec, into } while the HOST is recording for a board box
  const boardDraftRef = useRef(null);
  const boardPath = ".systemview/boards/board.md";
  // THE BOARD IS A FILE, SO IT COMES FROM THE SHELL. It used to be read through whichever service
  // happened to be first for this project — which is why his notes vanished the moment a test
  // service was down: not lost, just asked for down a road that was closed. `.systemview/boards/
  // board.md` sits on disk the whole time. Same rule as the codebase: files are the host's.
  const boardPlugin = useMemo(
    () => (hasHostFiles() ? hostFiles(projectCode) : null),
    [projectCode],
  );
  // EVERY TIME IT OPENS, not just the first — a reply written while the board was shut was invisible
  // until he reloaded the whole page, which is not a thing anyone should have to do to read an answer.
  useEffect(() => {
    if (!boardPlugin) return undefined;
    let dead = false;
    (async () => {
      try {
        const res = await boardPlugin.readFile({ path: boardPath });
        if (!dead) {
          setBoard(parseBoard(res.content));
          setBoardTitle(parseTitle(res.content));
        }
      } catch {
        if (!dead) setBoard([]); // no board yet is the normal case, not an error
      }
    })();
    return () => {
      dead = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [boardPlugin]);



  const saveBoard = async (cards, title = boardTitle) => {
    setBoard(cards);
    setBoardSaved(false);
    if (!boardPlugin) return;
    try {
      // AN AGENT'S REPLY MUST SURVIVE HIS NEXT KEYSTROKE. The panel holds the whole board in memory
      // and writes the whole file, so a reply written by `systemview board --reply` between the
      // panel reading and the panel saving would simply vanish — which is exactly what happened the
      // first time I tried it. Replies are the agent's half and the UI never edits them, so re-read
      // and carry them over rather than trusting what was in memory.
      let keep = {};
      let keepStatus = {};
      // A READ THAT NEVER ANSWERED IS NOT AN EMPTY BOARD. The disk only gets to be authoritative
      // about statuses when it actually spoke — otherwise a transient read failure would strip
      // every status on the next save, which is the same mistake as treating a failed listing as a
      // mass deletion.
      let diskSpoke = false;
      try {
        const fresh = await boardPlugin.readFile({ path: boardPath });
        diskSpoke = true;
        parseBoard(fresh.content).forEach((c) => {
          if ((c.replies || []).length) keep[c.ts] = c.replies;
          // A STATUS IS THE AGENT'S HALF TOO, and this is the trap the whole lane turns on: this
          // panel holds the board in memory and writes the WHOLE file, so a status written by an
          // agent between the read and the save is erased by his next keystroke — which is how
          // replies used to vanish before they got this same merge. The panel never writes a
          // status; it carries whatever the disk says.
          if (c.status && c.status.text) keepStatus[c.ts] = c.status;
        });
      } catch {}
      // Union by (ts, text): an agent may have appended a reply since this panel read the file, and
      // he may have just written one that isn't on disk yet. Neither half gets to erase the other.
      cards = cards.map((c) => {
        const disk = keep[c.ts] || [];
        const mine = c.replies || [];
        // The status the disk holds wins over whatever this panel happens to be carrying — it is
        // not the panel's field to have an opinion about. Including its ABSENCE: an agent that
        // cleared a status must not have it restored by his next keystroke.
        if (diskSpoke) {
          const onDisk = keepStatus[c.ts];
          if (onDisk) {
            if (!(c.status && c.status.ts === onDisk.ts)) c = { ...c, status: onDisk };
          } else if (c.status) {
            const { status, ...rest } = c;
            c = rest;
          }
        }
        if (!disk.length) return c;
        const seen = new Set(mine.map((r) => `${r.ts}|${r.text}`));
        const merged = [...disk.filter((r) => !seen.has(`${r.ts}|${r.text}`)), ...mine].sort(
          (a, b) => (a.ts || 0) - (b.ts || 0),
        );
        return { ...c, replies: merged };
      });
      // AN EMPTY BOARD TAKES ITS FILE WITH IT — the same rule the comment sidecars follow, so an
      // emptied board doesn't sit in `.systemview/` pretending to be something. A title alone still
      // counts as something on the board.
      if (!cards.length && !title && boardPlugin.deleteFile)
        await boardPlugin.deleteFile({ path: boardPath });
      else await boardPlugin.writeFile({ path: boardPath, content: serializeBoard(cards, title) });
      setBoardSaved(true);
    } catch {
      setBoardSaved(false);
    }
  };
  // The title saves itself a beat after you stop typing, like the notes do.
  const titleTimer = useRef(null);
  const writeTitle = (t) => {
    setBoardTitle(t);
    setBoardSaved(false);
    if (titleTimer.current) clearTimeout(titleTimer.current);
    titleTimer.current = setTimeout(() => saveBoard(board || [], t), 600);
  };
  // HIS REPLY, appended to the note's thread. Same save path as everything else here, so it merges
  // with whatever an agent wrote in the meantime rather than overwriting it.
  const addReply = (ts) => {
    const text = (replyDraft || "").trim();
    setReplying(0);
    setReplyDraft("");
    if (!text) return;
    saveBoard(
      (board || []).map((c) =>
        c.ts === ts ? { ...c, replies: [...(c.replies || []), { by: "you", ts: Date.now(), text }] } : c,
      ),
    );
  };
  const addCard = () => {
    const text = (boardDraft || "").trim();
    if (!text) return;
    // ADDING THE NOTE ENDS THE DICTATION — the same rule sending has in the chat: you said what you
    // had to say. Left running, the next thing spoken landed in an empty box behind a note that was
    // already on the board. The flag drops HERE rather than waiting for `onend`, which arrives a
    // beat late and leaves the transcript line hanging over a box you just emptied.
    if (boardRec) stopBoardMic();
    setBoardDraft("");
    saveBoard([{ ts: Date.now(), text }, ...(board || [])]); // newest on top
  };
  // THE SAME MIC THE CHAT HAS, not a second kind. The first version wrote straight into the
  // textarea's DOM value — which is a CONTROLLED React input, so every render put the old value
  // back and the words appeared and then vanished. His report, and he was right that we have done
  // this before: interim words show ABOVE the box on their own line, finals commit INTO it.
  const [boardInterim, setBoardInterim] = useState("");
  // Clearing the whole board is two-step, the same as every other destructive thing in this app.
  const [boardArmed, setBoardArmed] = useState(false);
  // …and so is clearing just the settled ones, on its own arm, because the two buttons sit beside
  // each other and one armed state for both would let a press aimed at "settled" clear everything.
  // WHICH GROUP IS ARMED, by name — not a boolean. Every state in the header is its own press, so
  // a single `armed` flag would arm all of them at once and a press aimed at `partial` would read
  // as a press on `done`.
  const [settledArmed, setSettledArmed] = useState(null);
  // TWO COUNTS, AND THE GAP BETWEEN THEM IS THE POINT. `settled` is how many cards carry an
  // account; `done` is how many are FINISHED (implemented, answered) — and only those are what a
  // press clears. A `partial` or `blocked` card carries an account precisely to say work is still
  // outstanding on it, so a clear that ran on "has an account" would delete the cards that most
  // need to survive. The board is meant to be manageable without being re-read, which means a
  // press has to be safe without being re-read either.
  // EVERY CARD HAS A STATE — his ruling, 2026-10-19: *"everything should have a status, even the
  // ones that don't have a status, meaning it should be a default status… and those defaults
  // should be provoking."* A card nobody has accounted for is the most interesting card on the
  // board, and rendering it as an absence made it the quietest. `open` is that default: it is not
  // written to the file (nothing is stamped on his behalf) — it is what no account MEANS, drawn
  // loudly so the untouched ones are the first thing the eye lands on.
  const OPEN = "open";
  // OPEN IS AN ABSENCE, and the only state nobody writes: no account at all means nobody has even
  // read the card. Everything else is stamped by whoever did it — including `reviewed`, because a
  // state the surface DERIVES is a state nobody can be held to.
  const stateOfCard = (c) =>
    (c.status && c.status.text ? c.status.state || stateOf(c.status.text) : null) || OPEN;
  // THE STATE IS LIFTED OUT OF THE LINE, OR IT IS NOT A STATE. Rendering the raw account put the
  // word inline — `partial — agents can set one` — and he read it back as "that still just looks
  // like regular text, there's no distinction". He was right: a state you have to read a sentence
  // to find cannot be scanned, which is the only thing it was for. So the word renders as its own
  // chip and the prose that follows it renders as the account, from the SAME one line on disk.
  const statusLine = (c) => {
    const st = stateOfCard(c);
    const t = String((c.status && c.status.text) || "");
    return st ? t.replace(new RegExp(`^\\s*${st}\\s*[—:-]?\\s*`, "i"), "") : t;
  };
  // What the header shows: every state present, with its count. A board with nothing finished still
  // has to SAY what it is carrying — the press disappearing is how he lost sight of it.
  // THE ROW READS AS THE WORKFLOW — his ask, and it is the right order: a card arrives unread,
  // gets read, gets worked, maybe gets stuck, and ends finished. Left to right is the life of a
  // card, so the eye travels the same way the work does and the delete batch sits at the end,
  // where you arrive after everything else. Ordered explicitly, never by insertion: the row must
  // not reshuffle itself as cards change state.
  const ORDER = [OPEN, "reviewed", "partial", "blocked", ...DONE];
  const tally = (board || []).reduce((acc, c) => {
    const k = stateOfCard(c);
    acc[k] = (acc[k] || 0) + 1;
    return acc;
  }, {});
  const settledCount = (board || []).filter((c) => c.status && c.status.text).length;
  const doneCards = (board || []).filter((c) => DONE.includes(stateOfCard(c)));
  const doneCount = doneCards.length;
  // THE CHIPS ARE A FILTER, NOT A DELETE. They were a two-step delete for about an hour, and he
  // caught the collision immediately: *"it's hard to just filter or click, because when you click
  // again, that's the way to close it… as soon as you click again, you put it on filter."* A
  // second press on a selected chip has to mean "unselect", which leaves no gesture for "confirm
  // the deletion". So selection lives on the chips and deletion lives on ONE press at the end of
  // the row — `clear` — which takes the selected state, or everything when nothing is selected.
  const [pick, setPick] = useState(null);
  const [editingTitle, setEditingTitle] = useState(null);
  const shown = pick ? (board || []).filter((c) => stateOfCard(c) === pick) : board;
  // ORDER IS HIS. Cards arrive newest-first, but a board is a thing you arrange — so the stamp bar
  // on each card is a drag handle and dropping one on another puts it there. The saved file IS the
  // order, so what you arrange is what you come back to. A private MIME, the same trick the file
  // tree's drag uses, so nothing else on the page answers a card drag.
  const CARD_MIME = "application/x-systemview-card";
  const [dropCard, setDropCard] = useState(null);
  // A LONG NOTE IS CLAMPED UNTIL YOU SAY OTHERWISE — his rule, and the important half is the second
  // one: "I don't care that I can't see the whole thing, but I can't see it BY CHOICE."
  const [openCards, setOpenCards] = useState([]);
  // Which note is being EDITED (its ts). Rendered markdown by default; the textarea only while editing.
  const [editingCard, setEditingCard] = useState(null);
  // THIS EFFECT LIVES HERE, NOT WITH THE OTHER READS, and the position is load-bearing: it reads
  // `editingCard` and `editingTitle`, so declared above them it is a temporal-dead-zone
  // ReferenceError on every render — which is exactly what it was, and the board would not open at
  // all. Keep it below every value it names.
  // IT IS A FILE, SO IT STAYS FRESH. His catch, 2026-10-19 — he had the board open while I wrote
  // 28 titles and 28 accounts into it, and the panel showed none of them: it read the file once, on
  // mount, and nothing told it the file had moved. On the surface whose entire purpose is carrying
  // things between him and an agent, that is the worst possible place to read a stale copy.
  //
  // The hub emits `board-updated:<project>` after any write through its door; this re-reads. It
  // does NOT re-read while he is mid-edit — a card open in the editor, a title being typed, or an
  // unsaved change in flight — because pulling the disk's copy in underneath him would take the
  // sentence he is writing. Those land when the edit settles, which is the same rule the reply
  // merge follows.
  useEffect(() => {
    const SystemView = SystemViewService && SystemViewService.SystemView;
    if (!SystemView || !boardPlugin) return undefined;
    const off = SystemView.on(`board-updated:${projectCode}`, async () => {
      if (editingCard !== null || editingTitle !== null || !boardSavedRef.current) return;
      try {
        const res = await boardPlugin.readFile({ path: boardPath });
        setBoard(parseBoard(res.content));
        setBoardTitle(parseTitle(res.content));
      } catch {}
    });
    return () => {
      try {
        if (typeof off === "function") off();
      } catch {}
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [SystemViewService, boardPlugin, projectCode, editingCard, editingTitle]);
  // RFC-039 — his half of a note's thread: which card is being replied to, and the draft.
  const [replying, setReplying] = useState(0);
  const [replyDraft, setReplyDraft] = useState("");
  const [openReplies, setOpenReplies] = useState([]);
  const [copied, setCopied] = useState(0);
  const moveCard = (fromTs, toTs) => {
    if (!board || fromTs === toTs) return;
    const from = board.findIndex((c) => c.ts === fromTs);
    const to = board.findIndex((c) => c.ts === toTs);
    if (from < 0 || to < 0) return;
    const next = board.slice();
    const [card] = next.splice(from, 1);
    next.splice(to, 0, card);
    saveBoard(next);
  };
  // ONE RECORDER, WHICHEVER BOX IS ASKING. Every input in this app takes voice — a new box without a
  // mic is a broken box, which is exactly what the note-reply box shipped as for about ten minutes.
  // `into` names the target ("note" = a new card, or a card's ts = a reply on that note), so the
  // finals land in the right draft and the mic can only be lit in one place at a time.
  // ONE WAY TO STOP THE BOARD'S MIC, because two of them is what left it running.
  //
  // HIS REPORT: *"the record is recording at all time on this chat that I'm using… no indication
  // that it's open."* That is not ambient capture by design — nothing here was ever meant to listen
  // on its own. It is this: the board's recorder lives in `boardHostRef` when the shell does the
  // listening (which is his setup, always) and in `boardRecRef` when the browser does. FOUR stop
  // paths — adding a note, pressing another box's mic, Escape, "never mind" — stopped only
  // `boardRecRef`, an object that is null on his machine. So every one of them set the light to off
  // and left the microphone open, with no way to tell and nothing to press.
  //
  // A state that two places decide is a state that eventually disagrees. There is one door now, it
  // closes both kinds, and it is the only thing any caller is allowed to know about.
  const stopBoardMic = () => {
    const host = boardHostRef.current;
    if (host) {
      boardHostRef.current = null;
      try {
        const r = host.rec.stop();
        if (r && r.catch) r.catch(() => {});
      } catch {}
    }
    if (boardRecRef.current) {
      try { boardRecRef.current.stop(); } catch {}
      boardRecRef.current = null;
    }
    setBoardRec(false);
    setBoardInterim("");
  };
  const toggleBoardRec = (into = "note") => {
    if (boardHostRef.current) {
      const { rec, into: wasFor } = boardHostRef.current;
      boardHostRef.current = null;
      setBoardInterim("transcribing…");
      // The segments already landed in the box as he paused; stopping just closes the last one.
      rec
        .stop()
        .catch(() => {})
        .finally(() => {
          setBoardRec(false);
          setBoardInterim("");
        });
      if (wasFor === into) return;
    }
    if (boardRecRef.current) {
      const wasFor = boardRec;
      try { boardRecRef.current.stop(); } catch {}
      // Pressing the OTHER box's mic while this one is live moves the recorder there rather than
      // just switching it off — that reads as the button not working.
      if (wasFor === into) return;
    }
    const SRB = window.SpeechRecognition || window.webkitSpeechRecognition;
    const write = (txt) =>
      into === "note"
        ? setBoardDraft((cur) => (cur ? `${cur} ` : "") + txt)
        : setReplyDraft((cur) => (cur ? `${cur} ` : "") + txt);
    // Same host-first rule as the chat mic — the board's recorder is the same feature on another box.
    if (hasHostDictation()) {
      (async () => {
        try {
          const rec = await startHostRecording({
            onDraft: (t) => setBoardInterim(t),
            onSegment: (t) => {
              setBoardInterim("");
              write(t.trim());
            },
          });
          boardHostRef.current = { rec, into };
          setBoardRec(into);
          setBoardInterim("");
        } catch {
          setBoardRec(false);
        }
      })();
      return;
    }
    if (!SRB) return;
    try {
      const rec = new SRB();
      rec.lang = navigator.language || "en-US";
      rec.interimResults = true;
      rec.continuous = true;
      rec.onresult = (e) => {
        let fin = "";
        let inter = "";
        for (let i = e.resultIndex; i < e.results.length; i++) {
          if (e.results[i].isFinal) fin += e.results[i][0].transcript;
          else inter += e.results[i][0].transcript;
        }
        if (fin) {
          write(fin.trim());
          setBoardInterim("");
        } else setBoardInterim(inter);
      };
      const done = () => {
        boardRecRef.current = null;
        setBoardRec(false);
        setBoardInterim("");
      };
      rec.onend = done;
      rec.onerror = done;
      boardRecRef.current = rec;
      rec.start();
      setBoardRec(into);
    } catch {
      setBoardRec(false);
    }
  };


  // The recorder must not outlive the board that lit it — the one leak the floating panel ever had.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => () => stopBoardMic(), []);

  return (
    <>
            {/* THE HEADER IS THE HANDLE, like every other header here: dragging it moves the bot and
                everything hanging off it, so the board travels with the rest instead of being the
                one panel you cannot move. */}
            <div
              // AS A TAB IT WEARS THE HOUSE HEADER — his correction, 2026-10-14: *"all these
              // documents have similar headers"*. `doc-pane__header` is the one band every centre
              // document already wears (docs, files, reports); the popup keeps its own head
              // because there it is also the drag handle.
              className={
                chrome === "pane"
                  ? `doc-pane__header doc-pane__header--board ${CLASSNAME}__board-head`
                  : `${CLASSNAME}__board-head${headerDrag ? ` ${CLASSNAME}__tv-head--grab` : ""}`
              }
              title={headerDrag ? "Drag to move · double-click to toggle size" : undefined}
              onPointerDown={headerDrag && headerDrag.onPointerDown}
              onDoubleClick={headerDrag && headerDrag.onDoubleClick}
            >
              {chrome === "pane" ? (
                <span className="doc-pane__kind doc-pane__kind--board">board</span>
              ) : (
                <span className={`${CLASSNAME}__tv-badge`}>📋</span>
              )}
              {/* THE TITLE IS TEXT UNTIL YOU GO FOR IT. No field sitting there catching the eye and
                  no I-beam under the pointer — you click the words and only then is there an input,
                  already carrying what it said. */}
              {titling ? (
                <input
                  className={`${CLASSNAME}__board-title ${CLASSNAME}__board-title--edit`}
                  value={boardTitle}
                  placeholder="board"
                  spellCheck={false}
                  autoFocus
                  onPointerDown={(e) => e.stopPropagation()} // typing in it is not dragging the bot
                  onChange={(e) => writeTitle(e.target.value)}
                  onBlur={() => setTitling(false)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === "Escape") {
                      e.preventDefault();
                      setTitling(false);
                    }
                  }}
                />
              ) : (
                <span
                  className={`${CLASSNAME}__board-title ${CLASSNAME}__board-title--read${boardTitle ? "" : ` ${CLASSNAME}__board-title--unnamed`}`}
                  title="Click to name this board — optional, and it's the first thing an agent reads"
                  onClick={() => board !== null && setTitling(true)}
                >
                  {boardTitle || "board"}
                </span>
              )}
              {/* HOW MANY ARE OPEN — his ask, 2026-10-14. And the card count IS that number, with
                  nothing to filter, because the rule he settled in the same conversation is that a
                  card LEAVES the board when its account lands: no done state, no archive, no
                  ledger. *"If it was so important it would have never just gone on the board"* —
                  the board is for real-but-not-urgent, so losing one costs little and a problem
                  that persists gets written again. Which makes this a count of outstanding work
                  rather than a count of rows, and the one honest number the surface can show. */}
              {!!(board && board.length) && (
                <span
                  className={`${CLASSNAME}__board-count`}
                  title={`${board.length} open — everything on the board is outstanding; a card is deleted when its account lands`}
                >
                  {board.length}
                </span>
              )}
              {/* THE STATE ROW — his, and he asked that it stay what it is: *"I like the fact that
                  it's these little things at the top, I don't want to change that too much. It
                  should all work there, but filtering should be involved."* So the counts kept
                  their place and gained the one gesture they were missing: press one and the board
                  shows only those, press it again and the filter lifts. Colour carries the state;
                  the number carries the weight. Every state the board holds appears, including
                  `open` — the cards nobody has accounted for, which are the ones worth provoking. */}
              {ORDER.filter((k) => tally[k]).map((k) => (
                <button
                  type="button"
                  key={k}
                  className={`${CLASSNAME}__board-tally ${CLASSNAME}__board-tally--${k}${
                    pick === k ? ` ${CLASSNAME}__board-tally--on` : ""
                  }`}
                  title={
                    pick === k
                      ? `showing the ${k} ones — press again to show everything`
                      : `${tally[k]} ${k} — press to show only those`
                  }
                  onClick={() => {
                    setBoardArmed(false);
                    setPick((cur) => (cur === k ? null : k));
                  }}
                >
                  {k === "blocked" ? "✗" : DONE.includes(k) ? "✓" : k === "open" ? "•" : "~"} {tally[k]}
                </button>
              ))}
              {/* AT THE END OF THE LIST, IN THE PICKED STATE'S COLOUR — his instruction, twice:
                  the clear belongs at the end of the row of marks and applies to whatever is
                  selected, with the colour saying which. It sat out at the far right beside
                  `saved`, which made it read as the whole board's button and nothing else. */}
              {!!(board && board.length) && (
                <button
                  type="button"
                  className={`${CLASSNAME}__board-clear${pick ? ` ${CLASSNAME}__board-tally--${pick}` : ""}${
                    boardArmed ? ` ${CLASSNAME}__board-clear--armed` : ""
                  }`}
                  // ONE DELETE, AT THE END OF THE ROW, AND IT TAKES WHAT YOU PICKED. *"To the
                  // right of the entire list you show a clear, which we already do — clear all.
                  // If you select one of those, it would clear one of those."* So the selection
                  // does the aiming and this does the deleting: nothing selected means the whole
                  // board, exactly as before, and a selected state means those and only those.
                  // The two-step arm stays, because this is the one press that loses things.
                  title={pick ? `Take the ${pick} cards off the board` : "Take everything off the board"}
                  onClick={() => {
                    if (!boardArmed) return setBoardArmed(true);
                    setBoardArmed(false);
                    if (pick) {
                      saveBoard((board || []).filter((c) => stateOfCard(c) !== pick));
                      setPick(null);
                    } else saveBoard([]);
                  }}
                  onBlur={() => setBoardArmed(false)}
                >
                  {/* AT REST IT IS JUST `clear` — the arm already says what it will take, and
                      saying it twice made the row wider for no new information. His call, after
                      trying it: *"when you click it, it says clear the particular thing."* The
                      colour is what carries the aim before the press. */}
                  {boardArmed ? (pick ? `clear ${tally[pick]} ${pick}?` : "clear it all?") : "clear"}
                </button>
              )}
              <span className={`${CLASSNAME}__board-state`}>
                {board === null ? "opening…" : boardSaved ? "saved" : "saving…"}
              </span>
              {onClose && (
                <button
                  type="button"
                  className={`${CLASSNAME}__board-x`}
                  title="Put the board away"
                  onClick={onClose}
                >
                  ✕
                </button>
              )}
            </div>
            {/* THE RECORDER STAYS AT THE TOP and the notes come down under it — but only when it is
                the NOTE box being spoken into; a reply shows its transcript beside the reply. */}
            {boardRec === "note" && (
              <div className={`${CLASSNAME}__interim ${CLASSNAME}__board-interim`}>
                <span className={`${CLASSNAME}__interim-dot`} />
                {boardInterim || "listening…"}
              </div>
            )}
            <div className={`${CLASSNAME}__board-new`}>
              <textarea
                ref={boardDraftRef}
                className={`${CLASSNAME}__board-draft`}
                value={boardDraft}
                placeholder="a note to yourself · something to hand me later"
                spellCheck={false}
                disabled={board === null}
                onChange={(e) => setBoardDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                    e.preventDefault();
                    addCard();
                  }
                }}
              />
              <span className={`${CLASSNAME}__board-tools`}>
                {micSupported && (
                  <button
                    type="button"
                    className={`${CLASSNAME}__board-mic${boardRec === "note" ? ` ${CLASSNAME}__board-mic--on` : ""}`}
                    title={boardRec === "note" ? "Stop — the words stay in the box" : "Speak a note"}
                    onClick={() => toggleBoardRec("note")}
                  >
                    🎙
                  </button>
                )}
                <button
                  type="button"
                  className={`${CLASSNAME}__board-add`}
                  title="Put it on the board (⌘↵)"
                  disabled={!boardDraft.trim()}
                  onClick={addCard}
                >
                  add
                </button>
              </span>
            </div>
            <div className={`${CLASSNAME}__board-cards`}>
              {board === null ? (
                <div className={`${CLASSNAME}__board-note`}>opening…</div>
              ) : !board.length ? (
                <div className={`${CLASSNAME}__board-empty`}>
                  nothing on the board yet — speak one or type one
                </div>
              ) : (
                // FILTERED, NOT HIDDEN — `shown` is the board when nothing is picked, so the
                // default view is still the whole board and the filter is a lens you take off.
                shown.map((c) => (
                  <div
                    key={c.ts}
                    className={`${CLASSNAME}__board-card${dropCard === c.ts ? ` ${CLASSNAME}__board-card--drop` : ""}`}
                    onDragOver={(e) => {
                      if (![...e.dataTransfer.types].includes(CARD_MIME)) return;
                      e.preventDefault();
                      if (dropCard !== c.ts) setDropCard(c.ts);
                    }}
                    onDragLeave={() => dropCard === c.ts && setDropCard(null)}
                    onDrop={(e) => {
                      if (![...e.dataTransfer.types].includes(CARD_MIME)) return;
                      e.preventDefault();
                      setDropCard(null);
                      moveCard(Number(e.dataTransfer.getData(CARD_MIME)), c.ts);
                    }}
                  >
                    {/* The stamp bar is the handle — the body is a textarea, and dragging from it
                        would be selecting text, which is what you actually want there. */}
                    <div
                      className={`${CLASSNAME}__board-card-head`}
                      draggable
                      onDragStart={(e) => {
                        e.dataTransfer.effectAllowed = "move";
                        e.dataTransfer.setData(CARD_MIME, String(c.ts));
                      }}
                      onDragEnd={() => setDropCard(null)}
                    >
                      <span className={`${CLASSNAME}__board-when`}>{moment(c.ts).fromNow()}</span>
                      {/* An agent can leave a note now, so a note has to say whose it is. His own
                          carry no author at all — the board is his by default. */}
                      {c.by && (
                        <span className={`${CLASSNAME}__board-by`} title={`left by ${c.by}`}>
                          {c.by}
                        </span>
                      )}
                      {/* SEE IT ALL, COPY IT, OR HAND IT TO ME — the three things he reached for the
                          moment he actually used the board. */}
                      <button
                        type="button"
                        className={`${CLASSNAME}__board-act`}
                        title="Copy this note"
                        onClick={() => {
                          // SAY "copied" ONLY IF IT COPIED. The clipboard can refuse (an unfocused
                          // window, a permission), and a button that claims success either way is
                          // how you find out at the paste.
                          const done = (ok) => {
                            setCopied(ok ? c.ts : -c.ts);
                            setTimeout(() => setCopied(0), 1400);
                          };
                          try {
                            navigator.clipboard.writeText(c.text).then(() => done(true), () => done(false));
                          } catch {
                            done(false);
                          }
                        }}
                      >
                        {copied === c.ts ? "copied" : copied === -c.ts ? "can't copy" : "copy"}
                      </button>
                      <button
                        type="button"
                        className={`${CLASSNAME}__board-act`}
                        title="Put it in the chat box — you still press send"
                        onClick={() => {
                          // RFC-039 — A HANDED-OVER NOTE SAYS SO. It used to arrive as bare text,
                          // indistinguishable from something he'd just typed, so an agent read a
                          // three-week-old reminder as a live instruction. The marker is part of the
                          // message (it survives into the room's file, which is what an agent
                          // actually reads) and it carries WHEN the note was written, because a note
                          // from the board is a thing he wrote THEN and is handing over NOW.
                          const stamp = moment(c.ts).format("MMM D, h:mm A");
                          const handed = `[from my board — written ${stamp}]\n${c.text}`;
                          hand(handed);
                        }}
                      >
                        💬
                      </button>
                      <button
                        type="button"
                        className={`${CLASSNAME}__board-x`}
                        title="Take this note off the board"
                        onClick={() => saveBoard(board.filter((x) => x.ts !== c.ts))}
                      >
                        ×
                      </button>
                    </div>
                    {/* Editable in place — a note you cannot fix is a note you rewrite somewhere else. */}
                    {(() => {
                      const open = openCards.includes(c.ts);
                      // How many lines this note really needs at the card's width — a long single
                      // line wraps, so counting newlines alone would call it one line and hide the
                      // rest with nothing to say so.
                      const needed = c.text
                        .split("\n")
                        .reduce((n, l) => n + Math.max(1, Math.ceil(l.length / 44)), 0);
                      const hidden = Math.max(0, needed - 2);
                      return (
                        <>
                          {/* THE NOTE SPEAKS CHAT MARKDOWN. Agents leave notes here in the same
                              light markdown they use in a bubble — and a note is READ far more than
                              it is edited, yet it lived in a textarea, so every one drew as raw text.
                              His call: "the board needs markdown… the initial comment." Rendered by
                              default, same renderer as the bubble, scoped to this project so any
                              block resolves against the right repo; click the text to edit it in
                              place (the textarea comes back, autofocused), blur to read again. */}
                          {/* THE ACCOUNT, WHERE HE IS ALREADY LOOKING. His ask, 2026-10-16: *"it
                              could be saying implemented, it could tell me what you did in one
                              status, and whether it's done. Then I could come, see what it is and
                              delete all of them."* So it is not a badge and not a lifecycle state
                              to filter by — it is one line saying what happened, under the card's
                              own words and above the thread, so deleting the card needs no re-read
                              of it and no trip to a report. Never clamped: a status you have to
                              unfold is a status you did not read.
                              ABOVE THE NOTE, not under it — his correction, 2026-10-19. The whole
                              claim of the account is that reading it is cheaper than reading the
                              card; printed underneath, you have already read the card by the time
                              you reach it, and a card whose text is clamped put the account below
                              a "7 more lines" fold where it could not be scanned at all. */}
                          {/* THE CARD'S NAME, ABOVE EVERYTHING. A real field (his call), so it
                              is deliberate rather than read out of the prose — and it is what
                              makes a card SAYABLE: "the status picker" now resolves, for him out
                              loud and for an agent through `at`. Click to write or change it;
                              a card without one simply has no header, exactly as before. */}
                          {editingTitle === c.ts ? (
                            <input
                              className={`${CLASSNAME}__board-card-title-edit`}
                              autoFocus
                              defaultValue={c.title || ""}
                              placeholder="name this card"
                              onBlur={(e) => {
                                const v = e.target.value.trim();
                                setEditingTitle(null);
                                saveBoard(
                                  (board || []).map((x) =>
                                    x.ts === c.ts ? (v ? { ...x, title: v } : (({ title, ...rest }) => rest)(x)) : x,
                                  ),
                                );
                              }}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") e.target.blur();
                                if (e.key === "Escape") setEditingTitle(null);
                              }}
                            />
                          ) : (
                            <div
                              className={`${CLASSNAME}__board-card-title${c.title ? "" : ` ${CLASSNAME}__board-card-title--none`}`}
                              title="Click to name this card"
                              onClick={() => setEditingTitle(c.ts)}
                            >
                              {c.title || "name this card"}
                            </div>
                          )}
                          {/* DRAWN EVEN WITH NO ACCOUNT, because `open` IS the account then —
                              a bare chip, no line. A card nobody has spoken for should say so in
                              the same place every other card says what happened to it. */}
                          {true && (
                            <div
                              className={`${CLASSNAME}__board-status ${CLASSNAME}__board-status--${stateOfCard(c)}`}
                              // GUARDED, because this row draws for a card with NO account too —
                              // that is what `open` is. Dereferencing c.status here threw on every
                              // unaccounted card, which is most of the board, so it could not open
                              // and typing a note re-rendered straight back into the throw.
                              title={
                                c.status
                                  ? `${c.status.by || projectCode}${c.status.ts ? ` · ${moment(c.status.ts).format("MMM D, h:mm A")}` : ""}`
                                  : "nobody has accounted for this one yet"
                              }
                            >
                              {/* THE STATE, AS THE THING YOU SCAN. The word leads the account on
                                  disk; here it is lifted out as its own mark so the board can be
                                  read down the left edge without reading a single line of prose,
                                  and so a card that is NOT finished cannot hide behind a tick. */}
                              {/* THE CHIP ALONE. The mark beside it said the same thing twice —
                                  I saw that in the first photograph of this and it was mine to
                                  cut. A tick survives only where it adds something the word does
                                  not: that this one is FINISHED. */}
                              {DONE.includes(stateOfCard(c)) && (
                                <span className={`${CLASSNAME}__board-status-mark`}>✓</span>
                              )}
                              <span className={`${CLASSNAME}__board-status-chip`}>{stateOfCard(c)}</span>
                              {!!(c.status && c.status.text) && (
                                <span className={`${CLASSNAME}__board-status-text`}>
                                  <MarkdownScopeProvider value={{ projectCode }}>
                                    {renderChatMessage(statusLine(c))}
                                  </MarkdownScopeProvider>
                                </span>
                              )}
                            </div>
                          )}
                          {editingCard === c.ts ? (
                            <textarea
                              className={`${CLASSNAME}__board-card-text ${CLASSNAME}__board-card-text--open`}
                              value={c.text}
                              spellCheck={false}
                              autoFocus
                              rows={Math.max(2, needed)}
                              onChange={(e) =>
                                saveBoard(board.map((x) => (x.ts === c.ts ? { ...x, text: e.target.value } : x)))
                              }
                              onBlur={() => setEditingCard(null)}
                              onKeyDown={(e) => {
                                if (e.key === "Escape") setEditingCard(null);
                              }}
                            />
                          ) : (
                            <div
                              className={`${CLASSNAME}__board-card-text ${CLASSNAME}__board-card-md${open ? ` ${CLASSNAME}__board-card-text--open` : ""}`}
                              title="Click to edit"
                              onClick={(e) => {
                                // A click on a chip or a block is that control's — only bare text opens the editor.
                                if (e.target.closest && e.target.closest("button, a, .chat-md__block")) return;
                                setEditingCard(c.ts);
                              }}
                            >
                              <MarkdownScopeProvider value={{ projectCode }}>
                                {renderChatMessage(String(c.text || ""))}
                              </MarkdownScopeProvider>
                            </div>
                          )}
                          {/* SAY THAT THERE IS MORE. A clamp with no sign of it is just a note you
                              think you have read. The line itself opens it — the ▸ is not the only
                              way in. */}
                          {hidden > 0 && (
                            <button
                              type="button"
                              className={`${CLASSNAME}__board-more`}
                              onClick={() =>
                                setOpenCards((cur) =>
                                  cur.includes(c.ts) ? cur.filter((x) => x !== c.ts) : [...cur, c.ts],
                                )
                              }
                            >
                              {open ? "show less" : `${hidden} more line${hidden === 1 ? "" : "s"} — show it all`}
                            </button>
                          )}
                          {/* THE EXCHANGE. Every reply in the order it was written, his and the
                              agent's told apart by who wrote it, each folding on its own. */}
                          {(c.replies || []).map((r, ri) => {
                            const rKey = `${c.ts}:${r.ts || ri}`;
                            const rOpen = openReplies.includes(rKey);
                            const rNeeded = String(r.text)
                              .split("\n")
                              .reduce((n, l) => n + Math.max(1, Math.ceil(l.length / 44)), 0);
                            const rHidden = Math.max(0, rNeeded - 3);
                            const mine = r.by === "you";
                            return (
                              <div
                                key={rKey}
                                className={`${CLASSNAME}__board-reply${mine ? ` ${CLASSNAME}__board-reply--mine` : ""}`}
                              >
                                {/* WHO SAID IT — the project's own name, never the word "agent". */}
                                <span className={`${CLASSNAME}__board-reply-who`}>
                                  {mine ? "you" : r.by || projectCode}
                                  {/* DELETE ONE REPLY — same × the note has, same one-click, same
                                      store. A reply he doesn't want (a wrong answer, a test, an
                                      agent's junk) had no way off the board except taking the whole
                                      note with it. Matched by ts (or position when an old reply has
                                      none), so deleting the second identical reply never takes the
                                      first. */}
                                  <button
                                    type="button"
                                    className={`${CLASSNAME}__board-x ${CLASSNAME}__board-reply-x`}
                                    title="Delete this reply"
                                    onClick={() =>
                                      saveBoard(
                                        board.map((x) =>
                                          x.ts !== c.ts
                                            ? x
                                            : { ...x, replies: (x.replies || []).filter((y, yi) => (r.ts ? y.ts !== r.ts : yi !== ri)) },
                                        ),
                                      )
                                    }
                                  >
                                    ×
                                  </button>
                                </span>
                                <span
                                  className={`${CLASSNAME}__board-reply-text${rOpen ? ` ${CLASSNAME}__board-reply-text--open` : ""}`}
                                >
                                  {/* THE BOARD SPEAKS CHAT MARKDOWN. Agents answer a note in the same
                                      light markdown they use in a bubble — bold, code, lists, a :file
                                      chip, a ::diff — and it was landing here as raw text, asterisks
                                      and all. Same renderer as the bubble, scoped to this project so
                                      any block inside resolves against the right repo. */}
                                  <MarkdownScopeProvider value={{ projectCode }}>
                                    {renderChatMessage(String(r.text || ""))}
                                  </MarkdownScopeProvider>
                                </span>
                                {rHidden > 0 && (
                                  <button
                                    type="button"
                                    className={`${CLASSNAME}__board-more`}
                                    onClick={() =>
                                      setOpenReplies((cur) =>
                                        cur.includes(rKey) ? cur.filter((x) => x !== rKey) : [...cur, rKey],
                                      )
                                    }
                                  >
                                    {rOpen ? "show less" : `${rHidden} more line${rHidden === 1 ? "" : "s"} — show it all`}
                                  </button>
                                )}
                              </div>
                            );
                          })}
                          {/* HIS HALF OF THE THREAD — reply to your own note, or to the answer under
                              it. Enter sends, Escape puts it away; it stays out of sight until asked
                              for, because most notes never need one. */}
                          {replying === c.ts ? (
                            <>
                              {boardRec === c.ts && (
                                <div className={`${CLASSNAME}__interim ${CLASSNAME}__board-interim`}>
                                  <span className={`${CLASSNAME}__interim-dot`} />
                                  {boardInterim || "listening…"}
                                </div>
                              )}
                              {/* THE SAME COMPOSER THE BOARD ALREADY HAS — box, mic, button, one row,
                                  same classes. A reply is not a different kind of writing, so it does
                                  not get a different kind of input. */}
                              {/* A REPLY COMPOSER THAT LOOKS LIKE ONE: the box takes the width, the
                                  controls sit under it on one line — mic on the left, the way out and
                                  the send on the right where a send belongs. */}
                              <div className={`${CLASSNAME}__board-replybox`}>
                                <textarea
                                  className={`${CLASSNAME}__board-draft`}
                                  autoFocus
                                  rows={2}
                                  value={replyDraft}
                                  placeholder="reply…"
                                  spellCheck={false}
                                  onChange={(e) => setReplyDraft(e.target.value)}
                                  onKeyDown={(e) => {
                                    if (e.key === "Escape") {
                                      e.preventDefault();
                                      stopBoardMic();
                                      setReplying(0);
                                      setReplyDraft("");
                                    } else if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                                      e.preventDefault();
                                      addReply(c.ts);
                                    }
                                  }}
                                />
                                <div className={`${CLASSNAME}__board-replybar`}>
                                  <span className={`${CLASSNAME}__board-replybar-end`}>
                                    <button
                                      type="button"
                                      className={`${CLASSNAME}__board-act`}
                                      title="Never mind (esc)"
                                      onClick={() => {
                                        stopBoardMic();
                                        setReplying(0);
                                        setReplyDraft("");
                                      }}
                                    >
                                      cancel
                                    </button>
                                    <button
                                      type="button"
                                      className={`${CLASSNAME}__board-send`}
                                      title="Put it under the note (⌘↵)"
                                      disabled={!replyDraft.trim()}
                                      onClick={() => addReply(c.ts)}
                                    >
                                      reply
                                    </button>
                                    {/* The recorder rides the far right end of the row — his call. */}
                                    {micSupported && (
                                      <button
                                        type="button"
                                        className={`${CLASSNAME}__board-mic${boardRec === c.ts ? ` ${CLASSNAME}__board-mic--on` : ""}`}
                                        title={boardRec === c.ts ? "Stop — the words stay in the box" : "Speak the reply"}
                                        onClick={() => toggleBoardRec(c.ts)}
                                      >
                                        🎙
                                      </button>
                                    )}
                                  </span>
                              </div>
                              </div>
                            </>
                          ) : (
                            <button
                              type="button"
                              // Still the whole row — he found that by clicking it — but the WORD
                              // rides the right edge now, where a control reads as one. His report,
                              // 2026-10-14: "the reply on the board is damn near invisible… slide
                              // it all the way to the right side."
                              className={`${CLASSNAME}__board-more ${CLASSNAME}__board-replylink`}
                              onClick={() => {
                                setReplyDraft("");
                                setReplying(c.ts);
                              }}
                            >
                              ↩ reply
                            </button>
                          )}
                        </>
                      );
                    })()}
                  </div>
                ))
              )}
            </div>
            {!boardPlugin && (
              <div className={`${CLASSNAME}__board-note`}>
                no live service for this project — the board can't be saved from here
              </div>
            )}
    </>
  );
}
