import { Capacitor } from '@capacitor/core';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { pushSources } from '../lib/catalog';
import type { MutedKeywordRule } from '../lib/keywordFilter';
import { articleIdentity } from '../lib/newsFeed';
import type { NewsArticle, NewsSource, NotificationSettings } from '../types/news';
import { useLocalStorage } from './useLocalStorage';

export function useNotifications({
  activeSources,
  activeMutedRules,
  feedHasLoaded,
  initialArticleIds,
  showAlert,
}: {
  activeSources: NewsSource[];
  activeMutedRules: MutedKeywordRule[];
  feedHasLoaded: React.MutableRefObject<boolean>;
  initialArticleIds: React.MutableRefObject<Set<string>>;
  showAlert: (title: string, source: string) => void;
}) {
  const [notifications, setNotifications] = useLocalStorage<NotificationSettings>('opennews_notifications', {
    enabled: false,
    breakingOnly: false,
    topics: [],
  });
  const pushSyncVersion = useRef(0);
  const [pushStatus, setPushStatus] = useState('');
  const [pushPermissionDenied, setPushPermissionDenied] = useState(false);
  const [requestingPushPermission, setRequestingPushPermission] = useState(false);
  const announcedArticles = useRef(new Set<string>());

  const pushSourceIds = useMemo(
    () => activeSources
      .filter(source => pushSources.some(candidate => candidate.id === source.id && candidate.url === source.url))
      .map(source => source.id),
    [activeSources],
  );

  const configurePush = useCallback(async (settings: NotificationSettings) => {
    if (Capacitor.getPlatform() !== 'android') return;
    const version = ++pushSyncVersion.current;
    try {
      const { NewsPush } = await import('../lib/newsPush');
      const feeds = activeSources
        .filter(source => source.format !== 'podcast')
        .slice(0, 25)
        .map(source => ({
          id: source.id,
          name: source.name,
          url: source.url,
          category: source.category,
          accentColor: source.accentColor,
          shortCode: source.shortCode,
        }));
      const mutedKeywords = activeMutedRules.map(rule => rule.keyword);
      const { status, mode } = await NewsPush.configure({
        ...settings,
        sources: pushSourceIds,
        feeds,
        mutedKeywords,
      });
      if (!settings.enabled || version !== pushSyncVersion.current) return;
      setPushPermissionDenied(status === 'denied');
      setPushStatus(
        status === 'unconfigured'
          ? 'Dieser Build hat noch keine Benachrichtigungs-Konfiguration.'
          : status === 'denied'
            ? 'Erlaube Benachrichtigungen in den Android-Einstellungen.'
            : settings.enabled && !feeds.length
              ? 'Aktiviere mindestens eine Nachrichtenquelle.'
              : settings.enabled && mode === 'local'
                ? `Hintergrund-Check auf dem Gerät aktiv (alle ${settings.intervalMinutes ?? 30} Min.).`
                : settings.enabled
                  ? 'Push & Hintergrund-Check für deine Quellen aktiv.'
                  : '',
      );
    } catch {
      if (settings.enabled && version === pushSyncVersion.current) {
        setPushStatus('Push-Anmeldung gerade nicht möglich.');
      }
    }
  }, [activeMutedRules, activeSources, pushSourceIds]);

  useEffect(() => {
    const sync = () => { if (!document.hidden) void configurePush(notifications); };
    sync();
    document.addEventListener('visibilitychange', sync);
    window.addEventListener('online', sync);
    return () => {
      document.removeEventListener('visibilitychange', sync);
      window.removeEventListener('online', sync);
    };
  }, [configurePush, notifications]);

  const checkForAlert = useCallback((articles: NewsArticle[]) => {
    const firstLoad = !feedHasLoaded.current;
    const now = new Date();
    const time = now.toTimeString().slice(0, 5);
    const from = notifications.from ?? '00:00';
    const until = notifications.until ?? '23:59';
    const withinWindow = from <= until ? time >= from && time <= until : time >= from || time <= until;
    let candidate: NewsArticle | undefined;
    for (const article of articles) {
      const identity = articleIdentity(article);
      if (announcedArticles.current.has(identity) || initialArticleIds.current.has(identity)) continue;
      announcedArticles.current.add(identity);
      const age = now.getTime() - Date.parse(article.publishedAt);
      if (
        !candidate
        && age >= 0
        && age <= 2 * 60 * 60_000
        && (notifications.breakingOnly
          ? article.isBreaking
          : !notifications.topics.length || notifications.topics.includes(article.category))
      ) {
        candidate = article;
      }
    }
    if (!firstLoad && notifications.enabled && withinWindow && candidate) {
      if (document.visibilityState === 'visible') {
        showAlert(candidate.title, candidate.sourceName);
      } else if (
        Capacitor.getPlatform() === 'web'
        && 'Notification' in window
        && Notification.permission === 'granted'
      ) {
        const tag = articleIdentity(candidate);
        void navigator.serviceWorker?.ready
          ?.then(reg => reg.showNotification(candidate.title, {
            body: candidate.sourceName,
            icon: '/pwa-192x192.png',
            tag,
          }))
          .catch(() => {
            try {
              new Notification(candidate.title, { body: candidate.sourceName, tag });
            } catch {
              // Ignore restricted notification contexts
            }
          });
      }
    }
  }, [feedHasLoaded, initialArticleIds, notifications, showAlert]);

  const handleNotificationSettings = useCallback(async (next: NotificationSettings) => {
    if (Capacitor.getPlatform() === 'android' && next.enabled && !notifications.enabled) {
      setRequestingPushPermission(true);
      setPushStatus('');
      try {
        const { NewsPush } = await import('../lib/newsPush');
        const { allowed } = await NewsPush.requestAccess();
        setPushPermissionDenied(!allowed);
        if (!allowed) {
          setPushStatus('Erlaube Benachrichtigungen in den Android-Einstellungen.');
          return;
        }
      } catch {
        setPushStatus('Die Android-Freigabe konnte nicht abgefragt werden.');
        return;
      } finally {
        setRequestingPushPermission(false);
      }
    } else if (
      Capacitor.getPlatform() !== 'android'
      && next.enabled
      && !notifications.enabled
      && 'Notification' in window
      && Notification.permission === 'default'
    ) {
      setRequestingPushPermission(true);
      try {
        const perm = await Notification.requestPermission();
        if (perm === 'denied') {
          setPushStatus('Browser-Benachrichtigungen wurden blockiert — In-App-Hinweise bleiben aktiv.');
        } else if (perm === 'granted') {
          setPushStatus('Browser-Benachrichtigungen sind aktiviert.');
        }
      } catch {
        // Ignore restricted Notification.requestPermission contexts
      } finally {
        setRequestingPushPermission(false);
      }
    }
    if (!next.enabled) {
      pushSyncVersion.current++;
      setPushPermissionDenied(false);
      setPushStatus('');
    }
    setNotifications(next);
  }, [notifications.enabled, setNotifications]);

  const handleSendTestNotification = useCallback(() => {
    if (Capacitor.getPlatform() === 'android') {
      void import('../lib/newsPush')
        .then(({ NewsPush }) => NewsPush.test())
        .catch(() => showAlert('Android hat Benachrichtigungen gesperrt.', 'OpenNews · Test'));
    } else {
      showAlert('Benachrichtigungen sind aktiv.', 'OpenNews · Test');
      if ('Notification' in window && Notification.permission === 'granted') {
        try {
          new Notification('OpenNews · Test', { body: 'Browser-Benachrichtigungen sind aktiv.', tag: 'opennews-test' });
        } catch {
          // Ignore Notification constructor errors in headless environments
        }
      }
    }
  }, [showAlert]);

  return {
    notifications,
    pushStatus,
    pushPermissionDenied,
    requestingPushPermission,
    checkForAlert,
    handleNotificationSettings,
    handleSendTestNotification,
  };
}
