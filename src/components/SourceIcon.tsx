import { useState } from 'react';
import type { NewsSource } from '../types/news';

export function SourceIcon({ source, size = 'h-10 w-10' }: { source: NewsSource; size?: string }) {
  const [failed, setFailed] = useState(false);
  const brand = source.id.startsWith('tagesschau-') || source.id === 'tagesthemen-video' ? 'tagesschau'
    : source.id.startsWith('dlf-') ? 'deutschlandfunk'
    : source.id;
  return (
    <span aria-hidden="true" className={`relative grid shrink-0 place-items-center overflow-hidden rounded-lg text-[10px] font-bold text-white ${size}`}
      style={{ backgroundColor: source.accentColor }}>
      {source.shortCode}
      {!source.isCustom && !failed && (
        <img src={`/source-icons/${brand}.png`} alt="" loading="lazy" decoding="async"
          onError={() => setFailed(true)} className="absolute inset-0 h-full w-full bg-white object-contain" />
      )}
    </span>
  );
}
