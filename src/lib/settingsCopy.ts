import type { AppLanguage } from '../types/news';
import type { Edition, Retention } from './preferences';

export interface SettingsCopy {
  accentOptions: Record<'system' | 'blue' | 'green' | 'violet', string>;
  cardOptions: Record<'balanced' | 'compact', string>;
  motionOptions: Record<'system' | 'reduced', string>;
  editionLabel: string;
  editions: Record<Edition, { label: string; description: string }>;
  retentionOptions: Record<Retention, string>;
  autoTranslateAndroid: string;
  recommendedApplied: string;
  readerThemeLabel: string;
  readerNewspaperLabel: string;
  readerNewspaperHelp: string;
  ttsSystemUnsupported: string;
  ttsSystemPlaying: string;
  ttsProviderPlaying: (name: string) => string;
  ttsTestFailed: string;
  webKeysPersistLabel: string;
  webKeysPersistHelp: string;
  webKeysSessionActive: string;
}

const COPY: Record<AppLanguage, SettingsCopy> = {
  de: {
    accentOptions: { system: 'Neutral', blue: 'Blau', green: 'Grün', violet: 'Violett' },
    cardOptions: { balanced: 'Ausgewogen', compact: 'Kompakt' },
    motionOptions: { system: 'System', reduced: 'Reduziert' },
    editionLabel: 'Journalistische Voreinstellung',
    editions: {
      balanced: {
        label: 'Ausgewogen',
        description: 'Ausgewogene Auswahl aus Nachrichten, Wirtschaft, Technik und Wissenschaft.',
      },
      public: {
        label: 'Öffentlich-rechtliche Nachrichten',
        description: 'Tagesschau, ZDFheute, Deutschlandfunk, DW, BBC und NPR.',
      },
      analysis: {
        label: 'Analyse & Hintergrund',
        description: 'ZEIT, F.A.Z., SZ, Handelsblatt, SPIEGEL, Guardian, Le Monde und El País.',
      },
      technology: {
        label: 'Technologie & KI',
        description: 'heise, THE DECODER, Golem, netzpolitik, Hacker News, Ars Technica, The Verge und MIT Tech.',
      },
      tabloid: {
        label: 'Boulevard & Aktuelles',
        description: 'BILD, n-tv und WELT.',
      },
    },
    retentionOptions: {
      '2': '2 Tage',
      '4': '4 Tage (Standard)',
      '7': '7 Tage',
      '14': '2 Wochen',
      '30': '1 Monat (30 Tage)',
      '90': '3 Monate (90 Tage)',
    },
    autoTranslateAndroid: 'Englische Artikel automatisch auf Deutsch übersetzen',
    recommendedApplied: 'Empfohlene Einstellungen übernommen.',
    readerThemeLabel: 'Lesethema',
    readerNewspaperLabel: 'Zeitungsmodus standardmäßig aktivieren',
    readerNewspaperHelp: 'Öffnet Artikel im ruhigen Papier-Layout mit Serifen und Spaltenansicht auf großen Bildschirmen.',
    ttsSystemUnsupported: 'Systemstimme wird in diesem Browser nicht unterstützt.',
    ttsSystemPlaying: 'Systemstimme spielt Beispiel ab.',
    ttsProviderPlaying: name => `${name} spielt Beispiel ab.`,
    ttsTestFailed: 'Stimm-Test fehlgeschlagen.',
    webKeysPersistLabel: 'API-Schlüssel dauerhaft im Browser speichern (weniger sicher)',
    webKeysPersistHelp: 'Standardmäßig merkt sich OpenNews Web-Schlüssel nur für diese Sitzung (sessionStorage). Dauerhaftes Speichern erlaubt es Browser-Erweiterungen oder eingeschleusten Skripten auf dieser Seite, den Schlüssel auszulesen.',
    webKeysSessionActive: 'Aktuell nur für diese Browser-Sitzung gespeichert.',
  },
  en: {
    accentOptions: { system: 'Neutral', blue: 'Blue', green: 'Green', violet: 'Violet' },
    cardOptions: { balanced: 'Balanced', compact: 'Compact' },
    motionOptions: { system: 'System', reduced: 'Reduced' },
    editionLabel: 'Editorial preset',
    editions: {
      balanced: {
        label: 'Balanced',
        description: 'Balanced mix of news, business, technology, and science.',
      },
      public: {
        label: 'Public broadcasters',
        description: 'Tagesschau, ZDFheute, Deutschlandfunk, DW, BBC, and NPR.',
      },
      analysis: {
        label: 'Analysis & deep dives',
        description: 'ZEIT, F.A.Z., SZ, Handelsblatt, SPIEGEL, Guardian, Le Monde, and El País.',
      },
      technology: {
        label: 'Technology & AI',
        description: 'heise, THE DECODER, Golem, netzpolitik, Hacker News, Ars Technica, The Verge, and MIT Tech.',
      },
      tabloid: {
        label: 'Fast & breaking',
        description: 'BILD, n-tv, and WELT.',
      },
    },
    retentionOptions: {
      '2': '2 days',
      '4': '4 days (Default)',
      '7': '7 days',
      '14': '2 weeks',
      '30': '1 month (30 days)',
      '90': '3 months (90 days)',
    },
    autoTranslateAndroid: 'Automatically translate English articles into German',
    recommendedApplied: 'Recommended settings applied.',
    readerThemeLabel: 'Reading theme',
    readerNewspaperLabel: 'Enable Newspaper Mode by default',
    readerNewspaperHelp: 'Opens articles in a calm paper layout with serif typography and two columns on wide screens.',
    ttsSystemUnsupported: 'System voice is not supported in this browser.',
    ttsSystemPlaying: 'System voice is playing a sample.',
    ttsProviderPlaying: name => `${name} is playing a sample.`,
    ttsTestFailed: 'Voice test failed.',
    webKeysPersistLabel: 'Persist API keys across browser restarts (less secure)',
    webKeysPersistHelp: 'By default, web API keys are kept in sessionStorage for this tab session only. Persisting them allows browser extensions or injected scripts on this origin to read them later.',
    webKeysSessionActive: 'Currently kept for this browser session only.',
  },
  fr: {
    accentOptions: { system: 'Neutre', blue: 'Bleu', green: 'Vert', violet: 'Violet' },
    cardOptions: { balanced: 'Équilibré', compact: 'Compact' },
    motionOptions: { system: 'Système', reduced: 'Réduit' },
    editionLabel: 'Sélection éditoriale',
    editions: {
      balanced: {
        label: 'Équilibré',
        description: 'Sélection équilibrée entre actualités, économie, technologie et science.',
      },
      public: {
        label: 'Médias publics',
        description: 'Tagesschau, ZDFheute, Deutschlandfunk, DW, BBC et NPR.',
      },
      analysis: {
        label: 'Analyses et dossiers',
        description: 'ZEIT, F.A.Z., SZ, Handelsblatt, SPIEGEL, Guardian, Le Monde et El País.',
      },
      technology: {
        label: 'Technologie & IA',
        description: 'heise, THE DECODER, Golem, netzpolitik, Hacker News, Ars Technica, The Verge et MIT Tech.',
      },
      tabloid: {
        label: 'Actualité rapide',
        description: 'BILD, n-tv et WELT.',
      },
    },
    retentionOptions: {
      '2': '2 jours',
      '4': '4 jours (Par défaut)',
      '7': '7 jours',
      '14': '2 semaines',
      '30': '1 mois (30 jours)',
      '90': '3 mois (90 jours)',
    },
    autoTranslateAndroid: 'Traduire automatiquement les articles anglais en allemand',
    recommendedApplied: 'Paramètres recommandés appliqués.',
    readerThemeLabel: 'Thème de lecture',
    readerNewspaperLabel: 'Activer le mode journal par défaut',
    readerNewspaperHelp: 'Ouvre les articles sur une surface papier avec police serif et mise en page en colonnes sur grand écran.',
    ttsSystemUnsupported: 'La voix système n’est pas prise en charge par ce navigateur.',
    ttsSystemPlaying: 'Lecture d’un extrait avec la voix système.',
    ttsProviderPlaying: name => `Lecture d’un extrait avec ${name}.`,
    ttsTestFailed: 'Le test vocal a échoué.',
    webKeysPersistLabel: 'Conserver les clés API dans le navigateur (moins sûr)',
    webKeysPersistHelp: 'Par défaut, les clés web restent uniquement dans sessionStorage pour cette session. Un stockage durable expose les clés aux extensions ou scripts sur cette origine.',
    webKeysSessionActive: 'Actuellement conservées uniquement pour cette session.',
  },
  es: {
    accentOptions: { system: 'Neutro', blue: 'Azul', green: 'Verde', violet: 'Violeta' },
    cardOptions: { balanced: 'Equilibrado', compact: 'Compacto' },
    motionOptions: { system: 'Sistema', reduced: 'Reducido' },
    editionLabel: 'Selección editorial',
    editions: {
      balanced: {
        label: 'Equilibrado',
        description: 'Mezcla equilibrada de noticias, economía, tecnología y ciencia.',
      },
      public: {
        label: 'Medios públicos',
        description: 'Tagesschau, ZDFheute, Deutschlandfunk, DW, BBC y NPR.',
      },
      analysis: {
        label: 'Análisis y reportajes',
        description: 'ZEIT, F.A.Z., SZ, Handelsblatt, SPIEGEL, Guardian, Le Monde y El País.',
      },
      technology: {
        label: 'Tecnología e IA',
        description: 'heise, THE DECODER, Golem, netzpolitik, Hacker News, Ars Technica, The Verge y MIT Tech.',
      },
      tabloid: {
        label: 'Última hora',
        description: 'BILD, n-tv y WELT.',
      },
    },
    retentionOptions: {
      '2': '2 días',
      '4': '4 días (Predeterminado)',
      '7': '7 días',
      '14': '2 semanas',
      '30': '1 mes (30 días)',
      '90': '3 meses (90 días)',
    },
    autoTranslateAndroid: 'Traducir automáticamente artículos en inglés al alemán',
    recommendedApplied: 'Ajustes recomendados aplicados.',
    readerThemeLabel: 'Tema de lectura',
    readerNewspaperLabel: 'Activar modo periódico por defecto',
    readerNewspaperHelp: 'Abre los artículos en diseño papel con tipografía serif y columnas en pantallas grandes.',
    ttsSystemUnsupported: 'La voz del sistema no es compatible con este navegador.',
    ttsSystemPlaying: 'Reproduciendo muestra con la voz del sistema.',
    ttsProviderPlaying: name => `Reproduciendo muestra con ${name}.`,
    ttsTestFailed: 'Error en la prueba de voz.',
    webKeysPersistLabel: 'Guardar claves API de forma permanente en el navegador (menos seguro)',
    webKeysPersistHelp: 'Por defecto, las claves web solo se guardan en sessionStorage para esta sesión. Guardarlas de forma permanente permite que extensiones o scripts en este sitio puedan leerlas.',
    webKeysSessionActive: 'Actualmente guardadas solo para esta sesión.',
  },
  it: {
    accentOptions: { system: 'Neutro', blue: 'Blu', green: 'Verde', violet: 'Viola' },
    cardOptions: { balanced: 'Bilanciato', compact: 'Compatto' },
    motionOptions: { system: 'Sistema', reduced: 'Ridotto' },
    editionLabel: 'Selezione editoriale',
    editions: {
      balanced: {
        label: 'Bilanciato',
        description: 'Selezione equilibrata di notizie, economia, tecnologia e scienza.',
      },
      public: {
        label: 'Emittenti pubbliche',
        description: 'Tagesschau, ZDFheute, Deutschlandfunk, DW, BBC e NPR.',
      },
      analysis: {
        label: 'Analisi e approfondimenti',
        description: 'ZEIT, F.A.Z., SZ, Handelsblatt, SPIEGEL, Guardian, Le Monde ed El País.',
      },
      technology: {
        label: 'Tecnologia e IA',
        description: 'heise, THE DECODER, Golem, netzpolitik, Hacker News, Ars Technica, The Verge e MIT Tech.',
      },
      tabloid: {
        label: 'Notizie rapide',
        description: 'BILD, n-tv e WELT.',
      },
    },
    retentionOptions: {
      '2': '2 giorni',
      '4': '4 giorni (Predefinito)',
      '7': '7 giorni',
      '14': '2 settimane',
      '30': '1 mese (30 giorni)',
      '90': '3 mesi (90 giorni)',
    },
    autoTranslateAndroid: 'Traduci automaticamente gli articoli inglesi in tedesco',
    recommendedApplied: 'Impostazioni consigliate applicate.',
    readerThemeLabel: 'Tema di lettura',
    readerNewspaperLabel: 'Attiva modalità giornale di default',
    readerNewspaperHelp: 'Apre gli articoli su sfondo carta con carattere serif e colonne sugli schermi ampi.',
    ttsSystemUnsupported: 'La voce di sistema non è supportata da questo browser.',
    ttsSystemPlaying: 'Riproduzione esempio con voce di sistema.',
    ttsProviderPlaying: name => `Riproduzione esempio con ${name}.`,
    ttsTestFailed: 'Test vocale non riuscito.',
    webKeysPersistLabel: 'Salva le chiavi API in modo permanente nel browser (meno sicuro)',
    webKeysPersistHelp: 'Per impostazione predefinita, le chiavi web restano solo in sessionStorage per questa sessione. Il salvataggio permanente le rende leggibili da estensioni o script su questa pagina.',
    webKeysSessionActive: 'Attualmente salvate solo per questa sessione.',
  },
  pt: {
    accentOptions: { system: 'Neutro', blue: 'Azul', green: 'Verde', violet: 'Violeta' },
    cardOptions: { balanced: 'Equilibrado', compact: 'Compacto' },
    motionOptions: { system: 'Sistema', reduced: 'Reduzido' },
    editionLabel: 'Seleção editorial',
    editions: {
      balanced: {
        label: 'Equilibrado',
        description: 'Seleção equilibrada de notícias, economia, tecnologia e ciência.',
      },
      public: {
        label: 'Emissoras públicas',
        description: 'Tagesschau, ZDFheute, Deutschlandfunk, DW, BBC e NPR.',
      },
      analysis: {
        label: 'Análises e bastidores',
        description: 'ZEIT, F.A.Z., SZ, Handelsblatt, SPIEGEL, Guardian, Le Monde e El País.',
      },
      technology: {
        label: 'Tecnologia e IA',
        description: 'heise, THE DECODER, Golem, netzpolitik, Hacker News, Ars Technica, The Verge e MIT Tech.',
      },
      tabloid: {
        label: 'Últimas notícias',
        description: 'BILD, n-tv e WELT.',
      },
    },
    retentionOptions: {
      '2': '2 dias',
      '4': '4 dias (Padrão)',
      '7': '7 dias',
      '14': '2 semanas',
      '30': '1 mês (30 dias)',
      '90': '3 meses (90 dias)',
    },
    autoTranslateAndroid: 'Traduzir automaticamente artigos em inglês para alemão',
    recommendedApplied: 'Configurações recomendadas aplicadas.',
    readerThemeLabel: 'Tema de leitura',
    readerNewspaperLabel: 'Ativar modo jornal por padrão',
    readerNewspaperHelp: 'Abre artigos em layout de papel com tipografia serifada e colunas em telas grandes.',
    ttsSystemUnsupported: 'A voz do sistema não é suportada neste navegador.',
    ttsSystemPlaying: 'Reproduzindo amostra com a voz do sistema.',
    ttsProviderPlaying: name => `Reproduzindo amostra com ${name}.`,
    ttsTestFailed: 'O teste de voz falhou.',
    webKeysPersistLabel: 'Salvar chaves de API permanentemente no navegador (menos seguro)',
    webKeysPersistHelp: 'Por padrão, as chaves da web ficam apenas no sessionStorage desta sessão. O armazenamento permanente permite que extensões ou scripts nesta página leiam as chaves.',
    webKeysSessionActive: 'Atualmente mantidas apenas para esta sessão.',
  },
};

export function getSettingsCopy(lang: AppLanguage): SettingsCopy {
  return COPY[lang] ?? COPY.de;
}
