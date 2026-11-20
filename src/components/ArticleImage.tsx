import React, { useEffect, useState } from 'react';
import { Newspaper } from 'lucide-react';

interface ArticleImageProps {
  src?: string;
  alt: string;
  sourceShortCode: string;
  sourceColor: string;
  className?: string;
  priority?: boolean;
}

export const ArticleImage: React.FC<ArticleImageProps> = ({
  src,
  alt,
  sourceShortCode,
  sourceColor,
  className = '',
  priority = false,
}) => {
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const [loadedSrc, setLoadedSrc] = useState<string | null>(null);

  const failed = !src || failedSrc === src;
  const loaded = Boolean(src) && loadedSrc === src;

  useEffect(() => {
    if (!src) return;
    // Reset stale states when src changes to a new URL
    if (failedSrc && failedSrc !== src) setFailedSrc(null);
  }, [src, failedSrc]);

  if (failed) {
    return (
      <div
        className={`relative flex items-center justify-center overflow-hidden bg-gradient-to-br from-[#eae8e3] via-[#f2f0ec] to-[#e5e3de] dark:from-[#161922] dark:via-[#12151d] dark:to-[#1c212d] ${className}`}
        aria-label={alt || undefined}
      >
        <div
          className="absolute inset-0 opacity-20"
          style={{
            background: `radial-gradient(circle at 28% 28%, ${sourceColor}, transparent 68%)`,
          }}
        />
        <div className="relative z-10 flex flex-col items-center gap-1.5 text-[var(--muted)]">
          <Newspaper className="h-5 w-5 opacity-65" aria-hidden="true" />
          <span className="text-[11px] font-semibold tracking-wider uppercase opacity-80">
            {sourceShortCode}
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className={`relative overflow-hidden bg-[var(--control)] ${className}`}>
      {!loaded && <div aria-hidden="true" className="image-shimmer absolute inset-0" />}
      <img
        src={src}
        alt={alt}
        loading={priority ? 'eager' : 'lazy'}
        decoding="async"
        fetchPriority={priority ? 'high' : undefined}
        referrerPolicy="no-referrer"
        onError={() => setFailedSrc(src)}
        onLoad={(e) => {
          const img = e.currentTarget;
          if (img.naturalWidth <= 12 || img.naturalHeight <= 12) {
            setFailedSrc(src);
          } else {
            setLoadedSrc(src);
          }
        }}
        className={`h-full w-full object-cover transition-opacity duration-300 ease-out ${loaded ? 'opacity-100' : 'opacity-0'}`}
      />
    </div>
  );
};
