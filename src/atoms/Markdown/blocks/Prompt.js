import React, { useEffect, useRef, useState } from "react";
import { useDocMembers } from "../context";

// `::prompt[button label]{text="the ask"}` — A PROMPT, IN A DOCUMENT, PRESSABLE (his design,
// 2026-10-29: "a button that you can put any prompt behind, in any document — that's all").
//
// The block is deliberately dumb: it carries words and a press sends them into the chat as a
// visible message, through the SAME send() a typed one takes (the sv:say door — queueing, echo,
// words-back-on-failure, all of it). No semantics live here: what the prompt asks for — a demo, a
// walkthrough, a job — is between the author and the agent. A fixture's "show me this walk", a
// report's "demo what landed": same block, different words.
//
// Nothing runs invisibly: the press produces a message he can see in the chat, and the agent's
// answer arrives like any other reply. The button never speaks for the agent and never runs code.
const Prompt = ({ attrs = {}, label }) => {
  const { projectCode = "" } = useDocMembers() || {};
  const [sent, setSent] = useState(false);
  const t = useRef(null);
  useEffect(() => () => clearTimeout(t.current), []);
  const text = String(attrs.text || attrs.prompt || "").trim();
  // A button with no words is a press that does nothing — said, not silently rendered dead.
  if (!text)
    return (
      <span className="md-prompt md-prompt--invalid" title='a prompt block needs its words: ::prompt[label]{text="…"}'>
        prompt — no text to send
      </span>
    );
  return (
    <span className="md-prompt">
      <button
        type="button"
        className="md-prompt__btn"
        title={`sends to the chat: ${text.slice(0, 140)}`}
        onClick={() => {
          // NOT AS IF HE TYPED IT (his, 2026-10-29: "don't let it land as a normal — as if I sent
          // it"): the message wears the press mark, so the chat row and the agent both read it as
          // a document's button firing, not his own words.
          window.dispatchEvent(
            new CustomEvent("sv:say", { detail: { text: `🔘 ${text}`, ...(projectCode ? { projectCode } : {}) } })
          );
          setSent(true);
          clearTimeout(t.current);
          t.current = setTimeout(() => setSent(false), 2400);
        }}
      >
        {sent ? "sent ✓ — watch the chat" : String(label || "ask")}
      </button>
    </span>
  );
};

export default Prompt;
