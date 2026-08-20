#!/usr/bin/env node
// Turns scripts/registry.src.json into public/layers/index.json.
//
// Every entry in the source registry reaches the browser. What differs is how:
//
//   live      the browser fetches GeoJSON straight from the publisher's REST
//             endpoint. Nothing to build, always current, works on first deploy.
//   baked     public/layers/<id>.geojson or .pmtiles exists, so use that.
//   pending   the source needs a build step that has not run yet. The layer is
//             listed, greyed, and says why — a catalogue that hides what it
//             cannot yet draw is a catalogue that lies about the record.
//   absent    confirmed not published by anyone. Listed on purpose: §6 of the
//             survey is the best teaching material in it.
//   gated     NYSDEC forbids secondary distribution. Named, never served.
//
//   --baked   prefer local files where they exist
//   INCLUDE_GATED=1  emit the DEC layers too (local classroom use only)

import fs from 'node:fs';
import path from 'node:path';

const SRC = 'scripts/registry.src.json';
const OUT = 'public/layers/index.json';
const baked = process.argv.includes('--baked');
const includeGated = process.env.INCLUDE_GATED === '1';

const CAP = 2000;   // ArcGIS maxRecordCount on the services used here

const src = JSON.parse(fs.readFileSync(SRC, 'utf8'));

function arcgisUrl(s, limit = CAP) {
  const base = s.url.replace(/\/$/, '');
  const q = new URLSearchParams({
    where: s.where || '1=1', outFields: '*', outSR: '4326', f: 'geojson',
    resultRecordCount: String(limit), returnGeometry: 'true'
  });
  return `${base}/${s.layer ?? 0}/query?${q}`;
}

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
               bytes: fs.statSync(p).size, sourceLayer: id };
    }
  }
  return null;
}

// Why a source cannot be a single browser fetch. Said plainly, because the
// panel shows this text to a student.
const PENDING = {
  'socrata-family': 'several datasets merged into one scenario layer — needs the bake step',
  'socrata-zip':    'published as a zip or geodatabase, not a GeoJSON endpoint',
  'socrata-query':  'built from a parameterised query rather than a fixed layer',
  'arcgis-map':     'several sublayers combined — needs the bake step',
  'arcgis-item':    'an ArcGIS item that must be resolved to a service first',
  'arcgis-owner':   'found by searching a publisher account — needs the bake step',
  'zip':            'a zip or geodatabase download',
  'noaa-slr':       'NOAA raster set — needs clipping and tiling',
  'noaa-inport':    'lidar tiles — needs clipping and tiling',
  'usgs-3dep':      'national elevation service — needs clipping',
  'usgs-stn':       'USGS Flood Event Viewer API',
  'image-server':   'an ArcGIS image service; rendering only, no export',
  'nys-ortho':      'per-borough imagery zips — needs tiling',
  'gtfs':           'a GTFS feed — needs unpacking',
  'coops':          'a tide-gauge time series, not a map layer',
  'fema-openfema':  'a tabular API joined to census geography',
  'ncei':           'a survey archive, not a single layer',
  'dohmh':          'an indicator explorer, not a service',
};

const out = [];
const counts = { live: 0, baked: 0, pending: 0, absent: 0, gated: 0, partial: 0 };

for (const L of src.layers) {
  const { source, ...pub } = L;

  if (L.absent) {
    out.push({ ...pub, status: 'absent', reason: source?.why || 'not published' });
    counts.absent++;
    continue;
  }

  if (L.gated && !includeGated) {
    out.push({ ...pub, status: 'gated',
      reason: 'NYSDEC forbids secondary distribution — built for class use, not re-served here' });
    counts.gated++;
    continue;
  }

  const local = baked ? localIfPresent(L.id) : null;
  if (local) {
    out.push({ ...pub, ...local, status: 'baked' });
    counts.baked++;
    continue;
  }

  if (source?.type === 'arcgis') {
    // §3 lesson 1 in a new costume: an ArcGIS query stops at the server's
    // transfer limit and says nothing. The response is a valid
    // FeatureCollection that happens to be missing most of the data.
    const partial = !(L.features && L.features <= CAP * 0.75);
    if (partial) counts.partial++;
    out.push({ ...pub, url: arcgisUrl(source), format: 'geojson', status: 'live',
               ...(partial ? { partial: CAP } : {}) });
    counts.live++;
  } else if (source?.type === 'socrata' && !source.lat && !source.attachment && !source.join) {
    out.push({ ...pub, url: socrataUrl(source), format: 'geojson', status: 'live' });
    counts.live++;
  } else {
    out.push({ ...pub, status: 'pending',
      reason: PENDING[source?.type] || (source?.lat ? 'point dataset published as lat/lon columns'
                                                    : `source type "${source?.type}"`) });
    counts.pending++;
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
  counts
};

fs.mkdirSync('public/layers', { recursive: true });
fs.writeFileSync(OUT, JSON.stringify(registry, null, 1));

// Silence is not success — say the numbers out loud.
const variants = out.reduce((n, L) =>
  n + ((L.scenarioSet?.axes || []).reduce((p, a) => p * a.values.length, 1)), 0);
console.log(`wrote ${OUT}  (${registry.mode})`);
console.log(`  entries  ${out.length}   ${variants} counting scenario variants`);
for (const [k, v] of Object.entries(counts)) console.log(`  ${k.padEnd(8)} ${v}`);
if (!out.length) { console.error('FAIL: registry has no layers'); process.exit(1); }
