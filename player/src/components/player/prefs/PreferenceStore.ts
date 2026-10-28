'use client';
import type { PreferenceMode } from './modes';
import { DEFAULT_PREFERENCES, migratePreferences, type PlayerPreferences } from './schema';

export interface PreferenceStore {
  get(): PlayerPreferences;
  set(patch: Partial<PlayerPreferences>): PlayerPreferences;
  subscribe(listener: (prefs: PlayerPreferences) => void): () => void;
  readonly mode: PreferenceMode;
  readonly syncEnabled: boolean;
  setSyncEnabled(value: boolean): Promise<void>;
}

export interface CreatePreferenceStoreOptions {
  mode: PreferenceMode;
  namespace?: string;
  storage?: Storage;
  fetchImpl?: typeof fetch;
  endpoint?: string;
  onError?: (error: unknown) => void;
}

export function createPreferenceStore(options: CreatePreferenceStoreOptions): PreferenceStore {
  const { mode, namespace = 'default', storage = typeof localStorage !== 'undefined' ? localStorage : undefined, fetchImpl, endpoint, onError } = options;

  const STORAGE_KEY = `peak:prefs:v1:${namespace}`;
  let memory: PlayerPreferences = { ...DEFAULT_PREFERENCES };
  let warned = false;
  let syncEnabled = mode === 'server' || mode === 'user';
  let subscribers = new Set<(prefs: PlayerPreferences) => void>();

  const warnOnce = (error: unknown) => {
    if (!warned) {
      warned = true;
      onError?.(error);
    }
  };

  const readBrowser = (): PlayerPreferences => {
    if (!storage) return { ...memory };
    try {
      const raw = storage.getItem(STORAGE_KEY);
      return raw ? migratePreferences(JSON.parse(raw)) : { ...memory };
    } catch (e) {
      warnOnce(e);
      return { ...memory };
    }
  };

  const writeBrowser = (prefs: PlayerPreferences) => {
    if (!storage) {
      memory = prefs;
      return;
    }
    try {
      storage.setItem(STORAGE_KEY, JSON.stringify(prefs));
    } catch (e) {
      warnOnce(e);
      memory = prefs;
    }
  };

  const get = (): PlayerPreferences => {
    if (mode === 'browser' || mode === 'user') return readBrowser();
    return { ...memory };
  };

  const persist = (prefs: PlayerPreferences) => {
    memory = prefs;
    if (mode === 'browser' || mode === 'user') writeBrowser(prefs);
  };

  const set = (patch: Partial<PlayerPreferences>): PlayerPreferences => {
    const next = migratePreferences({ ...get(), ...patch });
    persist(next);
    for (const listener of subscribers) listener(next);
    return next;
  };

  const subscribe = (listener: (prefs: PlayerPreferences) => void): (() => void) => {
    subscribers.add(listener);
    return () => {
      subscribers.delete(listener);
    };
  };

  const loadServer = async (): Promise<PlayerPreferences> => {
    if (!endpoint || !fetchImpl) return { ...memory };
    try {
      const res = await fetchImpl(endpoint, { credentials: 'include' });
      if (!res.ok) return { ...memory };
      const data = (await res.json()) as { success?: boolean; preferences?: unknown };
      if (data.success && data.preferences) return migratePreferences(data.preferences);
      return { ...memory };
    } catch (e) {
      warnOnce(e);
      return { ...memory };
    }
  };

  const setSyncEnabled = async (value: boolean): Promise<void> => {
    syncEnabled = value;
    if (value && mode === 'user') {
      const server = await loadServer();
      persist(migratePreferences({ ...server, ...get() }));
    }
  };

  if (mode === 'browser' || mode === 'user') memory = readBrowser();

  return {
    get,
    set,
    subscribe,
    mode,
    syncEnabled,
    setSyncEnabled,
  };
}
