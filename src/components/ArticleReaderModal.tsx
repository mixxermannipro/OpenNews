import { Capacitor, registerPlugin } from '@capacitor/core';
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
import { analyzeArticleWithBYOK } from '../lib/aiClient';
import { formatRelativeTimeDe, generateLocalExtractiveSummary } from '../lib/personalization';
import { ArticleImage } from './ArticleImage';
import { ArticleMedia } from './ArticleMedia';

const ArticleShare = registerPlugin<{ share(options: { title: string; url: string }): Promise<void> }>('ArticleShare');

interface ArticleReaderModalProps {
  article: NewsArticle;
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

  const [paragraphs, setParagraphs] = useState<string[]>(article.paragraphs);
  const [headingIndexes, setHeadingIndexes] = useState<number[]>([]);
  const [heroImage, setHeroImage] = useState<string | undefined>(article.imageUrl);
  const [loadingFullText, setLoadingFullText] = useState(false);
  const [fullTextUnavailable, setFullTextUnavailable] = useState(false);
  const [shareFeedback, setShareFeedback] = useState<string | null>(null);

  const [aiResult, setAiResult] = useState<AISummaryResult | null>(() =>
    generateLocalExtractiveSummary(article)
  );
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
    const utterance = new SpeechSynthesisUtterance([article.title, ...(paragraphs.length ? paragraphs : [article.summary])].join('\n\n'));
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

  const hasBYOKKey = Boolean(aiConfig.apiKey.trim()) || aiConfig.provider === 'custom';

  useEffect(() => {
    setAiError(null);

    if (aiConfig.autoSummarize && hasBYOKKey) {
      if (!showSummary || loadingFullText) { setAiLoading(false); return; }
      if (aiResult?.mode === 'ai') return;
      let cancelled = false;
      setAiLoading(true);
      analyzeArticleWithBYOK({ ...article, paragraphs }, aiConfig)
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
  }, [article, aiConfig, hasBYOKKey, showSummary, loadingFullText, paragraphs]);

  const handleRunBYOK = async () => {
    if (!hasBYOKKey) {
      onOpenAISettings();
      return;
    }
    setAiLoading(true);
    setAiError(null);
    try {
      const res = await analyzeArticleWithBYOK(
        { ...article, paragraphs },
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
    let cancelled = false;
    const controller = new AbortController();
    setLoadingFullText(true);
    const load = async () => {
      try {
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
    return () => { cancelled = true; controller.abort(); };
  }, [article]);

  const handleShare = async () => {
    try {
      if (Capacitor.getPlatform() === 'android') {
        await ArticleShare.share({ title: article.title, url: article.link });
        return;
      }
      if (navigator.share) {
        await navigator.share({
          title: article.title,
          text: article.summary,
          url: article.link,
        });
        return;
      }
      await navigator.clipboard.writeText(`${article.title}\n${article.link}`);
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
      aria-label={`Artikel lesen: ${article.title}`}
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/65"
    >
      <motion.div
        initial={{ opacity: 0, y: 28 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 20 }}
        transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
        className="relative flex h-[100dvh] sm:h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-none sm:rounded-[32px] reader-surface shadow-2xl ring-1 ring-white/15"
      >
        <div className="flex-1 overflow-y-auto">
          {/* Top-bleed Hero Media (Screenshot 3) */}
          <div className="relative h-64 sm:h-80 w-full bg-slate-900">
            <ArticleImage
              src={heroImage}
              alt={article.title}
              sourceShortCode={article.sourceShortCode}
              sourceColor={article.sourceColor}
              className="h-full w-full"
            />

            <div className="pointer-events-none absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-black/55 to-transparent" />

            {/* Floating Glass Back & Source Pill */}
            <div className="reader-toolbar absolute inset-x-4 flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={onClose}
                ref={backButton}
                className="inline-flex min-h-[42px] items-center gap-1 rounded-full bg-white/25 px-4 py-2 text-xs font-semibold text-white backdrop-blur-xl ring-1 ring-white/30 transition hover:bg-white/35 active:scale-95"
              >
                <ChevronLeft className="h-4 w-4" />
                Zurück
              </button>

            </div>
          </div>

          {/* Overlapping Rounded Reader Sheet */}
          <div className="reader-surface reader-body relative -mt-7 rounded-t-[30px] px-5 pt-6 sm:px-8">
            <div className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/15 px-3 py-1 text-xs font-semibold text-emerald-700 dark:bg-emerald-400/15 dark:text-emerald-300">
              {article.category}
            </div>

            <h1 className="mt-2 text-2xl sm:text-3xl font-bold leading-tight tracking-tight text-slate-900 dark:text-white [text-wrap:balance]">
              {article.title}
            </h1>

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
              <span aria-hidden="true">·</span>
              <span>{Math.max(1, Math.ceil((paragraphs.join(' ').match(/\S+/g)?.length ?? 0) / 220))} Min. Lesezeit</span>
            </div>

            <ArticleMedia key={article.id} article={article} heroImage={heroImage} />

            <div className={`reader-prose mt-6 space-y-4 ${textSizeClass} ${fontFamily === 'serif' ? 'font-editorial-serif' : ''}`}>
              {(paragraphs.length ? paragraphs : [article.summary]).map((paragraph, index) => headingIndexes.includes(index)
                ? <h2 key={index}>{paragraph}</h2> : <p key={index}>{paragraph}</p>)}
            </div>
            {loadingFullText && <p role="status" className="mt-3 text-sm text-slate-500 dark:text-slate-400">Artikeltext wird geladen …</p>}
            {fullTextUnavailable && <a href={article.link} target="_blank" rel="noopener noreferrer" className="mt-3 inline-block text-sm underline">Bei der Quelle weiterlesen</a>}
            {speechError && <p role="status" className="mt-2 text-sm">Die Sprachausgabe ist gerade nicht verfügbar.</p>}
          </div>
        </div>
        <div className="reader-actions" aria-label="Artikelaktionen">
          <button ref={summaryButton} type="button" className="glass-icon" aria-label="Zusammenfassung"
            aria-haspopup="dialog" aria-controls="reader-summary" onClick={onOpenSummary}><Sparkles size={19} /></button>
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
      <dialog ref={summaryDialog} id="reader-summary" className="reader-summary"
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
              {hasBYOKKey ? 'KI aktualisieren' : 'KI-Key verbinden'}
            </button>
          </div>

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
        </div>
      </dialog>
    </div>
  );
};
