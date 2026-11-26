import { useCallback, useEffect, useRef, useState } from 'react';

type Update<T> = T | ((previous: T) => T);
const storeName = 'articles';
let database: Promise<IDBDatabase> | undefined;

function openDatabase() {
  if (typeof indexedDB === 'undefined') {
    return Promise.reject(new Error('IndexedDB unavailable'));
  }
  database ??= new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open('opennews', 1);
    request.onupgradeneeded = () => request.result.createObjectStore(storeName);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  }).catch(error => {
    database = undefined;
    throw error;
  });
  return database;
}

async function read<T>(key: string) {
  const db = await openDatabase();
  return new Promise<T | undefined>((resolve, reject) => {
    const request = db.transaction(storeName).objectStore(storeName).get(key);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function write<T>(key: string, value: T) {
  const db = await openDatabase();
  return new Promise<void>((resolve, reject) => {
    const transaction = db.transaction(storeName, 'readwrite');
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () => reject(transaction.error);
    transaction.objectStore(storeName).put(value, key);
  });
}

function apply<T>(previous: T, update: Update<T>): T {
  return typeof update === 'function' ? (update as (previous: T) => T)(previous) : update;
}

export function useArticleStorage<T>(key: string, initialValue: T) {
  const initial = useRef(initialValue);
  const pending = useRef<Update<T>[]>([]);
  const loaded = useRef(false);
  const [snapshot, setSnapshot] = useState(() => ({ value: initial.current, ready: false }));
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const initialize = async () => {
      let value = initial.current;
      let ready = false;
      try {
        const stored = await read<T>(key);
        if (stored !== undefined) value = stored;
        else {
          const legacy = localStorage.getItem(key);
          if (legacy !== null) value = JSON.parse(legacy) as T;
        }
        ready = true;
      } catch {
        try {
          const legacy = localStorage.getItem(key);
          if (legacy !== null) value = JSON.parse(legacy) as T;
        } catch {
          // Keep the original value on disk for recovery.
        }
        if (!cancelled) setFailed(true);
      }
      if (cancelled) return;
      loaded.current = true;
      for (const update of pending.current.splice(0)) value = apply(value, update);
      setSnapshot({ value, ready });
    };
    void initialize();
    return () => { cancelled = true; };
  }, [key]);

  const dirtyRef = useRef(false);
  const latestValueRef = useRef<T>(snapshot.value);
  latestValueRef.current = snapshot.value;

  useEffect(() => {
    if (!snapshot.ready) return;
    let cancelled = false;
    dirtyRef.current = true;

    const persist = () => {
      if (!dirtyRef.current) return;
      dirtyRef.current = false;
      void write(key, latestValueRef.current).then(() => {
        if (cancelled) return;
        try {
          localStorage.removeItem(key);
        } catch {
          // Ignore storage restrictions
        }
        setFailed(false);
      }).catch(() => {
        if (!cancelled) setFailed(true);
      });
    };

    const timer = window.setTimeout(persist, 350);
    const flushOnHide = () => {
      if (document.visibilityState === 'hidden') persist();
    };
    window.addEventListener('pagehide', persist);
    document.addEventListener('visibilitychange', flushOnHide);

    return () => {
      if (dirtyRef.current) persist();
      cancelled = true;
      window.clearTimeout(timer);
      window.removeEventListener('pagehide', persist);
      document.removeEventListener('visibilitychange', flushOnHide);
    };
  }, [key, snapshot]);

  const update = useCallback((next: Update<T>) => {
    if (!loaded.current) {
      pending.current.push(next);
      return;
    }
    setSnapshot(previous => {
      const value = apply(previous.value, next);
      return Object.is(value, previous.value) ? previous : { ...previous, value };
    });
  }, []);

  return [snapshot.value, update, failed, loaded.current] as const;
}
