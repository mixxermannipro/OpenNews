import { expect, test, type Page } from '@playwright/test';
import type { NewsArticle, NewsSource } from '../src/types/news';

function createFixtureArticles(feeds: NewsSource[]): NewsArticle[] {
  const source = feeds[0] ?? {
    id: 'tagesschau',
    name: 'Tagesschau',
    shortCode: 'TS',
    accentColor: '#0f4c81',
    category: 'Politik' as const,
  };
  const now = Date.now();
  return [
    {
      id: 'walkthrough-1',
      sourceId: source.id,
      sourceName: source.name,
      sourceShortCode: source.shortCode,
      sourceColor: source.accentColor,
      title: 'Klimagipfel beschließt neue Energieziele für Europa',
      summary: 'Die Mitgliedstaaten einigen sich auf beschleunigten Ausbau erneuerbarer Energien und moderne Stromnetze.',
      paragraphs: [
        'Die Mitgliedstaaten einigen sich auf beschleunigten Ausbau erneuerbarer Energien und moderne Stromnetze.',
        'Bis 2035 sollen grenzüberschreitende Leitungen die Versorgungssicherheit deutlich erhöhen.',
      ],
      link: 'https://example.org/news/walkthrough-1',
      category: 'Politik',
      publishedAt: new Date(now - 10 * 60_000).toISOString(),
      readingTimeMin: 3,
      keywords: ['klima', 'europa', 'energie'],
    },
    {
      id: 'walkthrough-2',
      sourceId: source.id,
      sourceName: source.name,
      sourceShortCode: source.shortCode,
      sourceColor: source.accentColor,
      title: 'Forschungsteam präsentiert effizienten Quantenprozessor',
      summary: 'Ein neuer Chip halbiert die Fehlerrate bei Raumtemperatur-Tests im Labor.',
      paragraphs: ['Ein neuer Chip halbiert die Fehlerrate bei Raumtemperatur-Tests im Labor.'],
      link: 'https://example.org/news/walkthrough-2',
      category: 'Technologie',
      publishedAt: new Date(now - 25 * 60_000).toISOString(),
      readingTimeMin: 2,
      keywords: ['quanten', 'chip', 'forschung'],
    },
    {
      id: 'walkthrough-clip-1',
      sourceId: source.id,
      sourceName: source.name,
      sourceShortCode: source.shortCode,
      sourceColor: source.accentColor,
      title: 'Kompaktclip zur Verkehrswende',
      summary: 'Kurzer Überblick über neue Bahnverbindungen in Europa.',
      paragraphs: ['Kurzer Überblick über neue Bahnverbindungen in Europa.'],
      link: 'https://example.org/clips/walkthrough-clip-1',
      category: 'Europa',
      publishedAt: new Date(now - 40 * 60_000).toISOString(),
      readingTimeMin: 1,
      keywords: ['verkehr', 'bahn'],
      media: [{ type: 'video', url: 'https://example.org/clips/walkthrough-1.webm', portrait: true }],
    },
    {
      id: 'walkthrough-audio-1',
      sourceId: source.id,
      sourceName: source.name,
      sourceShortCode: source.shortCode,
      sourceColor: source.accentColor,
      title: 'Wirtschafts-Podcast: Zinsen und Konjunktur',
      summary: 'Aktuelle Einschätzungen zur europäischen Zinsentwicklung.',
      paragraphs: ['Aktuelle Einschätzungen zur europäischen Zinsentwicklung.'],
      link: 'https://example.org/audio/walkthrough-audio-1',
      category: 'Wirtschaft',
      publishedAt: new Date(now - 55 * 60_000).toISOString(),
      readingTimeMin: 5,
      keywords: ['zinsen', 'wirtschaft'],
      audioUrl: 'https://example.org/audio/episode.mp3',
      media: [{ type: 'audio', url: 'https://example.org/audio/episode.mp3' }],
    },
  ];
}

async function setupRoutes(page: Page) {
  await page.route('https://**/*', route => {
    const url = route.request().url();
    if (url.endsWith('.webm')) {
      return route.fulfill({ path: 'e2e/fixtures/portrait.webm', contentType: 'video/webm' });
    }
    return route.abort();
  });
  await page.route('**/api/feeds/fetch', async route => {
    const { feeds } = route.request().postDataJSON() as { feeds: NewsSource[] };
    await route.fulfill({ json: { articles: createFixtureArticles(feeds), feedStatuses: [] } });
  });
  await page.route('**/api/article/extract?**', route =>
    route.fulfill({
      json: {
        paragraphs: [
          'Dies ist der vollständige erste Absatz des extrahierten Artikels für den Funktionstest.',
          'Ein zweiter Absatz bestätigt die saubere Darstellung im Reader- und Zeitungsmodus.',
          'Ein dritter Absatz prüft Scrollen, Vorlesen und Typografie ohne Layoutsprünge.',
        ],
      },
    }),
  );
}

test('full end-to-end walkthrough across all views, dialogs, filters, settings, and animations', async ({ page }) => {
  test.setTimeout(30_000);
  const errors: string[] = [];
  page.on('pageerror', err => errors.push(`pageerror: ${err.message}`));
  page.on('console', msg => {
    if (msg.type() === 'error') errors.push(`console.error: ${msg.text()}`);
  });

  await setupRoutes(page);
  await page.goto('/');

  // 1. Onboarding: skip & pick starter pack
  await page.getByRole('button', { name: 'Einrichtung überspringen' }).click();
  await page.getByRole('button', { name: /^DACH Kompakt/ }).click();
  await expect(page.getByText('Klimagipfel beschließt neue Energieziele für Europa').filter({ visible: true }).first()).toBeVisible();

  // 2. Home tabs, reactions, manual refresh
  const homeTabs = page.getByRole('group', { name: 'Ansicht der Startseite' });
  await homeTabs.getByRole('button', { name: 'Für dich', exact: true }).click();
  await homeTabs.getByRole('button', { name: 'Neueste', exact: true }).click();
  await homeTabs.getByRole('button', { name: 'Heute', exact: true }).click();
  await page.getByRole('button', { name: 'Feeds aktualisieren', exact: true }).click();

  // Like & Bookmark from Home card
  await page.getByRole('button', { name: /Gefällt mir: Klimagipfel/ }).first().click();
  await expect(page.getByRole('button', { name: /Gefällt mir entfernen: Klimagipfel/ }).first()).toBeVisible();
  await page.getByRole('button', { name: /Artikel speichern: Klimagipfel/ }).first().click();
  await expect(page.getByRole('button', { name: /Lesezeichen entfernen: Klimagipfel/ }).first()).toBeVisible();

  // 3. Daily Briefing -> click article inside Briefing -> Reader opens and stays open (regression test!)
  await page.getByRole('button', { name: 'Tagesüberblick' }).click();
  const briefingDialog = page.locator('dialog.briefing-dialog[open]');
  await expect(briefingDialog).toBeVisible();
  await briefingDialog.getByRole('button', { name: /Klimagipfel beschließt/ }).first().click();
  const reader = page.getByRole('dialog', { name: /Artikel lesen/ });
  await expect(reader).toBeVisible();
  await expect(reader.getByText(/vollständige erste Absatz/).first()).toBeVisible();
  // Ensure it stays open after any async popstate tick
  await page.waitForTimeout(150);
  await expect(reader).toBeVisible();

  // 4. Reader controls: Queue, Typography (Theme & Newspaper mode), Summary dialog
  await reader.getByRole('button', { name: 'Als Nächstes lesen' }).click();
  await reader.getByRole('button', { name: /Textbild|Typografie|Schrift/ }).click();
  await reader.getByRole('button', { name: 'Sepia' }).click();
  await reader.getByRole('button', { name: 'Nacht' }).click();
  await reader.getByRole('button', { name: 'Papier' }).click();
  await reader.getByRole('button', { name: /Zeitungsmodus/ }).click();
  await reader.getByRole('button', { name: /Zeitungsmodus/ }).click();
  await reader.getByRole('button', { name: 'Zusammenfassung' }).click();
  const summaryDialog = page.locator('dialog.reader-summary[open]');
  await expect(summaryDialog).toBeVisible();
  await summaryDialog.getByRole('button', { name: 'Schließen' }).click();
  await expect(summaryDialog).toBeHidden();
  await page.goBack();
  await expect(reader).toBeHidden();
  await expect(briefingDialog).toBeVisible();
  await briefingDialog.getByRole('button', { name: 'Schließen' }).click();
  await expect(briefingDialog).toBeHidden();

  // 5. Discover: Search, Keyword Radar & Mute Filter panel stays open while typing (regression test!)
  const desktopNav = page.getByRole('navigation', { name: 'Hauptnavigation' });
  await desktopNav.getByRole('button', { name: 'Entdecken', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Entdecken' })).toBeVisible();
  await page.getByRole('button', { name: 'Radar & Filter' }).click();
  const radarInput = page.getByPlaceholder(/Stichwort|Thema/i).first();
  await expect(radarInput).toBeVisible();
  await radarInput.fill('Quanten');
  await expect(radarInput).toHaveValue('Quanten');
  await radarInput.press('Enter');
  await expect(page.getByText('Quanten', { exact: true }).first()).toBeVisible();

  // Mute keyword test
  const muteInput = page.getByPlaceholder(/Stummschalten|Begriff/i).first();
  await muteInput.fill('Quantenprozessor');
  await muteInput.press('Enter');
  await expect(page.getByText('Forschungsteam präsentiert effizienten Quantenprozessor')).toHaveCount(0);
  await page.getByRole('button', { name: /Quantenprozessor/ }).click();

  // 6. Media & Clips: open clip -> open article from clip -> Reader opens & stays open (regression test!)
  await desktopNav.getByRole('button', { name: 'Video & Audio', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Kompaktclip zur Verkehrswende' })).toBeVisible();
  await page.getByRole('button', { name: 'Kompaktclip zur Verkehrswende' }).click();
  const clipsDialog = page.getByRole('dialog', { name: 'Clips' });
  await expect(clipsDialog).toBeVisible();
  await clipsDialog.getByRole('button', { name: 'Artikel', exact: true }).first().click();
  await expect(clipsDialog).toBeHidden();
  await expect(reader).toBeVisible();
  await page.waitForTimeout(150);
  await expect(reader).toBeVisible();
  await page.goBack();
  await expect(reader).toBeHidden();

  // 7. Profile & Saved (all 6 sub-tabs)
  await desktopNav.getByRole('button', { name: 'Profil', exact: true }).click();
  await page.getByRole('button', { name: /^Gespeichert/ }).click();
  for (const tabLabel of ['Gemerkt', /^Warteschlange/, /^Zitate/, 'Likes', 'Gelesen', 'Profil']) {
    await page.getByRole('group', { name: 'Gespeichert' }).getByRole('button', { name: tabLabel }).click();
  }
  await page.getByRole('button', { name: 'Zurück' }).click();

  // 8. Profile -> Settings -> Appearance, Reading, Privacy
  await page.getByRole('button', { name: 'Einstellungen', exact: true }).click();
  await page.getByRole('button', { name: 'Darstellung', exact: true }).click();
  await page.getByRole('button', { name: 'Dunkel', exact: true }).click();
  await expect(page.locator('html')).toHaveClass(/dark/);
  await page.getByRole('button', { name: 'Hell', exact: true }).click();
  await expect(page.locator('html')).not.toHaveClass(/dark/);
  await page.getByRole('button', { name: 'Zurück' }).click();
  await page.getByRole('button', { name: 'Lesen', exact: true }).click();
  await page.getByRole('button', { name: 'Zurück' }).click();
  await page.getByRole('button', { name: 'Datenschutz', exact: true }).click();
  await page.getByRole('button', { name: 'Zurück' }).click();

  // 9. Mobile viewport overflow audit across main tabs
  await page.setViewportSize({ width: 390, height: 844 });
  for (const navName of ['Heute', 'Entdecken', 'Video & Audio', 'Profil']) {
    await page.getByRole('navigation', { name: 'Mobile Navigation' }).getByRole('button', { name: navName }).click();
    await page.waitForTimeout(80);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow, `Horizontal overflow on ${navName} (390px)`).toBeLessThanOrEqual(1);
  }

  expect(errors).toEqual([]);
});
