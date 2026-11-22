import { hasCloudAI } from '../lib/aiClient';
import { hasCloudTTS, prefetchSpeechClip, synthesizeSpeechBlob } from '../lib/ttsClient';
import { synthesizeLocalBriefing } from '../lib/dailyBriefingSynth';
import { Capacitor, registerPlugin } from '@capacitor/core';
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { ArrowUpRight, Headphones, Loader2, Pause, Play, Sparkles, Square, X } from 'lucide-react';
import type { AIProviderConfig, NewsArticle, TTSProviderConfig } from '../types/news';
import { useI18n } from '../lib/i18n';

const AndroidSpeech = registerPlugin<{
  speak(options: { text: string }): Promise<void>;
  stop(): Promise<void>;
  pause(): Promise<void>;
  resume(): Promise<void>;
}>('BriefingSpeech');
const android = Capacitor.getPlatform() === 'android';

const BRIEFING_SPEEDS = [0.9, 1, 1.15, 1.35] as const;

export function AudioBriefing({ articles, config, ttsConfig, open, onOpen, onClose, onOpenArticle, onBeforeSpeak }: {
  articles: NewsArticle[];
  config: AIProviderConfig;
  ttsConfig: TTSProviderConfig;
  open: boolean;
  onOpen: () => void;
  onClose: () => void;
  onOpenArticle?: (article: NewsArticle) => void;
  onBeforeSpeak?: () => void;
}) {
  const { lang, locale, t, categoryLabel, formatHeaderDate } = useI18n();
  const dialog = useRef<HTMLDialogElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const [aiBriefing, setAiBriefing] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [state, setState] = useState<'idle' | 'playing' | 'paused'>('idle');
  const [ttsLoading, setTtsLoading] = useState(false);
  const [activeBulletIndex, setActiveBulletIndex] = useState<number>(-1);
  const [speedIndex, setSpeedIndex] = useState(1);
  const [status, setStatus] = useState('');
  const request = useRef(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioUrlRef = useRef<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const speed = BRIEFING_SPEEDS[speedIndex];
  const speedRef = useRef<number>(speed);
  speedRef.current = speed;
  const cloud = hasCloudAI(config);
  const cloudTTS = hasCloudTTS(ttsConfig, config);

  const localBriefing = useMemo(
    () => synthesizeLocalBriefing(articles, lang, new Date(), 5),
    [articles, lang],
  );

  const cleanupAudio = () => {
    abortRef.current?.abort();
    abortRef.current = null;
    if (audioRef.current) {
      audioRef.current.onended = null;
      audioRef.current.onerror = null;
      audioRef.current.pause();
      audioRef.current.src = '';
      audioRef.current = null;
    }
    if (audioUrlRef.current) {
      URL.revokeObjectURL(audioUrlRef.current);
      audioUrlRef.current = null;
    }
    setTtsLoading(false);
  };

  const stopSpeaking = () => {
    cleanupAudio();
    if (android) void AndroidSpeech.stop().catch(() => {});
    else if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      if (window.speechSynthesis.paused) window.speechSynthesis.resume();
    }
  };

  useEffect(() => () => {
    request.current++;
    stopSpeaking();
  }, []);

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.playbackRate = speed;
    }
  }, [speed]);

  const stop = () => {
    request.current++;
    stopSpeaking();
    setState('idle');
    setActiveBulletIndex(-1);
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
      if (audioRef.current) {
        if (pause) audioRef.current.pause();
        else await audioRef.current.play();
      } else if (android) {
        await (pause ? AndroidSpeech.pause() : AndroidSpeech.resume());
      } else if ('speechSynthesis' in window) {
        if (pause) window.speechSynthesis.pause();
        else window.speechSynthesis.resume();
      }
      if (current !== request.current) return;
      setState(pause ? 'paused' : 'playing');
      setStatus(pause ? t('briefingPause') : t('briefingTrigger'));
    } catch {
      if (current === request.current) setStatus(t('retry'));
    }
  };

  const enhanceWithAI = async () => {
    if (!cloud || !articles.length) return;
    setAiLoading(true);
    setStatus(t('readerAnalyzing'));
    try {
      const { createAudioBriefing } = await import('../lib/aiClient');
      const text = await createAudioBriefing(config, articles);
      setAiBriefing(text);
      setStatus('');
    } catch {
      setStatus(t('retry'));
    } finally {
      setAiLoading(false);
    }
  };

  const play = async () => {
    const current = ++request.current;
    setStatus('');
    stopSpeaking();
    onBeforeSpeak?.();

    // Build synchronized chunks: intro -> each bullet -> quick notes (or AI prose if active)
    const segments: Array<{ text: string; bulletIdx: number }> = aiBriefing
      ? [{ text: aiBriefing.trim().slice(0, 2800), bulletIdx: -1 }]
      : [
          { text: `${localBriefing.greeting}. ${localBriefing.intro}`, bulletIdx: -1 },
          ...localBriefing.bullets.map((b, idx) => ({
            text: `${b.sources[0] ? `${b.sources[0]}: ` : ''}${b.headline}. ${b.detail !== b.headline ? b.detail : ''}`.trim(),
            bulletIdx: idx,
          })),
          ...(localBriefing.quickNotes.length
            ? [{
                text: `${t('briefingQuickNotes')}: ${localBriefing.quickNotes.map(q => `${q.sourceName}: ${q.title}`).join('. ')}.`,
                bulletIdx: -1,
              }]
            : []),
        ].filter(seg => seg.text.trim().length > 0);

    if (!segments.length) return;

    const speakSystemFrom = (startIndex: number) => {
      if (current !== request.current) return;
      if (android) {
        const remainingText = segments.slice(startIndex).map(s => s.text).join(' ').trim().slice(0, 4000);
        if (!remainingText) {
          setState('idle');
          setActiveBulletIndex(-1);
          return;
        }
        setState('playing');
        void AndroidSpeech.speak({ text: remainingText }).then(
          () => {
            if (current === request.current) {
              setState('idle');
              setActiveBulletIndex(-1);
            }
          },
          () => {
            if (current === request.current) {
              setState('idle');
              setStatus(t('retry'));
            }
          },
        );
        return;
      }

      if (!('speechSynthesis' in window)) {
        setState('idle');
        setActiveBulletIndex(-1);
        return;
      }
      window.speechSynthesis.cancel();
      setState('playing');

      const speakNext = (index: number) => {
        if (current !== request.current) return;
        if (index >= segments.length) {
          setState('idle');
          setActiveBulletIndex(-1);
          return;
        }
        const seg = segments[index];
        setActiveBulletIndex(seg.bulletIdx);
        const utterance = new SpeechSynthesisUtterance(seg.text);
        utterance.lang = locale;
        utterance.rate = speedRef.current;
        utterance.onend = () => speakNext(index + 1);
        utterance.onerror = event => {
          if (current !== request.current) return;
          if (['canceled', 'interrupted'].includes(event.error)) return;
          setState('idle');
          setActiveBulletIndex(-1);
          setStatus(t('retry'));
        };
        window.speechSynthesis.speak(utterance);
      };

      speakNext(startIndex);
    };

    if (cloudTTS && navigator.onLine) {
      setState('playing');

      const playCloudIndex = async (index: number): Promise<void> => {
        if (current !== request.current) return;
        if (index >= segments.length) {
          cleanupAudio();
          setState('idle');
          setActiveBulletIndex(-1);
          setStatus('');
          return;
        }
        const seg = segments[index];
        setActiveBulletIndex(seg.bulletIdx);
        setTtsLoading(true);
        setStatus(t('ttsLoadingAudio'));

        // Opportunistically prefetch next segment for gapless playback
        if (index + 1 < segments.length) {
          prefetchSpeechClip(segments[index + 1].text, 'briefing', ttsConfig, config, lang);
        }

        const controller = new AbortController();
        abortRef.current = controller;
        try {
          const blob = await synthesizeSpeechBlob(seg.text, 'briefing', ttsConfig, config, lang, controller.signal);
          if (current !== request.current) return;
          cleanupAudio();
          const url = URL.createObjectURL(blob);
          audioUrlRef.current = url;
          const audio = new Audio(url);
          audio.playbackRate = speedRef.current;
          audioRef.current = audio;
          setStatus('');
          audio.onended = () => {
            if (current === request.current) void playCloudIndex(index + 1);
          };
          audio.onerror = () => {
            if (current !== request.current) return;
            cleanupAudio();
            setStatus(t('ttsFallbackHint'));
            speakSystemFrom(index);
          };
          await audio.play();
        } catch {
          if (current !== request.current) return;
          cleanupAudio();
          setStatus(t('ttsFallbackHint'));
          speakSystemFrom(index);
        }
      };

      void playCloudIndex(0);
      return;
    }

    speakSystemFrom(0);
  };

  const handleOpenBulletArticle = (article: NewsArticle) => {
    if (state !== 'idle') stop();
    onClose();
    onOpenArticle?.(article);
  };

  const canSpeak = cloudTTS || android || 'speechSynthesis' in window;

  return (
    <>
      <button ref={trigger} className="briefing-trigger" type="button" aria-haspopup="dialog" onClick={onOpen}>
        <Headphones size={16} aria-hidden="true" />
        {t('briefingTrigger')}
      </button>
      <dialog
        ref={dialog}
        className="motion-dialog briefing-dialog"
        aria-labelledby="briefing-title"
        onCancel={event => { event.preventDefault(); onClose(); }}
        onClick={event => { if (event.target === event.currentTarget) onClose(); }}
      >
        <div className="reader-summary-content space-y-5">
          {/* Editorial Masthead Header */}
          <div className="flex items-start justify-between gap-3 border-b border-[var(--line)] pb-4">
            <div className="min-w-0">
              <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-[var(--accent)]">
                {formatHeaderDate(new Date())}
              </p>
              <h2 id="briefing-title" className="mt-0.5 text-2xl font-extrabold tracking-tight text-[var(--ink)]">
                {localBriefing.greeting || t('briefingTrigger')}
              </h2>
              {localBriefing.bullets.length > 0 && (
                <p className="mt-1 text-sm leading-relaxed text-[var(--muted)]">
                  {localBriefing.intro}
                </p>
              )}
              {localBriefing.bullets.length > 0 && (
                <p className="mt-1.5 text-xs font-medium text-[var(--muted)] tabular-nums">
                  {t('briefingSourcesCount', { count: localBriefing.sourceCount })} · {t('briefingReadMin', { min: localBriefing.estimatedMinutes })}
                </p>
              )}
            </div>
            <button type="button" autoFocus className="glass-icon shrink-0" aria-label={t('close')} onClick={onClose}>
              <X size={20} aria-hidden="true" />
            </button>
          </div>

          {/* Audio Playback Controls Bar */}
          {canSpeak && (articles.length > 0 || state !== 'idle') && (
            <div className="flex flex-wrap items-center gap-2">
              <button
                className="primary-action inline-flex min-h-11 items-center gap-2 px-4 text-xs"
                type="button"
                onClick={state === 'idle' ? () => void play() : () => void togglePause()}
              >
                {ttsLoading ? (
                  <Loader2 size={15} className="animate-spin" aria-hidden="true" />
                ) : state === 'playing' ? (
                  <Pause size={15} fill="currentColor" aria-hidden="true" />
                ) : (
                  <Play size={15} fill="currentColor" aria-hidden="true" />
                )}
                {state === 'idle'
                  ? t('briefingListen')
                  : state === 'playing'
                    ? t('briefingPause')
                    : t('briefingResume')}
              </button>
              {state !== 'idle' && (
                <button className="choice-pill inline-flex items-center gap-1.5" type="button" onClick={stop}>
                  <Square size={13} fill="currentColor" aria-hidden="true" />
                  {t('briefingStop')}
                </button>
              )}
              <button
                type="button"
                className="choice-pill tabular-nums"
                aria-label={t('mediaAudioSpeed')}
                onClick={() => setSpeedIndex(i => (i + 1) % BRIEFING_SPEEDS.length)}
              >
                {speed}×
              </button>
              {cloud && (
                <button
                  type="button"
                  className="choice-pill inline-flex items-center gap-1.5"
                  disabled={aiLoading}
                  onClick={() => void enhanceWithAI()}
                >
                  {aiLoading ? (
                    <Loader2 size={14} className="animate-spin" aria-hidden="true" />
                  ) : (
                    <Sparkles size={14} className="text-[var(--accent)]" aria-hidden="true" />
                  )}
                  {t('briefingEnhanceAI')}
                </button>
              )}
            </div>
          )}

          {/* Optional Cloud AI Narrative Block */}
          {aiBriefing && (
            <div className="rounded-2xl border border-[var(--line)] bg-[var(--panel-2)] p-4 space-y-1.5">
              <p className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-[var(--accent)]">
                <Sparkles size={13} aria-hidden="true" />
                KI-Tagesüberblick
              </p>
              <p className="whitespace-pre-line text-sm leading-relaxed text-[var(--ink)]">{aiBriefing}</p>
            </div>
          )}

          {/* Structured Local Synthesized Briefing Bullets */}
          {localBriefing.bullets.length > 0 ? (
            <div className="space-y-4">
              <ol className="space-y-3">
                {localBriefing.bullets.map((bullet, idx) => {
                  const isActive = activeBulletIndex === idx;
                  return (
                    <li
                      key={bullet.id}
                      className={`reader-speech-para rounded-2xl border p-3.5 transition-colors ${
                        isActive
                          ? 'reader-speaking-active border-[var(--accent)]/40'
                          : 'border-[var(--line)] bg-[var(--panel)]'
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => handleOpenBulletArticle(bullet.leadArticle)}
                        className="group block w-full text-left"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-[11px] font-bold tracking-wide text-[var(--accent)]">
                            {idx + 1}. {categoryLabel(bullet.category)}
                          </span>
                          <ArrowUpRight
                            size={15}
                            className="shrink-0 text-[var(--muted)] transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-[var(--ink)]"
                            aria-hidden="true"
                          />
                        </div>
                        <p className="mt-1 text-[15px] font-bold leading-snug text-[var(--ink)]">
                          {bullet.headline}
                        </p>
                        {bullet.detail && bullet.detail !== bullet.headline && (
                          <p className="mt-1.5 text-[13.5px] leading-relaxed text-[var(--ink-soft,var(--muted))]">
                            {bullet.detail}
                          </p>
                        )}
                        <p className="mt-2 text-[11.5px] font-medium text-[var(--muted)]">
                          {bullet.sources.join(' · ')}
                          {bullet.relatedCount > 0 ? ` (+${bullet.relatedCount})` : ''}
                        </p>
                      </button>
                    </li>
                  );
                })}
              </ol>

              {/* Quick Notes Strip */}
              {localBriefing.quickNotes.length > 0 && (
                <div className="space-y-2 border-t border-[var(--line)] pt-4">
                  <h3 className="text-xs font-bold uppercase tracking-[0.06em] text-[var(--muted)]">
                    {t('briefingQuickNotes')}
                  </h3>
                  <ul className="divide-y divide-[var(--line)]">
                    {localBriefing.quickNotes.map(note => (
                      <li key={note.article.id}>
                        <button
                          type="button"
                          onClick={() => handleOpenBulletArticle(note.article)}
                          className="flex min-h-11 w-full items-center justify-between gap-3 py-2 text-left transition-colors hover:text-[var(--accent)]"
                        >
                          <span className="min-w-0 text-[13.5px] font-medium leading-snug text-[var(--ink)]">
                            <span className="font-semibold text-[var(--muted)]">{note.sourceName}: </span>
                            {note.title}
                          </span>
                          <ArrowUpRight size={14} className="shrink-0 text-[var(--muted)]" aria-hidden="true" />
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          ) : (
            <p className="text-sm text-[var(--muted)]">{t('briefingEmpty')}</p>
          )}

          {status && <p className="text-xs text-[var(--muted)]" role="status">{status}</p>}
        </div>
      </dialog>
    </>
  );
}
