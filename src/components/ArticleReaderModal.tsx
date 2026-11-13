import React, { useEffect, useRef, useState } from 'react';
import {
  Bookmark,
  ChevronLeft,
  ExternalLink,
  FileText,
  Heart,
  Loader2,
  Newspaper,
  Settings,
  Share2,
  Sparkles,
  ThumbsDown,
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

interface ArticleReaderModalProps {
  article: NewsArticle;
  isBookmarked: boolean;
  isLiked: boolean;
  isDisliked: boolean;
  aiConfig: AIProviderConfig;
  fontSize: ReaderFontSize;
  fontFamily: ReaderFontFamily;
  onChangeFontSize: (size: ReaderFontSize) => void;
  onChangeFontFamily: (family: ReaderFontFamily) => void;
  onToggleBookmark: (article: NewsArticle) => void;
  onToggleLike: (article: NewsArticle) => void;
  onToggleDislike: (article: NewsArticle) => void;
  onRecordReadingDuration: (article: NewsArticle, seconds: number) => void;
  onOpenAISettings: () => void;
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
  onChangeFontSize,
  onChangeFontFamily,
  onToggleBookmark,
  onToggleLike,
  onToggleDislike,
  onRecordReadingDuration,
  onOpenAISettings,
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
  const [heroImage, setHeroImage] = useState<string | undefined>(article.imageUrl);
  const [loadingFullText, setLoadingFullText] = useState(false);
  const [fullTextLoaded, setFullTextLoaded] = useState(false);
  const [shareFeedback, setShareFeedback] = useState<string | null>(null);

  const [aiResult, setAiResult] = useState<AISummaryResult | null>(() =>
    generateLocalExtractiveSummary(article)
  );
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);

  const hasBYOKKey = Boolean(aiConfig.apiKey.trim()) || aiConfig.provider === 'custom';

  useEffect(() => {
    setParagraphs(article.paragraphs);
    setHeroImage(article.imageUrl);
    setFullTextLoaded(false);
    setAiError(null);
    setAiResult(generateLocalExtractiveSummary(article));

    if (aiConfig.autoSummarize && hasBYOKKey) {
      let cancelled = false;
      setAiLoading(true);
      analyzeArticleWithBYOK(article, aiConfig)
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
  }, [article, aiConfig, hasBYOKKey]);

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

  const handleLoadFullText = async () => {
    if (loadingFullText || fullTextLoaded) return;
    setLoadingFullText(true);
    try {
      const resp = await fetch(`/api/article/extract?url=${encodeURIComponent(article.link)}`);
      if (resp.ok) {
        const data = (await resp.json()) as { paragraphs?: string[]; ogImage?: string };
        if (Array.isArray(data.paragraphs) && data.paragraphs.length > paragraphs.length) {
          setParagraphs(data.paragraphs);
        }
        if (!heroImage && data.ogImage) {
          setHeroImage(data.ogImage);
        }
      }
      setFullTextLoaded(true);
    } catch {
      setFullTextLoaded(true);
    } finally {
      setLoadingFullText(false);
    }
  };

  const handleShare = async () => {
    try {
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
    } catch {
      setShareFeedback('Link bereit');
      setTimeout(() => setShareFeedback(null), 2000);
    }
  };

  const cycleFontSize = () => {
    if (fontSize === 'normal') onChangeFontSize('large');
    else if (fontSize === 'large') onChangeFontSize('xlarge');
    else onChangeFontSize('normal');
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
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-md"
    >
      <motion.div
        initial={{ opacity: 0, y: 28 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 20 }}
        transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
        className="relative flex h-[96dvh] sm:h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-t-3xl sm:rounded-3xl bg-[#F2F3F7] dark:bg-[#0B0D12] shadow-2xl ring-1 ring-white/10"
      >
        <div className="flex-1 overflow-y-auto">
          {/* Top-bleed Hero Media (Screenshot 3 layout) */}
          <div className="relative h-64 sm:h-80 w-full bg-slate-900">
            {article.youtubeId ? (
              <iframe
                src={`https://www.youtube-nocookie.com/embed/${article.youtubeId}`}
                title={article.title}
                className="h-full w-full"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
            ) : article.videoUrl ? (
              <video
                src={article.videoUrl}
                poster={heroImage}
                controls
                playsInline
                className="h-full w-full object-cover bg-black"
              />
            ) : (
              <ArticleImage
                src={heroImage}
                alt={article.title}
                sourceShortCode={article.sourceShortCode}
                sourceColor={article.sourceColor}
                className="h-full w-full"
              />
            )}

            <div className="pointer-events-none absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-black/60 to-transparent" />

            {/* Floating Glass Back & Source Pill */}
            <div className="absolute inset-x-4 top-4 flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={onClose}
                className="inline-flex min-h-[44px] items-center gap-1 rounded-full bg-black/50 px-4 py-2 text-xs font-semibold text-white backdrop-blur-xl ring-1 ring-white/20 transition hover:bg-black/70 active:scale-95"
              >
                <ChevronLeft className="h-4 w-4" />
                Zurück
              </button>

              <a
                href={article.link}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex min-h-[44px] items-center gap-1.5 rounded-full bg-black/50 px-4 py-2 text-xs font-semibold text-white backdrop-blur-xl ring-1 ring-white/20 transition hover:bg-black/70"
              >
                <Newspaper className="h-3.5 w-3.5" />
                {article.sourceName}
              </a>
            </div>
          </div>

          {/* Overlapping Rounded Reader Sheet */}
          <div className="relative -mt-6 rounded-t-3xl bg-[#F2F3F7] dark:bg-[#0B0D12] px-5 pb-12 pt-6 sm:px-8">
            <div className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">
              {article.category}
            </div>

            <h1 className="mt-2 text-2xl sm:text-3xl font-bold leading-tight tracking-tight text-slate-900 dark:text-white [text-wrap:balance]">
              {article.title}
            </h1>

            <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400 tabular-nums">
              <span className="font-semibold text-slate-700 dark:text-slate-300">
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
              <span>Lesezeit: {article.readingTimeMin} Min.</span>
            </div>

            {/* Action Pills (Speichern, Gefällt mir, Teilen, A | A) */}
            <div className="mt-5 flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => onToggleBookmark(article)}
                aria-pressed={isBookmarked}
                className={`inline-flex min-h-[44px] items-center gap-1.5 rounded-full px-4 py-2 text-xs font-semibold transition active:scale-95 ${
                  isBookmarked
                    ? 'bg-blue-600 text-white'
                    : 'liquid-glass text-slate-700 dark:text-slate-200'
                }`}
              >
                <Bookmark className={`h-3.5 w-3.5 ${isBookmarked ? 'fill-current' : ''}`} />
                {isBookmarked ? 'Gespeichert' : 'Speichern'}
              </button>

              <button
                type="button"
                onClick={() => onToggleLike(article)}
                aria-pressed={isLiked}
                className={`inline-flex min-h-[44px] items-center gap-1.5 rounded-full px-4 py-2 text-xs font-semibold transition active:scale-95 ${
                  isLiked
                    ? 'bg-rose-600 text-white'
                    : 'liquid-glass text-slate-700 dark:text-slate-200'
                }`}
              >
                <Heart className={`h-3.5 w-3.5 ${isLiked ? 'fill-current' : ''}`} />
                Gefällt mir
              </button>

              <button
                type="button"
                onClick={handleShare}
                className="liquid-glass inline-flex min-h-[44px] items-center gap-1.5 rounded-full px-4 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 transition active:scale-95"
              >
                <Share2 className="h-3.5 w-3.5" />
                {shareFeedback || 'Teilen'}
              </button>

              <button
                type="button"
                onClick={cycleFontSize}
                aria-label="Schriftgröße ändern"
                className="liquid-glass inline-flex min-h-[44px] items-center gap-2 rounded-full px-4 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 transition active:scale-95"
              >
                <span className="text-[11px] opacity-70">A</span>
                <span className="text-slate-400">|</span>
                <span className="text-sm font-bold">A</span>
              </button>

              <button
                type="button"
                onClick={() => onChangeFontFamily(fontFamily === 'sans' ? 'serif' : 'sans')}
                className="liquid-glass inline-flex min-h-[44px] items-center rounded-full px-3.5 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 transition active:scale-95"
              >
                {fontFamily === 'sans' ? 'Serif' : 'Sans'}
              </button>
            </div>

            {/* Audio / Podcast Player if available */}
            {article.audioUrl && (
              <div className="liquid-glass mt-5 rounded-2xl p-4">
                <p className="mb-2 text-xs font-semibold text-slate-600 dark:text-slate-300">
                  Audio-Beitrag / Podcast
                </p>
                <audio src={article.audioUrl} controls className="w-full" />
              </div>
            )}

            {/* AI Summary & Einordnung Card (Screenshot 3: "Kurz zusammengefasst") */}
            <div className="liquid-glass mt-6 rounded-3xl p-5 space-y-3.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-blue-500" />
                  <h2 className="text-base font-bold text-slate-900 dark:text-white">
                    Kurz zusammengefasst
                  </h2>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                    {aiLoading ? 'Analysiere…' : aiResult?.providerLabel}
                  </span>
                  <button
                    type="button"
                    onClick={handleRunBYOK}
                    disabled={aiLoading}
                    className="inline-flex min-h-[36px] items-center gap-1.5 rounded-full bg-blue-600 px-3.5 py-1 text-xs font-semibold text-white transition hover:bg-blue-500 disabled:opacity-60"
                  >
                    {aiLoading ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : hasBYOKKey ? (
                      <Sparkles className="h-3.5 w-3.5" />
                    ) : (
                      <Settings className="h-3.5 w-3.5" />
                    )}
                    {hasBYOKKey ? 'KI-Einordnung aktualisieren' : 'Eigenen KI-Key verbinden'}
                  </button>
                </div>
              </div>

              {aiError && (
                <div className="rounded-2xl bg-rose-500/10 p-3 text-xs text-rose-600 dark:text-rose-400">
                  {aiError}
                </div>
              )}

              {aiResult && (
                <div className="space-y-3 text-sm leading-relaxed text-slate-700 dark:text-slate-200">
                  <ul className="space-y-2 pl-4 list-disc marker:text-blue-500">
                    {aiResult.bullets.map((b, i) => (
                      <li key={i}>{b}</li>
                    ))}
                  </ul>

                  {aiConfig.includeContext && aiResult.context && (
                    <div className="border-t border-black/5 pt-3 dark:border-white/10">
                      <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">
                        Einordnung &amp; Kontext
                      </p>
                      <p className="text-sm text-slate-700 dark:text-slate-300">
                        {aiResult.context}
                      </p>
                    </div>
                  )}

                  {aiConfig.includePerspectives && aiResult.perspectives.length > 0 && (
                    <div className="border-t border-black/5 pt-3 dark:border-white/10">
                      <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">
                        Perspektiven &amp; Kritische Fragen
                      </p>
                      <ul className="space-y-1 text-xs text-slate-600 dark:text-slate-300">
                        {aiResult.perspectives.map((p, idx) => (
                          <li key={idx}>• {p}</li>
                        ))}
                        {aiResult.criticalQuestions.map((q, idx) => (
                          <li key={`q-${idx}`} className="text-blue-600 dark:text-blue-400">
                            ? {q}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Article Prose */}
            <div
              className={`mt-6 space-y-4 text-slate-800 dark:text-slate-200 ${textSizeClass} ${
                fontFamily === 'serif' ? 'font-editorial-serif' : ''
              }`}
            >
              {paragraphs.map((p, idx) => (
                <p key={idx}>{p}</p>
              ))}
            </div>

            {/* Reader Footer Actions */}
            <div className="mt-8 flex flex-wrap items-center justify-between gap-3 border-t border-black/10 pt-5 dark:border-white/10">
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={handleLoadFullText}
                  disabled={loadingFullText || fullTextLoaded}
                  className="liquid-glass inline-flex min-h-[44px] items-center gap-2 rounded-full px-4 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 disabled:opacity-60"
                >
                  {loadingFullText ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <FileText className="h-3.5 w-3.5" />
                  )}
                  {fullTextLoaded ? 'Volltext geladen' : 'Volltext von Quelle laden'}
                </button>

                <button
                  type="button"
                  onClick={() => onToggleDislike(article)}
                  aria-pressed={isDisliked}
                  className={`inline-flex min-h-[44px] items-center gap-1.5 rounded-full px-4 py-2 text-xs font-semibold transition ${
                    isDisliked
                      ? 'bg-slate-800 text-white dark:bg-white dark:text-slate-900'
                      : 'liquid-glass text-slate-600 dark:text-slate-300'
                  }`}
                >
                  <ThumbsDown className="h-3.5 w-3.5" />
                  Weniger davon
                </button>
              </div>

              <a
                href={article.link}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex min-h-[44px] items-center gap-1.5 rounded-full bg-slate-900 px-5 py-2 text-xs font-semibold text-white dark:bg-white dark:text-slate-950"
              >
                Originalartikel öffnen
                <ExternalLink className="h-3.5 w-3.5" />
              </a>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
};
