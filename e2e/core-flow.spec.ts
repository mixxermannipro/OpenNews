import { expect, test } from '@playwright/test';
import fs from 'node:fs/promises';
import type { NewsArticle, NewsSource } from '../src/types/news';

const ARTICLE_TITLE = 'Kernablauf-Meldung für den End-to-End-Test';
const FULL_TEXT_PARAGRAPH = 'Ausführlicher Volltextartikel nach explizitem Quellen-Opt-in.';

test.beforeEach(async ({ page }) => {
  await page.route('https://**/*', route => route.abort());
  await page.route('**/api/feeds/fetch', async route => {
    const { feeds } = route.request().postDataJSON() as { feeds: NewsSource[] };
    const articles: NewsArticle[] = feeds.slice(0, 1).map(source => ({
      id: `core-${source.id}`,
      sourceId: source.id,
      sourceName: source.name,
      sourceShortCode: source.shortCode,
      sourceColor: source.accentColor,
      title: ARTICLE_TITLE,
      summary: 'Kurze Feed-Zusammenfassung für den Kernablauf-Test.',
      paragraphs: [
        'Kurze Feed-Zusammenfassung für den Kernablauf-Test.',
        'Ein zweiter Absatz aus dem Feed-Text.',
      ],
      link: `https://example.org/core/${source.id}`,
      category: source.category,
      publishedAt: new Date(Date.now() - 60_000).toISOString(),
      readingTimeMin: 2,
      keywords: ['kernablauf'],
    }));
    await route.fulfill({ json: { articles, feedStatuses: [] } });
  });
  await page.route('**/api/article/extract?**', route =>
    route.fulfill({
      json: {
        paragraphs: [
          FULL_TEXT_PARAGRAPH,
          'Dieser zweite Absatz des abgerufenen Volltexts enthält weitere geprüfte Details aus dem simulierten Beitrag.',
          'Ein dritter Absatz stellt sicher, dass der Volltext deutlich länger als die Feed-Vorschau ist.',
        ],
      },
    }),
  );
});

test('completes core flow: onboarding, feed, reader summary + opt-in full text, bookmark, backup export & import', async ({ page }, testInfo) => {
  await page.goto('/');

  // 1. Onboarding: Language -> Sources -> Topics -> Start
  await page.getByRole('button', { name: 'Weiter', exact: false }).click();
  await page.getByRole('button', { name: /^DACH Kompakt/ }).click();
  await page.getByRole('button', { name: 'Weiter', exact: false }).click();
  await page.getByRole('button', { name: 'Nachrichten öffnen', exact: false }).click();

  // 2. Load feed & open article
  const articleHeading = page.getByText(ARTICLE_TITLE, { exact: true }).filter({ visible: true }).first();
  await expect(articleHeading).toBeVisible();
  await articleHeading.click();

  const reader = page.getByRole('dialog', { name: /Artikel lesen/ });
  await expect(reader).toBeVisible();

  // 3. Open local summary dialog
  await reader.getByRole('button', { name: 'Zusammenfassung' }).click();
  const summaryDialog = page.locator('#reader-summary');
  await expect(summaryDialog).toBeVisible();
  await summaryDialog.getByRole('button', { name: 'Schließen', exact: true }).click();
  await expect(summaryDialog).toBeHidden();

  // 4. Enable opt-in full text per source
  await reader.getByRole('button', { name: 'Volltext für diese Quelle laden' }).click();
  await expect(reader.locator('article').getByText(FULL_TEXT_PARAGRAPH)).toBeVisible();

  // 5. Bookmark article & close reader
  await reader.getByRole('button', { name: 'Artikel speichern' }).click();
  await expect(reader.getByRole('button', { name: 'Lesezeichen entfernen' })).toBeVisible();
  await reader.getByRole('button', { name: 'Zurück', exact: true }).first().click();
  await expect(reader).toBeHidden();

  // 6. Export profile JSON backup
  await page.getByRole('button', { name: 'Profil', exact: true }).click();
  await page.getByRole('button', { name: 'Einstellungen', exact: true }).click();
  await page.getByRole('button', { name: 'Datenschutz', exact: true }).click();

  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Sicherung exportieren' }).click();
  const download = await downloadPromise;
  const backupPath = testInfo.outputPath('opennews-backup.json');
  await download.saveAs(backupPath);

  const exportedRaw = await fs.readFile(backupPath, 'utf8');
  const parsed = JSON.parse(exportedRaw) as {
    version?: number;
    sources?: string;
    reactions?: { bookmarkedIds?: string[] };
    bookmarks?: Array<{ id: string; title: string }>;
  };
  expect(parsed.version).toBe(1);
  expect(parsed.sources ?? '').toContain('<opml');
  expect((parsed.reactions?.bookmarkedIds ?? []).length).toBe(1);
  expect((parsed.bookmarks ?? []).length).toBe(1);

  // 7. Reset storage and import backup again
  await page.evaluate(() => {
    localStorage.clear();
    sessionStorage.clear();
  });
  await page.reload();
  await page.getByRole('button', { name: 'Einrichtung überspringen' }).click();
  await page.getByRole('button', { name: 'Profil', exact: true }).click();
  await page.getByRole('button', { name: 'Einstellungen', exact: true }).click();
  await page.getByRole('button', { name: 'Datenschutz', exact: true }).click();

  await page.locator('input[type="file"][accept*="json"]').setInputFiles(backupPath);
  await expect(page.getByRole('status').filter({ hasText: /\S+/ }).first()).toBeVisible();

  // Verify bookmark survived roundtrip in Saved view
  await page.getByRole('button', { name: 'Zurück', exact: true }).click();
  await page.getByRole('button', { name: 'Zurück', exact: true }).click();
  await page.getByRole('button', { name: /^Gespeichert \d+$/ }).click();
  await expect(page.getByText(ARTICLE_TITLE, { exact: true }).filter({ visible: true }).first()).toBeVisible();
});
