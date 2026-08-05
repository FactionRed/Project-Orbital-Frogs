#!/usr/bin/env node
// tools/preview-parts.mjs
//
// Renders the voxel part models to PNGs so model changes can be reviewed by
// looking at them instead of by reading the code. Writes:
//
//   preview/parts.png  — every catalog part, three-quarter view
//   preview/stack.png  — an assembled two-stage rocket, for checking joins
//
//   npm run preview:parts
//
// The models are the one part of this codebase with no meaningful automated
// check on the result: the tests can assert a part fits its collision box and
// scales uniformly, but not that it looks like an engine. This closes that gap
// cheaply — the winglet spent a release as a flat sliver because nobody had a
// reason to look at it in isolation.
//
// Needs a Chromium to render into. It looks for one in this order:
//   1. $CHROME_PATH
//   2. Playwright's own download (whatever playwright-core resolves)
//   3. $PLAYWRIGHT_BROWSERS_PATH
//   4. the usual system locations
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..');
const OUT = path.join(ROOT, 'preview');

const SYSTEM_CHROMIUM = [
  '/usr/bin/chromium',
  '/usr/bin/chromium-browser',
  '/usr/bin/google-chrome',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
];

/** Look inside a Playwright browsers directory for a chromium build. */
function findInBrowsersDir(dir) {
  if (!dir || !existsSync(dir)) return null;
  const candidates = readdirSync(dir)
    .filter((n) => n.startsWith('chromium') && !n.includes('headless_shell'))
    .sort()
    .reverse();
  for (const name of candidates)
    for (const rel of ['chrome-linux/chrome', 'chrome-mac/Chromium.app/Contents/MacOS/Chromium', 'chrome-win/chrome.exe']) {
      const full = path.join(dir, name, rel);
      if (existsSync(full)) return full;
    }
  return null;
}

async function findChromium(chromium) {
  if (process.env.CHROME_PATH && existsSync(process.env.CHROME_PATH)) return process.env.CHROME_PATH;
  try {
    const p = chromium.executablePath();
    if (p && existsSync(p)) return p;
  } catch {
    // playwright-core has no browsers of its own unless one was downloaded.
  }
  const fromEnv = findInBrowsersDir(process.env.PLAYWRIGHT_BROWSERS_PATH);
  if (fromEnv) return fromEnv;
  return SYSTEM_CHROMIUM.find((p) => existsSync(p)) ?? null;
}

async function main() {
  let chromium;
  try {
    ({ chromium } = await import('playwright-core'));
  } catch {
    console.error('preview-parts: playwright-core is not installed.\n  npm install');
    process.exit(1);
  }

  const executablePath = await findChromium(chromium);
  if (!executablePath) {
    console.error(
      'preview-parts: no Chromium found.\n' +
      '  Point CHROME_PATH at a Chrome or Chromium binary, or install one:\n' +
      '    npx playwright install chromium',
    );
    process.exit(1);
  }

  mkdirSync(OUT, { recursive: true });

  // Bundle the browser half. esbuild ships with Vite, so this needs no extra
  // dependency; it also means the preview runs the real source, not a copy.
  const bundlePath = path.join(OUT, 'bundle.js');
  execFileSync(path.join(ROOT, 'node_modules/.bin/esbuild'), [
    path.join(HERE, 'preview-parts.entry.ts'),
    '--bundle', '--format=iife', `--outfile=${bundlePath}`, '--log-level=warning',
  ], { cwd: ROOT, stdio: 'inherit' });
  const bundle = readFileSync(bundlePath, 'utf8');

  const browser = await chromium.launch({
    executablePath,
    // SwiftShader: these run on CI and in containers with no GPU.
    args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'],
  });

  try {
    for (const [mode, file] of [['parts', 'parts.png'], ['stack', 'stack.png']]) {
      const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
      page.on('pageerror', (e) => console.error('page error:', e.message));
      await page.setContent(
        `<body style="margin:0;background:#1a1d24"><canvas id="c"></canvas>` +
        `<script>window.__PREVIEW_MODE=${JSON.stringify(mode)}</script>` +
        `<script>${bundle}</script></body>`,
        { waitUntil: 'load' },
      );
      await page.waitForFunction('window.__done === true', { timeout: 60000 });

      if (mode === 'parts') {
        const stats = await page.evaluate('window.__stats');
        const total = stats.reduce((a, s) => a + s.tris, 0);
        console.log(stats.map((s) => `${s.id} ${s.tris}`).join('  '), `| ${total} tris total`);
      }
      await page.locator('#c').screenshot({ path: path.join(OUT, file) });
      await page.close();
      console.log(`wrote preview/${file}`);
    }
  } finally {
    await browser.close();
  }
}

main().catch((e) => {
  console.error('preview-parts failed:', e.message);
  process.exit(1);
});
