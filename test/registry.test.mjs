import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const src = JSON.parse(fs.readFileSync('scripts/registry.src.json', 'utf8'));
const idx = JSON.parse(fs.readFileSync('public/layers/index.json', 'utf8'));
const CAP = 2000;
const GEOM = ['point', 'line', 'polygon', 'raster'];
const DRAWABLE = new Set(['live', 'baked']);

test('every source layer has the fields the app needs', () => {
  for (const L of src.layers) {
    assert.match(L.id, /^[a-z0-9-]+$/, `${L.id}: id must be kebab-case`);
    assert.ok(L.label, `${L.id}: missing label`);
    assert.ok(L.group, `${L.id}: missing group`);
    assert.ok(L.source, `${L.id}: missing source`);
    if (!L.absent) assert.ok(GEOM.includes(L.geom), `${L.id}: bad geom "${L.geom}"`);
  }
});

test('layer ids are unique and groups all exist', () => {
  const seen = new Set();
  const groups = new Set(src.groups.map(g => g.id));
  for (const L of src.layers) {
    assert.ok(!seen.has(L.id), `duplicate id ${L.id}`);
    seen.add(L.id);
    assert.ok(groups.has(L.group), `${L.id}: unknown group ${L.group}`);
  }
});

test('the survey is represented at full size', () => {
  // The handoff counted about 90 buildable layers, roughly 150 with every
  // scenario variant. Anything much smaller means the inventory has been
  // quietly trimmed.
  assert.ok(src.layers.length >= 90, `only ${src.layers.length} entries`);
  const variants = src.layers.reduce((n, L) =>
    n + (L.scenarioSet?.axes || []).reduce((p, a) => p * a.values.length, 1), 0);
  assert.ok(variants >= 150, `only ${variants} scenario variants`);
});

test('every NYSDEC layer is gated, and no gated layer is ever given a url', () => {
  const dec = src.layers.filter(L => /nysdec/i.test(L.agency || '') || /NYSDEC/.test(L.license || ''));
  assert.ok(dec.length >= 6, `expected at least the six DEC layers, found ${dec.length}`);
  for (const L of dec) {
    assert.equal(L.gated, true, `${L.id}: a NYSDEC layer must be gated`);
    assert.match(L.license, /secondary distribution/i, `${L.id}: licence must state the restriction`);
  }
  for (const L of idx.layers.filter(l => l.status === 'gated')) {
    assert.equal(L.url, undefined, `${L.id}: a DEC-gated layer must not be re-served or hot-linked`);
    assert.ok(L.reason, `${L.id}: must say why it is held back`);
  }
});

test('the confirmed absences are published as entries, not omitted', () => {
  // §6 of the survey is the best teaching material in it. A catalogue that
  // hides what nobody publishes misrepresents the public record.
  const absent = idx.layers.filter(l => l.status === 'absent');
  assert.ok(absent.length >= 8, `only ${absent.length} absences listed`);
  for (const L of absent) {
    assert.equal(L.url, undefined, `${L.id}: an absent layer cannot have a url`);
    assert.ok(L.reason, `${L.id}: must say why it is absent`);
    assert.ok(L.notes, `${L.id}: an absence with no explanation teaches nothing`);
  }
  const ids = absent.map(l => l.id);
  for (const must of ['absent-shoreline-structures', 'absent-buyouts', 'absent-cso'])
    assert.ok(ids.includes(must), `missing the ${must} absence`);
});

test('every entry carries a status, and only drawable ones carry a url', () => {
  const ok = new Set(['live', 'baked', 'pending', 'gated', 'absent']);
  for (const L of idx.layers) {
    assert.ok(ok.has(L.status), `${L.id}: bad status "${L.status}"`);
    assert.ok(!('source' in L), `${L.id}: build-time source block leaked into the public index`);
    if (DRAWABLE.has(L.status)) {
      assert.ok(L.url, `${L.id}: drawable but no url`);
      assert.ok(['geojson', 'pmtiles', 'raster'].includes(L.format), `${L.id}: bad format`);
    } else {
      assert.equal(L.url, undefined, `${L.id}: ${L.status} entries must not have a url`);
      assert.ok(L.reason, `${L.id}: ${L.status} entries must say why`);
    }
  }
  assert.ok(idx.layers.filter(l => DRAWABLE.has(l.status)).length >= 35,
    'too few layers are actually drawable');
});

test('layers a single live query silently truncates are flagged partial', () => {
  for (const L of idx.layers.filter(l => l.status === 'live' && /arcgis/.test(l.url))) {
    const declared = src.layers.find(s => s.id === L.id)?.features;
    if (declared && declared <= CAP * 0.75)
      assert.equal(L.partial, undefined, `${L.id}: small layer should not be flagged`);
    else
      assert.equal(L.partial, CAP, `${L.id}: may exceed the query cap and must be flagged`);
  }
});

test('scenario axes are internally consistent', () => {
  for (const L of src.layers.filter(l => l.scenarioSet)) {
    for (const a of L.scenarioSet.axes) {
      assert.ok(a.values?.length, `${L.id}/${a.id}: no values`);
      if (a.default != null)
        assert.ok(a.values.includes(a.default), `${L.id}/${a.id}: default not in values`);
      if (a.display)
        for (const v of a.values)
          assert.ok(v in a.display, `${L.id}/${a.id}: no display label for "${v}"`);
    }
  }
  const n = src.layers.find(l => l.id === 'nyserda-slr');
  assert.equal(n.scenarioSet.axes.reduce((p, a) => p * a.values.length, 1), 32,
    'NYSERDA should offer 32 scenarios');
});

test('the twelve spine layers of the survey are all present', () => {
  const ids = new Set(src.layers.map(l => l.id));
  for (const must of ['nyserda-slr', 'stormwater-flood', 'evac-zones', 'slosh-inundation',
                      'firm-2015-prelim', 'firm-2007-effective', 'sandy-inundation', 'fvi',
                      'floodnet-sensors', 'building-elevation', 'enc-shoreline-construction',
                      'usace-channels'])
    assert.ok(ids.has(must), `spine layer ${must} is missing`);
});

test('New Jersey is reachable, not just New York', () => {
  const bi = src.layers.filter(L => /NJ/.test(L.state || ''));
  assert.ok(bi.length >= 10, `only ${bi.length} layers cover New Jersey`);
});
