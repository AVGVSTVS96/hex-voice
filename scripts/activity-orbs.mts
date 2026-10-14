import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { chromium } from 'playwright-core';

import { ACTIVITY_ORBS, type ActivityOrb } from '../src/live/activity-orb';

const ROOT = join(import.meta.dirname, '..');
const OUT = join(ROOT, 'assets', 'live-activity', 'Orbs.xcassets');
const RIVE = dirname(createRequire(import.meta.url).resolve('@rive-app/webgl2'));
const CANVAS = 400;
const SIZE = 144;
// The idle orb at this moment matches the still the app shows before a call starts.
const SETTLE_MS = 1000;

const files: Record<string, [string, string]> = {
  '/rive.js': [join(RIVE, 'rive.js'), 'text/javascript'],
  '/rive.wasm': [join(RIVE, 'rive.wasm'), 'application/wasm'],
  '/page.js': [join(import.meta.dirname, 'activity-orbs.page.js'), 'text/javascript'],
};

const page = `<body style="margin:0;background:transparent">
<canvas id="orb" width="${CANVAS}" height="${CANVAS}"></canvas><script src="/rive.js"></script><script src="/page.js"></script>`;

async function render(
  browser: import('playwright-core').Browser,
  orb: ActivityOrb,
  color = orb.color,
) {
  const tab = await browser.newPage({ viewport: { width: CANVAS, height: CANVAS } });
  await tab.route('http://orbs.local/**', (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path === '/') return route.fulfill({ contentType: 'text/html', body: page });
    if (path === '/orb.riv')
      return route.fulfill({
        body: readFileSync(join(ROOT, 'src/components/persona/assets', `${orb.variant}.riv`)),
      });
    const [file, contentType] = files[path];
    return route.fulfill({ contentType, body: readFileSync(file) });
  });
  await tab.goto('http://orbs.local/');
  await tab.evaluate((orb) => (window as any).loadOrb(orb), { color, palette: orb.palette });
  await tab.waitForTimeout(SETTLE_MS);
  const shot = await tab.locator('#orb').screenshot({ omitBackground: true });
  const png: string = await tab.evaluate((args) => (window as any).cropOrb(args), {
    shot: shot.toString('base64'),
    size: SIZE,
  });
  await tab.close();
  return Buffer.from(png, 'base64');
}

const info = { author: 'xcode', version: 1 };
rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });
writeFileSync(join(OUT, 'Contents.json'), JSON.stringify({ info }, null, 2) + '\n');

const browser = await chromium.launch({
  args: ['--use-angle=swiftshader', '--ignore-gpu-blocklist'],
});
for (const orb of ACTIVITY_ORBS) {
  const set = join(OUT, `${orb.name}.imageset`);
  mkdirSync(set);
  const images: object[] = [{ filename: 'orb.png', idiom: 'universal' }];
  writeFileSync(join(set, 'orb.png'), await render(browser, orb));
  if (orb.light) {
    writeFileSync(join(set, 'orb-light.png'), await render(browser, orb, orb.light));
    images.push({
      filename: 'orb-light.png',
      idiom: 'universal',
      appearances: [{ appearance: 'luminosity', value: 'light' }],
    });
  }
  writeFileSync(join(set, 'Contents.json'), JSON.stringify({ images, info }, null, 2) + '\n');
  console.log(orb.name);
}
await browser.close();
