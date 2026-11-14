import type { AIProviderConfig } from '../types/news';
import { resolveRetention, type Retention } from './preferences';

const day = 86_400_000;
const store = 'results';
type Entry<T = unknown> = { created: number; value: T };
let database: Promise<IDBDatabase> | undefined;
let generation = 0;
const pending = new Map<string, Promise<unknown>>();

function requestIdentity(config: AIProviderConfig, kind: string, articleIds: readonly string[], prompt: string) {
  return JSON.stringify([
    1, kind, articleIds, config.provider, config.model,
    config.provider === 'custom' ? config.customEndpoint : undefined, prompt,
  ]);
}

export function aiCacheKey(config: AIProviderConfig, kind: string, articleIds: readonly string[], prompt: string) {
  return hashIdentity(requestIdentity(config, kind, articleIds, prompt));
}

async function hashIdentity(identity: string) {
  const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(identity));
  return Array.from(new Uint8Array(hash), byte => byte.toString(16).padStart(2, '0')).join('');
}

export function isFreshAIResult(entry: Pick<Entry, 'created'>, retention: Retention, now: number) {
  return entry.created <= now && now - entry.created < Number(retention) * day;
}

function currentRetention() {
  try {
    return resolveRetention(JSON.parse(localStorage.getItem('opennews_preferences') ?? '{}')?.retention);
  } catch {
    return resolveRetention(undefined);
  }
}

function openDatabase() {
  database ??= new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open('opennews-ai', 1);
    request.onupgradeneeded = () => request.result.createObjectStore(store);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  }).catch(error => {
    database = undefined;
    throw error;
  });
  return database;
}

async function mutate(action: (store: IDBObjectStore) => void) {
  const db = await openDatabase();
  return new Promise<void>((resolve, reject) => {
    const transaction = db.transaction(store, 'readwrite');
    transaction.oncomplete = () => resolve();
    transaction.onabort = () => reject(transaction.error);
    action(transaction.objectStore(store));
  });
}

export function pruneAIResults(retention: Retention) {
  return mutate(results => {
    const request = results.openCursor();
    request.onsuccess = () => {
      const cursor = request.result;
      if (!cursor) return;
      if (!isFreshAIResult(cursor.value, retention, Date.now())) cursor.delete();
      cursor.continue();
    };
  });
}

export function clearAIResults() {
  generation++;
  pending.clear();
  return mutate(results => { results.clear(); });
}

async function readResult<T>(key: string) {
  const db = await openDatabase();
  return new Promise<Entry<T> | undefined>((resolve, reject) => {
    const request = db.transaction(store).objectStore(store).get(key);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function withAIResult<T>(
  config: AIProviderConfig, kind: string, articleIds: readonly string[], prompt: string, load: () => Promise<T>,
): Promise<T> {
  const started = generation;
  const identity = requestIdentity(config, kind, articleIds, prompt);
  const existing = pending.get(identity) as Promise<T> | undefined;
  if (existing) return existing;
  const request = (async () => {
    const key = await hashIdentity(identity).catch(() => undefined);
    if (!key || started !== generation) return load();
    const cached = await readResult<T>(key).catch(() => undefined);
    if (cached && started === generation && isFreshAIResult(cached, currentRetention(), Date.now())) return cached.value;
    const value = await load();
    await mutate(results => {
      if (started === generation) results.put({ created: Date.now(), value }, key);
    }).catch(() => undefined);
    return value;
  })();
  pending.set(identity, request);
  try {
    return await request;
  } finally {
    if (pending.get(identity) === request) pending.delete(identity);
  }
}
