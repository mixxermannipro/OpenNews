import { readFile } from 'node:fs/promises';

const CONCURRENCY = 10;
const TIMEOUT_MS = 8000;
const USER_AGENT = 'OpenNews/1.0 (+https://opennews-app.pages.dev; Feed Health Check)';

async function extractUrls(filePath, pattern) {
  const source = await readFile(filePath, 'utf8');
  const urls = new Set();
  for (const match of source.matchAll(pattern)) {
    if (match[1]?.startsWith('http')) {
      urls.add(match[1]);
    }
  }
  return [...urls];
}

async function checkUrl(entry) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const method = entry.kind === 'radio' ? 'HEAD' : 'GET';
    let res = await fetch(entry.url, {
      method,
      signal: controller.signal,
      redirect: 'follow',
      headers: { 'User-Agent': USER_AGENT },
    });
    if (entry.kind === 'radio' && (res.status === 405 || res.status === 403)) {
      await res.body?.cancel();
      res = await fetch(entry.url, {
        method: 'GET',
        signal: controller.signal,
        redirect: 'follow',
        headers: { 'User-Agent': USER_AGENT, Range: 'bytes=0-1024' },
      });
    }
    await res.body?.cancel();
    return { ...entry, ok: res.ok, status: res.status };
  } catch (err) {
    return {
      ...entry,
      ok: false,
      status: err instanceof Error ? err.name : 'error',
    };
  } finally {
    clearTimeout(timer);
  }
}

async function runPool(items) {
  const results = new Array(items.length);
  let cursor = 0;
  async function worker() {
    while (cursor < items.length) {
      const idx = cursor++;
      results[idx] = await checkUrl(items[idx]);
    }
  }
  await Promise.all(Array.from({ length: CONCURRENCY }, () => worker()));
  return results;
}

const feedUrls = await extractUrls('src/lib/catalog.ts', /'(https:\/\/[^']+)'/g);
const radioUrls = await extractUrls('src/lib/radioCatalog.ts', /streamUrl:\s*'(https:\/\/[^']+)'/g);

const targets = [
  ...feedUrls.map((url) => ({ kind: 'feed', url })),
  ...radioUrls.map((url) => ({ kind: 'radio', url })),
];

const results = await runPool(targets);
const broken = results.filter((r) => !r.ok);

console.log(`Checked ${results.length} URLs (${feedUrls.length} feeds, ${radioUrls.length} radio streams).`);
console.log(`Healthy: ${results.length - broken.length}, Failing: ${broken.length}`);

if (broken.length > 0) {
  console.log('\nFailing URLs:');
  for (const item of broken) {
    console.log(`- [${item.kind}] ${item.url} (${item.status})`);
  }
}

if (process.env.GITHUB_STEP_SUMMARY) {
  const { appendFile } = await import('node:fs/promises');
  const lines = [
    `## Feed & Radio Health Check`,
    `- Checked: **${results.length}** (${feedUrls.length} feeds, ${radioUrls.length} radio streams)`,
    `- Healthy: **${results.length - broken.length}** · Failing: **${broken.length}**`,
    '',
    ...broken.map((b) => `- [${b.kind}] ${b.url} → \`${b.status}\``),
  ];
  await appendFile(process.env.GITHUB_STEP_SUMMARY, `${lines.join('\n')}\n`);
}
