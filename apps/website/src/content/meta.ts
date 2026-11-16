import { site } from './site.ts';

export const routes = {
  '/': {
    title: 'OpenNews – Deine Nachrichten. Deine Quellen.',
    description: 'OpenNews bündelt Nachrichten aus deinen Quellen. Behalte den Überblick und entdecke Meldungen nach deinen Interessen. Deine Lesegewohnheiten bleiben auf deinem Gerät.',
  },
  '/datenschutz/': {
    title: 'Datenschutz – OpenNews',
    description: 'Informationen über diese Website, lokale App-Daten, Feed-Abrufe und optionale KI-Dienste.',
  },
  '/impressum/': {
    title: 'Impressum – OpenNews',
    description: 'Anbieterkennzeichnung für die OpenNews-Website.',
  },
  '/kontakt/': {
    title: 'Kontakt – OpenNews',
    description: 'Kontakt für Fragen, Feedback und Datenschutzanfragen zu OpenNews.',
  },
  '/404': {
    title: 'Seite nicht gefunden – OpenNews',
    description: 'Zurück zur OpenNews-Startseite.',
  },
} as const;

export type Route = keyof typeof routes;

export function canonicalFor(path: Route): string | undefined {
  if (site.url && path !== '/404') return site.url + path;
}
