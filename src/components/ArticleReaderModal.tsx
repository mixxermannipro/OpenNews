import { ReaderAudioBar } from './ReaderAudioBar';
import { resolveSummaryStyle } from '../lib/summaryStyles';
import { useReaderKeyboard } from './reader/useReaderKeyboard';
import { ReaderToolbar } from './reader/ReaderToolbar';
import { ReaderHeader } from './reader/ReaderHeader';
import { ReaderChapterBar } from './reader/ReaderChapterBar';
import { ReaderPaywallNotice } from './reader/ReaderPaywallNotice';
import { ReaderSummaryDialog } from './reader/ReaderSummaryDialog';
import { Capacitor } from '@capacitor/core';
import { readOfflineArticle, removeOfflineArticle, storeOfflineArticle } from '../lib/offlineArticle';
import { extractNativeArticle } from '../lib/nativeFeed';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Bookmark,
  Check,
  Download,
  Ellipsis,
  ExternalLink,
  Headphones,
  Heart,
  Highlighter,
  ListPlus,
  Loader2,
  Play,
  Share2,
  Sparkles,
  Square,
  ThumbsDown,
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
  allowFullText?: boolean;
  onEnableFullText?: (sourceId: string) => void;
  onDisableFullText?: (sourceId: string) => void;
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
  allowFullText = false,
  onEnableFullText,
  onDisableFullText,
}: ArticleReaderModalProps) => {
  const { lang, locale, t, categoryLabel, formatRelative } = useI18n();
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
  const [publisherOptOut, setPublisherOptOut] = useState(false);
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
    setFullTextUnavailable(false);
    setBlockedWall(false);
    setPublisherOptOut(false);
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
        if (!allowFullText) {
          setLoadingFullText(false);
          return;
        }
        setLoadingFullText(true);
        const data: { paragraphs: string[]; headingIndexes?: number[]; ogImage?: string; unavailable?: boolean; blockedWall?: boolean; optOut?: boolean } | null = Capacitor.isNativePlatform()
          ? await extractNativeArticle(article.link)
          : await fetch(
            `/api/article/extract?url=${encodeURIComponent(article.link)}&title=${encodeURIComponent(article.title.slice(0, 200))}`,
            { signal: controller.signal },
          ).then(response => response.ok
            ? response.json() as Promise<{ paragraphs: string[]; headingIndexes?: number[]; ogImage?: string; unavailable?: boolean; blockedWall?: boolean; optOut?: boolean }>
            : null);
        if (cancelled) return;
        if (data?.optOut) setPublisherOptOut(true);
        if (data?.blockedWall) setBlockedWall(true);
        const contentLength = (items: string[]) => items.join(' ').length;
        if (!data?.unavailable && !data?.blockedWall && !data?.optOut && data?.paragraphs?.length && contentLength(data.paragraphs) > contentLength(article.paragraphs)) {
          setParagraphs(data.paragraphs);
          setHeadingIndexes(data.headingIndexes ?? []);
          setAiResult(previous => previous?.mode === 'ai' ? previous : generateLocalExtractiveSummary({ ...article, paragraphs: data.paragraphs }));
        } else if (!cached) {
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
  }, [article, allowFullText]);

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

  useReaderKeyboard({
    showSummary,
    showTypography,
    setShowTypography,
    previousArticle,
    nextArticle,
    article,
    newspaperMode,
    onOpenArticle,
    onToggleBookmark,
    onToggleQueue,
    onNewspaperMode,
  });

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
          <ReaderToolbar
            backButtonRef={backButton}
            typographyRef={typographyRef}
            progressBarRef={progressBarRef}
            title={title}
            compactHeader={compactHeader}
            newspaperMode={newspaperMode}
            showTypography={showTypography}
            readerTheme={readerTheme}
            fontFamily={fontFamily}
            fontSize={fontSize}
            twoColumns={twoColumns}
            copy={copy}
            onClose={onClose}
            onNewspaperMode={onNewspaperMode}
            onToggleTypography={() => setShowTypography(open => !open)}
            onReaderTheme={onReaderTheme}
            onFontFamily={onFontFamily}
            onFontSize={onFontSize}
            onToggleTwoColumns={() => setTwoColumns(v => !v)}
          />

          <article
            ref={articleRef}
            className={`reader-body mx-auto px-5 pt-6 sm:px-8 ${
              newspaperMode
                ? `reader-newspaper ${twoColumns ? 'max-w-[58rem]' : 'max-w-[44rem]'}`
                : 'max-w-[44rem]'
            }`}
          >
            <ReaderHeader
              article={article}
              title={title}
              kicker={kicker}
              newspaperMode={newspaperMode}
              effectiveSerif={effectiveSerif}
              readingMinutes={readingMinutes}
              offlineSaved={offlineSaved}
              activeBlockId={activeBlockId}
              registerBlockNode={registerBlockNode}
              translate={translate}
              translationError={translationError}
              hasTranslation={translation?.source === originalParagraphs}
              showOriginal={showOriginal}
              onToggleOriginal={() => setShowOriginal(current => !current)}
              resumeBannerPct={resumeBannerPct}
              onBackToTop={() => {
                scrollContainerRef.current?.scrollTo({ top: 0, behavior: reducedMotion ? 'auto' : 'smooth' });
                setResumeBannerPct(null);
              }}
              onDismissResumeBanner={() => setResumeBannerPct(null)}
              copy={copy}
            />

            <ReaderChapterBar
              items={headingItems}
              label={copy.chaptersLabel(headingItems.length)}
              onJumpTo={blockId => {
                blockNodesRef.current.get(blockId)?.scrollIntoView({
                  behavior: reducedMotion ? 'auto' : 'smooth',
                  block: 'start',
                });
              }}
            />

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

            <ReaderPaywallNotice
              allowFullText={allowFullText}
              offlineSaved={offlineSaved}
              loadingFullText={loadingFullText}
              publisherOptOut={publisherOptOut}
              blockedWall={blockedWall}
              fullTextUnavailable={fullTextUnavailable}
              sourceId={article.sourceId}
              safeArticleHref={safeArticleHref}
              freeAlternatives={freeAlternatives}
              copy={copy}
              onEnableFullText={onEnableFullText}
              onOpenArticle={onOpenArticle}
              onSearchTopic={onSearchTopic}
            />

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
                {allowFullText && onDisableFullText && article.sourceId && (
                  <button
                    type="button"
                    className="choice-pill inline-flex items-center gap-2"
                    onClick={() => onDisableFullText(article.sourceId)}
                  >
                    {copy.fullTextOptInDisable}
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
          <ReaderAudioBar
            speechState={speechState}
            speechLoading={speechLoading}
            speechIndex={speechIndex}
            totalBlocks={speechBlocks.length}
            speechStatus={speechStatus}
            speechRate={speechRate}
            sleepMinutes={sleepMinutes}
            onPrev={() => speakFromIndex(Math.max(0, speechIndex - 1))}
            onTogglePause={toggleSpeechPause}
            onNext={() => speakFromIndex(Math.min(speechBlocks.length - 1, speechIndex + 1))}
            onCycleRate={cycleSpeechRate}
            onCycleSleep={cycleSleepTimer}
            onStop={stopSpeech}
          />
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

      <ReaderSummaryDialog
        dialogRef={summaryDialog}
        resolvedSurfaceTheme={resolvedSurfaceTheme}
        article={article}
        originalParagraphs={originalParagraphs}
        perspectiveArticles={perspectiveArticles}
        aiConfig={aiConfig}
        aiLoading={aiLoading}
        aiResult={aiResult}
        aiError={aiError}
        hasBYOKKey={hasBYOKKey}
        deviceSummary={deviceSummary}
        style={style}
        showSummary={showSummary}
        priorCoverage={priorCoverage}
        contextBullets={contextBullets}
        contextLoading={contextLoading}
        contextError={contextError}
        loadingFullText={loadingFullText}
        onChangeStyle={nextStyle => {
          setAiResult(generateLocalExtractiveSummary({ ...article, paragraphs: originalParagraphs }));
          setStyle(nextStyle);
        }}
        onRunBYOK={handleRunBYOK}
        onLoadContext={() => void handleLoadContext()}
        onOpenArticle={onOpenArticle}
        onClose={onClose}
      />
    </div>
  );
};
