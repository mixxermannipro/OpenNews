import { PLAY_BETA } from '../lib/playBeta';
import { TranscriptSummary } from './TranscriptSummary';
import { resolveSummaryStyle, SUMMARY_STYLES } from '../lib/summaryStyles';
import { ArticlePerspectives } from './ArticlePerspectives';
import { ArticleQuestions } from './ArticleQuestions';
import { Capacitor } from '@capacitor/core';
import { readOfflineArticle, removeOfflineArticle, storeOfflineArticle } from '../lib/offlineArticle';
import { extractNativeArticle } from '../lib/nativeFeed';
import React, { useEffect, useRef, useState } from 'react';
import {
  Bookmark,
  ChevronLeft,
  ExternalLink,
  Heart,
  Ellipsis,
  Loader2,
  Volume2,
  Square,
  Settings,
  Share2,
  Sparkles,
  ThumbsDown,
  X,
} from 'lucide-react';
import { motion } from 'motion/react';
import type {
  AIProviderConfig,
  AISummaryResult,
  NewsArticle,
  ReaderFontFamily,
  ReaderFontSize,
} from '../types/news';
import { analyzeArticleWithBYOK, hasCloudAI } from '../lib/aiClient';
import { formatRelativeTimeDe, generateLocalExtractiveSummary } from '../lib/personalization';
import { trackNavigationScroll } from '../lib/scrollNavigation';
import { ArticleImage } from './ArticleImage';
import { shareArticle } from '../lib/shareArticle';
import { translateToGerman } from '../lib/localTranslation';
import { ArticleMedia } from './ArticleMedia';

interface ArticleReaderModalProps {
  article: NewsArticle;
  perspectiveArticles: NewsArticle[];
  sourceLanguage?: 'de' | 'en';
  translate: boolean;
  backgroundPlayback: boolean;
  reducedMotion: boolean;
  isBookmarked: boolean;
  isLiked: boolean;
  isDisliked: boolean;
  aiConfig: AIProviderConfig;
  fontSize: ReaderFontSize;
  fontFamily: ReaderFontFamily;
  onToggleBookmark: (article: NewsArticle) => void;
  onToggleLike: (article: NewsArticle) => void;
  onToggleDislike: (article: NewsArticle) => void;
  onRecordReadingDuration: (article: NewsArticle, seconds: number) => void;
  onOpenAISettings: () => void;
  showSummary: boolean;
  onOpenSummary: () => void;
  onClose: () => void;
}

export const ArticleReaderModal: React.FC<ArticleReaderModalProps> = ({
  article,
  perspectiveArticles,
  sourceLanguage,
  translate,
  backgroundPlayback,
  reducedMotion,
  isBookmarked,
  isLiked,
  isDisliked,
  aiConfig,
  fontSize,
  fontFamily,
  onToggleBookmark,
  onToggleLike,
  onToggleDislike,
  onRecordReadingDuration,
  onOpenAISettings,
  showSummary,
  onOpenSummary,
  onClose,
}) => {
  const openTimestampRef = useRef<number>(Date.now());
  const recordedRef = useRef<boolean>(false);
  const [trackActionsScroll] = useState(() => trackNavigationScroll(0));
  const [actionsHidden, setActionsHidden] = useState(false);

  useEffect(() => {
    openTimestampRef.current = Date.now();
    recordedRef.current = false;
    return () => {
      if (!recordedRef.current) {
        const secs = Math.round((Date.now() - openTimestampRef.current) / 1000);
        if (secs >= 3) {
          recordedRef.current = true;
          onRecordReadingDuration(article, secs);
        }
      }
    };
  }, [article, onRecordReadingDuration]);

  const [originalParagraphs, setParagraphs] = useState<string[]>(article.paragraphs);
  const [translation, setTranslation] = useState<{ source: string[]; texts: string[] }>();
  const [translationError, setTranslationError] = useState(false);
  const [showOriginal, setShowOriginal] = useState(false);
  const translated = translate && !showOriginal && translation?.source === originalParagraphs ? translation.texts : undefined;
  const title = translated?.[0] ?? article.title;
  const summary = translated?.[1] ?? article.summary;
  const paragraphs = translated?.slice(2) ?? originalParagraphs;

  useEffect(() => {
    if (!translate) return;
    let active = true;
    setTranslationError(false);
    void translateToGerman([article.title, article.summary, ...originalParagraphs]).then(texts => {
      if (active) setTranslation({ source: originalParagraphs, texts });
    }).catch(() => { if (active) setTranslationError(true); });
    return () => { active = false; };
  }, [translate, article.title, article.summary, originalParagraphs]);
  const [headingIndexes, setHeadingIndexes] = useState<number[]>([]);
  const hasStandLine = /^Stand:\s*\d{1,2}[./]\d{1,2}[./]\d{2,4}\b/i.test(paragraphs[0] ?? '');
  const firstTextIndex = hasStandLine ? 1 : 0;
  const leadIsHeading = headingIndexes.includes(firstTextIndex);
  const lead = (leadIsHeading ? summary : paragraphs[firstTextIndex]) || summary;
  const bodyStart = firstTextIndex + (leadIsHeading ? 0 : 1);
  const [heroImage, setHeroImage] = useState<string | undefined>(article.imageUrl);
  const [loadingFullText, setLoadingFullText] = useState(false);
  const [fullTextUnavailable, setFullTextUnavailable] = useState(false);
  const [offlineSaved, setOfflineSaved] = useState(false);
  const [offlineBusy, setOfflineBusy] = useState(false);
  const [offlineStatus, setOfflineStatus] = useState('');
  const saveOffline = async () => {
    setOfflineBusy(true);
    try {
      if (offlineSaved) {
        await removeOfflineArticle(article.link);
        setOfflineSaved(false);
        setOfflineStatus('Offline-Kopie entfernt.');
      } else {
        const hasImage = await storeOfflineArticle(article.link, originalParagraphs.length ? originalParagraphs : [article.summary], headingIndexes, heroImage);
        if (!isBookmarked) onToggleBookmark(article);
        setOfflineSaved(true);
        setOfflineStatus(hasImage ? 'Text und Bild offline verfügbar.' : 'Text offline verfügbar.');
      }
    } catch {
      setOfflineStatus('Offline-Kopie konnte nicht gespeichert oder entfernt werden.');
    } finally {
      setOfflineBusy(false);
    }
  };
  const [shareFeedback, setShareFeedback] = useState<string | null>(null);

  const [aiResult, setAiResult] = useState<AISummaryResult | null>(() =>
    generateLocalExtractiveSummary(article)
  );
  const [style, setStyle] = useState(() => resolveSummaryStyle(aiConfig.summaryStyle));
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);

  const [speaking, setSpeaking] = useState(false);
  const [speechError, setSpeechError] = useState(false);
  const summaryDialog = useRef<HTMLDialogElement>(null);
  const summaryButton = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLDetailsElement>(null);
  useEffect(() => {
    const dismiss = (event: PointerEvent) => {
      if (menu.current?.open && event.target instanceof Node && !menu.current.contains(event.target)) {
        menu.current.open = false;
      }
    };
    document.addEventListener('pointerdown', dismiss, true);
    return () => document.removeEventListener('pointerdown', dismiss, true);
  }, []);

  const backButton = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    backButton.current?.focus();
    return () => {
      window.speechSynthesis?.cancel();
      requestAnimationFrame(() => { if (document.activeElement === document.body) opener?.focus(); });
    };
  }, []);

  useEffect(() => {
    const dialog = summaryDialog.current;
    if (showSummary && !dialog?.open) dialog?.showModal();
    if (!showSummary && dialog?.open) {
      dialog.close();
      summaryButton.current?.focus({ preventScroll: true });
    }
  }, [showSummary]);

  const toggleSpeech = () => {
    if (speaking) {
      window.speechSynthesis.cancel();
      setSpeaking(false);
      return;
    }
    const utterance = new SpeechSynthesisUtterance([title, ...(paragraphs.length ? paragraphs : [summary])].join('\n\n'));
    utterance.lang = document.documentElement.lang;
    utterance.onend = () => setSpeaking(false);
    utterance.onerror = event => {
      setSpeaking(false);
      if (!['canceled', 'interrupted'].includes(event.error)) setSpeechError(true);
    };
    setSpeechError(false);
    setSpeaking(true);
    window.speechSynthesis.speak(utterance);
  };

  const hasBYOKKey = hasCloudAI(aiConfig);
  const deviceSummary = aiConfig.provider === 'device';
  const canSummarize = hasBYOKKey || deviceSummary;

  useEffect(() => {
    setAiError(null);

    if (aiConfig.autoSummarize && hasBYOKKey) {
      if (!showSummary || loadingFullText) { setAiLoading(false); return; }
      if (aiResult?.mode === 'ai') return;
      let cancelled = false;
      setAiLoading(true);
      analyzeArticleWithBYOK({ ...article, paragraphs: originalParagraphs }, { ...aiConfig, summaryStyle: style })
        .then((res) => {
          if (!cancelled) setAiResult(res);
        })
        .catch((err) => {
          if (!cancelled) {
            setAiError(err instanceof Error ? err.message : 'KI-Analyse fehlgeschlagen');
          }
        })
        .finally(() => {
          if (!cancelled) setAiLoading(false);
        });
      return () => {
        cancelled = true;
      };
    }
  }, [article, aiConfig, hasBYOKKey, showSummary, loadingFullText, originalParagraphs, style]);

  const handleRunBYOK = async () => {
    if (!canSummarize) {
      onOpenAISettings();
      return;
    }
    setAiLoading(true);
    setAiError(null);
    try {
      const res = await analyzeArticleWithBYOK(
        { ...article, paragraphs: originalParagraphs },
        aiConfig
      );
      setAiResult(res);
    } catch (err) {
      setAiError(err instanceof Error ? err.message : 'KI-Analyse fehlgeschlagen');
    } finally {
      setAiLoading(false);
    }
  };

  useEffect(() => {
    if (PLAY_BETA) return;
    let cancelled = false;
    const controller = new AbortController();
    setLoadingFullText(true);
    let offlineImage: string | undefined;
    const load = async () => {
      try {
        const cached = !Capacitor.isNativePlatform() && 'caches' in window
          ? await readOfflineArticle(article.link).catch(() => undefined) : undefined;
        if (cancelled) return;
        if (cached) {
          setOfflineSaved(true);
          setParagraphs(cached.paragraphs);
          setHeadingIndexes(cached.headingIndexes);
          if (cached.image) {
            offlineImage = URL.createObjectURL(cached.image);
            setHeroImage(offlineImage);
          }
          if (!navigator.onLine) return;
        }
        const data = Capacitor.isNativePlatform()
          ? await extractNativeArticle(article.link)
          : await fetch(`/api/article/extract?url=${encodeURIComponent(article.link)}`, { signal: controller.signal })
            .then(response => response.ok ? response.json() as Promise<{ paragraphs: string[]; headingIndexes?: number[]; ogImage?: string }> : null);
        if (cancelled) return;
        const contentLength = (paragraphs: string[]) => paragraphs.join(' ').length;
        if (data?.paragraphs?.length && contentLength(data.paragraphs) > contentLength(article.paragraphs)) {
          setParagraphs(data.paragraphs);
          setHeadingIndexes(data.headingIndexes ?? []);
          setAiResult(previous => previous?.mode === 'ai' ? previous : generateLocalExtractiveSummary({ ...article, paragraphs: data.paragraphs }));
        } else {
          setFullTextUnavailable(true);
        }
        if (!article.imageUrl && data?.ogImage) setHeroImage(data.ogImage);
      } catch {
        if (!cancelled) setFullTextUnavailable(true);
      } finally {
        if (!cancelled) setLoadingFullText(false);
      }
    };
    void load();
    return () => {
      cancelled = true;
      controller.abort();
      if (offlineImage) URL.revokeObjectURL(offlineImage);
    };
  }, [article]);

  const handleShare = async () => {
    try {
      if (!await shareArticle(article)) return;
      setShareFeedback('Link kopiert');
      setTimeout(() => setShareFeedback(null), 2000);
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return;
      setShareFeedback('Teilen gerade nicht möglich');
      setTimeout(() => setShareFeedback(null), 2000);
    }
  };

  const textSizeClass =
    fontSize === 'xlarge'
      ? 'text-lg leading-8'
      : fontSize === 'large'
        ? 'text-[17px] leading-7'
        : 'text-[15px] leading-7';

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Artikel lesen: ${title}`}
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center"
    >
      <motion.div aria-hidden="true" className="pointer-events-none absolute inset-0 bg-black/65"
        initial={reducedMotion ? false : { opacity: 0 }} animate={{ opacity: 1 }}
        exit={{ opacity: 0 }} transition={{ duration: reducedMotion ? 0 : 0.24, ease: 'easeOut' }} />
      <motion.div
        initial={reducedMotion ? false : { opacity: 0, y: 22 }}
        animate={{ opacity: 1, y: 0 }}
        exit={reducedMotion ? undefined : { opacity: 0, y: 18, transition: { duration: 0.24, ease: [0.3, 0, 0.35, 1] } }}
        transition={reducedMotion ? { duration: 0 } : {
          y: { type: 'spring', stiffness: 310, damping: 30, mass: 0.85 },
          opacity: { duration: 0.18, ease: 'easeOut' },
        }}
        className="relative flex h-[100dvh] sm:h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-none sm:rounded-[32px] reader-surface shadow-2xl ring-1 ring-white/15"
      >
        <div className="flex-1 overflow-y-auto" onScroll={event => {
          const { scrollTop, scrollHeight, clientHeight } = event.currentTarget;
          setActionsHidden(trackActionsScroll(scrollTop, scrollHeight - clientHeight));
        }}>
          <div className="reader-toolbar sticky top-0 z-10 border-b border-slate-400/20 bg-[var(--canvas)] px-5 pb-2 sm:px-8">
            <button
              type="button"
              onClick={onClose}
              ref={backButton}
              className="choice-pill inline-flex min-h-11 items-center gap-1"
            >
              <ChevronLeft className="h-4 w-4" aria-hidden />
              Zurück
            </button>
          </div>

          <div className="reader-body mx-auto max-w-[44rem] px-5 pt-5 sm:px-8">
            <div className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/15 px-3 py-1 text-xs font-semibold text-emerald-700 dark:bg-emerald-400/15 dark:text-emerald-300">
              {article.category}
            </div>

            <h1 className="mt-2 text-2xl sm:text-3xl font-bold leading-tight tracking-tight text-slate-900 dark:text-white [text-wrap:balance]">
              {title}
            </h1>
            {translate && (
              <div className="mt-2 text-sm" role="status">
                {translationError ? 'Übersetzung gerade nicht verfügbar. Für den Modell-Download wird WLAN benötigt.'
                  : translation?.source === originalParagraphs ? (
                    <button type="button" className="choice-pill" onClick={() => setShowOriginal(current => !current)}>
                      {showOriginal ? 'Deutsch anzeigen' : 'Original anzeigen'}
                    </button>
                  ) : 'Übersetzung wird vorbereitet …'}
              </div>
            )}

            <div className="mt-2.5 flex flex-wrap items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 tabular-nums">
              <span className="font-medium text-slate-700 dark:text-slate-300">
                {article.sourceName}
              </span>
              {article.author && (
                <>
                  <span aria-hidden="true">·</span>
                  <span>{article.author}</span>
                </>
              )}
              <span aria-hidden="true">·</span>
              <span>{formatRelativeTimeDe(article.publishedAt)}</span>
              {!PLAY_BETA && <>
                <span aria-hidden="true">·</span>
                <span>{Math.max(1, Math.ceil((paragraphs.join(' ').match(/\S+/g)?.length ?? 0) / 220))} Min. Lesezeit</span>
              </>}
            </div>

            <div className={`reader-prose mt-5 space-y-4 ${textSizeClass} ${fontFamily === 'serif' ? 'font-editorial-serif' : ''}`}>
              {lead && <p className="reader-lead">{lead}</p>}
              {heroImage && (
                <ArticleImage
                  src={heroImage}
                  alt=""
                  sourceShortCode={article.sourceShortCode}
                  sourceColor={article.sourceColor}
                  className="aspect-video w-full overflow-hidden rounded-2xl"
                />
              )}
              <ArticleMedia key={article.id} article={article} heroImage={heroImage} background={backgroundPlayback} />
              {paragraphs.slice(bodyStart).map((paragraph, index) => headingIndexes.includes(index + bodyStart)
                ? <h2 key={index}>{paragraph}</h2> : <p key={index}>{paragraph}</p>)}
            </div>
            {loadingFullText && <p role="status" className="mt-3 text-sm text-slate-500 dark:text-slate-400">Artikeltext wird geladen …</p>}
            {!PLAY_BETA && !Capacitor.isNativePlatform() && 'caches' in window && !article.linkIsFeed && (
              <div className="mt-4 space-y-2">
                <button type="button" className="choice-pill" disabled={offlineBusy || loadingFullText} onClick={() => void saveOffline()}>
                  {offlineSaved ? 'Offline-Kopie entfernen' : 'Offline speichern'}
                </button>
                <p className="text-sm" role="status">{offlineStatus}</p>
              </div>
            )}
            {PLAY_BETA ? (
              <a href={article.link} target="_blank" rel="noopener noreferrer" className="choice-pill mt-3 inline-flex min-h-11 items-center gap-2">
                <ExternalLink size={16} aria-hidden="true" /> Bei der Quelle weiterlesen
              </a>
            ) : fullTextUnavailable && (
              <a href={article.link} target="_blank" rel="noopener noreferrer" className="mt-3 inline-block text-sm underline">Bei der Quelle weiterlesen</a>
            )}
            {speechError && <p role="status" className="mt-2 text-sm">Die Sprachausgabe ist gerade nicht verfügbar.</p>}
          </div>
        </div>
        <div className="reader-actions" aria-label="Artikelaktionen"
          data-scroll-hidden={actionsHidden && !showSummary && !shareFeedback}>
          {!PLAY_BETA && <button ref={summaryButton} type="button" className="glass-icon" aria-label="Zusammenfassung"
            aria-haspopup="dialog" aria-controls="reader-summary" onClick={onOpenSummary}><Sparkles size={19} /></button>}
          <button type="button" className="glass-icon" aria-label={isLiked ? 'Gefällt mir entfernen' : 'Gefällt mir'}
            aria-pressed={isLiked} onClick={() => onToggleLike(article)}><Heart size={19} fill={isLiked ? 'currentColor' : 'none'} /></button>
          <button type="button" className="glass-icon" aria-label={isBookmarked ? 'Lesezeichen entfernen' : 'Artikel speichern'}
            aria-pressed={isBookmarked} onClick={() => onToggleBookmark(article)}><Bookmark size={19} fill={isBookmarked ? 'currentColor' : 'none'} /></button>
          <button type="button" className="glass-icon" aria-label="Teilen" onClick={handleShare}><Share2 size={19} /></button>
          {shareFeedback && <span className="reader-share-feedback" role="status">{shareFeedback}</span>}
          <details ref={menu} className="reader-menu">
            <summary className="glass-icon" aria-label="Weitere Artikelaktionen"><Ellipsis size={20} /></summary>
            <div className="settings-group">
              <button type="button" className="preference-row settings-link" aria-pressed={isDisliked}
                onClick={() => onToggleDislike(article)}><ThumbsDown /><span>Weniger davon</span></button>
              {'speechSynthesis' in window && <button type="button" className="preference-row settings-link" onClick={toggleSpeech}>
                {speaking ? <Square /> : <Volume2 />}<span>{speaking ? 'Vorlesen beenden' : 'Vorlesen'}</span></button>}
              <a href={article.link} target="_blank" rel="noopener noreferrer" className="preference-row settings-link"><ExternalLink /><span>Original öffnen</span></a>
            </div>
          </details>
        </div>
      </motion.div>
      <dialog ref={summaryDialog} id="reader-summary" className="motion-dialog reader-summary"
        aria-labelledby="reader-summary-title"
        onCancel={event => { event.preventDefault(); onClose(); }}
        onClick={event => { if (event.target === event.currentTarget) onClose(); }}>
        <div className="reader-summary-content space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
              <h2 id="reader-summary-title" className="text-base font-bold text-slate-900 dark:text-white">
                Das Wichtigste in Kürze
              </h2>
            </div>

            <button type="button" autoFocus className="glass-icon" aria-label="Zusammenfassung schließen" onClick={onClose}>
              <X size={20} />
            </button>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
              {aiLoading ? 'Analysiere…' : aiResult?.providerLabel}
            </span>
            <button
              type="button"
              onClick={handleRunBYOK}
              disabled={aiLoading}
              className="inline-flex min-h-[36px] items-center gap-1.5 rounded-full bg-slate-900 px-3.5 py-1 text-xs font-semibold text-white transition hover:bg-slate-800 disabled:opacity-60 dark:bg-white dark:text-slate-950 dark:hover:bg-slate-200"
            >
              {aiLoading ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : hasBYOKKey ? (
                <Sparkles className="h-3.5 w-3.5" />
              ) : (
                <Settings className="h-3.5 w-3.5" />
              )}
              {deviceSummary ? 'Auf dem Gerät zusammenfassen' : hasBYOKKey ? 'KI aktualisieren' : 'KI-Key verbinden'}
            </button>
          </div>

          {(hasBYOKKey || (deviceSummary && Capacitor.getPlatform() !== 'android')) && <label className="flex flex-wrap items-center gap-2 text-sm">
            Zusammenfassungsstil
            <select className="preference-input" value={style} disabled={aiLoading}
              onChange={event => {
                setAiResult(generateLocalExtractiveSummary({ ...article, paragraphs: originalParagraphs }));
                setStyle(resolveSummaryStyle(event.target.value));
              }}>
              {Object.entries(SUMMARY_STYLES).map(([id, preset]) => <option key={id} value={id}>{preset.label}</option>)}
            </select>
          </label>}
          {aiError && (
            <div className="rounded-2xl bg-rose-500/10 p-3 text-xs text-rose-600 dark:text-rose-400">
              {aiError}
            </div>
          )}

          {aiResult && (
            <div className="space-y-3 text-sm leading-relaxed text-slate-800 dark:text-slate-200">
              <ul className="space-y-2 pl-4 list-disc marker:text-emerald-600 dark:marker:text-emerald-400">
                {aiResult.bullets.map((b, i) => (
                  <li key={i}>{b}</li>
                ))}
              </ul>
            </div>
          )}
          {showSummary && hasBYOKKey && <ArticleQuestions
            article={{ ...article, paragraphs: originalParagraphs }}
            config={aiConfig}
            disabled={loadingFullText}
          />}
          {showSummary && hasBYOKKey && perspectiveArticles.length >= 2 && <ArticlePerspectives
            key={perspectiveArticles.map(report => report.id).join(',')}
            articles={perspectiveArticles} config={aiConfig}
          />}
          {showSummary && (article.transcript || article.audioUrl || article.videoUrl || article.youtubeId) &&
            <TranscriptSummary article={article} config={aiConfig} />}
        </div>
      </dialog>
    </div>
  );
};
