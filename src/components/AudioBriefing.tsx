import { hasCloudAI } from '../lib/aiClient';
import { Capacitor, registerPlugin } from '@capacitor/core';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Headphones, X } from 'lucide-react';
import type { AIProviderConfig, NewsArticle } from '../types/news';

const AndroidSpeech = registerPlugin<{
  speak(options: { text: string }): Promise<void>;
  stop(): Promise<void>;
  pause(): Promise<void>;
  resume(): Promise<void>;
}>('BriefingSpeech');
const android = Capacitor.getPlatform() === 'android';

export function AudioBriefing({ articles, config, open, onOpen, onClose }: {
  articles: NewsArticle[];
  config: AIProviderConfig;
  open: boolean;
  onOpen: () => void;
  onClose: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const [briefing, setBriefing] = useState('');
  const cloud = hasCloudAI(config);
  const [state, setState] = useState<'idle' | 'loading' | 'playing' | 'paused'>('idle');
  const [status, setStatus] = useState('');
  const request = useRef(0);
  const utterance = useRef<SpeechSynthesisUtterance | null>(null);
  const stopSpeaking = () => {
    if (android) void AndroidSpeech.stop().catch(() => {});
    else if (utterance.current) {
      window.speechSynthesis.cancel();
      if (window.speechSynthesis.paused) window.speechSynthesis.resume();
    }
  };
  useEffect(() => () => {
    request.current++;
    stopSpeaking();
  }, []);

  const stop = () => {
    request.current++;
    stopSpeaking();
    utterance.current = null;
    setState('idle');
    setStatus('');
  };

  useLayoutEffect(() => {
    const element = dialog.current;
    if (open && !element?.open) element?.showModal();
    if (!open && element?.open) {
      if (state !== 'idle') stop();
      element.close();
      trigger.current?.focus({ preventScroll: true });
    }
  }, [open]);

  const togglePause = async () => {
    const current = request.current;
    const pause = state === 'playing';
    try {
      if (android) await (pause ? AndroidSpeech.pause() : AndroidSpeech.resume());
      else if (pause) window.speechSynthesis.pause();
      else window.speechSynthesis.resume();
      if (current !== request.current) return;
      setState(pause ? 'paused' : 'playing');
      setStatus(pause ? 'Wiedergabe pausiert.' : 'Tagesüberblick läuft.');
    } catch {
      if (current === request.current) setStatus('Wiedergabe konnte nicht umgeschaltet werden.');
    }
  };

  const play = async () => {
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
        request.current++;
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
    <>
      <button ref={trigger} className="briefing-trigger" type="button" aria-haspopup="dialog" onClick={onOpen}>
        <Headphones size={16} aria-hidden="true" />
        Tagesüberblick
      </button>
      <dialog ref={dialog} className="briefing-dialog" aria-labelledby="briefing-title"
        onCancel={event => { event.preventDefault(); onClose(); }}
        onClick={event => { if (event.target === event.currentTarget) onClose(); }}>
        <div className="reader-summary-content space-y-4">
          <div className="flex items-center justify-between gap-2">
            <h2 id="briefing-title" className="text-xl font-semibold">Tagesüberblick</h2>
            <button type="button" autoFocus className="glass-icon shrink-0" aria-label="Tagesüberblick schließen" onClick={onClose}>
              <X size={20} aria-hidden="true" />
            </button>
          </div>
          {briefing ? <p className="whitespace-pre-line text-sm">{briefing}</p> : articles.length ? (
            <ul className="divide-y divide-[var(--line)] text-sm">
              {articles.slice(0, 8).map(article => <li className="py-2" key={article.id}>
                <span className="block font-medium">{article.title}</span>
                <span className="text-[var(--muted)]">{article.sourceName}</span>
              </li>)}
            </ul>
          ) : <p className="text-sm">Sobald deine Meldungen geladen sind, erscheinen hier die Schlagzeilen.</p>}
          {canSpeak && (articles.length > 0 || state !== 'idle') && <div className="flex flex-wrap gap-2">
            {(state === 'playing' || state === 'paused') && (
              <button className="choice-pill" type="button" onClick={() => void togglePause()}>
                {state === 'playing' ? 'Wiedergabe pausieren' : 'Wiedergabe fortsetzen'}
              </button>
            )}
            <button className="choice-pill" type="button" onClick={state === 'idle' ? () => void play() : stop}>
              {state === 'idle' ? 'Tagesüberblick anhören' : state === 'loading' ? 'Erstellung abbrechen' : 'Wiedergabe stoppen'}
            </button>
          </div>}
          <p className="text-sm text-[var(--muted)]" role="status">{status}</p>
          {cloud && <p className="text-sm text-[var(--muted)]">Beim Anhören erhält die eingestellte KI bis zu acht Überschriften und Kurztexte.</p>}
        </div>
      </dialog>
    </>
  );
}
