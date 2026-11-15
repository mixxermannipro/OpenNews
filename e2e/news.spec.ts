import { expect, test, type Page } from '@playwright/test';
import type { NewsArticle, NewsSource } from '../src/types/news';
import { DEFAULT_PREFERENCES } from '../src/lib/preferences';

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
  await expect(page.getByText(title, { exact: true }).filter({ visible: true }).first()).toBeVisible();
  await page.reload();
  await expect(page.getByText(title, { exact: true }).filter({ visible: true }).first()).toBeVisible();
});

test('keeps the feed unchanged when returning to an open app', async ({ page }) => {
  await page.route('**/api/feeds/fetch', route => route.fulfill({ status: 429 }));
  await page.clock.install();
  await page.reload();
  await enterApp(page);
  await expect(page.getByText(/Der Server erhält zu viele Anfragen/)).toBeVisible();

  const triggeredRequest = await page.evaluate(() => {
    let triggered = false;
    const originalFetch = window.fetch;
    window.fetch = (input, options) => {
      if (input === '/api/feeds/fetch') triggered = true;
      return originalFetch(input, options);
    };
    document.dispatchEvent(new Event('visibilitychange'));
    window.dispatchEvent(new Event('online'));
    window.fetch = originalFetch;
    return triggered;
  });
  expect(triggeredRequest).toBe(false);

  const requests: string[] = [];
  page.on('request', request => {
    if (request.url().endsWith('/api/feeds/fetch')) requests.push(request.url());
  });
  await page.clock.fastForward(5 * 60_000);
  await page.evaluate(() => new Promise<void>(resolve => window.setTimeout(resolve, 0)));
  expect(requests).toHaveLength(0);

  const tabs = page.getByRole('group', { name: 'Ansicht der Startseite' });
  const feed = page.getByRole('region', { name: 'Startseite Nachrichten' });
  for (const tab of ['Heute', 'Für dich', 'Neueste']) {
    await tabs.getByRole('button', { name: tab, exact: true }).click();
    await page.evaluate(() => window.scrollTo(0, 0));
    const request = page.waitForRequest('**/api/feeds/fetch');
    await feed.evaluate(element => {
      const touch = (clientY: number) => new Touch({ identifier: 1, target: element, clientX: 100, clientY });
      element.dispatchEvent(new TouchEvent('touchstart', { bubbles: true, touches: [touch(100)] }));
      element.dispatchEvent(new TouchEvent('touchmove', { bubbles: true, touches: [touch(230)] }));
      element.dispatchEvent(new TouchEvent('touchend', { bubbles: true }));
    });
    await request;
    await expect(page.getByText(/Der Server erhält zu viele Anfragen/)).toBeVisible();
  }
});

test('opens a reader and saves the article', async ({ page }) => {
  await enterApp(page);
  await page.getByText(title, { exact: true }).filter({ visible: true }).first().click();
  const reader = page.getByRole('dialog', { name: /Artikel lesen/ });
  await expect(reader).toBeVisible();
  await reader.getByRole('button', { name: 'Artikel speichern' }).click();
  await expect(reader.getByRole('button', { name: 'Lesezeichen entfernen' })).toBeVisible();
  const scrollPosition = await page.evaluate(() => window.scrollY);
  await page.evaluate(() => {
    const now = Date.now;
    const twoDaysLater = now() + 2 * 24 * 60 * 60_000;
    Date.now = () => twoDaysLater;
    document.dispatchEvent(new Event('visibilitychange'));
    Date.now = now;
  });
  await page.goBack();
  await expect(reader).toBeHidden();
  await expect(page.getByText(title, { exact: true }).filter({ visible: true }).first()).toBeVisible();
  expect(await page.evaluate(() => window.scrollY)).toBe(scrollPosition);
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
  await page.getByText(title, { exact: true }).filter({ visible: true }).first().click();
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
  await page.getByText(title, { exact: true }).filter({ visible: true }).first().click();
  await expect(reader.getByText(/Volltext stammt/).first()).toBeVisible();
});

test('generates an audio briefing on demand and starts speech', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('opennews_ai_config', JSON.stringify({
      provider: 'google', model: 'gemini-flash-latest', apiKey: 'local-test-fixture', autoSummarize: false,
    }));
    Object.defineProperty(window.speechSynthesis, 'speak', {
      value: (utterance: SpeechSynthesisUtterance) => {
        document.documentElement.dataset.spokenBriefing = utterance.text;
      },
    });
    Object.defineProperty(window.speechSynthesis, 'cancel', { value: () => {} });
  });
  let briefingText = '';
  await page.route('**/api/ai/proxy', route => {
    const { prompt } = route.request().postDataJSON() as { prompt: string };
    const data = JSON.parse(prompt.split('\n').find(line => line.startsWith('{'))!) as { articles: Array<{ source: string }> };
    briefingText = `Guten Morgen. Laut ${data.articles[0].source} erscheint heute eine Testmeldung.`;
    return route.fulfill({ json: { text: JSON.stringify({ text: briefingText }) } });
  });
  await page.reload();
  await enterApp(page);
  await page.setViewportSize({ width: 320, height: 640 });
  await page.evaluate(() => { document.documentElement.style.fontSize = '125%'; });
  const tabs = page.getByRole('group', { name: 'Ansicht der Startseite' });
  const trigger = page.getByRole('button', { name: 'Tagesüberblick', exact: true });
  for (const tab of ['Heute', 'Für dich', 'Neueste']) {
    await tabs.getByRole('button', { name: tab, exact: true }).click();
    await expect(trigger).toBeVisible();
  }
  const tabBar = page.locator('[aria-label="Ansicht der Startseite"]');
  const position = await tabBar.boundingBox();
  await trigger.click();
  const briefing = page.getByRole('dialog', { name: 'Tagesüberblick' });
  await expect(briefing).toBeVisible();
  expect(await tabBar.boundingBox()).toEqual(position);
  await briefing.getByRole('button', { name: 'Tagesüberblick anhören' }).click();
  await expect.poll(() => briefingText).not.toBe('');
  await expect(page.locator('html')).toHaveAttribute('data-spoken-briefing', briefingText);
  await briefing.getByRole('button', { name: 'Wiedergabe pausieren' }).click();
  await expect(briefing.getByRole('status')).toHaveText('Wiedergabe pausiert.');
  await briefing.getByRole('button', { name: 'Wiedergabe fortsetzen' }).click();
  await expect(briefing.getByRole('status')).toHaveText('Tagesüberblick läuft.');
  await page.getByRole('button', { name: 'Wiedergabe stoppen' }).click();
  await expect(page.getByRole('button', { name: 'Tagesüberblick anhören' })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(briefing).toBeHidden();
  await expect(trigger).toBeFocused();
});

test('migrates old reading history and preserves it across restarts', async ({ browser, baseURL }) => {
  const context = await browser.newContext({ baseURL });
  try {
    const page = await context.newPage();
    await page.goto('/api/health');
    const legacy = [{ id: 'legacy-article', title: 'Migrationstest' }];
    await page.evaluate(value => localStorage.setItem('opennews_read_articles', JSON.stringify(value)), legacy);
    await page.goto('/');
    await expect.poll(() => page.evaluate(() => localStorage.getItem('opennews_read_articles'))).toBeNull();
    await page.reload();
    const history = await page.evaluate(() => new Promise<unknown>((resolve, reject) => {
      const open = indexedDB.open('opennews', 1);
      open.onerror = () => reject(open.error);
      open.onsuccess = () => {
        const request = open.result.transaction('articles').objectStore('articles').get('opennews_read_articles');
        request.onsuccess = () => { resolve(request.result); open.result.close(); };
        request.onerror = () => reject(request.error);
      };
    }));
    expect(history).toEqual(legacy);
  } finally {
    await context.close();
  }
});

test('keeps home tabs usable with large text on a narrow screen', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 820 });
  await page.emulateMedia({ colorScheme: 'dark', reducedMotion: 'reduce' });
  await page.evaluate(preferences => localStorage.setItem('opennews_preferences', JSON.stringify(preferences)), { ...DEFAULT_PREFERENCES, textScale: 'large' });
  await page.reload();
  await enterApp(page);
  const tabs = page.getByRole('group', { name: 'Ansicht der Startseite' });
  const initialHeight = (await tabs.boundingBox())?.height;
  for (const name of ['Heute', 'Für dich', 'Neueste']) {
    const button = tabs.getByRole('button', { name, exact: true });
    await button.click();
    await expect(button).toHaveAttribute('aria-pressed', 'true');
    expect((await button.boundingBox())?.height).toBeGreaterThanOrEqual(44);
    expect((await tabs.boundingBox())?.height).toBe(initialHeight);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);
  }
});

test('shows a rate limit without marking feeds as failed', async ({ page }) => {
  await page.route('**/api/feeds/fetch', route => route.fulfill({ status: 429 }));
  await page.reload();
  await enterApp(page);
  await expect(page.getByText('Der Server erhält zu viele Anfragen.', { exact: false })).toBeVisible();
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('opennews_feed_health') ?? '{}'))).toEqual({});
});
