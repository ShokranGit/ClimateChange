import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';

// The container pins its own Chromium under PLAYWRIGHT_BROWSERS_PATH and blocks
// the postinstall download, so resolve the binary rather than assuming it.
function chromePath() {
  if (process.env.CHROME_PATH) return process.env.CHROME_PATH;
  const root = process.env.PLAYWRIGHT_BROWSERS_PATH || '/opt/pw-browsers';
  if (fs.existsSync(root)) {
    const dir = fs.readdirSync(root).filter(d => /^chromium-/.test(d)).sort().pop();
    if (dir) {
      const p = path.join(root, dir, 'chrome-linux', 'chrome');
      if (fs.existsSync(p)) return p;
    }
  }
  return undefined;   // let Playwright find its own
}

// Everything off-origin is stubbed: the sandbox cannot reach the basemap CDN or
// any publisher, and a test that silently depends on the network is a test that
// will fail on a train.
const PORT = 8124;
let srv, browser, page;
const errors = [];

const BLANK_STYLE = {
  version: 8, name: 'blank', sources: {}, layers: [
    { id: 'bg', type: 'background', paint: { 'background-color': '#0d1b2a' } }
  ], glyphs: 'http://127.0.0.1/{fontstack}/{range}.pbf'
};

const stubFC = n => ({
  type: 'FeatureCollection',
  features: Array.from({ length: n }, (_, i) => ({
    type: 'Feature',
    properties: { hurricane_: String((i % 6) + 1), name: `stub ${i}` },
    geometry: { type: 'Polygon', coordinates: [[
      [-74 + i * 0.01, 40.7], [-73.99 + i * 0.01, 40.7],
      [-73.99 + i * 0.01, 40.71], [-74 + i * 0.01, 40.71], [-74 + i * 0.01, 40.7]]] }
  }))
});

before(async () => {
  srv = spawn('node', ['scripts/serve.mjs'], { env: { ...process.env, PORT: String(PORT) } });
  await new Promise(r => setTimeout(r, 700));
  browser = await chromium.launch({ executablePath: chromePath(), args: ['--no-sandbox'] });
  page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  page.on('pageerror', e => errors.push(String(e)));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });

  // The pinned CDN libraries are served from the local npm copies —
  // `npm run vendor` puts them there. A test that reaches jsDelivr is a test
  // that fails on a train.
  await page.route(/cdn\.jsdelivr\.net/, r => {
    const name = {
      'maplibre-gl.js': 'maplibre-gl-5.24.0.js', 'maplibre-gl.css': 'maplibre-gl-5.24.0.css',
      'pmtiles.js': 'pmtiles-4.5.0.js', 'supabase.js': 'supabase-js-2.112.3.js'
    }[r.request().url().split('/').pop()];
    const file = `public/vendor/${name}`;
    if (!name || !fs.existsSync(file)) return r.fulfill({ status: 404, body: 'missing vendor file' });
    r.fulfill({ status: 200,
      contentType: name.endsWith('.css') ? 'text/css' : 'text/javascript',
      body: fs.readFileSync(file, 'utf8') });
  });

  await page.route(/basemaps\.cartocdn\.com/, r =>
    r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(BLANK_STYLE) }));
  await page.route(/services\d*\.arcgis\.com|encdirect\.noaa\.gov|data\.cityofnewyork\.us|data\.ny\.gov/, r =>
    r.fulfill({ status: 200, contentType: 'application/geo+json', body: JSON.stringify(stubFC(6)) }));

  await page.goto(`http://127.0.0.1:${PORT}/`, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => window.__registry != null, null, { timeout: 15000 });
});

after(async () => { await browser?.close(); srv?.kill(); });

test('the map initialises', async () => {
  assert.equal(await page.evaluate(() => !!window.__map?.loaded()), true);
});

test('the panel lists every registered layer', async () => {
  const registered = await page.evaluate(() => window.__registry.layers.length);
  const rows = await page.locator('#layer-groups .layer').count();
  assert.equal(rows, registered, `panel shows ${rows} of ${registered} layers`);
  assert.ok(registered >= 25, `only ${registered} layers registered`);
});

test('groups render with their blurbs', async () => {
  const groups = await page.locator('#layer-groups .group').count();
  assert.ok(groups >= 8, `only ${groups} groups rendered`);
});

test('toggling a layer actually adds layers to the style', async () => {
  await page.evaluate(async () => {
    const L = window.__registry.byId.get('evac-zones');
    await window.__lm.add(L);
  });
  const drawn = await page.evaluate(() =>
    window.__map.getStyle().layers.filter(l => l.id.startsWith('evac-zones:')).map(l => l.id));
  assert.deepEqual(drawn.sort(), ['evac-zones:fill', 'evac-zones:line'],
    'a polygon layer must produce both a fill and an outline');
});

test('a toggled-on layer really carries features', async () => {
  const n = await page.evaluate(async () => {
    const s = window.__map.getSource('src:evac-zones');
    const d = await s.getData?.();
    return d?.features?.length ?? null;
  });
  assert.ok(n === null || n > 0, 'source loaded but empty — silence is not success');
});

test('removing a layer cleans up both the layers and the source', async () => {
  await page.evaluate(() => window.__lm.remove('evac-zones'));
  const left = await page.evaluate(() => ({
    layers: window.__map.getStyle().layers.filter(l => l.id.startsWith('evac-zones:')).length,
    source: !!window.__map.getSource('src:evac-zones')
  }));
  assert.equal(left.layers, 0);
  assert.equal(left.source, false);
});

test('search filters the panel', async () => {
  await page.fill('#layer-search', 'fema');
  await page.waitForTimeout(120);
  const n = await page.locator('#layer-groups .layer').count();
  assert.ok(n >= 2 && n < 10, `"fema" matched ${n} layers`);
  await page.fill('#layer-search', '');
  await page.waitForTimeout(120);
});

test('the scenario chooser appears only when a scenario layer is on', async () => {
  // The Scenarios tab is closed, so ask the element, not the renderer.
  const hidden = () => page.evaluate(() => document.querySelector('#scenario-empty').hidden);
  assert.equal(await hidden(), false, 'the empty-state note should show before any scenario layer is on');
  await page.evaluate(async () =>
    window.__lm.add(window.__registry.byId.get('nyserda-slr')));
  await page.waitForTimeout(200);
  const sliders = await page.locator('#scenario-controls input[type=range]').count();
  assert.equal(sliders, 2, 'NYSERDA needs a sea-level axis and an annual-chance axis');
  assert.equal(await hidden(), true, 'the empty-state note should retire once a scenario layer is on');
});

test('no page errors and no silent MapLibre layer failures', async () => {
  const mapErrors = await page.evaluate(() => window.__lm.errors);
  const real = errors.filter(e => !/favicon|manifest|Failed to load resource.*404/i.test(e));
  assert.deepEqual(real, [], `page errors: ${real.join(' | ')}`);
  assert.deepEqual(mapErrors, [], `maplibre errors: ${mapErrors.join(' | ')}`);
});
