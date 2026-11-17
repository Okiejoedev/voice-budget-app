// Voice input using the browser's built-in speech recognition (free; works in Chrome on
// Android and desktop, Edge and Safari). Firefox has no support, so the text box is the fallback.

import { useCallback, useEffect, useRef, useState } from 'react';

interface RecognitionAlternative { transcript: string }
interface RecognitionResult { isFinal: boolean; 0: RecognitionAlternative; length: number }
interface RecognitionEvent { resultIndex: number; results: { length: number; [i: number]: RecognitionResult } }
interface RecognitionErrorEvent { error: string }
interface Recognition {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((e: RecognitionEvent) => void) | null;
  onerror: ((e: RecognitionErrorEvent) => void) | null;
  onend: (() => void) | null;
}
type RecognitionCtor = new () => Recognition;

function getCtor(): RecognitionCtor | null {
  const w = window as unknown as { SpeechRecognition?: RecognitionCtor; webkitSpeechRecognition?: RecognitionCtor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

const ERRORS: Record<string, string> = {
  'not-allowed': 'Microphone permission was blocked. Allow the mic for this site in your browser settings.',
  'service-not-allowed': 'Microphone permission was blocked. Allow the mic for this site in your browser settings.',
  'no-speech': 'I no hear anything. Tap the mic and talk again.',
  'audio-capture': 'No microphone found on this device.',
  network: 'Voice needs internet. Check your data or type am instead.',
};

export function useSpeech(lang: string) {
  const supported = typeof window !== 'undefined' && !!getCtor();
  const [listening, setListening] = useState(false);
  const [interim, setInterim] = useState('');
  const [error, setError] = useState<string | null>(null);
  const recRef = useRef<Recognition | null>(null);
  const finalRef = useRef('');
  const onDoneRef = useRef<((text: string) => void) | null>(null);

  useEffect(() => () => recRef.current?.abort(), []);

  const start = useCallback((onDone: (text: string) => void) => {
    const Ctor = getCtor();
    if (!Ctor) return;
    recRef.current?.abort();
    const rec = new Ctor();
    rec.lang = lang;
    rec.continuous = false;
    rec.interimResults = true;
    rec.maxAlternatives = 1;
    finalRef.current = '';
    onDoneRef.current = onDone;
    setInterim('');
    setError(null);
    rec.onresult = (e) => {
      let text = '';
      let fin = '';
      for (let i = 0; i < e.results.length; i++) {
        const r = e.results[i];
        if (r.isFinal) fin += r[0].transcript + ' ';
        else text += r[0].transcript;
      }
      if (fin) finalRef.current = fin.trim();
      setInterim((finalRef.current + ' ' + text).trim());
    };
    rec.onerror = (e) => {
      if (e.error !== 'aborted') setError(ERRORS[e.error] ?? `Voice error: ${e.error}`);
    };
    rec.onend = () => {
      setListening(false);
      const text = finalRef.current.trim();
      setInterim('');
      if (text && onDoneRef.current) onDoneRef.current(text);
    };
    recRef.current = rec;
    try {
      rec.start();
      setListening(true);
    } catch {
      setError('Could not start the microphone. Try again.');
    }
  }, [lang]);

  const stop = useCallback(() => recRef.current?.stop(), []);

  return { supported, listening, interim, error, start, stop, clearError: () => setError(null) };
}

export function speak(text: string, enabled: boolean): void {
  if (!enabled || typeof window === 'undefined' || !('speechSynthesis' in window)) return;
  window.speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text.replace(/₦/g, 'naira '));
  const voices = window.speechSynthesis.getVoices();
  u.voice = voices.find((v) => v.lang === 'en-NG') ?? voices.find((v) => v.lang.startsWith('en')) ?? null;
  u.rate = 1;
  window.speechSynthesis.speak(u);
}
