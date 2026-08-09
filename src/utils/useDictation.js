import { useRef, useState } from "react";

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
  const supported = !!SR;

  const stop = () => {
    try {
      if (recRef.current) recRef.current.stop();
    } catch {}
  };

  const toggle = () => {
    if (listening) {
      stop();
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
