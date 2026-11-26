import React from 'react';
import { ChevronLeft, Columns2, Newspaper, Type } from 'lucide-react';
import { useI18n } from '../../lib/i18n';
import type { ReaderCopy } from '../../lib/readerCopy';
import type { ReaderSurfaceTheme } from '../../lib/readerExtras';
import type { ReaderFontFamily, ReaderFontSize } from '../../types/news';

export function ReaderToolbar({
  backButtonRef,
  typographyRef,
  progressBarRef,
  title,
  compactHeader,
  newspaperMode,
  showTypography,
  readerTheme,
  fontFamily,
  fontSize,
  twoColumns,
  copy,
  onClose,
  onNewspaperMode,
  onToggleTypography,
  onReaderTheme,
  onFontFamily,
  onFontSize,
  onToggleTwoColumns,
}: {
  backButtonRef: React.RefObject<HTMLButtonElement | null>;
  typographyRef: React.RefObject<HTMLDivElement | null>;
  progressBarRef: React.RefObject<HTMLDivElement | null>;
  title: string;
  compactHeader: boolean;
  newspaperMode: boolean;
  showTypography: boolean;
  readerTheme: ReaderSurfaceTheme;
  fontFamily: ReaderFontFamily;
  fontSize: ReaderFontSize;
  twoColumns: boolean;
  copy: ReaderCopy;
  onClose: () => void;
  onNewspaperMode: (value: boolean) => void;
  onToggleTypography: () => void;
  onReaderTheme: (value: ReaderSurfaceTheme) => void;
  onFontFamily: (value: ReaderFontFamily) => void;
  onFontSize: (value: ReaderFontSize) => void;
  onToggleTwoColumns: () => void;
}) {
  const { t } = useI18n();

  return (
    <div className="reader-toolbar reader-toolbar-glass sticky top-0 z-20 px-4 pb-2.5 sm:px-7">
      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={onClose}
          ref={backButtonRef}
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
              onClick={onToggleTypography}
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
                      onClick={onToggleTwoColumns}
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
  );
}
