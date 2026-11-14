import { hasCloudAI } from '../lib/aiClient';
import { Capacitor, registerPlugin } from '@capacitor/core';
import { useEffect, useRef, useState } from 'react';
import type { AIProviderConfig, NewsArticle } from '../types/news';

const AndroidSpeech = registerPlugin<{ speak(options: { text: string }): Promise<void>; stop(): Promise<void> }>('BriefingSpeech');
const android = Capacitor.getPlatform() === 'android';

export function AudioBriefing({ articles, config, open }: { articles: NewsArticle[]; config: AIProviderConfig; open: boolean }) {
  const [expanded, setExpanded] = useState(open);
  const [briefing, setBriefing] = useState('');
  const cloud = hasCloudAI(config);
  useEffect(() => { if (open) setExpanded(true); }, [open]);
  const [state, setState] = useState<'idle' | 'loading' | 'playing'>('idle');
  const [status, setStatus] = useState('');
  const request = useRef(0);
  const utterance = useRef<SpeechSynthesisUtterance | null>(null);
  const stopSpeaking = () => {
    if (android) void AndroidSpeech.stop().catch(() => {});
    else if (utterance.current) window.speechSynthesis.cancel();
  };
  useEffect(() => () => {
    request.current++;
    stopSpeaking();
  }, []);

  const play = async () => {
    if (state !== 'idle') {
      request.current++;
      stopSpeaking();
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
      let text = articles.slice(0, 8).map(article => `${article.sourceName}. ${article.title}`).join('\n');
      if (cloud) {
        try { text = await createAudioBriefing(config, articles); } catch { /* Keep the headlines usable offline. */ }
      }
      if (current !== request.current) return;
      if (!text.trim()) throw new Error('Leere Antwort');
      const finish = (message: string) => {
        if (current !== request.current) return;
        utterance.current = null;
        setState('idle');
        setStatus(message);
      };
      setBriefing(text);
      setState('playing');
      setStatus('Tagesüberblick läuft.');
      if (android) {
        await AndroidSpeech.speak({ text: text.trim().slice(0, 4000) }).then(
          () => finish('Tagesüberblick beendet.'),
          () => finish('Vorlesen fehlgeschlagen. Prüfe die deutsche Android-Systemstimme.'),
        );
        return;
      }
      const speech = new SpeechSynthesisUtterance(text.trim().slice(0, 4000));
      speech.lang = 'de-DE';
      speech.onend = () => finish('Tagesüberblick beendet.');
      speech.onerror = () => finish('Wiedergabe fehlgeschlagen.');
      utterance.current = speech;
      window.speechSynthesis.speak(speech);
    } catch {
      if (current !== request.current) return;
      setState('idle');
      setStatus('Tagesüberblick konnte nicht erstellt werden.');
    }
  };

  const canSpeak = android || 'speechSynthesis' in window;
  return (
    <div className="space-y-2">
      <button className="choice-pill" type="button" aria-expanded={expanded} onClick={() => setExpanded(value => !value)}>
        Tagesüberblick
      </button>
      {canSpeak && articles.length > 0 && (cloud || expanded) && <button className="choice-pill" type="button" onClick={() => void play()}>
        {state === 'idle' ? 'Tagesüberblick anhören' : state === 'loading' ? 'Erstellung abbrechen' : 'Wiedergabe stoppen'}
      </button>}
      {expanded && <section className="settings-group space-y-2 px-4 py-3" aria-label="Tagesüberblick">
        <h2 className="font-semibold">Dein Tagesüberblick</h2>
        {briefing ? <p className="whitespace-pre-line text-sm">{briefing}</p> : articles.length ? <ul className="list-disc space-y-1 ps-5 text-sm">
          {articles.slice(0, 8).map(article => <li key={article.id}>{article.title} · {article.sourceName}</li>)}
        </ul> : <p className="text-sm">Sobald deine Meldungen geladen sind, erscheinen hier die Schlagzeilen.</p>}
      </section>}
      {cloud && <p className="text-sm">Beim Anhören erhält die eingestellte KI bis zu acht Überschriften und Kurztexte.</p>}
      <p className="text-sm" role="status">{status}</p>
    </div>
  );
}
