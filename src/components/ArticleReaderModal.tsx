import { TranscriptSummary } from './TranscriptSummary';
import { resolveSummaryStyle, SUMMARY_STYLES } from '../lib/summaryStyles';
import { ArticlePerspectives } from './ArticlePerspectives';
import { ArticleQuestions } from './ArticleQuestions';
import { Capacitor } from '@capacitor/core';
import { readOfflineArticle, removeOfflineArticle, storeOfflineArticle } from '../lib/offlineArticle';
import { extractNativeArticle } from '../lib/nativeFeed';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Bookmark,
  Check,
  ChevronDown,
  ChevronLeft,
  Columns2,
  Download,
  Ellipsis,
  ExternalLink,
  Headphones,
  Heart,
  Highlighter,
  History,
  ListPlus,
  Loader2,
  Moon,
  Newspaper,
  Pause,
  Play,
  Search,
  Settings,
  Share2,
  SkipBack,
  SkipForward,
  Sparkles,
  Square,
  ThumbsDown,
  Type,
  Video,
  Volume2,
  X,
} from 'lucide-react';
import type {
  AIProviderConfig,
  AISummaryResult,
  AppLanguage,
  NewsArticle,
  ReaderFontFamily,
  ReaderFontSize,
  TTSProviderConfig,
} from '../types/news';
import { analyzeArticleWithBYOK, createArticleContext, hasCloudAI } from '../lib/aiClient';
import { hasCloudTTS, prefetchSpeechClip, synthesizeSpeechBlob } from '../lib/ttsClient';
import { generateLocalExtractiveSummary } from '../lib/personalization';
import { useI18n, type TranslationKey } from '../lib/i18n';
import { trackNavigationScroll } from '../lib/scrollNavigation';
import { computeReadingProgress } from '../lib/pullPhysics';
import { classifyArticleType, type EditorialArticleType } from '../lib/localEditorialAI';
import { findPriorCoverage, findRelatedMediaForArticle, type RelatedMediaLink } from '../lib/relatedMedia';
import {
  buildSpeechBlocks,
  selectFreeAlternatives,
  type ArticleHighlight,
  type ReaderSurfaceTheme,
} from '../lib/readerExtras';
import { getReaderCopy } from '../lib/readerCopy';
import { ArticleImage } from './ArticleImage';
import { SourceIcon } from './SourceIcon';
import { shareArticle } from '../lib/shareArticle';
import { translateToGerman } from '../lib/localTranslation';
import { safeHref } from '../lib/contentIdentity';
import { ArticleMedia } from './ArticleMedia';
import { MediaPlayer } from './MediaPlayer';

const SPEECH_RATES = [0.85, 1, 1.15, 1.35, 1.5] as const;
const SLEEP_OPTIONS = [0, 5, 15, 30] as const;
const TYPE_LABEL_KEY: Partial<Record<EditorialArticleType, TranslationKey>> = {
  breaking: 'breaking',
  opinion: 'typeOpinion',
  analysis: 'typeAnalysis',
  interview: 'typeInterview',
  factcheck: 'typeFactcheck',
};

interface ArticleReaderModalProps {
  article: NewsArticle;
  allArticles: NewsArticle[];
  perspectiveArticles: NewsArticle[];
  sourceLanguage?: AppLanguage;
  translate: boolean;
  backgroundPlayback: boolean;
  reducedMotion: boolean;
  isBookmarked: boolean;
  isLiked: boolean;
  isDisliked: boolean;
  inQueue: boolean;
  nextQueuedArticle?: NewsArticle;
  highlights: ArticleHighlight[];
  aiConfig: AIProviderConfig;
  ttsConfig: TTSProviderConfig;
  fontSize: ReaderFontSize;
  fontFamily: ReaderFontFamily;
  readerTheme: ReaderSurfaceTheme;
  newspaperMode: boolean;
  onFontSize: (value: ReaderFontSize) => void;
  onFontFamily: (value: ReaderFontFamily) => void;
  onReaderTheme: (value: ReaderSurfaceTheme) => void;
  onNewspaperMode: (value: boolean) => void;
  onToggleBookmark: (article: NewsArticle) => void;
  onToggleLike: (article: NewsArticle) => void;
  onToggleDislike: (article: NewsArticle) => void;
  onToggleQueue: (article: NewsArticle) => void;
  onAddHighlight: (article: NewsArticle, quote: string) => void;
  onOpenArticle: (article: NewsArticle) => void;
  onPlayRelatedAudio: (link: RelatedMediaLink) => void;
  onOpenRelatedClip?: (link: RelatedMediaLink) => void;
  onRecordReadingDuration: (article: NewsArticle, seconds: number) => void;
  onOpenAISettings: () => void;
  onBeforeSpeak?: () => void;
  showSummary: boolean;
  onOpenSummary: () => void;
  onClose: () => void;
  initialReadingRatio?: number;
  onSaveReadingProgress?: (articleId: string, ratio: number) => void;
  previousArticle?: NewsArticle;
  nextArticle?: NewsArticle;
  articlePosition?: { current: number; total: number };
  onSearchTopic?: () => void;
}

function renderWithHighlights(text: string, quotes: string[]): React.ReactNode {
  if (!quotes.length) return text;
  const match = quotes.find(q => q.length >= 8 && text.includes(q));
  if (!match) return text;
  const idx = text.indexOf(match);
  if (idx < 0) return text;
  return (
    <>
      {text.slice(0, idx)}
      <mark className="reader-highlight-mark">{match}</mark>
      {text.slice(idx + match.length)}
    </>
  );
}

export const ArticleReaderModal: React.FC<ArticleReaderModalProps> = ({
  article,
  allArticles,
  perspectiveArticles,
  translate,
  backgroundPlayback,
  reducedMotion,
  isBookmarked,
  isLiked,
  isDisliked,
  inQueue,
  nextQueuedArticle,
  highlights,
  aiConfig,
  ttsConfig,
  fontSize,
  fontFamily,
  readerTheme,
  newspaperMode,
  onFontSize,
  onFontFamily,
  onReaderTheme,
  onNewspaperMode,
  onToggleBookmark,
  onToggleLike,
  onToggleDislike,
  onToggleQueue,
  onAddHighlight,
  onOpenArticle,
  onPlayRelatedAudio,
  onOpenRelatedClip,
  onRecordReadingDuration,
  onOpenAISettings,
  onBeforeSpeak,
  showSummary,
  onOpenSummary,
  onClose,
  initialReadingRatio,
  onSaveReadingProgress,
  previousArticle,
  nextArticle,
  articlePosition,
  onSearchTopic,
}) => {
  const { lang, locale, t, categoryLabel, formatRelative, formatHeaderDate } = useI18n();
  const copy = useMemo(() => getReaderCopy(lang), [lang]);
  const openTimestampRef = useRef<number>(Date.now());
  const recordedRef = useRef<boolean>(false);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const progressBarRef = useRef<HTMLDivElement>(null);
  const articleRef = useRef<HTMLElement>(null);
  const lastRatioRef = useRef<number>(initialReadingRatio ?? 0);
  const progressSaveTimerRef = useRef<number | undefined>(undefined);
  const restoredScrollRef = useRef<boolean>(false);
  const [resumeBannerPct, setResumeBannerPct] = useState<number | null>(null);
  const [trackActionsScroll] = useState(() => trackNavigationScroll(0));
  const [actionsHidden, setActionsHidden] = useState(false);
  const [compactHeader, setCompactHeader] = useState(false);
  const [showTypography, setShowTypography] = useState(false);
  const [twoColumns, setTwoColumns] = useState(true);
  const typographyRef = useRef<HTMLDivElement>(null);

  // Lock background page scroll cleanly while reader is open
  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, []);

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
  const hasLeadMetaLine = /^(?:Stand:\s*\d{1,2}[./]\d{1,2}[./]\d{2,4}\b|Online seit\b|\d{1,2}\.\d{1,2}\.\d{2,4}(?:[\s,-]+\d{1,2}[:.]\d{2})?)/i.test(paragraphs[0] ?? '');
  const firstTextIndex = hasLeadMetaLine ? 1 : 0;
  const leadIsHeading = headingIndexes.includes(firstTextIndex);
  const lead = (leadIsHeading ? summary : paragraphs[firstTextIndex]) || summary;
  const bodyStart = firstTextIndex + (leadIsHeading ? 0 : 1);
  const [heroImage, setHeroImage] = useState<string | undefined>(article.imageUrl);
  const [loadingFullText, setLoadingFullText] = useState(false);
  const [fullTextUnavailable, setFullTextUnavailable] = useState(false);
  const [blockedWall, setBlockedWall] = useState(false);
  const [offlineSaved, setOfflineSaved] = useState(false);
  const [offlineBusy, setOfflineBusy] = useState(false);
  const [offlineStatus, setOfflineStatus] = useState('');

  // Related cross-media links & inline player
  const relatedMedia = useMemo(
    () => findRelatedMediaForArticle(article, allArticles, 3),
    [article, allArticles],
  );
  const [inlineMediaUrl, setInlineMediaUrl] = useState<string | null>(null);

  // Local prior coverage ("What happened so far")
  const priorCoverage = useMemo(
    () => findPriorCoverage(article, allArticles, 3),
    [article, allArticles],
  );
  const [contextBullets, setContextBullets] = useState<string[] | null>(null);
  const [contextLoading, setContextLoading] = useState(false);
  const [contextError, setContextError] = useState(false);

  // Local text selection highlight state
  const [selectedQuote, setSelectedQuote] = useState('');
  const [quoteToast, setQuoteToast] = useState('');
  const articleQuotes = useMemo(
    () => highlights.filter(h => h.articleId === article.id).map(h => h.quote),
    [highlights, article.id],
  );

  useEffect(() => {
    const checkSelection = () => {
      const sel = window.getSelection();
      if (!sel || sel.isCollapsed || !articleRef.current) {
        setSelectedQuote('');
        return;
      }
      const anchor = sel.anchorNode;
      if (!anchor || !articleRef.current.contains(anchor)) {
        setSelectedQuote('');
        return;
      }
      const text = sel.toString().replace(/\s+/g, ' ').trim();
      setSelectedQuote(text.length >= 12 && text.length <= 420 ? text : '');
    };
    document.addEventListener('selectionchange', checkSelection);
    return () => document.removeEventListener('selectionchange', checkSelection);
  }, []);

  const quoteTimerRef = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearTimeout(quoteTimerRef.current), []);

  const handleSaveQuote = () => {
    if (!selectedQuote) return;
    onAddHighlight(article, selectedQuote);
    window.getSelection()?.removeAllRanges();
    setSelectedQuote('');
    setQuoteToast(t('readerHighlightSaved'));
    window.clearTimeout(quoteTimerRef.current);
    quoteTimerRef.current = window.setTimeout(() => setQuoteToast(''), 2200);
  };

  const saveOffline = async () => {
    setOfflineBusy(true);
    try {
      if (offlineSaved) {
        await removeOfflineArticle(article.link);
        setOfflineSaved(false);
        setOfflineStatus(copy.offlineRemoved);
      } else {
        const hasImage = await storeOfflineArticle(article.link, originalParagraphs.length ? originalParagraphs : [article.summary], headingIndexes, heroImage);
        if (!isBookmarked) onToggleBookmark(article);
        setOfflineSaved(true);
        setOfflineStatus(hasImage ? copy.offlineSavedFull : copy.offlineSavedText);
      }
    } catch {
      setOfflineStatus(copy.offlineError);
    } finally {
      setOfflineBusy(false);
    }
  };

  const [shareFeedback, setShareFeedback] = useState<string | null>(null);
  const shareTimerRef = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearTimeout(shareTimerRef.current), []);

  const [aiResult, setAiResult] = useState<AISummaryResult | null>(() =>
    generateLocalExtractiveSummary(article)
  );
  const [style, setStyle] = useState(() => resolveSummaryStyle(aiConfig.summaryStyle));
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);

  // Read Aloud 2.0 (Synchronized paragraph-by-paragraph speech: Cloud Scenario TTS + System Fallback)
  const bodyParagraphs = useMemo(() => paragraphs.slice(bodyStart), [paragraphs, bodyStart]);
  const speechBlocks = useMemo(() => buildSpeechBlocks(title, lead, bodyParagraphs), [title, lead, bodyParagraphs]);
  const [speechState, setSpeechState] = useState<'idle' | 'playing' | 'paused'>('idle');
  const [speechLoading, setSpeechLoading] = useState(false);
  const [speechIndex, setSpeechIndex] = useState(-1);
  const [speechRateIdx, setSpeechRateIdx] = useState(1);
  const [sleepIdx, setSleepIdx] = useState(0);
  const [speechStatus, setSpeechStatus] = useState('');
  const [speechError, setSpeechError] = useState(false);
  const speechRunRef = useRef(0);
  const sleepTimerRef = useRef<number | undefined>(undefined);
  const blockNodesRef = useRef<Map<string, HTMLElement>>(new Map());
  const ttsAudioRef = useRef<HTMLAudioElement | null>(null);
  const ttsUrlRef = useRef<string | null>(null);
  const ttsAbortRef = useRef<AbortController | null>(null);
  const speechRate = SPEECH_RATES[speechRateIdx];
  const speechRateRef = useRef<number>(speechRate);
  speechRateRef.current = speechRate;
  const sleepMinutes = SLEEP_OPTIONS[sleepIdx];
  const cloudTTSEnabled = hasCloudTTS(ttsConfig, aiConfig);
  const activeScenario = newspaperMode ? 'focus' : 'article';

  const cleanupTtsAudio = useCallback(() => {
    ttsAbortRef.current?.abort();
    ttsAbortRef.current = null;
    if (ttsAudioRef.current) {
      ttsAudioRef.current.onended = null;
      ttsAudioRef.current.onerror = null;
      ttsAudioRef.current.pause();
      ttsAudioRef.current.src = '';
      ttsAudioRef.current = null;
    }
    if (ttsUrlRef.current) {
      URL.revokeObjectURL(ttsUrlRef.current);
      ttsUrlRef.current = null;
    }
    setSpeechLoading(false);
  }, []);

  const stopSpeech = useCallback(() => {
    speechRunRef.current++;
    window.clearTimeout(sleepTimerRef.current);
    cleanupTtsAudio();
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    setSpeechState('idle');
    setSpeechIndex(-1);
    setSpeechStatus('');
  }, [cleanupTtsAudio]);

  const speakFromIndex = useCallback((startIndex: number, rateOverride?: number) => {
    if (!speechBlocks.length) return;
    if (!cloudTTSEnabled && !('speechSynthesis' in window)) return;
    const bounded = Math.max(0, Math.min(startIndex, speechBlocks.length - 1));
    const runId = ++speechRunRef.current;
    cleanupTtsAudio();
    if ('speechSynthesis' in window) window.speechSynthesis.cancel();
    onBeforeSpeak?.();
    setSpeechError(false);
    setSpeechStatus('');
    setSpeechState('playing');

    const playSystemStep = (idx: number) => {
      if (runId !== speechRunRef.current) return;
      if (!('speechSynthesis' in window) || idx >= speechBlocks.length) {
        setSpeechState('idle');
        setSpeechIndex(-1);
        setSpeechStatus('');
        return;
      }
      const block = speechBlocks[idx];
      setSpeechIndex(idx);
      const node = blockNodesRef.current.get(block.id);
      if (node) {
        node.scrollIntoView({ behavior: reducedMotion ? 'auto' : 'smooth', block: 'center' });
      }
      const utterance = new SpeechSynthesisUtterance(block.text);
      utterance.lang = locale;
      utterance.rate = rateOverride ?? speechRateRef.current;
      utterance.onend = () => playSystemStep(idx + 1);
      utterance.onerror = event => {
        if (runId !== speechRunRef.current) return;
        if (['canceled', 'interrupted'].includes(event.error)) return;
        setSpeechState('idle');
        setSpeechIndex(-1);
        setSpeechError(true);
      };
      window.speechSynthesis.speak(utterance);
    };

    if (cloudTTSEnabled && navigator.onLine) {
      const playCloudStep = async (idx: number): Promise<void> => {
        if (runId !== speechRunRef.current) return;
        if (idx >= speechBlocks.length) {
          cleanupTtsAudio();
          setSpeechState('idle');
          setSpeechIndex(-1);
          setSpeechStatus('');
          return;
        }
        const block = speechBlocks[idx];
        setSpeechIndex(idx);
        const node = blockNodesRef.current.get(block.id);
        if (node) {
          node.scrollIntoView({ behavior: reducedMotion ? 'auto' : 'smooth', block: 'center' });
        }
        setSpeechLoading(true);
        setSpeechStatus(t('ttsLoadingAudio'));

        // Gapless prefetch of the next paragraph
        if (idx + 1 < speechBlocks.length) {
          prefetchSpeechClip(speechBlocks[idx + 1].text, activeScenario, ttsConfig, aiConfig, lang);
        }

        const controller = new AbortController();
        ttsAbortRef.current = controller;
        try {
          const blob = await synthesizeSpeechBlob(block.text, activeScenario, ttsConfig, aiConfig, lang, controller.signal);
          if (runId !== speechRunRef.current) return;
          cleanupTtsAudio();
          const url = URL.createObjectURL(blob);
          ttsUrlRef.current = url;
          const audio = new Audio(url);
          audio.playbackRate = rateOverride ?? speechRateRef.current;
          ttsAudioRef.current = audio;
          setSpeechStatus('');
          audio.onended = () => {
            if (runId === speechRunRef.current) void playCloudStep(idx + 1);
          };
          audio.onerror = () => {
            if (runId !== speechRunRef.current) return;
            cleanupTtsAudio();
            setSpeechStatus(t('ttsFallbackHint'));
            playSystemStep(idx);
          };
          await audio.play();
        } catch {
          if (runId !== speechRunRef.current) return;
          cleanupTtsAudio();
          setSpeechStatus(t('ttsFallbackHint'));
          playSystemStep(idx);
        }
      };

      void playCloudStep(bounded);
      return;
    }

    playSystemStep(bounded);
  }, [speechBlocks, cloudTTSEnabled, cleanupTtsAudio, onBeforeSpeak, reducedMotion, locale, t, activeScenario, ttsConfig, aiConfig, lang]);

  const toggleSpeech = () => {
    if (speechState !== 'idle') {
      stopSpeech();
      return;
    }
    speakFromIndex(0);
  };

  const toggleSpeechPause = () => {
    if (ttsAudioRef.current) {
      if (speechState === 'playing') {
        ttsAudioRef.current.pause();
        setSpeechState('paused');
      } else if (speechState === 'paused') {
        void ttsAudioRef.current.play().catch(() => {});
        setSpeechState('playing');
      }
      return;
    }
    if (!('speechSynthesis' in window)) return;
    if (speechState === 'playing') {
      window.speechSynthesis.pause();
      setSpeechState('paused');
    } else if (speechState === 'paused') {
      window.speechSynthesis.resume();
      setSpeechState('playing');
    }
  };

  const cycleSpeechRate = () => {
    const nextIdx = (speechRateIdx + 1) % SPEECH_RATES.length;
    setSpeechRateIdx(nextIdx);
    const nextRate = SPEECH_RATES[nextIdx];
    if (ttsAudioRef.current) {
      ttsAudioRef.current.playbackRate = nextRate;
      return;
    }
    if (speechState === 'playing' && speechIndex >= 0) {
      speakFromIndex(speechIndex, nextRate);
    }
  };

  const cycleSleepTimer = () => {
    const nextIdx = (sleepIdx + 1) % SLEEP_OPTIONS.length;
    setSleepIdx(nextIdx);
    window.clearTimeout(sleepTimerRef.current);
    const mins = SLEEP_OPTIONS[nextIdx];
    if (mins > 0 && speechState !== 'idle') {
      sleepTimerRef.current = window.setTimeout(() => stopSpeech(), mins * 60_000);
    }
  };

  useEffect(() => {
    window.clearTimeout(sleepTimerRef.current);
    if (sleepMinutes > 0 && speechState === 'playing') {
      sleepTimerRef.current = window.setTimeout(() => stopSpeech(), sleepMinutes * 60_000);
    }
    return () => window.clearTimeout(sleepTimerRef.current);
  }, [sleepMinutes, speechState, stopSpeech]);

  const summaryDialog = useRef<HTMLDialogElement>(null);
  const summaryButton = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLDetailsElement>(null);

  useEffect(() => {
    const dismiss = (event: PointerEvent) => {
      if (menu.current?.open && event.target instanceof Node && !menu.current.contains(event.target)) {
        menu.current.open = false;
      }
      if (showTypography && typographyRef.current && event.target instanceof Node && !typographyRef.current.contains(event.target)) {
        setShowTypography(false);
      }
    };
    document.addEventListener('pointerdown', dismiss, true);
    return () => document.removeEventListener('pointerdown', dismiss, true);
  }, [showTypography]);

  const backButton = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    backButton.current?.focus();
    return () => {
      speechRunRef.current++;
      window.clearTimeout(sleepTimerRef.current);
      cleanupTtsAudio();
      window.speechSynthesis?.cancel();
      requestAnimationFrame(() => { if (document.activeElement === document.body) opener?.focus(); });
    };
  }, [cleanupTtsAudio]);

  useEffect(() => {
    const dialog = summaryDialog.current;
    if (showSummary && !dialog?.open) dialog?.showModal();
    if (!showSummary && dialog?.open) {
      dialog.close();
      summaryButton.current?.focus({ preventScroll: true });
    }
  }, [showSummary]);

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
        { ...aiConfig, summaryStyle: style }
      );
      setAiResult(res);
    } catch (err) {
      setAiError(err instanceof Error ? err.message : 'KI-Analyse fehlgeschlagen');
    } finally {
      setAiLoading(false);
    }
  };

  const handleLoadContext = async () => {
    if (!hasBYOKKey) return;
    setContextLoading(true);
    setContextError(false);
    try {
      const bullets = await createArticleContext({ ...article, paragraphs: originalParagraphs }, aiConfig);
      setContextBullets(bullets);
    } catch {
      setContextError(true);
    } finally {
      setContextLoading(false);
    }
  };

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();
    setLoadingFullText(true);
    setFullTextUnavailable(false);
    setBlockedWall(false);
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
        const data: { paragraphs: string[]; headingIndexes?: number[]; ogImage?: string; unavailable?: boolean; blockedWall?: boolean } | null = Capacitor.isNativePlatform()
          ? await extractNativeArticle(article.link)
          : await fetch(
            `/api/article/extract?url=${encodeURIComponent(article.link)}&title=${encodeURIComponent(article.title.slice(0, 200))}`,
            { signal: controller.signal },
          ).then(response => response.ok
            ? response.json() as Promise<{ paragraphs: string[]; headingIndexes?: number[]; ogImage?: string; unavailable?: boolean; blockedWall?: boolean }>
            : null);
        if (cancelled) return;
        if (data?.blockedWall) setBlockedWall(true);
        const contentLength = (items: string[]) => items.join(' ').length;
        if (!data?.unavailable && data?.paragraphs?.length && contentLength(data.paragraphs) > contentLength(article.paragraphs)) {
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

  // Restore saved reading scroll position once article text finishes loading
  useEffect(() => {
    if (loadingFullText || restoredScrollRef.current) return;
    restoredScrollRef.current = true;
    if (!initialReadingRatio || initialReadingRatio < 0.12 || initialReadingRatio >= 0.92) return;
    const raf = window.requestAnimationFrame(() => {
      const container = scrollContainerRef.current;
      if (!container) return;
      const scrollable = container.scrollHeight - container.clientHeight;
      if (scrollable < 320) return;
      container.scrollTo({
        top: Math.round(scrollable * initialReadingRatio),
        behavior: reducedMotion ? 'auto' : 'smooth',
      });
      setResumeBannerPct(Math.round(initialReadingRatio * 100));
    });
    return () => window.cancelAnimationFrame(raf);
  }, [loadingFullText, initialReadingRatio, reducedMotion]);

  // Persist reading progress cleanly on unmount
  useEffect(() => {
    return () => {
      window.clearTimeout(progressSaveTimerRef.current);
      if (onSaveReadingProgress && lastRatioRef.current > 0) {
        onSaveReadingProgress(article.id, lastRatioRef.current);
      }
    };
  }, [article.id, onSaveReadingProgress]);

  // Desktop keyboard shortcuts (Prev/Next, Bookmark, Queue, Newspaper mode, Escape)
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (showSummary || event.metaKey || event.ctrlKey || event.altKey) return;
      const target = event.target as HTMLElement | null;
      if (target && (['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName) || target.isContentEditable)) {
        return;
      }
      if (event.key === 'Escape' && showTypography) {
        event.preventDefault();
        event.stopImmediatePropagation();
        setShowTypography(false);
        return;
      }
      if ((event.key === 'ArrowLeft' || event.key === 'k') && previousArticle) {
        event.preventDefault();
        onOpenArticle(previousArticle);
      } else if ((event.key === 'ArrowRight' || event.key === 'j') && nextArticle) {
        event.preventDefault();
        onOpenArticle(nextArticle);
      } else if (event.key === 'b') {
        event.preventDefault();
        onToggleBookmark(article);
      } else if (event.key === 'q') {
        event.preventDefault();
        onToggleQueue(article);
      } else if (event.key === 'n') {
        event.preventDefault();
        onNewspaperMode(!newspaperMode);
      }
    };
    window.addEventListener('keydown', onKeyDown, true);
    return () => window.removeEventListener('keydown', onKeyDown, true);
  }, [
    showSummary,
    showTypography,
    previousArticle,
    nextArticle,
    article,
    newspaperMode,
    onOpenArticle,
    onToggleBookmark,
    onToggleQueue,
    onNewspaperMode,
  ]);

  const showShareMessage = (message: string) => {
    window.clearTimeout(shareTimerRef.current);
    setShareFeedback(message);
    shareTimerRef.current = window.setTimeout(() => setShareFeedback(null), 2200);
  };

  const handleShare = async () => {
    try {
      if (!await shareArticle(article)) return;
      showShareMessage(t('linkCopied'));
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return;
      showShareMessage(t('shareUnavailable'));
    }
  };

  const textSizeClass =
    fontSize === 'xlarge'
      ? 'text-[19px] leading-[1.82]'
      : fontSize === 'large'
        ? 'text-[17.5px] leading-[1.78]'
        : 'text-[16px] leading-[1.74]';

  const readingMinutes = useMemo(
    () => Math.max(1, Math.ceil((paragraphs.join(' ').match(/\S+/g)?.length ?? 0) / 220)),
    [paragraphs],
  );
  const resolvedSurfaceTheme: ReaderSurfaceTheme = newspaperMode && readerTheme === 'default' ? 'paper' : readerTheme;
  const effectiveSerif = newspaperMode || fontFamily === 'serif';
  const activeBlockId = speechIndex >= 0 ? speechBlocks[speechIndex]?.id : undefined;

  const articleType = useMemo(() => classifyArticleType(article), [article]);
  const typeKey = TYPE_LABEL_KEY[articleType];
  const kicker = typeKey ? `${t(typeKey)} · ${categoryLabel(article.category)}` : categoryLabel(article.category);
  const safeArticleHref = useMemo(() => safeHref(article.link), [article.link]);
  const headingSet = useMemo(() => new Set(headingIndexes), [headingIndexes]);
  const headingItems = useMemo(
    () =>
      bodyParagraphs
        .map((text, index) => ({
          blockId: `body-${index}`,
          text: text.trim(),
          isHeading: headingSet.has(index + bodyStart),
        }))
        .filter(item => item.isHeading && item.text.length >= 4),
    [bodyParagraphs, headingSet, bodyStart],
  );
  const freeAlternatives = useMemo(
    () => selectFreeAlternatives(article, perspectiveArticles, 3),
    [article, perspectiveArticles],
  );
  const firstProseIndex = useMemo(
    () => newspaperMode
      ? bodyParagraphs.findIndex((p, i) => !headingSet.has(i + bodyStart) && p.trim().length >= 110 && /^\p{L}/u.test(p.trim()))
      : -1,
    [newspaperMode, bodyParagraphs, headingSet, bodyStart],
  );

  const registerBlockNode = (id: string) => (el: HTMLElement | null) => {
    if (el) blockNodesRef.current.set(id, el);
    else blockNodesRef.current.delete(id);
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Artikel lesen: ${title}`}
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center"
    >
      <div
        aria-hidden="true"
        onClick={onClose}
        className={`absolute inset-0 bg-black/60 backdrop-blur-[2px] ${reducedMotion ? '' : 'reader-backdrop-enter'}`}
      />
      <div
        onClick={event => event.stopPropagation()}
        data-reader-theme={resolvedSurfaceTheme !== 'default' ? resolvedSurfaceTheme : undefined}
        className={`relative flex h-[100dvh] sm:h-[92vh] w-full flex-col overflow-hidden rounded-none sm:rounded-[30px] reader-surface shadow-2xl ring-1 ring-black/10 dark:ring-white/12 transition-[max-width] duration-300 ${
          reducedMotion ? '' : 'reader-sheet-enter'
        } ${
          newspaperMode && twoColumns ? 'max-w-5xl' : 'max-w-3xl'
        }`}
      >
        <div
          ref={scrollContainerRef}
          className="flex-1 overflow-y-auto overscroll-y-contain scroll-smooth"
          onScroll={event => {
            const { scrollTop, scrollHeight, clientHeight } = event.currentTarget;
            setActionsHidden(trackActionsScroll(scrollTop, scrollHeight - clientHeight));
            const nextCompact = scrollTop > 120;
            if (nextCompact !== compactHeader) setCompactHeader(nextCompact);
            const progress = computeReadingProgress(scrollTop, scrollHeight, clientHeight);
            if (progressBarRef.current) {
              progressBarRef.current.style.transform = `scaleX(${progress})`;
            }
            lastRatioRef.current = progress;
            if (onSaveReadingProgress) {
              window.clearTimeout(progressSaveTimerRef.current);
              progressSaveTimerRef.current = window.setTimeout(() => {
                onSaveReadingProgress(article.id, progress);
              }, 600);
            }
          }}
        >
          <div className="reader-toolbar reader-toolbar-glass sticky top-0 z-20 px-4 pb-2.5 sm:px-7">
            <div className="flex items-center justify-between gap-2">
              <button
                type="button"
                onClick={onClose}
                ref={backButton}
                className="choice-pill inline-flex min-h-11 shrink-0 items-center gap-1 pr-3.5 pl-2.5"
              >
                <ChevronLeft className="h-4 w-4" aria-hidden="true" />
                {t('back')}
              </button>

              <p
                className={`min-w-0 flex-1 truncate text-center text-xs font-semibold text-[var(--ink)] transition-opacity duration-200 ${
                  compactHeader ? 'opacity-100' : 'opacity-0 pointer-events-none'
                }`}
                aria-hidden={!compactHeader}
              >
                {title}
              </p>

              <div className="flex shrink-0 items-center gap-1">
                <button
                  type="button"
                  className="glass-icon"
                  aria-label={t('readerNewspaperMode')}
                  aria-pressed={newspaperMode}
                  title={t('readerNewspaperMode')}
                  onClick={() => onNewspaperMode(!newspaperMode)}
                >
                  <Newspaper size={18} className={newspaperMode ? 'text-[var(--accent)]' : undefined} aria-hidden="true" />
                </button>

                <div ref={typographyRef} className="relative shrink-0">
                  <button
                    type="button"
                    className="glass-icon"
                    aria-label={t('readerTypography')}
                    aria-expanded={showTypography}
                    onClick={() => setShowTypography(open => !open)}
                  >
                    <Type size={18} aria-hidden="true" />
                  </button>
                  {showTypography && (
                    <div className="settings-group absolute right-0 top-[calc(100%+0.5rem)] z-30 w-72 space-y-3.5 p-4 shadow-xl">
                      <div className="space-y-1.5">
                        <span className="block text-xs font-semibold text-[var(--muted)]">{t('readerThemeLabel')}</span>
                        <div className="grid grid-cols-2 gap-1.5">
                          {([
                            ['paper', t('readerThemePaper'), '#f4f2ec'],
                            ['sepia', t('readerThemeSepia'), '#f5edd9'],
                            ['night', t('readerThemeNight'), '#08090c'],
                            ['default', t('readerThemeDefault'), 'linear-gradient(135deg, #f5f3ee 50%, #0f1013 50%)'],
                          ] as const).map(([id, label, swatch]) => (
                            <button
                              key={id}
                              type="button"
                              className="choice-pill inline-flex items-center justify-center gap-1.5 text-xs"
                              aria-pressed={readerTheme === id}
                              onClick={() => onReaderTheme(id)}
                            >
                              <span
                                className="h-3 w-3 shrink-0 rounded-full border border-black/20 dark:border-white/25"
                                style={{ background: swatch }}
                                aria-hidden="true"
                              />
                              <span>{label}</span>
                            </button>
                          ))}
                        </div>
                      </div>

                      <div className="space-y-1.5">
                        <span className="block text-xs font-semibold text-[var(--muted)]">{t('readerFont')}</span>
                        <div className="segmented-control" style={{ gridTemplateColumns: 'repeat(2, minmax(0, 1fr))' }}>
                          <button
                            type="button"
                            className="choice-pill"
                            aria-pressed={fontFamily === 'sans'}
                            onClick={() => onFontFamily('sans')}
                          >
                            Sans
                          </button>
                          <button
                            type="button"
                            className="choice-pill font-editorial-serif"
                            aria-pressed={fontFamily === 'serif'}
                            onClick={() => onFontFamily('serif')}
                          >
                            Serif
                          </button>
                        </div>
                      </div>

                      <div className="space-y-1.5">
                        <span className="block text-xs font-semibold text-[var(--muted)]">{t('readerTextSize')}</span>
                        <div className="segmented-control">
                          {([['normal', 'A'], ['large', 'A+'], ['xlarge', 'A++']] as const).map(([id, label]) => (
                            <button
                              key={id}
                              type="button"
                              className="choice-pill"
                              aria-pressed={fontSize === id}
                              onClick={() => onFontSize(id)}
                            >
                              {label}
                            </button>
                          ))}
                        </div>
                      </div>

                      <div className="flex items-center justify-between gap-2 border-t border-[var(--line)] pt-2.5">
                        <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-[var(--ink)]">
                          <Newspaper size={14} aria-hidden="true" />
                          {t('readerNewspaperMode')}
                        </span>
                        <button
                          type="button"
                          className="choice-pill text-xs"
                          aria-pressed={newspaperMode}
                          onClick={() => onNewspaperMode(!newspaperMode)}
                        >
                          {newspaperMode ? copy.onLabel : copy.offLabel}
                        </button>
                      </div>

                      {newspaperMode && (
                        <div className="hidden lg:flex items-center justify-between gap-2">
                          <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-[var(--ink)]">
                            <Columns2 size={14} aria-hidden="true" />
                            {t('readerNewspaperColumns')}
                          </span>
                          <button
                            type="button"
                            className="choice-pill text-xs"
                            aria-pressed={twoColumns}
                            onClick={() => setTwoColumns(v => !v)}
                          >
                            {twoColumns ? '2' : '1'}
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
            <div className="reader-progress-track" aria-hidden="true">
              <div ref={progressBarRef} className="reader-progress-fill" />
            </div>
          </div>

          <article
            ref={articleRef}
            className={`reader-body mx-auto px-5 pt-6 sm:px-8 ${
              newspaperMode
                ? `reader-newspaper ${twoColumns ? 'max-w-[58rem]' : 'max-w-[44rem]'}`
                : 'max-w-[44rem]'
            }`}
          >
            {newspaperMode ? (
              <header className="reader-newspaper-masthead">
                <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--muted)]">
                  <span className="inline-flex items-center gap-1.5 text-[var(--ink)]">
                    <SourceIcon
                      source={{ id: article.sourceId, shortCode: article.sourceShortCode, accentColor: article.sourceColor }}
                      size="h-4 w-4 rounded-[3px] text-[7px]"
                    />
                    {article.sourceName}
                  </span>
                  <span>{formatHeaderDate(new Date(article.publishedAt || Date.now()))}</span>
                </div>
                <p className="mt-2 text-xs font-bold uppercase tracking-[0.08em] text-[var(--accent)]">
                  {kicker}
                </p>
                <h1
                  ref={registerBlockNode('title')}
                  className={`reader-speech-para mt-2 text-[1.75rem] sm:text-[2.35rem] font-extrabold leading-[1.12] tracking-[-0.02em] text-[var(--ink)] [text-wrap:balance] ${
                    activeBlockId === 'title' ? 'reader-speaking-active' : ''
                  }`}
                >
                  {title}
                </h1>
                <div className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-[var(--muted)] tabular-nums">
                  {article.author && (
                    <>
                      <span>{article.author}</span>
                      <span aria-hidden="true">·</span>
                    </>
                  )}
                  <span>{formatRelative(article.publishedAt)}</span>
                  <span aria-hidden="true">·</span>
                  <span>{t('readerReadMinutes', { min: readingMinutes })}</span>
                  {offlineSaved && (
                    <>
                      <span aria-hidden="true">·</span>
                      <span className="text-[var(--accent)]">{t('readerOfflineReady')}</span>
                    </>
                  )}
                </div>
              </header>
            ) : (
              <>
                <p className="text-xs font-bold tracking-wide text-[var(--accent)]">
                  {kicker}
                </p>

                <h1
                  ref={registerBlockNode('title')}
                  className={`reader-speech-para mt-2 text-[1.6rem] sm:text-[2.1rem] font-extrabold leading-[1.15] tracking-[-0.025em] text-[var(--ink)] [text-wrap:balance] ${effectiveSerif ? 'font-editorial-serif' : ''} ${
                    activeBlockId === 'title' ? 'reader-speaking-active' : ''
                  }`}
                >
                  {title}
                </h1>

                {translate && (
                  <div className="mt-3 text-sm" role="status">
                    {translationError ? 'Übersetzung gerade nicht verfügbar. Für den Modell-Download wird WLAN benötigt.'
                      : translation?.source === originalParagraphs ? (
                        <button type="button" className="choice-pill" onClick={() => setShowOriginal(current => !current)}>
                          {showOriginal ? 'Deutsch anzeigen' : 'Original anzeigen'}
                        </button>
                      ) : 'Übersetzung wird vorbereitet …'}
                  </div>
                )}

                <div className="mt-3.5 flex flex-wrap items-center gap-x-2 gap-y-1 border-b border-[var(--line)] pb-4 text-xs text-[var(--muted)] tabular-nums">
                  <span className="inline-flex items-center gap-1.5 font-semibold text-[var(--ink)]">
                    <SourceIcon
                      source={{ id: article.sourceId, shortCode: article.sourceShortCode, accentColor: article.sourceColor }}
                      size="h-4 w-4 rounded-[4px] text-[7px]"
                    />
                    {article.sourceName}
                  </span>
                  {article.author && (
                    <>
                      <span aria-hidden="true">·</span>
                      <span>{article.author}</span>
                    </>
                  )}
                  <span aria-hidden="true">·</span>
                  <span>{formatRelative(article.publishedAt)}</span>
                  <span aria-hidden="true">·</span>
                  <span>{t('readerReadMinutes', { min: readingMinutes })}</span>
                  {offlineSaved && (
                    <>
                      <span aria-hidden="true">·</span>
                      <span className="font-medium text-[var(--accent)]">{t('readerOfflineReady')}</span>
                    </>
                  )}
                </div>
              </>
            )}

            {resumeBannerPct !== null && (
              <div
                role="status"
                className="mt-4 flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-[var(--line)] bg-[var(--panel-2)] px-3.5 py-2 text-xs text-[var(--ink)]"
              >
                <span className="font-medium tabular-nums">{copy.resumeReading(resumeBannerPct)}</span>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => {
                      scrollContainerRef.current?.scrollTo({ top: 0, behavior: reducedMotion ? 'auto' : 'smooth' });
                      setResumeBannerPct(null);
                    }}
                    className="rounded-full px-2.5 py-1 font-semibold text-[var(--accent)] hover:bg-[var(--control)]"
                  >
                    {copy.backToTop}
                  </button>
                  <button
                    type="button"
                    aria-label={t('close')}
                    onClick={() => setResumeBannerPct(null)}
                    className="grid h-7 w-7 place-items-center rounded-full text-[var(--muted)] hover:bg-[var(--control)] hover:text-[var(--ink)]"
                  >
                    <X size={13} aria-hidden="true" />
                  </button>
                </div>
              </div>
            )}

            {headingItems.length >= 3 && (
              <details className="mt-4 rounded-2xl border border-[var(--line)] bg-[var(--panel-2)] px-3.5 py-2.5 text-sm">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-2 text-xs font-semibold text-[var(--ink)]">
                  <span>{copy.chaptersLabel(headingItems.length)}</span>
                  <ChevronDown size={15} className="text-[var(--muted)]" aria-hidden="true" />
                </summary>
                <ol className="mt-2.5 space-y-1 border-t border-[var(--line)] pt-2">
                  {headingItems.map((item, idx) => (
                    <li key={item.blockId}>
                      <button
                        type="button"
                        onClick={() => {
                          blockNodesRef.current.get(item.blockId)?.scrollIntoView({
                            behavior: reducedMotion ? 'auto' : 'smooth',
                            block: 'start',
                          });
                        }}
                        className="flex min-h-10 w-full items-baseline gap-2.5 rounded-xl px-2 py-1.5 text-left text-xs font-medium text-[var(--ink)] transition-colors hover:bg-[var(--control)] hover:text-[var(--accent)]"
                      >
                        <span className="shrink-0 font-bold text-[var(--muted)] tabular-nums">
                          {String(idx + 1).padStart(2, '0')}
                        </span>
                        <span className="line-clamp-2 leading-snug">{item.text}</span>
                      </button>
                    </li>
                  ))}
                </ol>
              </details>
            )}

            <div className={`reader-prose mt-6 space-y-5 ${textSizeClass} ${effectiveSerif ? 'font-editorial-serif' : ''}`}>
              {lead && (
                <p
                  ref={registerBlockNode('lead')}
                  className={`reader-speech-para reader-lead ${activeBlockId === 'lead' ? 'reader-speaking-active' : ''}`}
                >
                  {renderWithHighlights(lead, articleQuotes)}
                </p>
              )}
              {heroImage && (
                <ArticleImage
                  key={heroImage}
                  src={heroImage}
                  alt=""
                  sourceShortCode={article.sourceShortCode}
                  sourceColor={article.sourceColor}
                  priority
                  className="aspect-video w-full overflow-hidden rounded-2xl"
                />
              )}
              <ArticleMedia key={article.id} article={article} heroImage={heroImage} background={backgroundPlayback} />
              <div className={`space-y-5 ${newspaperMode ? `reader-newspaper-body ${twoColumns ? 'reader-newspaper-columns' : ''}` : ''}`}>
                {bodyParagraphs.map((paragraph, index) => {
                  const blockId = `body-${index}`;
                  const isSpeakingBlock = activeBlockId === blockId;
                  const isHeading = headingSet.has(index + bodyStart);
                  const isFirstProse = newspaperMode && !isHeading && index === firstProseIndex;
                  return isHeading ? (
                    <h2
                      key={index}
                      ref={registerBlockNode(blockId)}
                      className={`reader-speech-para text-[1.2em] ${isSpeakingBlock ? 'reader-speaking-active' : ''}`}
                    >
                      {paragraph}
                    </h2>
                  ) : (
                    <p
                      key={index}
                      ref={registerBlockNode(blockId)}
                      className={`reader-speech-para ${isFirstProse ? 'reader-dropcap' : ''} ${isSpeakingBlock ? 'reader-speaking-active' : ''}`}
                    >
                      {renderWithHighlights(paragraph, articleQuotes)}
                    </p>
                  );
                })}
              </div>
            </div>

            {loadingFullText && (
              <div className="mt-6 space-y-3" role="status">
                <span className="sr-only">{t('readerLoadingText')}</span>
                <div className="image-shimmer h-4 w-full rounded-md" aria-hidden="true" />
                <div className="image-shimmer h-4 w-11/12 rounded-md" aria-hidden="true" />
                <div className="image-shimmer h-4 w-4/5 rounded-md" aria-hidden="true" />
              </div>
            )}

            {!loadingFullText && (blockedWall || fullTextUnavailable) && (
              <section
                aria-label={copy.paywallTitle}
                className="mt-6 space-y-3.5 rounded-2xl border border-[var(--line)] bg-[var(--panel-2)] p-4 sm:p-5"
              >
                <div className="space-y-1">
                  <p className="text-sm font-bold text-[var(--ink)]">{copy.paywallTitle}</p>
                  <p className="text-xs leading-relaxed text-[var(--muted)]">{copy.paywallDesc}</p>
                </div>

                {freeAlternatives.length > 0 && (
                  <div className="space-y-2 border-t border-[var(--line)] pt-3">
                    <p className="text-[11px] font-bold uppercase tracking-[0.06em] text-[var(--muted)]">
                      {copy.paywallAlternativesTitle}
                    </p>
                    <ul className="divide-y divide-[var(--line)] rounded-xl border border-[var(--line)] bg-[var(--panel)] px-3">
                      {freeAlternatives.map(alt => (
                        <li key={alt.id}>
                          <button
                            type="button"
                            onClick={() => onOpenArticle(alt)}
                            className="group flex min-h-12 w-full items-center justify-between gap-3 py-2.5 text-left"
                          >
                            <div className="min-w-0 flex-1 space-y-0.5">
                              <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-[var(--muted)]">
                                <SourceIcon
                                  source={{ id: alt.sourceId, shortCode: alt.sourceShortCode, accentColor: alt.sourceColor }}
                                  size="h-4 w-4 rounded-[4px] text-[7px]"
                                />
                                {alt.sourceName} · {formatRelative(alt.publishedAt)}
                              </span>
                              <p className="line-clamp-2 text-xs font-bold leading-snug text-[var(--ink)] group-hover:text-[var(--accent)]">
                                {alt.title}
                              </p>
                            </div>
                            <span className="shrink-0 text-xs font-semibold text-[var(--accent)]">
                              {copy.paywallReadInApp}
                            </span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                <div className="flex flex-wrap items-center gap-2 pt-0.5">
                  {safeArticleHref && (
                    <a
                      href={safeArticleHref}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="choice-pill inline-flex items-center gap-1.5 text-xs"
                    >
                      <ExternalLink size={14} aria-hidden="true" />
                      {copy.paywallOpenSource}
                    </a>
                  )}
                  {onSearchTopic && (
                    <button
                      type="button"
                      onClick={onSearchTopic}
                      className="choice-pill inline-flex items-center gap-1.5 text-xs"
                    >
                      <Search size={14} aria-hidden="true" />
                      {copy.paywallSearchMore}
                    </button>
                  )}
                </div>
              </section>
            )}

            {/* Intelligent Related Cross-Media Links (Article -> Video / Clip / Podcast in-app) */}
            {relatedMedia.length > 0 && (
              <section aria-labelledby="related-media-heading" className="mt-8 space-y-3 border-t border-[var(--line)] pt-6">
                <h2 id="related-media-heading" className="text-xs font-bold uppercase tracking-[0.08em] text-[var(--muted)]">
                  {t('readerRelatedMedia')}
                </h2>
                <div className="space-y-2.5">
                  {relatedMedia.map(link => {
                    const isAudio = link.media.type === 'audio';
                    const isExpanded = inlineMediaUrl === link.media.url;
                    return (
                      <div key={link.media.url} className="overflow-hidden rounded-2xl border border-[var(--line)] bg-[var(--panel)]">
                        <div className="flex items-center gap-3 p-3">
                          <div className="relative h-14 w-20 shrink-0 overflow-hidden rounded-xl bg-slate-900 text-white">
                            {link.article.imageUrl ? (
                              <ArticleImage
                                src={link.article.imageUrl}
                                alt=""
                                sourceShortCode={link.article.sourceShortCode}
                                sourceColor={link.article.sourceColor}
                                className="h-full w-full object-cover"
                              />
                            ) : (
                              <span className="grid h-full w-full place-items-center">
                                {isAudio ? <Headphones size={20} aria-hidden="true" /> : <Video size={20} aria-hidden="true" />}
                              </span>
                            )}
                            <span className="absolute inset-0 grid place-items-center bg-black/35">
                              {isAudio ? <Headphones size={16} aria-hidden="true" /> : <Play size={16} fill="currentColor" aria-hidden="true" />}
                            </span>
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-[11px] font-semibold text-[var(--muted)]">
                              {link.article.sourceName} · {isAudio ? t('mediaFilterAudio') : link.media.portrait ? t('mediaFilterClips') : t('videoLabel')}
                            </p>
                            <p className="mt-0.5 line-clamp-2 text-[13.5px] font-bold leading-snug text-[var(--ink)]">
                              {link.article.title}
                            </p>
                          </div>
                          <button
                            type="button"
                            className="choice-pill shrink-0 text-xs"
                            onClick={() => {
                              if (isAudio) {
                                onPlayRelatedAudio(link);
                              } else if (link.media.portrait && onOpenRelatedClip) {
                                onOpenRelatedClip(link);
                              } else {
                                setInlineMediaUrl(current => (current === link.media.url ? null : link.media.url));
                              }
                            }}
                          >
                            {isAudio ? t('readerListenInApp') : t('readerWatchInApp')}
                          </button>
                        </div>

                        {isExpanded && !isAudio && (
                          <div className="border-t border-[var(--line)] bg-black">
                            <div className="aspect-video w-full">
                              <MediaPlayer
                                media={link.media}
                                title={link.article.title}
                                poster={link.article.imageUrl}
                                background={backgroundPlayback}
                                autoPlay
                                onEngaged={secs => onRecordReadingDuration(link.article, secs)}
                              />
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </section>
            )}

            {/* Up Next Reading Queue Card */}
            {nextQueuedArticle && (
              <div className="mt-6 rounded-2xl border border-[var(--line)] bg-[var(--panel)] p-4">
                <button
                  type="button"
                  onClick={() => onOpenArticle(nextQueuedArticle)}
                  className="group flex w-full items-center justify-between gap-3 text-left"
                >
                  <div className="min-w-0">
                    <p className="text-[11px] font-bold uppercase tracking-[0.06em] text-[var(--accent)]">
                      {t('readerQueueNext')} · {nextQueuedArticle.sourceName}
                    </p>
                    <p className="mt-0.5 line-clamp-2 text-sm font-bold text-[var(--ink)] group-hover:text-[var(--accent)]">
                      {nextQueuedArticle.title}
                    </p>
                  </div>
                  <ArrowRight size={18} className="shrink-0 text-[var(--muted)] transition-transform group-hover:translate-x-1" aria-hidden="true" />
                </button>
              </div>
            )}

            {/* Prev / Next Article Navigation inside Feed Context */}
            {(previousArticle || nextArticle) && (
              <nav
                aria-label={`${copy.prevArticle} / ${copy.nextArticle}`}
                className="mt-7 space-y-2.5 border-t border-[var(--line)] pt-5"
              >
                {articlePosition && articlePosition.total > 1 && (
                  <p className="text-[11px] font-semibold text-[var(--muted)] tabular-nums">
                    {articlePosition.current} / {articlePosition.total}
                  </p>
                )}
                <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                  {previousArticle ? (
                    <button
                      type="button"
                      onClick={() => onOpenArticle(previousArticle)}
                      className="group flex min-h-[64px] items-center gap-3 rounded-2xl border border-[var(--line)] bg-[var(--panel)] p-3.5 text-left transition-colors hover:border-[var(--accent)]/40"
                    >
                      <ArrowLeft size={16} className="shrink-0 text-[var(--muted)] transition-transform group-hover:-translate-x-0.5" aria-hidden="true" />
                      <div className="min-w-0">
                        <p className="text-[11px] font-semibold text-[var(--muted)]">
                          {copy.prevArticle} · {previousArticle.sourceName}
                        </p>
                        <p className="mt-0.5 line-clamp-2 text-xs font-bold leading-snug text-[var(--ink)] group-hover:text-[var(--accent)]">
                          {previousArticle.title}
                        </p>
                      </div>
                    </button>
                  ) : <div className="hidden sm:block" aria-hidden="true" />}
                  {nextArticle && (
                    <button
                      type="button"
                      onClick={() => onOpenArticle(nextArticle)}
                      className="group flex min-h-[64px] items-center justify-between gap-3 rounded-2xl border border-[var(--line)] bg-[var(--panel)] p-3.5 text-left transition-colors hover:border-[var(--accent)]/40"
                    >
                      <div className="min-w-0">
                        <p className="text-[11px] font-semibold text-[var(--muted)]">
                          {copy.nextArticle} · {nextArticle.sourceName}
                        </p>
                        <p className="mt-0.5 line-clamp-2 text-xs font-bold leading-snug text-[var(--ink)] group-hover:text-[var(--accent)]">
                          {nextArticle.title}
                        </p>
                      </div>
                      <ArrowRight size={16} className="shrink-0 text-[var(--muted)] transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
                    </button>
                  )}
                </div>
              </nav>
            )}

            <footer className="mt-8 space-y-3 border-t border-[var(--line)] pt-5 pb-20">
              <div className="flex flex-wrap items-center gap-2.5">
                <button
                  type="button"
                  className="choice-pill inline-flex items-center gap-2"
                  aria-pressed={inQueue}
                  onClick={() => onToggleQueue(article)}
                >
                  {inQueue ? <Check size={15} aria-hidden="true" /> : <ListPlus size={15} aria-hidden="true" />}
                  {inQueue ? t('readerQueueAdded') : t('readerQueueAdd')}
                </button>
                {!Capacitor.isNativePlatform() && 'caches' in window && !article.linkIsFeed && (
                  <button
                    type="button"
                    className="choice-pill inline-flex items-center gap-2"
                    disabled={offlineBusy || loadingFullText}
                    onClick={() => void saveOffline()}
                  >
                    <Download size={15} aria-hidden="true" />
                    {offlineSaved ? t('readerRemoveOffline') : t('readerSaveOffline')}
                  </button>
                )}
                {fullTextUnavailable && safeArticleHref && (
                  <a
                    href={safeArticleHref}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="choice-pill inline-flex items-center gap-2"
                  >
                    <ExternalLink size={15} aria-hidden="true" />
                    {t('readerContinueAtSource')}
                  </a>
                )}
              </div>
              {offlineStatus && <p className="text-sm text-[var(--muted)]" role="status">{offlineStatus}</p>}
              {speechError && <p role="status" className="text-sm text-[var(--muted)]">{t('shareUnavailable')}</p>}
            </footer>
          </article>
        </div>

        {/* Floating Selection Highlight Pill */}
        {(selectedQuote || quoteToast) && (
          <div className="pointer-events-none absolute inset-x-0 bottom-24 z-30 flex justify-center px-4">
            {selectedQuote ? (
              <button
                type="button"
                onClick={handleSaveQuote}
                className="pointer-events-auto primary-action inline-flex min-h-11 items-center gap-2 px-4 shadow-xl"
              >
                <Highlighter size={16} aria-hidden="true" />
                {t('readerHighlightAdd')}
              </button>
            ) : (
              <span role="status" className="liquid-glass-dock rounded-full px-4 py-2 text-xs font-semibold text-[var(--ink)] shadow-lg">
                {quoteToast}
              </span>
            )}
          </div>
        )}

        {/* Read Aloud 2.0 Floating Synchronized Playback Bar */}
        {speechState !== 'idle' && (
          <div
            role="region"
            aria-label={t('readerReadAloud')}
            className="mx-3 mb-2 flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-[var(--line)] bg-[var(--glass-tint)] px-3 py-2 backdrop-blur-xl shadow-lg sm:mx-6"
          >
            <div className="flex items-center gap-1">
              <button
                type="button"
                className="grid h-10 w-10 place-items-center rounded-full text-[var(--ink)] hover:bg-[var(--control)]"
                aria-label={t('readerSpeechPrev')}
                onClick={() => speakFromIndex(Math.max(0, speechIndex - 1))}
              >
                <SkipBack size={16} aria-hidden="true" />
              </button>
              <button
                type="button"
                className="grid h-10 w-10 place-items-center rounded-full bg-[var(--accent)] text-[var(--accent-ink)]"
                aria-label={speechState === 'playing' ? t('briefingPause') : t('briefingResume')}
                onClick={toggleSpeechPause}
              >
                {speechState === 'playing' ? <Pause size={16} fill="currentColor" aria-hidden="true" /> : <Play size={16} fill="currentColor" aria-hidden="true" />}
              </button>
              <button
                type="button"
                className="grid h-10 w-10 place-items-center rounded-full text-[var(--ink)] hover:bg-[var(--control)]"
                aria-label={t('readerSpeechNext')}
                onClick={() => speakFromIndex(Math.min(speechBlocks.length - 1, speechIndex + 1))}
              >
                <SkipForward size={16} aria-hidden="true" />
              </button>
              <span className="ml-1 inline-flex items-center gap-1.5 text-xs font-semibold text-[var(--muted)] tabular-nums">
                {speechLoading && <Loader2 size={13} className="animate-spin text-[var(--accent)]" aria-hidden="true" />}
                {Math.max(1, speechIndex + 1)} / {speechBlocks.length}
              </span>
              {speechStatus && (
                <span className="hidden sm:inline max-w-[14rem] truncate text-[11px] text-[var(--muted)]" role="status">
                  {speechStatus}
                </span>
              )}
            </div>

            <div className="flex items-center gap-1">
              <button
                type="button"
                className="choice-pill min-h-9 px-2.5 text-xs tabular-nums"
                aria-label={t('mediaAudioSpeed')}
                onClick={cycleSpeechRate}
              >
                {speechRate}×
              </button>
              <button
                type="button"
                className="choice-pill inline-flex min-h-9 items-center gap-1 px-2.5 text-xs tabular-nums"
                aria-label={t('readerSpeechSleep')}
                onClick={cycleSleepTimer}
              >
                <Moon size={13} aria-hidden="true" />
                {sleepMinutes > 0 ? `${sleepMinutes}m` : t('readerSpeechOff')}
              </button>
              <button
                type="button"
                className="grid h-10 w-10 place-items-center rounded-full text-[var(--muted)] hover:bg-[var(--control)] hover:text-[var(--ink)]"
                aria-label={t('readerStopAloud')}
                onClick={stopSpeech}
              >
                <Square size={15} fill="currentColor" aria-hidden="true" />
              </button>
            </div>
          </div>
        )}

        <div
          className="reader-actions"
          aria-label={t('readerMoreActions')}
          data-scroll-hidden={actionsHidden && !showSummary && !shareFeedback && speechState === 'idle'}
        >
          <button
            ref={summaryButton}
            type="button"
            className="glass-icon"
            aria-label={t('readerSummary')}
            aria-haspopup="dialog"
            aria-controls="reader-summary"
            onClick={onOpenSummary}
          >
            <Sparkles size={19} aria-hidden="true" />
          </button>
          {(cloudTTSEnabled || 'speechSynthesis' in window) && (
            <button
              type="button"
              className="glass-icon"
              aria-label={speechState !== 'idle' ? t('readerStopAloud') : t('readerReadAloud')}
              aria-pressed={speechState !== 'idle'}
              onClick={toggleSpeech}
            >
              {speechState !== 'idle'
                ? <Square size={17} className="text-[var(--accent)]" fill="currentColor" aria-hidden="true" />
                : <Volume2 size={19} aria-hidden="true" />}
            </button>
          )}
          <button
            type="button"
            className="glass-icon reaction-btn"
            data-active={isLiked || undefined}
            aria-label={isLiked ? t('unlike') : t('like')}
            aria-pressed={isLiked}
            onClick={() => onToggleLike(article)}
          >
            <Heart size={19} className={isLiked ? 'fill-current text-rose-500 dark:text-rose-400' : undefined} aria-hidden="true" />
          </button>
          <button
            type="button"
            className="glass-icon reaction-btn"
            data-active={isBookmarked || undefined}
            aria-label={isBookmarked ? t('unbookmark') : t('bookmark')}
            aria-pressed={isBookmarked}
            onClick={() => onToggleBookmark(article)}
          >
            <Bookmark size={19} className={isBookmarked ? 'fill-current text-[var(--accent)]' : undefined} aria-hidden="true" />
          </button>
          <button type="button" className="glass-icon" aria-label={t('share')} onClick={handleShare}>
            <Share2 size={19} aria-hidden="true" />
          </button>
          {shareFeedback && <span className="reader-share-feedback" role="status">{shareFeedback}</span>}
          <details ref={menu} className="reader-menu">
            <summary className="glass-icon" aria-label={t('readerMoreActions')}><Ellipsis size={20} aria-hidden="true" /></summary>
            <div className="settings-group">
              <button
                type="button"
                className="preference-row settings-link"
                aria-pressed={inQueue}
                onClick={() => {
                  onToggleQueue(article);
                  if (menu.current) menu.current.open = false;
                }}
              >
                {inQueue ? <Check aria-hidden="true" /> : <ListPlus aria-hidden="true" />}
                <span>{inQueue ? t('readerQueueAdded') : t('readerQueueAdd')}</span>
              </button>
              <button
                type="button"
                className="preference-row settings-link"
                aria-pressed={isDisliked}
                onClick={() => onToggleDislike(article)}
              >
                <ThumbsDown aria-hidden="true" /><span>{t('readerLessLikeThis')}</span>
              </button>
              {safeArticleHref && (
                <a href={safeArticleHref} target="_blank" rel="noopener noreferrer" className="preference-row settings-link">
                  <ExternalLink aria-hidden="true" /><span>{t('readerOpenOriginal')}</span>
                </a>
              )}
            </div>
          </details>
        </div>
      </div>

      <dialog
        ref={summaryDialog}
        id="reader-summary"
        data-reader-theme={resolvedSurfaceTheme}
        className="motion-dialog reader-summary"
        aria-labelledby="reader-summary-title"
        onCancel={event => { event.preventDefault(); onClose(); }}
        onClick={event => { if (event.target === event.currentTarget) onClose(); }}
      >
        <div className="reader-summary-content space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-[var(--accent)]" aria-hidden="true" />
              <h2 id="reader-summary-title" className="text-base font-bold text-[var(--ink)]">
                {t('readerSummaryTitle')}
              </h2>
            </div>

            <button type="button" autoFocus className="glass-icon" aria-label={t('close')} onClick={onClose}>
              <X size={20} aria-hidden="true" />
            </button>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-xs font-medium text-[var(--muted)]">
              {aiLoading ? t('readerAnalyzing') : aiResult?.providerLabel}
            </span>
            <button
              type="button"
              onClick={handleRunBYOK}
              disabled={aiLoading}
              className="primary-action min-h-[44px] px-4 py-2 text-xs"
            >
              {aiLoading ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
              ) : hasBYOKKey ? (
                <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
              ) : (
                <Settings className="h-3.5 w-3.5" aria-hidden="true" />
              )}
              {deviceSummary ? t('readerRunDeviceAI') : hasBYOKKey ? t('readerRefreshAI') : t('readerConnectAI')}
            </button>
          </div>

          {(hasBYOKKey || (deviceSummary && Capacitor.getPlatform() !== 'android')) && (
            <label className="flex flex-wrap items-center justify-between gap-2 text-sm">
              <span>{t('readerSummaryStyle')}</span>
              <select
                className="preference-input"
                value={style}
                disabled={aiLoading}
                onChange={event => {
                  setAiResult(generateLocalExtractiveSummary({ ...article, paragraphs: originalParagraphs }));
                  setStyle(resolveSummaryStyle(event.target.value));
                }}
              >
                {Object.entries(SUMMARY_STYLES).map(([id, preset]) => <option key={id} value={id}>{preset.label}</option>)}
              </select>
            </label>
          )}
          {aiError && (
            <div className="rounded-2xl bg-rose-500/10 p-3 text-xs text-rose-600 dark:text-rose-400">
              {aiError}
            </div>
          )}

          {aiResult && (
            <div className="space-y-3 text-sm leading-relaxed text-[var(--ink)]">
              <ul className="space-y-2.5 pl-4 list-disc marker:text-[var(--accent)]">
                {aiResult.bullets.map((b, i) => (
                  <li key={i}>{b}</li>
                ))}
              </ul>
            </div>
          )}

          {/* "What happened so far" (Local Archive + Optional BYOK AI Context) */}
          {showSummary && (priorCoverage.length > 0 || hasBYOKKey) && (
            <div className="space-y-2.5 border-t border-[var(--line)] pt-3.5">
              <div className="flex items-center gap-1.5 text-sm font-bold text-[var(--ink)]">
                <History size={15} className="text-[var(--accent)]" aria-hidden="true" />
                <span>{t('readerContextTitle')}</span>
              </div>

              {hasBYOKKey && (
                <div className="space-y-2">
                  {!contextBullets && (
                    <button
                      type="button"
                      className="choice-pill inline-flex items-center gap-1.5 text-xs"
                      disabled={contextLoading || loadingFullText}
                      onClick={() => void handleLoadContext()}
                    >
                      {contextLoading && <Loader2 size={13} className="animate-spin" aria-hidden="true" />}
                      {t('readerContextLoad')}
                    </button>
                  )}
                  {contextError && <p className="text-xs text-rose-500">{t('retry')}</p>}
                  {contextBullets && (
                    <ul className="space-y-1.5 pl-4 text-sm list-disc marker:text-[var(--accent)]">
                      {contextBullets.map((item, idx) => <li key={idx}>{item}</li>)}
                    </ul>
                  )}
                </div>
              )}

              {priorCoverage.length > 0 && (
                <div className="space-y-1.5">
                  <p className="text-xs font-medium text-[var(--muted)]">{t('readerContextPrior')}</p>
                  <ul className="divide-y divide-[var(--line)] rounded-xl border border-[var(--line)] bg-[var(--panel-2)] px-3">
                    {priorCoverage.map(prev => (
                      <li key={prev.id}>
                        <button
                          type="button"
                          onClick={() => {
                            onClose();
                            onOpenArticle(prev);
                          }}
                          className="flex min-h-11 w-full flex-col justify-center py-2 text-left hover:text-[var(--accent)]"
                        >
                          <span className="text-[11px] font-medium text-[var(--muted)]">
                            {prev.sourceName} · {formatRelative(prev.publishedAt)}
                          </span>
                          <span className="text-xs font-semibold leading-snug text-[var(--ink)]">
                            {prev.title}
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          {showSummary && hasBYOKKey && (
            <ArticleQuestions
              article={{ ...article, paragraphs: originalParagraphs }}
              config={aiConfig}
              disabled={loadingFullText}
            />
          )}
          {showSummary && hasBYOKKey && perspectiveArticles.length >= 2 && (
            <ArticlePerspectives
              key={perspectiveArticles.map(report => report.id).join(',')}
              articles={perspectiveArticles}
              config={aiConfig}
            />
          )}
          {showSummary && (article.transcript || article.audioUrl || article.videoUrl || article.youtubeId) && (
            <TranscriptSummary article={article} config={aiConfig} />
          )}
        </div>
      </dialog>
    </div>
  );
};
