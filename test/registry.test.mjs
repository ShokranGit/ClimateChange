import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const src = JSON.parse(fs.readFileSync('scripts/registry.src.json', 'utf8'));
const idx = JSON.parse(fs.readFileSync('public/layers/index.json', 'utf8'));

test('every source layer has the fields the app needs', () => {
  for (const L of src.layers) {
    assert.ok(L.id, 'missing id');
    assert.match(L.id, /^[a-z0-9-]+$/, `${L.id}: id must be kebab-case`);
    assert.ok(L.label, `${L.id}: missing label`);
    assert.ok(['point', 'line', 'polygon'].includes(L.geom), `${L.id}: bad geom "${L.geom}"`);
    assert.ok(L.group, `${L.id}: missing group`);
    assert.ok(L.source, `${L.id}: missing source`);
  }
});

test('layer ids are unique', () => {
  const seen = new Set();
  for (const L of src.layers) {
    assert.ok(!seen.has(L.id), `duplicate id ${L.id}`);
    seen.add(L.id);
  }
});

test('every layer names a group that exists', () => {
  const groups = new Set(src.groups.map(g => g.id));
  for (const L of src.layers) assert.ok(groups.has(L.group), `${L.id}: unknown group ${L.group}`);
});

test('the six NYSDEC layers are marked gated', () => {
  const dec = src.layers.filter(L => /nysdec/i.test(L.agency || '') || /NYSDEC/.test(L.license || ''));
  assert.ok(dec.length >= 3, 'expected DEC layers to be present');
  for (const L of dec) {
    assert.equal(L.gated, true, `${L.id}: a NYSDEC layer must be gated`);
    assert.match(L.license, /secondary distribution/i, `${L.id}: licence must state the restriction`);
  }
});

test('gated layers are never emitted as live remote fetches', () => {
  const gated = new Set(src.layers.filter(L => L.gated).map(L => L.id));
  for (const L of idx.layers) {
    if (gated.has(L.id)) assert.equal(L.live, undefined,
      `${L.id}: a DEC-gated layer must not be re-served or hot-linked publicly`);
  }
});

test('generated index is non-empty and well formed', () => {
  assert.ok(idx.layers.length >= 25, `only ${idx.layers.length} layers in the index`);
  for (const L of idx.layers) {
    assert.ok(L.url, `${L.id}: no url`);
    assert.ok(['geojson', 'pmtiles', 'raster'].includes(L.format), `${L.id}: bad format`);
    assert.ok(!('source' in L), `${L.id}: build-time source block leaked into the public index`);
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
  const combos = n.scenarioSet.axes.reduce((p, a) => p * a.values.length, 1);
  assert.equal(combos, 32, `NYSERDA should offer 32 scenarios, got ${combos}`);
});
