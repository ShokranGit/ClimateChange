#!/usr/bin/env node
// Turns scripts/registry.src.json into public/layers/index.json.
//
// Two modes:
//   --remote (default) every layer points straight at the publisher's REST
//            endpoint and the browser fetches GeoJSON live. Nothing to build,
//            always current, and it works on the first deploy.
//   --baked  layers for which public/layers/<id>.geojson or .pmtiles exists on
//            disk point at the local copy instead. Faster, offline-capable, and
//            immune to a publisher moving a URL mid-semester.
//
// A layer whose source cannot be expressed as a single GeoJSON request is
// emitted only in --baked mode, and only if its file is actually present.

import fs from 'node:fs';
import path from 'node:path';

const SRC = 'scripts/registry.src.json';
const OUT = 'public/layers/index.json';
const baked = process.argv.includes('--baked');
// The six NYSDEC layers carry "Secondary Distribution of the data is not
// allowed". Until DEC's position is in writing they stay out of the public
// registry entirely — not baked, and not hot-linked either.
const includeGated = process.env.INCLUDE_GATED === '1';

const src = JSON.parse(fs.readFileSync(SRC, 'utf8'));

// ArcGIS FeatureServer -> GeoJSON. `resultRecordCount` is capped server-side;
// anything past the cap needs paging, which is the build script's job, not the
// browser's. Layers over the cap are marked so we know to bake them.
function arcgisUrl(s, limit = 2000) {
  const base = s.url.replace(/\/$/, '');
  const layer = s.layer ?? 0;
  const q = new URLSearchParams({
    where: '1=1', outFields: '*', outSR: '4326', f: 'geojson',
    resultRecordCount: String(limit), returnGeometry: 'true'
  });
  return `${base}/${layer}/query?${q}`;
}

// Socrata -> GeoJSON. The .geojson endpoint only works when the dataset has a
// real geometry column; point datasets published as lat/lon columns need the
// JSON endpoint and a client-side assembly, so those are baked.
function socrataUrl(s) {
  const q = new URLSearchParams({ $limit: '50000' });
  if (s.where) q.set('$where', s.where);
  return `https://${s.domain}/resource/${s.id}.geojson?${q}`;
}

function localIfPresent(id) {
  for (const ext of ['.pmtiles', '.geojson']) {
    const p = path.join('public/layers', id + ext);
    if (fs.existsSync(p)) {
      return { url: `/layers/${id}${ext}`,
               format: ext === '.pmtiles' ? 'pmtiles' : 'geojson',
               bytes: fs.statSync(p).size };
    }
  }
  return null;
}

const out = [];
const skipped = [];

for (const L of src.layers) {
  const { source, ...pub } = L;
  if (L.gated && !includeGated) {
    skipped.push({ id: L.id, why: 'NYSDEC-gated — held back from public re-serving' });
    continue;
  }
  const local = baked ? localIfPresent(L.id) : null;

  if (local) {
    out.push({ ...pub, ...local, sourceLayer: L.id, live: false });
    continue;
  }

  if (source?.type === 'arcgis') {
    out.push({ ...pub, url: arcgisUrl(source), format: 'geojson', live: true });
  } else if (source?.type === 'socrata' && !source.lat && !source.attachment) {
    out.push({ ...pub, url: socrataUrl(source), format: 'geojson', live: true });
  } else {
    skipped.push({ id: L.id, why: `source type "${source?.type}" needs a build step` });
  }
}

const registry = {
  version: src.version,
  generated: new Date().toISOString(),
  mode: baked ? 'baked' : 'remote',
  groups: src.groups,
  layers: out,
  parked: src.parked,
  parked_note: src.parked_note,
  pending: skipped
};

fs.mkdirSync('public/layers', { recursive: true });
fs.writeFileSync(OUT, JSON.stringify(registry, null, 2));

// §3 lesson 1: silence is not success. Say the numbers out loud.
console.log(`wrote ${OUT}`);
console.log(`  mode      ${registry.mode}`);
console.log(`  live      ${out.filter(l => l.live).length}`);
console.log(`  baked     ${out.filter(l => !l.live).length}`);
console.log(`  pending   ${skipped.length}`);
for (const s of skipped) console.log(`    - ${s.id}: ${s.why}`);
if (!out.length) { console.error('FAIL: registry has no layers'); process.exit(1); }
