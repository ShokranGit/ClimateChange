#!/usr/bin/env node
// Fetches every layer in scripts/registry.src.json to public/layers/<id>.geojson,
// paging past the server's transfer limit, and reports a feature count for each.
//
// This runs in CI, not on a laptop and not in the agent sandbox — the sandbox
// cannot reach data.cityofnewyork.us, hazards.fema.gov or the ArcGIS hosts.
//
//   node scripts/bake-layers.mjs                 # everything not gated
//   node scripts/bake-layers.mjs evac-zones fvi  # named layers only
//   INCLUDE_GATED=1 node scripts/bake-layers.mjs # include the six DEC layers
//
// §3 lesson 1: count the features in the finished file. Silence is not success.

import fs from 'node:fs';

const src = JSON.parse(fs.readFileSync('scripts/registry.src.json', 'utf8'));
const only = process.argv.slice(2);
const includeGated = process.env.INCLUDE_GATED === '1';
const OUT = 'public/layers';
fs.mkdirSync(OUT, { recursive: true });

const sleep = ms => new Promise(r => setTimeout(r, ms));

async function getJSON(url, tries = 4) {
  for (let i = 0; i < tries; i++) {
    try {
      const r = await fetch(url, { headers: { 'user-agent': 'climatechange-course-build/0.1' } });
      if (r.status === 429 || r.status >= 500) throw new Error(`http ${r.status}`);
      if (!r.ok) throw new Error(`http ${r.status} ${await r.text().catch(() => '')}`.slice(0, 300));
      return await r.json();
    } catch (e) {
      if (i === tries - 1) throw e;
      await sleep(1500 * (i + 1));
    }
  }
}

async function fromArcGIS(s) {
  const base = `${s.url.replace(/\/$/, '')}/${s.layer ?? 0}`;
  const meta = await getJSON(`${base}?f=json`);
  const page = Math.min(meta.maxRecordCount || 1000, 2000);
  const feats = [];
  let offset = 0;
  for (;;) {
    const q = new URLSearchParams({
      where: s.where || '1=1', outFields: '*', outSR: '4326', f: 'geojson',
      resultOffset: String(offset), resultRecordCount: String(page), returnGeometry: 'true'
    });
    const j = await getJSON(`${base}/query?${q}`);
    const got = j.features || [];
    feats.push(...got);
    if (got.length < page) break;
    offset += page;
    if (offset > 400000) throw new Error('runaway paging');
  }
  return feats;
}

async function fromSocrataGeo(s) {
  const feats = [];
  let offset = 0;
  const limit = 20000;
  for (;;) {
    const q = new URLSearchParams({ $limit: String(limit), $offset: String(offset) });
    if (s.where) q.set('$where', s.where);
    const j = await getJSON(`https://${s.domain}/resource/${s.id}.geojson?${q}`);
    const got = j.features || [];
    feats.push(...got);
    if (got.length < limit) break;
    offset += limit;
  }
  return feats;
}

async function fromSocrataLatLon(s) {
  const feats = [];
  let offset = 0;
  const limit = 50000;
  for (;;) {
    const q = new URLSearchParams({ $limit: String(limit), $offset: String(offset) });
    if (s.where) q.set('$where', s.where);
    const rows = await getJSON(`https://${s.domain}/resource/${s.id}.json?${q}`);
    for (const r of rows) {
      const lat = +r[s.lat], lon = +r[s.lon];
      if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;
      const props = { ...r }; delete props[s.lat]; delete props[s.lon];
      feats.push({ type: 'Feature', geometry: { type: 'Point', coordinates: [lon, lat] }, properties: props });
    }
    if (rows.length < limit) break;
    offset += limit;
  }
  return feats;
}

async function fromArcGISMap(s) {
  // A MapServer with several numbered sublayers that belong together
  // (NOAA ENC ships shoreline construction as point / line / area).
  const feats = [];
  for (const id of s.layers) {
    const q = new URLSearchParams({
      where: '1=1', outFields: '*', outSR: '4326', f: 'geojson', returnGeometry: 'true'
    });
    const j = await getJSON(`${s.url.replace(/\/$/, '')}/${id}/query?${q}`);
    for (const f of j.features || []) {
      f.properties = { ...f.properties, __enc_layer: id };
      feats.push(f);
    }
  }
  return feats;
}

const results = [];
for (const L of src.layers) {
  if (only.length && !only.includes(L.id)) continue;
  if (L.gated && !includeGated) { results.push([L.id, 'skipped (DEC-gated)']); continue; }
  const s = L.source;
  if (!s) { results.push([L.id, 'skipped (no source)']); continue; }
  try {
    let feats;
    if (s.type === 'arcgis') feats = await fromArcGIS(s);
    else if (s.type === 'arcgis-map') feats = await fromArcGISMap(s);
    else if (s.type === 'socrata' && s.lat) feats = await fromSocrataLatLon(s);
    else if (s.type === 'socrata') feats = await fromSocrataGeo(s);
    else { results.push([L.id, `skipped (unhandled type ${s.type})`]); continue; }

    if (!feats.length) throw new Error('zero features returned');
    if (L.features && feats.length < L.features * 0.9)
      console.warn(`  ${L.id}: got ${feats.length}, registry expects ~${L.features}`);
    const fc = { type: 'FeatureCollection', features: feats };
    const file = `${OUT}/${L.id}.geojson`;
    fs.writeFileSync(file, JSON.stringify(fc));
    const mb = (fs.statSync(file).size / 1e6).toFixed(1);
    const expected = L.features;
    const flag = expected && Math.abs(feats.length - expected) / expected > 0.1
      ? `  ⚠ expected ~${expected}` : '';
    results.push([L.id, `${feats.length} features, ${mb} MB${flag}`]);
  } catch (e) {
    results.push([L.id, `FAILED: ${e.message}`]);
  }
}

const w = Math.max(...results.map(r => r[0].length));
for (const [id, msg] of results) console.log(`${id.padEnd(w)}  ${msg}`);
const failed = results.filter(r => r[1].startsWith('FAILED'));
const baked = results.filter(r => /^\d/.test(r[1]));
console.log(`\n${baked.length} baked, ${failed.length} failed, ${results.length - baked.length - failed.length} skipped`);
// A publisher having a bad afternoon must not throw away thirty good layers.
// Only a total wipeout is a build failure.
if (baked.length === 0) { console.error('nothing baked at all'); process.exitCode = 1; }
