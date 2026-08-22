import { useRef, useState } from "react";
import { hasHostDictation, startHostRecording } from "./hostDictation";

// Browser-native dictation, extracted from the chat's mic so ANY input can listen the same way
// (the chat panel keeps its own proven copy; this hook exists for every other input — thread
// replies first). Press to listen, press again to stop; INTERIM transcripts stream through
// `interim` (render them — the live line IS the recording indicator), finals arrive through
// `onFinal`. Input only — no TTS, no duplex.
//
// `onFinal` is captured when listening starts, so append with a FUNCTIONAL state update
// (setText((cur) => …)) — never read component state inside it.
export default function useDictation(onFinal) {
  const recRef = useRef(null);
  const [listening, setListening] = useState(false);
  const [interim, setInterim] = useState("");
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  // AN EMBEDDING HOST WINS when it offers dictation, because inside Electron the SR object exists
  // and does nothing — see utils/hostDictation.js. Anywhere else, SR as before.
  const hostRecRef = useRef(null);
  const viaHost = hasHostDictation();
  const supported = !!SR || viaHost;

  // Segments commit through `onSegment` as you pause, so stopping only has to close the last one —
  // it deliberately appends nothing itself, or the tail would land twice.
  const finishHost = async () => {
    const rec = hostRecRef.current;
    if (!rec) return;
    hostRecRef.current = null;
    setInterim("transcribing…");
    try {
      await rec.stop();
    } catch {
      /* the host said no — the mic simply goes quiet rather than throwing into the caller */
    }
    setListening(false);
    setInterim("");
  };

  const stop = () => {
    if (viaHost) return finishHost();
    try {
      if (recRef.current) recRef.current.stop();
    } catch {}
  };

  const toggle = async () => {
    if (listening) {
      stop();
      return;
    }
    if (viaHost) {
      try {
        // The draft pass paints the same interim line SR streamed into — his ask, immediately
        // after the first version landed: "the previous one used to show my text as I talk".
        hostRecRef.current = await startHostRecording({
          // Rough words while you talk…
          onDraft: (t) => setInterim(t),
          // …and the clean text lands in the caller's input at every pause, mid-recording.
          onSegment: (t) => {
            setInterim("");
            onFinal(t);
          },
        });
        setInterim("");
        setListening(true);
      } catch {
        setListening(false);
      }
      return;
    }
    try {
      const rec = new SR();
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
          onFinal(fin.trim());
          setInterim("");
        } else {
          setInterim(inter);
        }
      };
      rec.onend = () => {
        setListening(false);
        setInterim("");
      };
      rec.onerror = () => {
        setListening(false);
        setInterim("");
      };
      recRef.current = rec;
      rec.start();
      setListening(true);
    } catch {
      setListening(false);
    }
  };

  return { supported, listening, interim, toggle, stop };
}
