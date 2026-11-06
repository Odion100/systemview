import React, { useEffect, useState } from "react";
import { useDocMembers, useMarkdownWrite } from "../context";
import { readTucked, writeTucked } from "../pinTucked";
import { revealBlock } from "../revealBlock";

// EVERY HELD FIRE IN THIS DOCUMENT, IN ONE PLACE THAT DOES NOT SCROLL AWAY.
//
// His, 2026-10-19: *"I shouldn't have to scroll back up to where I added them as a member to send
// them an update — they're supposed to be on the top right corner regardless"*, and then: *"I hope
// updates that are thread level also go up there as well, and not just document level… it's
// supposed to be for both."*
//
// WHAT "BEHIND" MEANS CHANGED UNDER THE GATE (his ruling, 2026-11-06). It used to be derived from
// edits — a hash of the prose against a `sent=` stamp — and that whole channel is gone: *"general
// text in the document should send no updates, period point blank."* Blocks are the only senders.
// A decision lands, the engine fires it, and a PLAIN member's copy is HELD for the press this row
// carries; an `auto=` member was already told the moment it fired. So the rows here are the held
// lane, fetched from the one definition (the host's fires door) rather than re-derived — a second
// copy of that rule in the window is exactly how the two drifted apart last time.
//
// This row is still the ONLY send in the surface. The `::members` block and a thread's row carry
// membership and the auto toggle; neither carries a send button, because a press you have to
// scroll to is a press that does not happen.
//
// IT DISAPPEARS WHEN THERE IS NOTHING HELD, which is also how a press is confirmed: release for
// buapi and buapi's chip leaves the row. The row is state read off the document, never a notice.
const MembersPin = () => {
  const { source = "", docPath = "", projectCode = "" } = useDocMembers() || {};
  const { editable, setAttr } = useMarkdownWrite();
  const [fires, setFires] = useState([]);
  const [tucked, setTucked] = useState(() => readTucked(window.localStorage, docPath));
  const tuck = (on) => {
    setTucked(on);
    writeTucked(window.localStorage, docPath, on);
  };
  const [sending, setSending] = useState("");
  const [refusal, setRefusal] = useState("");
  // which held fire each row's next click reveals — reset per fetch, because the fires moved
  const [cursor, setCursor] = useState({});

  // FETCHED ON EVERY VERSION OF THE DOCUMENT — `source` changes on save, and a save is the only
  // thing that can mint or clear a fire. The door is host-granted; a window without it (embeds,
  // the chat) simply shows no pin, the same silence `editable` already enforces.
  const bridge = typeof window !== "undefined" && window.systemview && window.systemview.documents;
  useEffect(() => {
    let dead = false;
    if (!bridge || !bridge.fires || !docPath) return undefined;
    Promise.resolve(bridge.fires({ path: docPath, project: projectCode }))
      .then((r) => {
        if (!dead) {
          setFires(r && r.ok && Array.isArray(r.fires) ? r.fires : []);
          setCursor({});
        }
      })
      .catch(() => {});
    return () => {
      dead = true;
    };
  }, [bridge, docPath, projectCode, source]);

  const refetch = async () => {
    if (!bridge || !bridge.fires) return;
    try {
      const r = await bridge.fires({ path: docPath, project: projectCode });
      setFires(r && r.ok && Array.isArray(r.fires) ? r.fires : []);
    } catch {}
  };

  // ONE ROW PER SCOPE — the document's own fires in one, each thread's in its own — because that
  // is how he reads the corner: which conversation moved, and who has not heard.
  const scopes = [];
  for (const f of fires) {
    if (!f.held || !f.held.length) continue;
    const key = f.thread || "";
    let s = scopes.find((x) => x.id === key);
    if (!s) {
      s = { id: key, kind: key ? "thread" : "document", fires: [], behind: [], counts: {} };
      scopes.push(s);
    }
    s.fires.push(f);
    f.held.forEach((m) => {
      if (!s.behind.includes(m)) s.behind.push(m);
      s.counts[m] = (s.counts[m] || 0) + 1;
    });
  }

  if (!editable || (!scopes.length && !refusal)) return null;

  // THE PRESS — `managed` means these waited for him, and this is the release. The host delivers
  // the held lane and stamps `told=` for exactly who was reached; an unreached member's chip stays,
  // and the next press retries, which is honest rather than annoying.
  const tell = async (member) => {
    if (!bridge || !bridge.releaseFires) {
      setRefusal("this window cannot release — the host door is not granted here");
      return;
    }
    setSending(member || "*");
    try {
      const r = await bridge.releaseFires({ path: docPath, project: projectCode, ...(member ? { member } : {}), by: "you" });
      if (!r || r.ok === false) setRefusal((r && r.error) || "the release was refused");
      else setRefusal("");
    } catch (e) {
      setRefusal((e && e.message) || "the release failed");
    }
    setSending("");
    refetch();
  };

  // CAUGHT UP WITHOUT BEING TOLD — the other answer to the same row. Somebody who was in the
  // document when the decision landed does not need waking for it. It stamps what a delivery
  // stamps — `told=` on each fire's own line, merged over what the line already says — and emits
  // NOTHING. Same record, because the record is only ever "they know about this one".
  const square = (scope, targets) => {
    setRefusal("");
    scope.fires.forEach((f) => {
      const owed = targets.filter((m) => f.held.includes(m));
      if (!owed.length) return;
      const union = [...new Set([...(f.told || []), ...owed])];
      setAttr(f.line, "told", union.join("|"));
    });
  };

  const behindCount = scopes.reduce((n, s) => n + s.behind.length, 0);
  const people = [...new Set(scopes.flatMap((s) => s.behind))];
  const squareEveryone = () => scopes.forEach((s) => square(s, s.behind));

  return (
    <div className={`md-members-pin${tucked ? " md-members-pin--tucked" : ""}`}>
      {/* THE COLLAPSED TAB — what the stack becomes, the same vertical strip every tucked panel in
          this window leaves behind. It says how much is waiting, because a tab that hides a count
          is a tab you learn to ignore. */}
      {tucked && (
        <button
          type="button"
          className="md-members-pin__tab"
          title={`${behindCount} waiting on your press — bring them back`}
          onClick={() => tuck(false)}
        >
          ‹ {behindCount}
        </button>
      )}
      {!tucked && (
        <div className="md-members-pin__dock">
          <div className="md-members-pin__stack">
            {people.length > 0 && (
              <button
                type="button"
                className="md-members-pin__all"
                title="release everything held — one press, not one per chip"
                disabled={!!sending}
                onClick={() => tell("")}
              >
                {sending ? "telling…" : `tell ${people.length === 1 ? people[0] : `all ${people.length}`}`}
              </button>
            )}
            {/* Not every held pile wants delivering — somebody who sat in the document while the
                decisions landed was there for them. Quieter than the tell, because telling is what
                the row is for. */}
            <button
              type="button"
              className="md-members-pin__square"
              title="they are caught up — stamp these told and wake nobody"
              disabled={!!sending}
              onClick={squareEveryone}
            >
              ✓ caught up
            </button>
            {scopes.map((scope) => {
              // EVERY ROW IS A DOOR (his ask, 2026-11-06: "bring it right to you") — the document's
              // decisions exactly like a thread's. Clicks CYCLE through the scope's held fires, so
              // several presses are several stops, not one jump to the first. IN THIS PANE ONLY
              // (his catch, 2026-10-26: the chat's karaoke stamps share `data-md-start`, so a
              // page-wide reveal scrolled the wrong surface).
              const reveal = (e) => {
                const root = e.currentTarget && e.currentTarget.closest ? e.currentTarget.closest(".markdown") : null;
                const i = cursor[`${scope.kind}-${scope.id}`] || 0;
                const f = scope.fires[i % scope.fires.length];
                revealBlock(root, f && f.line);
                setCursor((cur) => ({ ...cur, [`${scope.kind}-${scope.id}`]: i + 1 }));
              };
              const isThread = scope.kind === "thread";
              const many = scope.fires.length > 1 ? ` — ${scope.fires.length} held, click again for the next` : "";
              return (
                <div
                  className={`md-members-pin__row md-members-pin__row--${scope.kind}`}
                  key={`${scope.kind}-${scope.id}`}
                  role="button"
                  tabIndex={0}
                  title={(isThread ? `go to thread ${scope.id}` : "go to the held decision") + many}
                  onClick={reveal}
                  onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && reveal(e)}
                >
                  <span className="md-members__kind">{isThread ? `💬 ${scope.id}` : "decisions"}</span>
                  {scope.behind.map((m) => (
                    <button
                      type="button"
                      key={m}
                      className="md-members__chip md-members-pin__chip"
                      disabled={!!sending}
                      title={
                        (isThread
                          ? `release what thread ${scope.id} is holding for ${m}`
                          : `release the decisions held for ${m}`) + ` — ${scope.counts[m] || 0} waiting`
                      }
                      onClick={(e) => {
                        e.stopPropagation(); // a release is not a navigation — the pill around it is the door
                        tell(m);
                      }}
                    >
                      {m}
                      {/* THE COUNT IS THE RECEIPT OF HIS PRESSES (his ask, 2026-11-06): one tick
                          per held fire, on the button that releases them — so a third verdict
                          visibly makes it ·3 rather than leaving him to trust the row. */}
                      <span className="md-members__mark">·{scope.counts[m] || 0}</span>
                    </button>
                  ))}
                </div>
              );
            })}
          </div>
          <button
            type="button"
            className="md-members-pin__tuck"
            title="tuck these to the edge"
            onClick={() => tuck(true)}
          >
            ›
          </button>
        </div>
      )}
      {/* A REFUSAL IS SAID WHERE THE PRESS WAS, and it outlives the chips: a release that failed
          silently is a member who thinks they heard. */}
      {!!refusal && (
        <div className="md-members-pin__row">
          <span className="md-members__refusal">{refusal}</span>
        </div>
      )}
    </div>
  );
};

export default MembersPin;
