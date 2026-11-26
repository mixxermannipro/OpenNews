import { Loader2, Moon, Pause, Play, SkipBack, SkipForward, Square } from 'lucide-react';
import { useI18n } from '../lib/i18n';

export function ReaderAudioBar({
  speechState,
  speechLoading,
  speechIndex,
  totalBlocks,
  speechStatus,
  speechRate,
  sleepMinutes,
  onPrev,
  onTogglePause,
  onNext,
  onCycleRate,
  onCycleSleep,
  onStop,
}: {
  speechState: 'playing' | 'paused';
  speechLoading: boolean;
  speechIndex: number;
  totalBlocks: number;
  speechStatus: string;
  speechRate: number;
  sleepMinutes: number;
  onPrev: () => void;
  onTogglePause: () => void;
  onNext: () => void;
  onCycleRate: () => void;
  onCycleSleep: () => void;
  onStop: () => void;
}) {
  const { t } = useI18n();

  return (
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
          onClick={onPrev}
        >
          <SkipBack size={16} aria-hidden="true" />
        </button>
        <button
          type="button"
          className="grid h-10 w-10 place-items-center rounded-full bg-[var(--accent)] text-[var(--accent-ink)]"
          aria-label={speechState === 'playing' ? t('briefingPause') : t('briefingResume')}
          onClick={onTogglePause}
        >
          {speechState === 'playing' ? (
            <Pause size={16} fill="currentColor" aria-hidden="true" />
          ) : (
            <Play size={16} fill="currentColor" aria-hidden="true" />
          )}
        </button>
        <button
          type="button"
          className="grid h-10 w-10 place-items-center rounded-full text-[var(--ink)] hover:bg-[var(--control)]"
          aria-label={t('readerSpeechNext')}
          onClick={onNext}
        >
          <SkipForward size={16} aria-hidden="true" />
        </button>
        <span className="ml-1 inline-flex items-center gap-1.5 text-xs font-semibold text-[var(--muted)] tabular-nums">
          {speechLoading && <Loader2 size={13} className="animate-spin text-[var(--accent)]" aria-hidden="true" />}
          {Math.max(1, speechIndex + 1)} / {totalBlocks}
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
          onClick={onCycleRate}
        >
          {speechRate}×
        </button>
        <button
          type="button"
          className="choice-pill inline-flex min-h-9 items-center gap-1 px-2.5 text-xs tabular-nums"
          aria-label={t('readerSpeechSleep')}
          onClick={onCycleSleep}
        >
          <Moon size={13} aria-hidden="true" />
          {sleepMinutes > 0 ? `${sleepMinutes}m` : t('readerSpeechOff')}
        </button>
        <button
          type="button"
          className="grid h-10 w-10 place-items-center rounded-full text-[var(--muted)] hover:bg-[var(--control)] hover:text-[var(--ink)]"
          aria-label={t('readerStopAloud')}
          onClick={onStop}
        >
          <Square size={15} fill="currentColor" aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
