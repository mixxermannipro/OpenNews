import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Newspaper } from 'lucide-react';
import { isTrackingPixelUrl } from '../lib/articleMedia';

interface ArticleImageProps {
  src?: string;
  alt: string;
  sourceShortCode: string;
  sourceColor: string;
  className?: string;
  priority?: boolean;
  hideOnError?: boolean;
}

const YOUTUBE_HQ_THUMB = /^(https:\/\/i\d?\.ytimg\.com\/vi\/[A-Za-z0-9_-]{11})\/hqdefault\.jpg(\?.*)?$/i;

function resolveThumbnailCandidates(src?: string): { primary?: string; fallback?: string } {
  if (!src || isTrackingPixelUrl(src)) return {};
  const match = src.match(YOUTUBE_HQ_THUMB);
  if (!match) return { primary: src };
  const [, prefix, query = ''] = match;
  // YouTube hqdefault.jpg is 4:3 with baked-in top/bottom black bars.
  // maxresdefault.jpg (1280x720) and mqdefault.jpg (320x180) are native 16:9 without bars.
  return {
    primary: `${prefix}/maxresdefault.jpg${query}`,
    fallback: `${prefix}/mqdefault.jpg${query}`,
  };
}

export const ArticleImage: React.FC<ArticleImageProps> = ({
  src,
  alt,
  sourceShortCode,
  sourceColor,
  className = '',
  priority = false,
  hideOnError = false,
}) => {
  const imgRef = useRef<HTMLImageElement>(null);
  const [fallbackForSrc, setFallbackForSrc] = useState<string | null>(null);
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const [loadedSrc, setLoadedSrc] = useState<string | null>(null);

  const { primary, fallback } = resolveThumbnailCandidates(src);
  const usingFallback = Boolean(fallback && fallbackForSrc === primary);
  const activeSrc = usingFallback ? fallback : primary;
  const failed = !activeSrc || failedSrc === activeSrc;
  const loaded = Boolean(activeSrc) && loadedSrc === activeSrc;

  useEffect(() => {
    if (!primary) return;
    if (failedSrc && failedSrc !== activeSrc) setFailedSrc(null);
    if (fallbackForSrc && fallbackForSrc !== primary) setFallbackForSrc(null);
  }, [primary, activeSrc, failedSrc, fallbackForSrc]);

  const handleImageIssue = () => {
    if (fallback && !usingFallback && primary) {
      setFallbackForSrc(primary);
    } else if (activeSrc) {
      setFailedSrc(activeSrc);
    }
  };

  const isUnusableImage = (img: HTMLImageElement) => {
    const { naturalWidth: w, naturalHeight: h } = img;
    if (w <= 24 || h <= 24) return true;
    // Reject tiny horizontal publisher masthead logos (e.g. 150x40 NYT RSS channel banner)
    if (h < 90 && w / h >= 2.6) return true;
    // Never stretch postage-stamp thumbnails across priority hero cards
    if (priority && (w < 260 || h < 140)) return true;
    return false;
  };

  // Immediately reveal browser-cached images on mount/src change without shimmer flash
  useLayoutEffect(() => {
    const img = imgRef.current;
    if (!activeSrc || !img || !img.complete) return;
    const isYtMissingPlaceholder = Boolean(fallback && !usingFallback && img.naturalWidth === 120 && img.naturalHeight === 90);
    if (isYtMissingPlaceholder) {
      if (primary) setFallbackForSrc(primary);
    } else if (img.naturalWidth === 0 || isUnusableImage(img)) {
      handleImageIssue();
    } else {
      setLoadedSrc(activeSrc);
    }
  }, [activeSrc, fallback, usingFallback, primary, priority]);

  const positionClass = /\b(?:absolute|fixed)\b/.test(className) ? '' : 'relative';

  if (failed) {
    if (hideOnError) return null;
    return (
      <div
        className={`${positionClass} flex items-center justify-center overflow-hidden bg-gradient-to-br from-[var(--control)] via-[var(--panel)] to-[var(--control)] ${className}`}
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
    <div className={`${positionClass} overflow-hidden bg-[var(--control)] ${className}`}>
      {!loaded && <div aria-hidden="true" className="image-shimmer absolute inset-0" />}
      <img
        ref={imgRef}
        src={activeSrc}
        alt={alt}
        loading={priority ? 'eager' : 'lazy'}
        decoding="async"
        fetchPriority={priority ? 'high' : undefined}
        referrerPolicy="no-referrer"
        onError={handleImageIssue}
        onLoad={(e) => {
          const img = e.currentTarget;
          const isYtMissingPlaceholder = Boolean(fallback && !usingFallback && img.naturalWidth === 120 && img.naturalHeight === 90);
          if (isYtMissingPlaceholder || isUnusableImage(img)) {
            handleImageIssue();
          } else {
            setLoadedSrc(activeSrc);
          }
        }}
        className={`h-full w-full object-cover transition-opacity duration-200 ease-out ${loaded ? 'opacity-100' : 'opacity-0'}`}
      />
    </div>
  );
};
