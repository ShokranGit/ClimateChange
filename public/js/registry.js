import { CONFIG } from './config.js';

// The registry is the single source of truth for what the site offers — and,
// deliberately, for what it cannot offer. Every entry reaches the browser with
// a `status`:
//
//   live | baked   drawable now
//   pending        real, described, not yet fetchable here
//   gated          NYSDEC forbids re-serving it
//   absent         confirmed not published by anyone
//
// A catalogue that silently omits what it cannot draw misrepresents the public
// record, and the gaps in that record are half the syllabus.
export const DRAWABLE = new Set(['live', 'baked']);

export async function loadRegistry() {
  const res = await fetch(CONFIG.registry, { cache: 'no-cache' });
  if (!res.ok) throw new Error(`registry ${res.status}`);
  const m = await res.json();

  const layers = (m.layers || []).map(normalise);
  const groups = m.groups || [];
  const byGroup = new Map(groups.map(g => [g.id, { ...g, layers: [] }]));
  for (const L of layers) {
    if (!byGroup.has(L.group)) byGroup.set(L.group, { id: L.group, label: L.group, layers: [] });
    byGroup.get(L.group).layers.push(L);
  }

  return {
    meta: m,
    counts: m.counts || {},
    groups: [...byGroup.values()].filter(g => g.layers.length),
    layers,
    byId: new Map(layers.map(L => [L.id, L])),
    drawable: layers.filter(L => DRAWABLE.has(L.status)),
    parked: m.parked || [],
    parkedNote: m.parked_note || ''
  };
}

function normalise(L) {
  const format = L.format || (L.url?.endsWith('.pmtiles') ? 'pmtiles'
                : L.url?.includes('{z}') ? 'raster' : 'geojson');
  return { geom: 'polygon', status: 'pending', ...L, format,
           drawable: DRAWABLE.has(L.status ?? 'pending') };
}

// Which side of the harbour a layer covers. NY-only layers stop at the state
// line; the bi-state ones are what a New Jersey student can actually use.
export function scopeOf(L) {
  const s = (L.state || '').toUpperCase();
  if (s.includes('/') || s.includes('NJ') && s.includes('NY')) return 'both';
  if (s.includes('NJ')) return 'nj';
  if (s.includes('NY')) return 'ny';
  return 'ny';
}

export function searchLayers(layers, q) {
  const s = q.trim().toLowerCase();
  if (!s) return layers;
  const terms = s.split(/\s+/);
  return layers.filter(L => {
    const hay = [L.label, L.agency, L.group, L.state, L.notes, L.fields, L.license,
                 ...(L.tags || [])].filter(Boolean).join(' ').toLowerCase();
    return terms.every(t => hay.includes(t));
  });
}
