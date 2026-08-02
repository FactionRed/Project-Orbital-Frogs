/// <reference types="vitest" />
import { defineConfig } from 'vite';
import electron from 'vite-plugin-electron/simple';
import { createRequire } from 'node:module';

// Version stencil on the title screen. Read from package.json so the displayed
// release can't drift from the published one.
const { version } = createRequire(import.meta.url)('./package.json') as { version: string };

// Skip the Electron plugin when running tests — it alters module resolution in
// ways that break vitest's worker, and tests don't touch the main process anyway.
const isTest = process.env.NODE_ENV === 'test' || !!process.env.VITEST;

export default defineConfig({
  plugins: isTest
    ? []
    : [
        electron({
          main: {
            entry: 'electron/main.ts',
            vite: {
              build: {
                outDir: 'dist-electron',
                rollupOptions: {
                  external: ['electron'],
                },
              },
            },
          },
          preload: {
            input: 'electron/preload.ts',
            vite: {
              build: {
                outDir: 'dist-electron',
                rollupOptions: {
                  external: ['electron'],
                },
              },
            },
          },
          // Don't spawn Electron when building the renderer alone.
          // renderer: undefined — the game uses zero renderer-side Electron
          // APIs, so we omit the key entirely. Passing `renderer: {}` is
          // truthy and triggers vite-plugin-electron-renderer, which crashes
          // the dev server on Windows (illegal '?' in cache filenames).
        }),
      ],
  define: {
    __BUILD_SHA__: JSON.stringify(process.env.GITHUB_SHA?.slice(0, 7) ?? 'dev'),
    __APP_VERSION__: JSON.stringify(version),
  },
  server: { open: false }, // Electron opens its own window; avoid the browser tab too
  test: {
    globals: true,
    environment: 'node',
    // DOM-dependent suites opt in per-file with `// @vitest-environment jsdom`.
    // setup-storage patches the localStorage gap described in that file.
    setupFiles: ['./test/setup-storage.ts'],
  },
});
