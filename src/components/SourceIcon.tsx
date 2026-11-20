import { useState } from 'react';
import type { NewsSource } from '../types/news';

export function SourceIcon({
  source,
  size = 'h-10 w-10',
  rounded = 'rounded-lg',
}: {
  source: Pick<NewsSource, 'id' | 'shortCode' | 'accentColor' | 'isCustom'>;
  size?: string;
  rounded?: string;
}) {
  const [failedId, setFailedId] = useState<string | null>(null);
  const brand = source.id.startsWith('tagesschau-') || source.id === 'tagesthemen-video' ? 'tagesschau'
    : source.id.startsWith('dlf-') ? 'deutschlandfunk'
    : source.id.startsWith('bbc-') ? 'bbc'
    : source.id.startsWith('guardian-') ? 'guardian'
    : source.id.startsWith('spiegel-') ? 'spiegel'
    : source.id.startsWith('dw-') ? 'dw'
    : source.id.startsWith('nasa-') ? 'nasa'
    : source.id.startsWith('handelsblatt-') ? 'handelsblatt'
    : source.id;
  const failed = failedId === source.id;

  return (
    <span
      aria-hidden="true"
      className={`relative grid shrink-0 place-items-center overflow-hidden ${rounded} text-[10px] font-bold text-white ring-1 ring-black/8 dark:ring-white/12 ${size}`}
      style={{ backgroundColor: source.accentColor }}
    >
      {source.shortCode}
      {!source.isCustom && !failed && (
        <img
          src={`/source-icons/${brand}.png`}
          alt=""
          loading="lazy"
          decoding="async"
          onError={() => setFailedId(source.id)}
          className="absolute inset-0 h-full w-full bg-white object-contain"
        />
      )}
    </span>
  );
}
