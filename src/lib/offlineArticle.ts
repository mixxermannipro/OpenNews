type OfflineArticle = { paragraphs: string[]; headingIndexes: number[]; image?: Blob };
const CACHE = 'opennews-offline-reader-v1';
const MAX_ARTICLES = 30;

function cacheKey(link: string) {
  const url = new URL('/opennews-offline-reader', location.origin);
  url.searchParams.set('article', link);
  return url.href;
}

export async function readOfflineArticle(link: string): Promise<OfflineArticle | undefined> {
  const cache = await caches.open(CACHE);
  const response = await cache.match(cacheKey(link));
  if (!response) return undefined;
  const data = await response.formData();
  const image = data.get('image');
  const text = JSON.parse(String(data.get('text'))) as Pick<OfflineArticle, 'paragraphs' | 'headingIndexes'>;
  return { ...text, image: image instanceof Blob ? image : undefined };
}

export async function storeOfflineArticle(link: string, paragraphs: string[], headingIndexes: number[], imageUrl?: string) {
  const data = new FormData();
  data.set('text', JSON.stringify({ paragraphs, headingIndexes }));
  if (imageUrl) {
    try {
      const resolvedImageUrl = new URL(imageUrl, location.origin);
      if (resolvedImageUrl.origin === location.origin) {
        const response = await fetch(resolvedImageUrl.href, { signal: AbortSignal.timeout(4000), credentials: 'omit' });
        if (response.ok && /^image\/(jpeg|png|webp|gif|avif)(;|$)/i.test(response.headers.get('content-type') ?? '')) {
          const image = await response.blob();
          if (image.size <= 2 * 1024 * 1024) data.set('image', image);
        }
      }
    } catch {
      // Non-fatal: the article text stays readable offline even without an image.
    }
  }
  const cache = await caches.open(CACHE);
  await cache.put(cacheKey(link), new Response(data));
  const keys = await cache.keys();
  await Promise.all(keys.slice(0, Math.max(0, keys.length - MAX_ARTICLES)).map(key => cache.delete(key)));
  return data.has('image');
}

export async function removeOfflineArticle(link: string) {
  const cache = await caches.open(CACHE);
  await cache.delete(cacheKey(link));
}
