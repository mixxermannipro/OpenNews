import React from 'react';
import { Capacitor } from '@capacitor/core';
import { History, Loader2, Settings, Sparkles, X } from 'lucide-react';
import { useI18n } from '../../lib/i18n';
import { resolveSummaryStyle, SUMMARY_STYLES } from '../../lib/summaryStyles';
import type { AIProviderConfig, AISummaryResult, NewsArticle, SummaryStyle } from '../../types/news';
import { ArticlePerspectives } from '../ArticlePerspectives';
import { ArticleQuestions } from '../ArticleQuestions';
import { TranscriptSummary } from '../TranscriptSummary';

export function ReaderSummaryDialog({
  dialogRef,
  resolvedSurfaceTheme,
  article,
  originalParagraphs,
  perspectiveArticles,
  aiConfig,
  aiLoading,
  aiResult,
  aiError,
  hasBYOKKey,
  deviceSummary,
  style,
  showSummary,
  priorCoverage,
  contextBullets,
  contextLoading,
  contextError,
  loadingFullText,
  onChangeStyle,
  onRunBYOK,
  onLoadContext,
  onOpenArticle,
  onClose,
}: {
  dialogRef: React.RefObject<HTMLDialogElement | null>;
  resolvedSurfaceTheme: string;
  article: NewsArticle;
  originalParagraphs: string[];
  perspectiveArticles: NewsArticle[];
  aiConfig: AIProviderConfig;
  aiLoading: boolean;
  aiResult: AISummaryResult | null;
  aiError: string | null;
  hasBYOKKey: boolean;
  deviceSummary: boolean;
  style: SummaryStyle;
  showSummary: boolean;
  priorCoverage: NewsArticle[];
  contextBullets: string[] | null;
  contextLoading: boolean;
  contextError: boolean;
  loadingFullText: boolean;
  onChangeStyle: (style: SummaryStyle) => void;
  onRunBYOK: () => void;
  onLoadContext: () => void;
  onOpenArticle: (article: NewsArticle) => void;
  onClose: () => void;
}) {
  const { t, formatRelative } = useI18n();

  return (
    <dialog
      ref={dialogRef}
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
            onClick={onRunBYOK}
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
              onChange={event => onChangeStyle(resolveSummaryStyle(event.target.value))}
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
                    onClick={onLoadContext}
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
  );
}
