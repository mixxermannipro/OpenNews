import { readFile, rename, writeFile } from 'node:fs/promises';
import { GoogleAuth } from 'google-auth-library';
import { articleIdentity } from '../src/lib/newsFeed';
import { pushSources } from '../src/lib/catalog';
import { parseFeedPayload } from '../src/lib/rssParser';
import type { NewsArticle } from '../src/types/news';

const maxAge = 2 * 60 * 60_000;
const auth = new GoogleAuth({ scopes: ['https://www.googleapis.com/auth/firebase.messaging'] });
const project = process.env.OPENNEWS_FIREBASE_PROJECT;
const stateFile = process.env.OPENNEWS_PUSH_STATE || './opennews-push-state.json';

if (!project || !/^[a-z0-9-]+$/.test(project)) {
  throw new Error('OPENNEWS_FIREBASE_PROJECT muss gesetzt sein.');
}

async function send(article: NewsArticle) {
  const token = await auth.getAccessToken();
  const response = await fetch(`https://fcm.googleapis.com/v1/projects/${project}/messages:send`, {
    method: 'POST',
    signal: AbortSignal.timeout(15_000),
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message: {
        topic: `opennews_${article.sourceId}`,
        data: {
          id: article.id,
          title: article.title.slice(0, 300),
          source: article.sourceId,
          sourceName: article.sourceName,
          category: article.category,
          breaking: String(Boolean(article.isBreaking)),
        },
        android: { priority: article.isBreaking ? 'HIGH' : 'NORMAL', ttl: '3600s' },
      },
    }),
  });
  if (!response.ok) throw new Error(`Firebase HTTP ${response.status}`);
}

async function cycle() {
  const state: Record<string, string[]> = await readFile(stateFile, 'utf8').then(
    value => JSON.parse(value),
    (error: NodeJS.ErrnoException) => {
      if (error.code === 'ENOENT') return {};
      throw error;
    },
  );
  const persist = async () => {
    await writeFile(stateFile + '.tmp', JSON.stringify(state), { mode: 0o600 });
    await rename(stateFile + '.tmp', stateFile);
  };
  for (const source of pushSources) {
    try {
      const response = await fetch(source.url, { signal: AbortSignal.timeout(10_000) });
      if (!response.ok) throw new Error(`Feed HTTP ${response.status}`);
      const items = parseFeedPayload(await response.text(), source);
      if (!items.length) continue;
      const previous = state[source.id];
      const seen = new Set(previous);
      const now = Date.now();
      for (const article of items.reverse()) {
        const key = articleIdentity(article);
        if (seen.has(key)) continue;
        const age = now - Date.parse(article.publishedAt);
        if (previous && age >= 0 && age < maxAge) await send(article);
        seen.add(key);
        state[source.id] = [...seen].slice(-200);
        await persist();
      }
    } catch (error) {
      console.error(source.id, error instanceof Error ? error.message : 'Abruf fehlgeschlagen');
    }
  }
}

while (true) {
  await cycle();
  await new Promise(resolve => setTimeout(resolve, 5 * 60_000));
}
