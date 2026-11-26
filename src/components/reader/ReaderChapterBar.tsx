import { ChevronDown } from 'lucide-react';

export interface ReaderChapterItem {
  blockId: string;
  text: string;
}

export function ReaderChapterBar({
  items,
  label,
  onJumpTo,
}: {
  items: ReaderChapterItem[];
  label: string;
  onJumpTo: (blockId: string) => void;
}) {
  if (items.length < 3) return null;

  return (
    <details className="mt-4 rounded-2xl border border-[var(--line)] bg-[var(--panel-2)] px-3.5 py-2.5 text-sm">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-2 text-xs font-semibold text-[var(--ink)]">
        <span>{label}</span>
        <ChevronDown size={15} className="text-[var(--muted)]" aria-hidden="true" />
      </summary>
      <ol className="mt-2.5 space-y-1 border-t border-[var(--line)] pt-2">
        {items.map((item, idx) => (
          <li key={item.blockId}>
            <button
              type="button"
              onClick={() => onJumpTo(item.blockId)}
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
  );
}
