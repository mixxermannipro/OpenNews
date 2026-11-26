import { hasCloudAI } from '../lib/aiClient';
import { hasCloudTTS, prefetchSpeechClip, synthesizeSpeechBlob } from '../lib/ttsClient';
import { synthesizeLocalBriefing } from '../lib/dailyBriefingSynth';
import { getReaderCopy } from '../lib/readerCopy';
import { Capacitor, registerPlugin } from '@capacitor/core';
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { ArrowUpRight, Headphones, Loader2, Pause, Play, SkipBack, SkipForward, Sparkles, Square, X } from 'lucide-react';
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

interface BriefingSegment {
  text: string;
  label: string;
  bulletIdx: number;
  article?: NewsArticle;
}

export function AudioBriefing({
  articles,
  config,
  ttsConfig,
  open,
  stopSignal = 0,
  onOpen,
  onClose,
  onOpenArticle,
  onBeforeSpeak,
  onPlaybackChange,
}: {
  articles: NewsArticle[];
  config: AIProviderConfig;
  ttsConfig: TTSProviderConfig;
  open: boolean;
  stopSignal?: number;
  onOpen: () => void;
  onClose: () => void;
  onOpenArticle?: (article: NewsArticle, contextList?: readonly NewsArticle[]) => void;
  onBeforeSpeak?: () => void;
  onPlaybackChange?: (active: boolean) => void;
}) {
  const { lang, locale, t, categoryLabel, formatHeaderDate } = useI18n();
  const copy = getReaderCopy(lang);
  const dialog = useRef<HTMLDialogElement>(null);
  const [aiBriefing, setAiBriefing] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [state, setState] = useState<'idle' | 'playing' | 'paused'>('idle');
  const [ttsLoading, setTtsLoading] = useState(false);
  const [activeSegmentIndex, setActiveSegmentIndex] = useState<number>(-1);
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
  const lastStopSignalRef = useRef(stopSignal);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const restoreFocusRef = useRef(true);

  const localBriefing = useMemo(
    () => synthesizeLocalBriefing(articles, lang, new Date(), 5),
    [articles, lang],
  );

  const briefingArticles = useMemo(() => {
    const items: NewsArticle[] = [];
    const seen = new Set<string>();
    for (const bullet of localBriefing.bullets) {
      if (!seen.has(bullet.leadArticle.id)) {
        seen.add(bullet.leadArticle.id);
        items.push(bullet.leadArticle);
      }
    }
    for (const note of localBriefing.quickNotes) {
      if (!seen.has(note.article.id)) {
        seen.add(note.article.id);
        items.push(note.article);
      }
    }
    return items;
  }, [localBriefing]);

  const segments = useMemo<BriefingSegment[]>(() => {
    if (aiBriefing) {
      return [{
        text: aiBriefing.trim().slice(0, 2800),
        label: copy.briefingAiLabel,
        bulletIdx: -1,
      }];
    }
    return [
      {
        text: `${localBriefing.greeting}. ${localBriefing.intro}`,
        label: copy.briefingIntroLabel,
        bulletIdx: -1,
      },
      ...localBriefing.bullets.map((b, idx) => ({
        text: `${b.sources[0] ? `${b.sources[0]}: ` : ''}${b.headline}. ${b.detail !== b.headline ? b.detail : ''}`.trim(),
        label: b.headline,
        bulletIdx: idx,
        article: b.leadArticle,
      })),
      ...(localBriefing.quickNotes.length
        ? [{
            text: `${t('briefingQuickNotes')}: ${localBriefing.quickNotes.map(q => `${q.sourceName}: ${q.title}`).join('. ')}.`,
            label: copy.briefingQuickNotesLabel,
            bulletIdx: -1,
            article: localBriefing.quickNotes[0]?.article,
          }]
        : []),
    ].filter(seg => seg.text.trim().length > 0);
  }, [aiBriefing, localBriefing, copy.briefingAiLabel, copy.briefingIntroLabel, copy.briefingQuickNotesLabel, t]);

  const activeSegment = activeSegmentIndex >= 0 ? segments[activeSegmentIndex] : undefined;
  const activeBulletIndex = activeSegment?.bulletIdx ?? -1;

  const cleanupAudio = useCallback(() => {
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
  }, []);

  const stopSpeaking = useCallback(() => {
    cleanupAudio();
    if (android) void AndroidSpeech.stop().catch(() => {});
    else if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      if (window.speechSynthesis.paused) window.speechSynthesis.resume();
    }
  }, [cleanupAudio]);

  const stop = useCallback(() => {
    request.current++;
    stopSpeaking();
    setState('idle');
    setActiveSegmentIndex(-1);
    setStatus('');
  }, [stopSpeaking]);

  useEffect(() => {
    onPlaybackChange?.(state !== 'idle');
  }, [state, onPlaybackChange]);

  useEffect(() => {
    if (stopSignal !== lastStopSignalRef.current) {
      lastStopSignalRef.current = stopSignal;
      if (state !== 'idle') stop();
    }
  }, [stopSignal, state, stop]);

  useEffect(() => () => {
    request.current++;
    stopSpeaking();
    const target = previousFocusRef.current;
    previousFocusRef.current = null;
    if (restoreFocusRef.current && target && target.isConnected) {
      target.focus({ preventScroll: true });
    }
  }, [stopSpeaking]);

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.playbackRate = speed;
    }
  }, [speed]);

  // Closing the dialog keeps playback running seamlessly in the floating mini player
  useLayoutEffect(() => {
    const element = dialog.current;
    if (open) {
      restoreFocusRef.current = true;
      if (!previousFocusRef.current && document.activeElement instanceof HTMLElement) {
        previousFocusRef.current = document.activeElement;
      }
      if (element && !element.open) element.showModal();
    } else {
      if (element?.open) element.close();
      const target = previousFocusRef.current;
      previousFocusRef.current = null;
      if (restoreFocusRef.current && target && target.isConnected) {
        target.focus({ preventScroll: true });
      }
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

  const playFromIndex = useCallback((startIndex = 0, rateOverride?: number) => {
    if (!segments.length) return;
    const bounded = Math.max(0, Math.min(startIndex, segments.length - 1));
    const current = ++request.current;
    setStatus('');
    stopSpeaking();
    onBeforeSpeak?.();

    const speakSystemFrom = (idxStart: number) => {
      if (current !== request.current) return;
      if (android) {
        const remainingText = segments.slice(idxStart).map(s => s.text).join(' ').trim().slice(0, 4000);
        if (!remainingText) {
          setState('idle');
          setActiveSegmentIndex(-1);
          return;
        }
        setActiveSegmentIndex(idxStart);
        setState('playing');
        void AndroidSpeech.speak({ text: remainingText }).then(
          () => {
            if (current === request.current) {
              setState('idle');
              setActiveSegmentIndex(-1);
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
        setActiveSegmentIndex(-1);
        return;
      }
      window.speechSynthesis.cancel();
      setState('playing');

      const speakNext = (index: number) => {
        if (current !== request.current) return;
        if (index >= segments.length) {
          setState('idle');
          setActiveSegmentIndex(-1);
          return;
        }
        const seg = segments[index];
        setActiveSegmentIndex(index);
        const utterance = new SpeechSynthesisUtterance(seg.text);
        utterance.lang = locale;
        utterance.rate = rateOverride ?? speedRef.current;
        utterance.onend = () => speakNext(index + 1);
        utterance.onerror = event => {
          if (current !== request.current) return;
          if (['canceled', 'interrupted'].includes(event.error)) return;
          setState('idle');
          setActiveSegmentIndex(-1);
          setStatus(t('retry'));
        };
        window.speechSynthesis.speak(utterance);
      };

      speakNext(idxStart);
    };

    if (cloudTTS && navigator.onLine) {
      setState('playing');

      const playCloudIndex = async (index: number): Promise<void> => {
        if (current !== request.current) return;
        if (index >= segments.length) {
          cleanupAudio();
          setState('idle');
          setActiveSegmentIndex(-1);
          setStatus('');
          return;
        }
        const seg = segments[index];
        setActiveSegmentIndex(index);
        setTtsLoading(true);
        setStatus(t('ttsLoadingAudio'));

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
          audio.playbackRate = rateOverride ?? speedRef.current;
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

      void playCloudIndex(bounded);
      return;
    }

    speakSystemFrom(bounded);
  }, [segments, stopSpeaking, onBeforeSpeak, locale, cloudTTS, cleanupAudio, t, ttsConfig, config, lang]);

  const cycleSpeed = () => {
    const nextIdx = (speedIndex + 1) % BRIEFING_SPEEDS.length;
    setSpeedIndex(nextIdx);
    const nextRate = BRIEFING_SPEEDS[nextIdx];
    if (audioRef.current) {
      audioRef.current.playbackRate = nextRate;
      return;
    }
    if (state === 'playing' && activeSegmentIndex >= 0 && !android) {
      playFromIndex(activeSegmentIndex, nextRate);
    }
  };

  const handleOpenBulletArticle = (article: NewsArticle) => {
    restoreFocusRef.current = false;
    if (onOpenArticle) {
      onOpenArticle(article, briefingArticles);
    } else {
      onClose();
    }
  };

  const canSpeak = cloudTTS || android || 'speechSynthesis' in window;
  const progressPct = segments.length > 0 && activeSegmentIndex >= 0
    ? Math.round(((activeSegmentIndex + 1) / segments.length) * 100)
    : 0;

  return (
    <>
      <dialog
        ref={dialog}
        className="motion-dialog briefing-dialog"
        aria-labelledby="briefing-title"
        onCancel={event => { event.preventDefault(); stop(); onClose(); }}
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
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <button
                  className="primary-action inline-flex min-h-11 items-center gap-2 px-4 text-xs"
                  type="button"
                  onClick={state === 'idle' ? () => playFromIndex(0) : () => void togglePause()}
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
                {state !== 'idle' && segments.length > 1 && (
                  <>
                    <button
                      type="button"
                      className="glass-icon"
                      disabled={activeSegmentIndex <= 0}
                      aria-label={copy.briefingPrevPoint}
                      onClick={() => playFromIndex(Math.max(0, activeSegmentIndex - 1))}
                    >
                      <SkipBack size={16} aria-hidden="true" />
                    </button>
                    <button
                      type="button"
                      className="glass-icon"
                      disabled={activeSegmentIndex >= segments.length - 1}
                      aria-label={copy.briefingNextPoint}
                      onClick={() => playFromIndex(Math.min(segments.length - 1, activeSegmentIndex + 1))}
                    >
                      <SkipForward size={16} aria-hidden="true" />
                    </button>
                  </>
                )}
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
                  onClick={cycleSpeed}
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
              {state !== 'idle' && (
                <p className="text-xs text-[var(--muted)]">
                  {copy.briefingBackgroundHint}
                </p>
              )}
            </div>
          )}

          {/* Optional Cloud AI Narrative Block */}
          {aiBriefing && (
            <div className="rounded-2xl border border-[var(--line)] bg-[var(--panel-2)] p-4 space-y-1.5">
              <p className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-[var(--accent)]">
                <Sparkles size={13} aria-hidden="true" />
                {copy.briefingAiLabel}
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
                      className={`rounded-2xl border p-3.5 transition-colors ${
                        isActive
                          ? 'border-[var(--accent)] bg-[var(--accent)]/10'
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

      {/* Persistent Floating Mini-Player when Briefing continues outside dialog */}
      {!open && state !== 'idle' && (
        <aside aria-label={copy.briefingMiniTitle} className="mini-audio-player">
          <div className="px-3.5 pt-3 pb-2.5 space-y-2">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={onOpen}
                aria-label={copy.briefingOpenDialog}
                className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-[var(--accent)] text-[var(--accent-ink)]"
              >
                <Headphones size={18} aria-hidden="true" />
              </button>

              <button
                type="button"
                onClick={onOpen}
                className="min-w-0 flex-1 text-left"
              >
                <p className="truncate text-[13.5px] font-bold leading-snug text-[var(--ink)]">
                  {activeSegment?.label || copy.briefingMiniTitle}
                </p>
                <p className="mt-0.5 truncate text-[11.5px] font-medium text-[var(--muted)] tabular-nums">
                  {copy.briefingMiniTitle}
                  {segments.length > 1 && activeSegmentIndex >= 0
                    ? ` · ${copy.briefingPointProgress(activeSegmentIndex + 1, segments.length)}`
                    : ''}
                </p>
              </button>

              <div className="flex shrink-0 items-center gap-0.5">
                {segments.length > 1 && (
                  <button
                    type="button"
                    disabled={activeSegmentIndex <= 0}
                    onClick={() => playFromIndex(Math.max(0, activeSegmentIndex - 1))}
                    aria-label={copy.briefingPrevPoint}
                    className="hidden sm:grid h-10 w-10 place-items-center rounded-full text-[var(--muted)] transition hover:bg-[var(--control)] hover:text-[var(--ink)] disabled:opacity-40"
                  >
                    <SkipBack size={15} aria-hidden="true" />
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => void togglePause()}
                  aria-label={state === 'playing' ? t('briefingPause') : t('briefingResume')}
                  className="grid h-11 w-11 place-items-center rounded-full bg-[var(--accent)] text-[var(--accent-ink)] shadow-sm transition active:scale-95"
                >
                  {ttsLoading ? (
                    <Loader2 size={16} className="animate-spin" aria-hidden="true" />
                  ) : state === 'playing' ? (
                    <Pause size={16} fill="currentColor" aria-hidden="true" />
                  ) : (
                    <Play size={16} fill="currentColor" className="translate-x-0.5" aria-hidden="true" />
                  )}
                </button>
                {segments.length > 1 && (
                  <button
                    type="button"
                    disabled={activeSegmentIndex >= segments.length - 1}
                    onClick={() => playFromIndex(Math.min(segments.length - 1, activeSegmentIndex + 1))}
                    aria-label={copy.briefingNextPoint}
                    className="grid h-10 w-10 place-items-center rounded-full text-[var(--muted)] transition hover:bg-[var(--control)] hover:text-[var(--ink)] disabled:opacity-40"
                  >
                    <SkipForward size={15} aria-hidden="true" />
                  </button>
                )}
                {activeSegment?.article && onOpenArticle && (
                  <button
                    type="button"
                    onClick={() => handleOpenBulletArticle(activeSegment.article!)}
                    aria-label={`${copy.briefingReadStory}: ${activeSegment.article.title}`}
                    title={copy.briefingReadStory}
                    className="hidden sm:grid h-10 w-10 place-items-center rounded-full text-[var(--muted)] transition hover:bg-[var(--control)] hover:text-[var(--ink)]"
                  >
                    <ArrowUpRight size={16} aria-hidden="true" />
                  </button>
                )}
                <button
                  type="button"
                  onClick={cycleSpeed}
                  aria-label={t('mediaAudioSpeed')}
                  className="grid h-10 min-w-[2.5rem] place-items-center rounded-full px-1.5 text-[11px] font-bold tabular-nums text-[var(--ink)] transition hover:bg-[var(--control)]"
                >
                  {speed}×
                </button>
                <button
                  type="button"
                  onClick={stop}
                  aria-label={t('briefingStop')}
                  className="grid h-10 w-10 place-items-center rounded-full text-[var(--muted)] transition hover:bg-[var(--control)] hover:text-[var(--ink)]"
                >
                  <X size={16} aria-hidden="true" />
                </button>
              </div>
            </div>

            {/* Subtle Briefing Segment Progress */}
            <div className="h-1 w-full overflow-hidden rounded-full bg-[var(--control)]" aria-hidden="true">
              <div
                className="h-full rounded-full bg-[var(--accent)] transition-[width] duration-300"
                style={{ width: `${progressPct}%` }}
              />
            </div>
          </div>
        </aside>
      )}
    </>
  );
}
