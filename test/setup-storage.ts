// test/setup-storage.ts — in-memory Web Storage for the test environment.
//
// Why this exists: Node 22+ ships its own `globalThis.localStorage`, which is
// `undefined` unless the process is started with `--localstorage-file`. vitest's
// jsdom environment only copies a window key onto the global when that key is
// absent from the Node global (or on its own allow-list), and `localStorage` is
// on neither — so jsdom's working implementation is skipped and code under test
// sees `undefined`. Real browsers and Electron are unaffected; this shim only
// restores the browser contract for tests.
class MemoryStorage implements Storage {
  private map = new Map<string, string>();

  get length(): number { return this.map.size; }
  key(i: number): string | null { return [...this.map.keys()][i] ?? null; }
  getItem(k: string): string | null { return this.map.has(k) ? this.map.get(k)! : null; }
  setItem(k: string, v: string): void { this.map.set(String(k), String(v)); }
  removeItem(k: string): void { this.map.delete(k); }
  clear(): void { this.map.clear(); }
  [name: string]: unknown;
}

for (const key of ['localStorage', 'sessionStorage'] as const) {
  if (typeof (globalThis as Record<string, unknown>)[key] === 'undefined') {
    Object.defineProperty(globalThis, key, {
      value: new MemoryStorage(),
      configurable: true,
      writable: true,
    });
  }
}
