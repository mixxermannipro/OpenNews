import { ExternalLink, Search } from 'lucide-react';
import { useI18n } from '../../lib/i18n';
import type { ReaderCopy } from '../../lib/readerCopy';
import type { NewsArticle } from '../../types/news';
import { SourceIcon } from '../SourceIcon';

export function ReaderPaywallNotice({
  allowFullText,
  offlineSaved,
  loadingFullText,
  publisherOptOut,
  blockedWall,
  fullTextUnavailable,
  sourceId,
  safeArticleHref,
  freeAlternatives,
  copy,
  onEnableFullText,
  onOpenArticle,
  onSearchTopic,
}: {
  allowFullText: boolean;
  offlineSaved: boolean;
  loadingFullText: boolean;
  publisherOptOut: boolean;
  blockedWall: boolean;
  fullTextUnavailable: boolean;
  sourceId: string;
  safeArticleHref?: string;
  freeAlternatives: NewsArticle[];
  copy: ReaderCopy;
  onEnableFullText?: (sourceId: string) => void;
  onOpenArticle: (article: NewsArticle) => void;
  onSearchTopic?: () => void;
}) {
  const { formatRelative } = useI18n();

  if (!allowFullText && !offlineSaved && !loadingFullText) {
    return (
      <section
        aria-label={copy.fullTextOptInTitle}
        className="mt-6 space-y-3 rounded-2xl border border-[var(--line)] bg-[var(--panel-2)] p-4 sm:p-5"
      >
        <div className="space-y-1">
          <p className="text-sm font-bold text-[var(--ink)]">{copy.fullTextOptInTitle}</p>
          <p className="text-xs leading-relaxed text-[var(--muted)]">{copy.fullTextOptInDesc}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2 pt-0.5">
          {onEnableFullText && sourceId && (
            <button
              type="button"
              onClick={() => onEnableFullText(sourceId)}
              className="primary-action inline-flex items-center gap-1.5 px-4 text-xs"
            >
              {copy.fullTextOptInEnable}
            </button>
          )}
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
        </div>
      </section>
    );
  }

  if (!(allowFullText && !loadingFullText && (publisherOptOut || blockedWall || fullTextUnavailable))) {
    return null;
  }

  return (
    <section
      aria-label={copy.paywallTitle}
      className="mt-6 space-y-3.5 rounded-2xl border border-[var(--line)] bg-[var(--panel-2)] p-4 sm:p-5"
    >
      <div className="space-y-1">
        <p className="text-sm font-bold text-[var(--ink)]">{copy.paywallTitle}</p>
        <p className="text-xs leading-relaxed text-[var(--muted)]">
          {publisherOptOut ? copy.fullTextOptOutDesc : copy.paywallDesc}
        </p>
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
  );
}
