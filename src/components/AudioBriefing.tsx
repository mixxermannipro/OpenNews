import { useEffect, useRef, useState } from 'react';
import type { AIProviderConfig, NewsArticle } from '../types/news';

export function AudioBriefing({ articles, config }: { articles: NewsArticle[]; config: AIProviderConfig }) {
  const [state, setState] = useState<'idle' | 'loading' | 'playing'>('idle');
  const [status, setStatus] = useState('');
  const request = useRef(0);
  const utterance = useRef<SpeechSynthesisUtterance | null>(null);
  useEffect(() => () => {
    request.current++;
    if (utterance.current) window.speechSynthesis.cancel();
  }, []);

  const play = async () => {
    if (state !== 'idle') {
      request.current++;
      if (utterance.current) window.speechSynthesis.cancel();
      utterance.current = null;
      setState('idle');
      setStatus('');
      return;
    }
    const current = ++request.current;
    setState('loading');
    setStatus('Tagesüberblick wird erstellt …');
    try {
      const { createAudioBriefing } = await import('../lib/aiClient');
      const text = await createAudioBriefing(config, articles);
      if (current !== request.current) return;
      if (!text.trim()) throw new Error('Leere Antwort');
      const speech = new SpeechSynthesisUtterance(text.trim().slice(0, 4000));
      speech.lang = 'de-DE';
      const finish = (message: string) => {
        if (current !== request.current) return;
        utterance.current = null;
        setState('idle');
        setStatus(message);
      };
      speech.onend = () => finish('Tagesüberblick beendet.');
      speech.onerror = () => finish('Wiedergabe fehlgeschlagen.');
      utterance.current = speech;
      window.speechSynthesis.speak(speech);
      setState('playing');
      setStatus('Tagesüberblick läuft.');
    } catch {
      if (current !== request.current) return;
      setState('idle');
      setStatus('Tagesüberblick konnte nicht erstellt werden.');
    }
  };

  if (!('speechSynthesis' in window) || !config.apiKey.trim() || !articles.length) return null;
  return (
    <div className="space-y-2">
      <button className="choice-pill" type="button" onClick={() => void play()}>
        {state === 'idle' ? 'Tagesüberblick anhören' : state === 'loading' ? 'Erstellung abbrechen' : 'Wiedergabe stoppen'}
      </button>
      <p className="text-sm">Die eingestellte KI erhält bis zu acht Überschriften und Kurztexte. Dein Gerät liest den Überblick vor.</p>
      <p className="text-sm" role="status">{status}</p>
    </div>
  );
}
