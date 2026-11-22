import React, { useState } from 'react';
import { Download, Smartphone, WifiOff } from 'lucide-react';
import { useOnlineStatus, usePWAInstall } from '../hooks/usePWAInstall';
import { useI18n } from '../lib/i18n';

export const PWAInstallButton: React.FC = () => {
  const { t } = useI18n();
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showGuide, setShowGuide] = useState(false);

  if (isInstalled) {
    return (
      <div className="flex items-center gap-2 text-xs font-medium text-emerald-500">
        <Smartphone className="h-4 w-4" aria-hidden="true" />
        {t('installedApp')}
      </div>
    );
  }

  if (isInstallable) {
    return (
      <button
        type="button"
        onClick={install}
        className="primary-action inline-flex min-h-[44px] items-center gap-2 px-4 py-2 text-xs font-semibold shadow-sm"
      >
        <Download className="h-4 w-4" aria-hidden="true" />
        {t('installApp')}
      </button>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setShowGuide(true)}
        className="choice-pill inline-flex min-h-[44px] items-center gap-2 px-4 py-2 text-xs font-semibold"
      >
        <Smartphone className="h-4 w-4" aria-hidden="true" />
        {isIOS ? t('installOnIOS') : t('installOnPhone')}
      </button>

      {showGuide && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={t('installApp')}
          className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
        >
          <div className="liquid-glass w-full max-w-sm rounded-3xl p-6 space-y-4">
            <h3 className="text-lg font-bold text-[var(--ink)]">
              OpenNews
            </h3>
            <div className="space-y-2 text-sm text-[var(--muted)]">
              {isIOS ? (
                <>
                  <p>1. Safari → <strong>Share</strong></p>
                  <p>2. <strong>Add to Home Screen</strong></p>
                </>
              ) : (
                <p>Browser menu → <strong>{t('installApp')}</strong></p>
              )}
            </div>
            <button
              type="button"
              onClick={() => setShowGuide(false)}
              className="primary-action w-full min-h-[44px] text-sm"
            >
              {t('understood')}
            </button>
          </div>
        </div>
      )}
    </>
  );
};

export const OfflineIndicator: React.FC = () => {
  const { t } = useI18n();
  const isOnline = useOnlineStatus();
  if (isOnline) return null;

  return (
    <div
      role="status"
      className="fixed top-3 left-1/2 z-50 -translate-x-1/2 flex items-center gap-2 rounded-full bg-amber-100 px-4 py-1.5 text-xs font-semibold text-amber-950 shadow-lg"
    >
      <WifiOff className="h-3.5 w-3.5" aria-hidden="true" />
      {t('offlineBanner')}
    </div>
  );
};
