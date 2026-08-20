import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fillPaint, fillOutlinePaint, linePaint, circlePaint } from '../public/js/paint.js';

// §3 lesson 2: MapLibre refuses two zoom-based interpolations in one paint
// expression and reports it on the map's error event, not by throwing. addLayer
// appears to succeed and the layer silently never exists. So: assert the shape.
function zoomInterpolates(expr, count = 0) {
  if (!Array.isArray(expr)) return count;
  if (expr[0] === 'interpolate' && JSON.stringify(expr[2]) === '["zoom"]') count++;
  for (const sub of expr) count = zoomInterpolates(sub, count);
  return count;
}

const SAMPLES = [
  { id: 'plain', color: '#fff' },
  { id: 'categorical', color: '#fff', field: 'zone', categories: { a: '#111', b: '#222' } },
  { id: 'tuned', color: '#fff', opacity: 0.7, width: 3, radius: 5 }
];

for (const L of SAMPLES) {
  for (const [name, fn] of Object.entries({ fillPaint, fillOutlinePaint, linePaint, circlePaint })) {
    test(`${name}(${L.id}) uses at most one zoom interpolation per property`, () => {
      for (const [prop, expr] of Object.entries(fn(L))) {
        assert.ok(zoomInterpolates(expr) <= 1,
          `${name}.${prop} nests more than one zoom interpolation`);
      }
    });
  }
}

test('categorical colours fall through to a default', () => {
  const p = fillPaint(SAMPLES[1])['fill-color'];
  assert.equal(p[0], 'match');
  assert.equal(p.at(-1), '#fff', 'last element of a match must be the fallback');
});

test('hover state is expressed without a second zoom stop', () => {
  const w = linePaint(SAMPLES[0])['line-width'];
  assert.equal(w[0], 'interpolate');
  assert.equal(w[4][0], 'case', 'the hover case must sit inside the interpolation');
});
