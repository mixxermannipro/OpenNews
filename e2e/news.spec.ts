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
  await page.getByRole('button', { name: /^DACH Kompakt/ }).click();
}
async function openSources(page: Page) {
  await page.getByRole('button', { name: 'Profil', exact: true }).click();
  await page.getByRole('button', { name: /^Quellen \d+$/ }).click();
  await page.getByRole('button', { name: 'Eigene Quelle', exact: true }).click();
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
    });
    const indicator = feed.locator('.pull-indicator');
    await expect(indicator).toHaveAttribute('data-ready', '');
    await feed.dispatchEvent('touchend');
    await expect(indicator).not.toHaveAttribute('data-pulling');
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
  await page.getByLabel(/^Name \(z\. B\./).fill('Eigene Testquelle');
  await page.getByLabel('Feed URL').fill('https://example.org/rss.xml');
  await page.getByRole('button', { name: 'Hinzufügen' }).click();
  await expect(page.getByRole('button', { name: 'Eigene Testquelle: Aktiv' })).toBeVisible();
});

test('imports a feed from OPML', async ({ page }) => {
  await enterApp(page);
  await openSources(page);
  await page.locator('input[type=file]').setInputFiles({
    name: 'quellen.opml',
    mimeType: 'application/xml',
    buffer: Buffer.from('<opml version="2.0"><body><outline text="OPML Testquelle" type="rss" xmlUrl="https://example.org/import.xml"/></body></opml>'),
  });
  await expect(page.getByRole('button', { name: 'OPML Testquelle: Aktiv' })).toBeVisible();
});

test('opens portrait clips full-screen, keeps the sound choice and closes the player', async ({ page }) => {
  await page.route('https://example.org/clips/*.webm', route =>
    route.fulfill({ path: 'e2e/fixtures/portrait.webm', contentType: 'video/webm' }));
  await page.route('**/api/feeds/fetch', route => {
    const { feeds } = route.request().postDataJSON() as { feeds: NewsSource[] };
    const source = feeds[0];
    const articles: NewsArticle[] = [1, 2, 3].map(index => ({
      id: 'clip-' + index,
      sourceId: source.id,
      sourceName: source.name,
      sourceShortCode: source.shortCode,
      sourceColor: source.accentColor,
      title: 'Testclip ' + index,
      summary: '',
      paragraphs: [],
      link: 'https://example.org/clips/' + index,
      category: source.category,
      publishedAt: new Date(Date.now() - 60_000 * index).toISOString(),
      readingTimeMin: 1,
      keywords: [],
      media: [index === 3
        ? { type: 'youtube', url: 'https://www.youtube-nocookie.com/embed/abcdefghijk', portrait: true }
        : { type: 'video', url: 'https://example.org/clips/' + index + '.webm', portrait: true }],
    }));
    return route.fulfill({ json: { articles, feedStatuses: [] } });
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.reload();
  await enterApp(page);
  await page.getByRole('button', { name: 'Video & Audio' }).click();
  await page.getByRole('button', { name: 'Testclip 1' }).click();
  const dialog = page.getByRole('dialog', { name: 'Clips' });
  await expect(dialog).toBeVisible();
  expect(await dialog.boundingBox()).toEqual({ x: 0, y: 0, width: 390, height: 844 });

  const player = dialog.locator('video');
  const playingClip = dialog.getByRole('listitem').filter({ has: page.locator('video') });
  await expect(player).toHaveAttribute('src', /1\.webm$/);
  await expect(player).toHaveJSProperty('muted', false);
  await playingClip.getByRole('button', { name: 'Ton aus' }).and(page.locator('[aria-pressed]')).click();
  await expect(player).toHaveJSProperty('muted', true);
  const clips = dialog.getByRole('list', { name: 'Clips' });
  await clips.evaluate(element => element.scrollTo(0, element.clientHeight));
  await expect(player).toHaveAttribute('src', /2\.webm$/);
  await expect(player).toHaveJSProperty('muted', true);
  await playingClip.getByRole('button', { name: 'Ton an' }).and(page.locator('[aria-pressed]')).click();
  await clips.evaluate(element => element.scrollTo(0, 2 * element.clientHeight));
  const youtube = dialog.locator('iframe');
  await expect(youtube).toHaveAttribute('src', /autoplay=1/);
  await expect(youtube).not.toHaveAttribute('src', /mute=1/);
  expect((await youtube.boundingBox())!.height).toBeGreaterThan(844 * 0.68);
  await page.setViewportSize({ width: 844, height: 400 });
  await clips.evaluate(element => element.scrollTo(0, 2 * element.clientHeight));
  await expect.poll(async () => {
    const bounds = await youtube.boundingBox();
    return bounds ? Math.min(bounds.width, bounds.height) : 0;
  }).toBeGreaterThanOrEqual(200);
  await dialog.getByRole('button', { name: 'Schließen' }).click();
  await expect(dialog).toBeHidden();
  await expect(dialog.locator('video, iframe')).toHaveCount(0);
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
  await page.getByRole('button', { name: /^Gespeichert \d+$/ }).click();
  await page.getByText(title, { exact: true }).filter({ visible: true }).first().click();
  await expect(reader.getByText(/Volltext stammt/).first()).toBeVisible();
});

test('generates an audio briefing on demand and starts speech', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('opennews_ai_config', JSON.stringify({
      provider: 'google', model: 'gemini-flash-latest', apiKey: 'local-test-fixture', autoSummarize: false,
    }));
    let paused = false;
    Object.defineProperties(window.speechSynthesis, {
      speak: {
        value: (utterance: SpeechSynthesisUtterance) => {
          if (!paused) document.documentElement.dataset.spokenBriefing = utterance.text;
        },
      },
      paused: { get: () => paused },
      cancel: { value: () => { delete document.documentElement.dataset.spokenBriefing; } },
      pause: { value: () => { paused = true; } },
      resume: { value: () => { paused = false; } },
    });
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
  const briefing = page.getByRole('dialog').filter({ has: page.locator('#briefing-title') });
  await expect(briefing).toBeVisible();
  expect(await tabBar.boundingBox()).toEqual(position);
  await briefing.getByRole('button', { name: 'Mit KI vertiefen' }).click();
  await expect.poll(() => briefingText).not.toBe('');
  await expect(briefing.getByText(briefingText, { exact: true })).toBeVisible();
  await briefing.getByRole('button', { name: 'Tagesüberblick anhören' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-spoken-briefing', briefingText);
  await briefing.getByRole('button', { name: 'Wiedergabe pausieren' }).click();
  await expect(briefing.getByRole('status')).toHaveText('Wiedergabe pausieren');
  await briefing.getByRole('button', { name: 'Wiedergabe fortsetzen' }).click();
  await expect(briefing.getByRole('status')).toHaveText('Tagesüberblick');
  await briefing.getByRole('button', { name: 'Wiedergabe pausieren' }).click();
  await briefing.getByRole('button', { name: 'Wiedergabe stoppen' }).click();
  await briefing.getByRole('button', { name: 'Tagesüberblick anhören' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-spoken-briefing', briefingText);
  await page.keyboard.press('Escape');
  await expect(page.locator('html')).not.toHaveAttribute('data-spoken-briefing');
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

test('moves between home sections while respecting both reduced-motion settings', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await enterApp(page);
  const home = page.getByRole('region', { name: 'Startseite Nachrichten' });
  const duration = () => home.evaluate(element => Number.parseFloat(getComputedStyle(element).animationDuration));
  await expect.poll(duration).toBeGreaterThan(0.1);
  const tabs = page.getByRole('group', { name: 'Ansicht der Startseite' });
  const selection = tabs.locator('.tab-selection');
  const initialPosition = (await selection.boundingBox())!.x;
  await tabs.getByRole('button', { name: 'Für dich', exact: true }).click();
  await expect.poll(async () => (await selection.boundingBox())!.x).toBeGreaterThan(initialPosition + 90);
  await tabs.getByRole('button', { name: 'Heute', exact: true }).click();
  await expect.poll(async () => (await selection.boundingBox())!.x).toBeCloseTo(initialPosition, 0);
  const briefingEntry = page.getByRole('button', { name: 'Tagesüberblick', exact: true });
  await briefingEntry.click();
  const briefing = page.getByRole('dialog').filter({ has: page.locator('#briefing-title') });
  await expect(briefing).toBeVisible();
  await briefing.getByRole('button', { name: 'Schließen' }).click();
  await expect(briefing).toBeHidden();
  await expect(briefingEntry).toBeFocused();

  await page.emulateMedia({ reducedMotion: 'reduce' });
  await expect.poll(duration).toBeLessThan(0.001);

  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.getByRole('button', { name: 'Profil', exact: true }).click();
  await page.getByRole('button', { name: 'Einstellungen', exact: true }).click();
  await page.getByRole('button', { name: 'Darstellung', exact: true }).click();
  await page.getByLabel('Animationen').selectOption('reduced');
  const dock = page.getByRole('navigation', { name: 'Mobile Navigation' });
  await dock.getByRole('button', { name: 'Heute', exact: true }).click();
  await expect.poll(duration).toBeLessThan(0.001);
  await expect.poll(() => selection.evaluate(element => Number.parseFloat(getComputedStyle(element).transitionDuration)))
    .toBeLessThan(0.001);
  await tabs.getByRole('button', { name: 'Neueste', exact: true }).click();
  await expect(tabs.getByRole('button', { name: 'Neueste', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await dock.getByRole('button', { name: 'Video & Audio' }).click();
  await page.getByRole('button', { name: 'Clips', exact: true }).click();
  const clips = page.getByRole('dialog', { name: 'Clips' });
  await expect(clips).toBeVisible();
  const clipDuration = await clips.evaluate(dialog =>
    Number.parseFloat(getComputedStyle(dialog).animationDuration),
  );
  expect(clipDuration).toBeLessThan(0.001);
  await clips.getByRole('button', { name: 'Schließen' }).click();
  await expect(clips).toBeHidden();
});

test('keeps notification and personalization settings in their own groups on the web', async ({ page }) => {
  await enterApp(page);
  await page.getByRole('button', { name: 'Profil', exact: true }).click();
  await page.getByRole('button', { name: 'Einstellungen', exact: true }).click();
  await page.getByRole('button', { name: 'Benachrichtigungen', exact: true }).click();
  await expect(page.getByText('Im Browser erscheinen Hinweise nur beim Aktualisieren in der geöffneten App.')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Algorithmus zurücksetzen' })).toHaveCount(0);
  const notifications = page.getByRole('switch', { name: 'Benachrichtigungen umschalten' });
  await notifications.click();
  await expect(notifications).toBeChecked();
  await page.getByRole('button', { name: 'Zurück', exact: true }).click();
  await page.getByRole('button', { name: 'KI & Personalisierung', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Algorithmus zurücksetzen' })).toBeVisible();
});

test('offers an email contact for voluntary beta feedback and privacy requests', async ({ page }) => {
  await enterApp(page);
  await page.getByRole('button', { name: 'Profil', exact: true }).click();

  const contact = 'mixxermannipropvp@gmail.com';
  await expect(page.getByRole('link', { name: 'Kontakt und Feedback' })).toHaveAttribute(
    'href', 'mailto:' + contact + '?subject=OpenNews%20Beta',
  );

  await page.getByRole('button', { name: 'Einstellungen', exact: true }).click();
  await page.getByRole('button', { name: 'Datenschutz', exact: true }).click();
  await expect(page.getByRole('link', { name: contact })).toHaveAttribute('href', 'mailto:' + contact);
});
