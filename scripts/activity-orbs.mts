import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { chromium } from 'playwright-core';
import type { Browser } from 'playwright-core';

import { ACTIVITY_ORBS } from '../src/live/activity-orb';
import type { ActivityOrb } from '../src/live/activity-orb';

const ROOT = path.join(import.meta.dirname, '..');
const OUT = path.join(ROOT, 'assets', 'live-activity', 'Orbs.xcassets');
const RIVE = path.dirname(createRequire(import.meta.url).resolve('@rive-app/webgl2'));
const CANVAS = 400;
const SIZE = 144;

const PRECALL_STILL_AT_MS = 1000;

const files = new Map([
  ['/rive.js', { file: path.join(RIVE, 'rive.js'), contentType: 'text/javascript' }],
  ['/rive.wasm', { file: path.join(RIVE, 'rive.wasm'), contentType: 'application/wasm' }],
  [
    '/page.js',
    {
      file: path.join(import.meta.dirname, 'activity-orbs.page.js'),
      contentType: 'text/javascript',
    },
  ],
]);

declare global {
  interface Window {
    loadOrb: (look: { color?: string; palette?: number }) => Promise<void>;
    cropOrb: (shot: { shot: string; size: number }) => Promise<string>;
  }
}

const page = `<body style="margin:0;background:transparent">
<canvas id="orb" width="${CANVAS}" height="${CANVAS}"></canvas><script src="/rive.js"></script><script src="/page.js"></script>`;

const render = async (browser: Browser, orb: ActivityOrb, color = orb.color) => {
  const tab = await browser.newPage({ viewport: { width: CANVAS, height: CANVAS } });
  await tab.route('http://orbs.local/**', async (route) => {
    const { pathname } = new URL(route.request().url());

    if (pathname === '/') {
      await route.fulfill({ contentType: 'text/html', body: page });

      return;
    }

    if (pathname === '/orb.riv') {
      await route.fulfill({
        body: readFileSync(path.join(ROOT, 'src/components/persona/assets', `${orb.variant}.riv`)),
      });

      return;
    }

    const served = files.get(pathname);

    if (served === undefined) {
      throw new Error(`the orb page asked for ${pathname}`);
    }

    await route.fulfill({ contentType: served.contentType, body: readFileSync(served.file) });
  });
  await tab.goto('http://orbs.local/');
  await tab.evaluate(
    async (look) => {
      await window.loadOrb(look);
    },
    { color, palette: orb.palette },
  );
  await tab.waitForTimeout(PRECALL_STILL_AT_MS);
  const shot = await tab.locator('#orb').screenshot({ omitBackground: true });

  const png = await tab.evaluate(async (args) => await window.cropOrb(args), {
    shot: shot.toString('base64'),
    size: SIZE,
  });

  await tab.close();

  return Buffer.from(png, 'base64');
};

const info = { author: 'xcode', version: 1 };

rmSync(OUT, { recursive: true, force: true });

mkdirSync(OUT, { recursive: true });

writeFileSync(path.join(OUT, 'Contents.json'), `${JSON.stringify({ info }, null, 2)}\n`);

const browser = await chromium.launch({
  args: ['--use-angle=swiftshader', '--ignore-gpu-blocklist'],
});

const writeImageSet = async (orb: ActivityOrb) => {
  const set = path.join(OUT, `${orb.name}.imageset`);
  mkdirSync(set);
  const images: object[] = [{ filename: 'orb.png', idiom: 'universal' }];
  writeFileSync(path.join(set, 'orb.png'), await render(browser, orb));

  if (orb.light !== undefined) {
    writeFileSync(path.join(set, 'orb-light.png'), await render(browser, orb, orb.light));
    images.push({
      filename: 'orb-light.png',
      idiom: 'universal',
      appearances: [{ appearance: 'luminosity', value: 'light' }],
    });
  }

  writeFileSync(path.join(set, 'Contents.json'), `${JSON.stringify({ images, info }, null, 2)}\n`);
  console.log(orb.name);
};

for (const orb of ACTIVITY_ORBS) {
  // oxlint-disable-next-line no-await-in-loop -- one tab at a time: PRECALL_STILL_AT_MS is wall-clock time, and tabs rendering at once in one software-GL browser would slow each other's frames
  await writeImageSet(orb);
}

await browser.close();
