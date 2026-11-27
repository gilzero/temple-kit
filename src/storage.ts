// @file: storage.ts
// @desc: retain preferences across temple visits
import type { TempleLogger } from "./logger";

export interface PreferenceStoreOptions {
  /** Namespace for every key, such as `"kaiyuan."`. */
  prefix: string;
  logger: TempleLogger;
}

/** Browser storage that keeps working in memory when the browser refuses it. */
export function createPreferenceStore({
  prefix,
  logger,
}: PreferenceStoreOptions) {
  const fallback = new Map<string, string>();
  const unsaved = new Set<string>();
  const storageKey = (key: string) => prefix + key;
  const area = (session: boolean) => (session ? sessionStorage : localStorage);

  function read(key: string, session = false) {
    const scope = (session ? "session." : "local.") + key;
    if (unsaved.has(scope)) return fallback.get(scope) ?? null;
    try {
      const value = area(session).getItem(storageKey(key));
      if (value === null) fallback.delete(scope);
      else fallback.set(scope, value);
      return value;
    } catch (error) {
      logger.warn("Temple storage unavailable", { error });
      return fallback.get(scope) ?? null;
    }
  }

  function write(key: string, value: string, session = false) {
    const scope = (session ? "session." : "local.") + key;
    fallback.set(scope, value);
    try {
      area(session).setItem(storageKey(key), value);
      unsaved.delete(scope);
    } catch (error) {
      unsaved.add(scope);
      logger.warn("Temple preference retained for this visit", { error });
    }
  }

  function remove(key: string, session = false) {
    const scope = (session ? "session." : "local.") + key;
    fallback.delete(scope);
    unsaved.delete(scope);
    try {
      area(session).removeItem(storageKey(key));
    } catch (error) {
      logger.warn("Temple preference removal unavailable", { error });
    }
  }

  function readCount(key: string) {
    const n = Number(read(key));
    return Number.isSafeInteger(n) && n >= 0 ? n : 0;
  }

  function incrementCount(key: string, delta = 1) {
    const next = readCount(key) + delta;
    write(key, String(next));
    return next;
  }

  return { storageKey, read, write, remove, readCount, incrementCount };
}

export type PreferenceStore = ReturnType<typeof createPreferenceStore>;
