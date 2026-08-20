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

  // The elevation readout asks the USGS Elevation Point Query Service. Answer
  // it here so the assertion below is about our arithmetic, not the network.
  await page.route(/epqs\.nationalmap\.gov/, r =>
    r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ value: 12.5 }) }));

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

// Regression: the first deploy built the whole UI inside map.on('load'), which
// MapLibre only fires after its first render. A tab opened in the background
// gets no animation frames, so the panel stayed empty until the tab was focused.
test('the layer panel builds even when the map style never loads', async () => {
  const p2 = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  await p2.route(/cdn\.jsdelivr\.net/, r => {
    const name = {
      'maplibre-gl.js': 'maplibre-gl-5.24.0.js', 'maplibre-gl.css': 'maplibre-gl-5.24.0.css',
      'pmtiles.js': 'pmtiles-4.5.0.js', 'supabase.js': 'supabase-js-2.112.3.js'
    }[r.request().url().split('/').pop()];
    r.fulfill({ status: 200,
      contentType: name.endsWith('.css') ? 'text/css' : 'text/javascript',
      body: fs.readFileSync(`public/vendor/${name}`, 'utf8') });
  });
  // Never answer the basemap request at all — the map can never finish loading.
  await p2.route(/basemaps\.cartocdn\.com/, () => {});
  await p2.goto(`http://127.0.0.1:${PORT}/`);
  await p2.waitForFunction(() => document.querySelectorAll('#layer-groups .layer').length > 0,
    null, { timeout: 15000 });
  const state = await p2.evaluate(() => ({
    rows: document.querySelectorAll('#layer-groups .layer').length,
    mapLoaded: window.__map.loaded()
  }));
  assert.ok(state.rows >= 25, `panel showed ${state.rows} layers`);
  assert.equal(state.mapLoaded, false, 'the map should still be unloaded — that is the point');
  await p2.close();
});

test('the whole survey is listed, not only the drawable part', async () => {
  const n = await page.evaluate(() => ({
    registered: window.__registry.layers.length,
    rows: document.querySelectorAll('#layer-groups .layer').length,
    drawable: window.__registry.drawable.length,
    absent: window.__registry.layers.filter(l => l.status === 'absent').length,
    gated: window.__registry.layers.filter(l => l.status === 'gated').length
  }));
  assert.ok(n.registered >= 90, `only ${n.registered} entries`);
  assert.equal(n.rows, n.registered, 'every entry should have a row');
  assert.ok(n.absent >= 8, 'the confirmed absences must be visible');
  assert.ok(n.gated >= 6, 'the DEC layers must be named even though they are held back');
});

test('an entry that cannot be drawn offers no checkbox', async () => {
  const bad = await page.evaluate(() =>
    [...document.querySelectorAll('#layer-groups .layer.off input[type=checkbox]')].length);
  assert.equal(bad, 0, 'pending, gated and absent rows must not be toggleable');
  const off = await page.locator('#layer-groups .layer.off').count();
  assert.ok(off >= 40, `only ${off} non-drawable rows rendered`);
});

test('the scope and status chips filter the list', async () => {
  const click = t => page.evaluate(txt => {
    [...document.querySelectorAll('.chip')].find(c => c.textContent === txt)?.click();
  }, t);
  const rows = () => page.locator('#layer-groups .layer').count();
  const all = await rows();
  await click('Ready now'); await page.waitForTimeout(150);
  const ready = await rows();
  assert.ok(ready > 0 && ready < all, `"Ready now" showed ${ready} of ${all}`);
  await click('Absences'); await page.waitForTimeout(150);
  assert.ok(await rows() >= 8, 'the absences filter should show the absences');
  await click('Everything'); await page.waitForTimeout(150);
  assert.equal(await rows(), all, 'clearing the filter should restore every row');
});

test('layers.add refuses an entry that is not drawable', async () => {
  const before = await page.evaluate(() => window.__map.getStyle().layers.length);
  await page.evaluate(async () => {
    const L = window.__registry.layers.find(l => l.status === 'absent');
    await window.__lm.add(L);
  });
  const after = await page.evaluate(() => window.__map.getStyle().layers.length);
  assert.equal(after, before, 'an absent entry must never reach the style');
});

test('the coordinate bar reads out, converts and pins', async () => {
  const read = () => page.evaluate(() => ({
    lat: document.querySelectorAll('#coordbar .v')[0].textContent,
    lon: document.querySelectorAll('#coordbar .v')[1].textContent,
    alt: document.querySelectorAll('#coordbar .v')[2].textContent
  }));
  await page.waitForFunction(() =>
    document.querySelectorAll('#coordbar .v')[2].textContent !== '—', null, { timeout: 8000 });
  const dd = await read();
  assert.match(dd.lat, /^\d+\.\d{5}$/, `latitude read "${dd.lat}"`);
  assert.equal(dd.alt, '12.5 m', 'elevation should arrive in metres from EPQS');

  // Feet and metres must describe the same height, not two different numbers.
  await page.evaluate(() => [...document.querySelectorAll('.unit')].find(u => u.textContent === 'ft').click());
  await page.waitForTimeout(120);
  const ft = (await read()).alt;
  assert.match(ft, /ft$/, `expected feet, got "${ft}"`);
  assert.ok(Math.abs(parseFloat(ft) - 12.5 / 0.3048) < 0.1, `${ft} is not 12.5 m`);

  await page.evaluate(() => [...document.querySelectorAll('#coordbar button')]
    .find(b => /D° M′ S″|LAT, LON/.test(b.textContent))?.click());
  await page.waitForTimeout(120);
  assert.match((await read()).lat, /°.*[NS]$/, 'the format toggle should give degrees–minutes–seconds');
});

test('the scale bar rounds to a number a person can reckon with', async () => {
  const label = () => page.locator('#scale .scale-end.r').textContent();
  const px = () => page.evaluate(() => parseFloat(getComputedStyle(document.querySelector('.scale-bar')).width));
  const nice = t => {
    const n = parseFloat(t.replace(/,/g, ''));
    const lead = Number(String(n).replace('.', '').replace(/0+$/, '')[0] || '0');
    return [1, 2, 5].includes(lead) && Number.isInteger(n);
  };
  const first = await label();
  assert.match(first, /^[\d,]+ (m|km|ft|mi)$/, `scale read "${first}"`);
  assert.ok(nice(first), `metric scale "${first}" is not a whole 1, 2 or 5 step`);

  // The imperial ladder is the one that goes wrong: round feet, divide by
  // 5,280, and you get 3.8 mi.
  await page.evaluate(() => [...document.querySelectorAll('.unit')].find(u => u.textContent === 'ft').click());
  await page.waitForTimeout(150);
  const imp = await label();
  assert.match(imp, /^[\d,]+ (ft|mi)$/, `imperial scale read "${imp}"`);
  assert.ok(nice(imp), `imperial scale "${imp}" is not a whole 1, 2 or 5 step`);
  await page.evaluate(() => [...document.querySelectorAll('.unit')].find(u => u.textContent === 'm').click());
  await page.waitForTimeout(150);

  const w = await px();
  assert.ok(w > 20 && w < 200, `scale bar is ${w}px wide`);
});

test('the north arrow turns with the map and resets it', async () => {
  await page.evaluate(() => window.__map.setBearing(45));
  await page.waitForTimeout(150);
  const turned = await page.evaluate(() => ({
    cls: document.querySelector('.north-btn').className,
    t: document.querySelector('.north-btn .needle').style.transform
  }));
  assert.match(turned.t, /rotate\(-45deg\)/, 'the needle should hold north while the map turns');
  assert.match(turned.cls, /turned/);
  await page.evaluate(() => document.querySelector('.north-btn').click());
  await page.waitForTimeout(600);
  assert.equal(Math.round(await page.evaluate(() => window.__map.getBearing())), 0);
});

test('switching the base map keeps the layers that were switched on', async () => {
  // setStyle throws away every source and layer. If the picker does not put
  // them back, the basemap works and all the data silently vanishes.
  // Two layers of different geometries: the manager inserts polygons *before*
  // the first point layer, so restoring them after setStyle used to reference a
  // layer that had not been put back yet.
  await page.evaluate(async () => {
    for (const id of [...window.__lm.on.keys()]) window.__lm.remove(id);
    // Order matters: the polygon goes on first, so the manager inserts it
    // *before* the point layer that follows.
    await window.__lm.add(window.__registry.byId.get('evac-zones'));
    await window.__lm.add(window.__registry.byId.get('boat-launches'));
    window.__lm.errors.length = 0;
  });
  const before = await page.evaluate(() => [...window.__lm.on.keys()]);
  assert.ok(before.includes('evac-zones'), 'setup: the layer should be on');
  assert.ok(before.includes('boat-launches'), 'setup: the point layer should be on');

  await page.evaluate(async () => {
    const opt = [...document.querySelectorAll('.basemap-opt')].find(o => /Muted/.test(o.textContent));
    opt.click();
  });
  await page.waitForTimeout(2500);

  const after = await page.evaluate(() => ({
    on: [...window.__lm.on.keys()],
    drawn: window.__map.getStyle().layers.filter(l => /^(evac-zones|boat-launches):/.test(l.id)).map(l => l.id),
    errors: window.__lm.errors.slice()
  }));
  assert.deepEqual(after.on, before, 'the same layers should still be on after the switch');
  assert.deepEqual(after.drawn.sort(),
    ['boat-launches:circle', 'evac-zones:fill', 'evac-zones:line'],
    'and they should still be in the style');
  assert.deepEqual(after.errors, [], `maplibre errors on restore: ${after.errors.join(' | ')}`);
});

test('a layer switched on mid style-swap still draws', async () => {
  // The window between setStyle and the style actually being usable is real:
  // map.addSource throws "Style is not done loading" inside it, and a student
  // ticking a box while the base map is still settling saw nothing appear.
  const out = await page.evaluate(async () => {
    for (const id of [...window.__lm.on.keys()]) window.__lm.remove(id);
    window.__lm.errors.length = 0;
    window.__map.setStyle({
      version: 8, name: 'swap', sources: {},
      layers: [{ id: 'bg2', type: 'background', paint: { 'background-color': '#111' } }],
      glyphs: 'http://127.0.0.1/{fontstack}/{range}.pbf'
    }, { diff: false });
    await window.__lm.add(window.__registry.byId.get('evac-zones'));
    return {
      on: [...window.__lm.on.keys()],
      drawn: window.__map.getStyle().layers.map(l => l.id).filter(i => i.startsWith('evac-zones:')),
      errors: window.__lm.errors.slice()
    };
  });
  assert.deepEqual(out.errors, [], `maplibre errors: ${out.errors.join(' | ')}`);
  assert.ok(out.on.includes('evac-zones'), 'the layer should be on');
  assert.deepEqual(out.drawn.sort(), ['evac-zones:fill', 'evac-zones:line']);
});

test('a layer draws even while the base map tiles never arrive', async () => {
  // isStyleLoaded() also waits for every source's tiles. A background tab gets
  // no frames, so it requests no tiles and that never becomes true — waiting on
  // it would hang the whole restore. Only the style *definition* matters here.
  const out = await page.evaluate(async () => {
    for (const id of [...window.__lm.on.keys()]) window.__lm.remove(id);
    window.__lm.errors.length = 0;
    window.__map.setStyle({
      version: 8, name: 'stalled',
      sources: { stalled: { type: 'raster', tiles: ['http://127.0.0.1:9/{z}/{x}/{y}.png'], tileSize: 256 } },
      layers: [
        { id: 'bg3', type: 'background', paint: { 'background-color': '#111' } },
        { id: 'stalled', type: 'raster', source: 'stalled' }
      ],
      glyphs: 'http://127.0.0.1/{fontstack}/{range}.pbf'
    }, { diff: false });
    await window.__lm.add(window.__registry.byId.get('evac-zones'));
    return {
      on: [...window.__lm.on.keys()],
      styleLoaded: window.__map.isStyleLoaded(),
      drawn: window.__map.getStyle().layers.map(l => l.id).filter(i => i.startsWith('evac-zones:')),
      errors: window.__lm.errors.slice()
    };
  });
  assert.deepEqual(out.errors, [], `maplibre errors: ${out.errors.join(' | ')}`);
  assert.ok(out.on.includes('evac-zones'), 'the layer should be on despite the stalled base map');
  assert.deepEqual(out.drawn.sort(), ['evac-zones:fill', 'evac-zones:line']);
});

test('the checkboxes follow the manager, not the other way round', async () => {
  // ?on= layers, scenario presets and base map restores all switch layers on
  // without a click. A panel that only remembers what was ticked shows nothing.
  const out = await page.evaluate(async () => {
    for (const id of [...window.__lm.on.keys()]) window.__lm.remove(id);
    window.__map.fire('layerschange');
    const box = () => document.querySelector('#layer-groups input[data-layer-id="evac-zones"]');
    const before = box().checked;
    await window.__lm.add(window.__registry.byId.get('evac-zones'));
    const after = box().checked;
    window.__lm.remove('evac-zones');
    window.__map.fire('layerschange');
    return { before, after, off: box().checked };
  });
  assert.equal(out.before, false);
  assert.equal(out.after, true, 'the box should tick itself when the layer goes on');
  assert.equal(out.off, false, 'and untick itself when it goes off');
});

test('two quick base map clicks do not fight over the same layers', async () => {
  // Make the style fetch slow enough that the second click genuinely lands
  // while the first switch is still putting the layers back.
  await page.route(/basemaps\.cartocdn\.com/, async r => {
    await new Promise(res => setTimeout(res, 700));
    await r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(BLANK_STYLE) });
  });
  const out = await page.evaluate(async () => {
    for (const id of [...window.__lm.on.keys()]) window.__lm.remove(id);
    await window.__lm.add(window.__registry.byId.get('evac-zones'));
    window.__lm.errors.length = 0;
    const opts = [...document.querySelectorAll('.basemap-opt')];
    const hit = n => opts.find(o => new RegExp(n).test(o.textContent)).click();
    hit('Muted');
    hit('Detailed');          // second click lands mid-restore
    await new Promise(r => setTimeout(r, 6000));
    return {
      on: [...window.__lm.on.keys()],
      drawn: window.__map.getStyle().layers.map(l => l.id).filter(i => i.startsWith('evac-zones:')),
      errors: window.__lm.errors.slice()
    };
  });
  assert.deepEqual(out.errors, [], `maplibre errors: ${out.errors.join(' | ')}`);
  assert.deepEqual(out.drawn.sort(), ['evac-zones:fill', 'evac-zones:line']);
  assert.ok(out.on.includes('evac-zones'));
});

test('no page errors and no silent MapLibre layer failures', async () => {
  const mapErrors = await page.evaluate(() => window.__lm.errors);
  const real = errors.filter(e => !/favicon|manifest|Failed to load resource.*404/i.test(e))
    .filter(e => !/is (pending|gated|absent) — not drawable/.test(e));
  assert.deepEqual(real, [], `page errors: ${real.join(' | ')}`);
  assert.deepEqual(mapErrors, [], `maplibre errors: ${mapErrors.join(' | ')}`);
});
