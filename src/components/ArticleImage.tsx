import React, { useState } from 'react';
import { Newspaper } from 'lucide-react';

interface ArticleImageProps {
  src?: string;
  alt: string;
  sourceShortCode: string;
  sourceColor: string;
  className?: string;
}

export const ArticleImage: React.FC<ArticleImageProps> = ({
  src,
  alt,
  sourceShortCode,
  sourceColor,
  className = '',
}) => {
  const [failed, setFailed] = useState(false);

  if (!src || failed) {
    return (
      <div
        className={`relative flex items-center justify-center overflow-hidden bg-gradient-to-br from-slate-200 via-slate-100 to-slate-200 dark:from-[#151923] dark:via-[#10131B] dark:to-[#1B2230] ${className}`}
        aria-label={alt}
      >
        <div
          className="absolute inset-0 opacity-20"
          style={{
            background: `radial-gradient(circle at 30% 30%, ${sourceColor}, transparent 68%)`,
          }}
        />
        <div className="relative z-10 flex flex-col items-center gap-1.5 text-slate-500 dark:text-slate-400">
          <Newspaper className="h-5 w-5 opacity-70" />
          <span className="text-[11px] font-semibold tracking-wider uppercase opacity-80">
            {sourceShortCode}
          </span>
        </div>
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      loading="lazy"
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
      onLoad={(e) => {
        const img = e.currentTarget;
        if (img.naturalWidth <= 12 || img.naturalHeight <= 12) {
          setFailed(true);
        }
      }}
      className={`object-cover ${className}`}
    />
  );
};
