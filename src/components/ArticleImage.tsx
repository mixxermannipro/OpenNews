import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
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
  const imgRef = useRef<HTMLImageElement>(null);
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const [loadedSrc, setLoadedSrc] = useState<string | null>(null);

  const failed = !src || failedSrc === src;
  const loaded = Boolean(src) && loadedSrc === src;

  useEffect(() => {
    if (!src) return;
    if (failedSrc && failedSrc !== src) setFailedSrc(null);
  }, [src, failedSrc]);

  // Immediately reveal browser-cached images on mount/src change without shimmer flash
  useLayoutEffect(() => {
    const img = imgRef.current;
    if (!src || !img || !img.complete) return;
    if (img.naturalWidth > 12 && img.naturalHeight > 12) {
      setLoadedSrc(src);
    } else if (img.naturalWidth === 0) {
      setFailedSrc(src);
    }
  }, [src]);

  if (failed) {
    return (
      <div
        className={`relative flex items-center justify-center overflow-hidden bg-gradient-to-br from-[var(--control)] via-[var(--panel)] to-[var(--control)] ${className}`}
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
        ref={imgRef}
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
        className={`h-full w-full object-cover transition-opacity duration-200 ease-out ${loaded ? 'opacity-100' : 'opacity-0'}`}
      />
    </div>
  );
};
