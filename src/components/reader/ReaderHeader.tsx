import React from 'react';
import { X } from 'lucide-react';
import { useI18n } from '../../lib/i18n';
import type { ReaderCopy } from '../../lib/readerCopy';
import type { NewsArticle } from '../../types/news';
import { SourceIcon } from '../SourceIcon';

export function ReaderHeader({
  article,
  title,
  kicker,
  newspaperMode,
  effectiveSerif,
  readingMinutes,
  offlineSaved,
  activeBlockId,
  registerBlockNode,
  translate,
  translationError,
  hasTranslation,
  showOriginal,
  onToggleOriginal,
  resumeBannerPct,
  onBackToTop,
  onDismissResumeBanner,
  copy,
}: {
  article: NewsArticle;
  title: string;
  kicker: string;
  newspaperMode: boolean;
  effectiveSerif: boolean;
  readingMinutes: number;
  offlineSaved: boolean;
  activeBlockId?: string;
  registerBlockNode: (id: string) => (el: HTMLElement | null) => void;
  translate: boolean;
  translationError: boolean;
  hasTranslation: boolean;
  showOriginal: boolean;
  onToggleOriginal: () => void;
  resumeBannerPct: number | null;
  onBackToTop: () => void;
  onDismissResumeBanner: () => void;
  copy: ReaderCopy;
}) {
  const { t, formatRelative, formatHeaderDate } = useI18n();

  return (
    <>
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
              {translationError
                ? 'Übersetzung gerade nicht verfügbar. Für den Modell-Download wird WLAN benötigt.'
                : hasTranslation
                  ? (
                    <button type="button" className="choice-pill" onClick={onToggleOriginal}>
                      {showOriginal ? 'Deutsch anzeigen' : 'Original anzeigen'}
                    </button>
                  )
                  : 'Übersetzung wird vorbereitet …'}
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
              onClick={onBackToTop}
              className="rounded-full px-2.5 py-1 font-semibold text-[var(--accent)] hover:bg-[var(--control)]"
            >
              {copy.backToTop}
            </button>
            <button
              type="button"
              aria-label={t('close')}
              onClick={onDismissResumeBanner}
              className="grid h-7 w-7 place-items-center rounded-full text-[var(--muted)] hover:bg-[var(--control)] hover:text-[var(--ink)]"
            >
              <X size={13} aria-hidden="true" />
            </button>
          </div>
        </div>
      )}
    </>
  );
}
