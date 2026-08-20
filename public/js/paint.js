// Paint expression builders.
//
// §3 lesson 2: MapLibre refuses two zoom-based interpolations in one paint
// expression, and reports it through the map's `error` event rather than by
// throwing — addLayer appears to succeed and the layer silently never exists.
// Every builder here emits at most ONE ['interpolate', ..., ['zoom'], ...] per
// property, with ['case'] / ['match'] nested INSIDE it.

const HL = ['boolean', ['feature-state', 'hover'], false];

export function fillPaint(L) {
  const c = L.color || '#4cc9f0';
  return {
    'fill-color': L.field && L.categories ? matchColor(L) : c,
    'fill-opacity': ['interpolate', ['linear'], ['zoom'],
      8,  ['case', HL, 0.75, L.opacity ?? 0.42],
      14, ['case', HL, 0.62, (L.opacity ?? 0.42) * 0.72]]
  };
}

export function fillOutlinePaint(L) {
  return {
    'line-color': L.outline || L.color || '#4cc9f0',
    'line-opacity': 0.85,
    'line-width': ['interpolate', ['linear'], ['zoom'],
      8,  ['case', HL, 2.0, 0.5],
      16, ['case', HL, 4.0, 1.4]]
  };
}

export function linePaint(L) {
  const c = L.field && L.categories ? matchColor(L) : (L.color || '#4cc9f0');
  return {
    'line-color': c,
    'line-opacity': L.opacity ?? 0.9,
    'line-width': ['interpolate', ['linear'], ['zoom'],
      10, ['case', HL, 4.0, L.width ?? 1.4],
      16, ['case', HL, 8.0, (L.width ?? 1.4) * 2.6]]
  };
}

export function circlePaint(L) {
  const c = L.field && L.categories ? matchColor(L) : (L.color || '#f4a261');
  return {
    'circle-color': c,
    'circle-stroke-color': '#0d1b2a',
    'circle-stroke-width': ['interpolate', ['linear'], ['zoom'], 10, 0.6, 16, 1.4],
    'circle-opacity': L.opacity ?? 0.9,
    'circle-radius': ['interpolate', ['linear'], ['zoom'],
      9,  ['case', HL, 5.5, L.radius ?? 2.6],
      16, ['case', HL, 12,  (L.radius ?? 2.6) * 3.2]]
  };
}

function matchColor(L) {
  const out = ['match', ['to-string', ['get', L.field]]];
  for (const [k, v] of Object.entries(L.categories)) out.push(String(k), v);
  out.push(L.color || '#8d99ae');
  return out;
}

// §3 lesson 3: a real fill over ~1M footprints crashes the renderer. A probe
// layer whose filter matches nothing still downloads the tiles, draws none, and
// stays queryable.
export const PROBE_FILTER = ['==', ['literal', 1], ['literal', 0]];
