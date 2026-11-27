// @file: browser-storage.ts
// @desc: stand-in web storage for tests
export function memoryStorage(entries = new Map<string, string>()) {
  return {
    entries,
    getItem: (key: string) => entries.get(key) ?? null,
    setItem: (key: string, value: string) => void entries.set(key, value),
    removeItem: (key: string) => void entries.delete(key),
  };
}

/** Replace browser globals for one test body, then restore them. */
export function withGlobals(values: Record<string, unknown>, body: () => void) {
  const originals = Object.keys(values).map(
    (name) =>
      [name, Object.getOwnPropertyDescriptor(globalThis, name)] as const,
  );
  for (const [name, value] of Object.entries(values))
    Object.defineProperty(globalThis, name, { configurable: true, value });
  try {
    body();
  } finally {
    for (const [name, original] of originals) {
      if (original) Object.defineProperty(globalThis, name, original);
      else Reflect.deleteProperty(globalThis, name);
    }
  }
}
