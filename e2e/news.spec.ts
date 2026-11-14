import { expect, test, type Page } from '@playwright/test';
import type { NewsArticle, NewsSource } from '../src/types/news';

const title = 'Testmeldung aus dem lokalen Testfeed';

test.beforeEach(async ({ page }) => {
  await page.route('https://**/*', route => route.abort());
  await page.route('**/api/feeds/fetch', async route => {
    const { feeds } = route.request().postDataJSON() as { feeds: NewsSource[] };
    const articles: NewsArticle[] = feeds.slice(0, 1).map(source => ({
      id: 'fixture-' + source.id,
      sourceId: source.id,
      sourceName: source.name,
      sourceShortCode: source.shortCode,
      sourceColor: source.accentColor,
      title,
      summary: 'Dieser Beitrag stammt aus einem simulierten Feed.',
      paragraphs: ['Dieser Beitrag stammt aus einem simulierten Feed.'],
      link: 'https://example.org/news/' + source.id,
      category: source.category,
      publishedAt: new Date(Date.now() - 60_000).toISOString(),
      readingTimeMin: 1,
      keywords: ['testfeed'],
    }));
    await route.fulfill({ json: { articles, feedStatuses: [] } });
  });
  await page.route('**/api/article/extract?**', route => route.fulfill({
    json: { paragraphs: ['Dieser Volltext stammt ausschließlich aus dem Browsertest.'] },
  }));
  await page.goto('/');
});

async function enterApp(page: Page) {
  await page.getByRole('button', { name: 'Einrichtung überspringen' }).click();
}
async function openSources(page: Page) {
  await page.getByRole('button', { name: 'Profil', exact: true }).click();
  await page.getByRole('button', { name: 'Quellen', exact: true }).click();
}

test('skips onboarding and displays a feed article', async ({ page }) => {
  await enterApp(page);
  await expect(page.getByText(title, { exact: true }).first()).toBeVisible();
  await page.reload();
  await expect(page.getByText(title, { exact: true }).first()).toBeVisible();
});

test('opens a reader and saves the article', async ({ page }) => {
  await enterApp(page);
  await page.getByText(title, { exact: true }).first().click();
  const reader = page.getByRole('dialog', { name: /Artikel lesen/ });
  await expect(reader).toBeVisible();
  await reader.getByRole('button', { name: 'Artikel speichern' }).click();
  await expect(reader.getByRole('button', { name: 'Lesezeichen entfernen' })).toBeVisible();
});

test('subscribes to a custom feed', async ({ page }) => {
  await enterApp(page);
  await openSources(page);
  await page.getByText('Eigene Quelle hinzufügen', { exact: true }).click();
  await page.getByLabel('Name des eigenen Feeds').fill('Eigene Testquelle');
  await page.getByLabel('URL des eigenen Feeds').fill('https://example.org/rss.xml');
  await page.getByRole('button', { name: 'Feed hinzufügen' }).click();
  await expect(page.getByRole('button', { name: 'Eigene Testquelle abbestellen' })).toBeVisible();
});

test('imports a feed from OPML', async ({ page }) => {
  await enterApp(page);
  await openSources(page);
  await page.locator('input[type=file]').setInputFiles({
    name: 'quellen.opml',
    mimeType: 'application/xml',
    buffer: Buffer.from('<opml version="2.0"><body><outline text="OPML Testquelle" type="rss" xmlUrl="https://example.org/import.xml"/></body></opml>'),
  });
  await expect(page.getByRole('button', { name: 'OPML Testquelle abbestellen' })).toBeVisible();
});

test('opens and closes the full-screen clips view', async ({ page }) => {
  await enterApp(page);
  await page.getByRole('button', { name: 'Video & Audio' }).click();
  await page.getByRole('button', { name: 'Clips', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Hochformat-Clips im Vollbild' });
  await expect(dialog).toBeVisible();
  await dialog.getByRole('button', { name: 'Clips schließen' }).click();
  await expect(dialog).toBeHidden();
});

test('reads a saved article offline', async ({ page, context }) => {
  await enterApp(page);
  await page.getByText(title, { exact: true }).first().click();
  const reader = page.getByRole('dialog', { name: /Artikel lesen/ });
  await expect(reader.getByText(/Volltext stammt/).first()).toBeVisible();
  await reader.getByRole('button', { name: 'Offline speichern' }).click();
  await expect(reader.getByText('Text offline verfügbar.')).toBeVisible();
  await page.goBack();
  await expect(reader).toBeHidden();
  await page.evaluate(() => navigator.serviceWorker.ready.then(() => undefined));
  await page.reload();
  await expect.poll(() => page.evaluate(() => Boolean(navigator.serviceWorker.controller))).toBe(true);
  await context.setOffline(true);
  await page.getByRole('button', { name: 'Profil', exact: true }).click();
  await page.getByRole('button', { name: 'Gespeichert', exact: true }).click();
  await page.getByText(title, { exact: true }).first().click();
  await expect(reader.getByText(/Volltext stammt/).first()).toBeVisible();
});
