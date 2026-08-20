import { CONFIG } from './config.js';

// The registry is the single source of truth for what the site offers.
// `layers` is what renders; `parked` is what exists but is hidden. Parking a
// layer is moving one entry between two arrays — same contract as Fieldmap.
export async function loadRegistry() {
  const res = await fetch(CONFIG.registry, { cache: 'no-cache' });
  if (!res.ok) throw new Error(`registry ${res.status}`);
  const m = await res.json();
  const groups = m.groups || [];
  const layers = (m.layers || []).map(normalise);
  const byGroup = new Map(groups.map(g => [g.id, { ...g, layers: [] }]));
  for (const L of layers) {
    if (!byGroup.has(L.group)) byGroup.set(L.group, { id: L.group, label: L.group, layers: [] });
    byGroup.get(L.group).layers.push(L);
  }
  return {
    meta: m,
    groups: [...byGroup.values()].filter(g => g.layers.length),
    layers,
    byId: new Map(layers.map(L => [L.id, L])),
    scenarios: m.scenarios || [],
    parked: m.parked || [],
    parkedNote: m.parked_note || ''
  };
}

function normalise(L) {
  const format = L.format || (L.url?.endsWith('.pmtiles') ? 'pmtiles'
                : L.url?.includes('{z}') ? 'raster' : 'geojson');
  return { geom: 'polygon', ...L, format };
}

export function searchLayers(layers, q) {
  const s = q.trim().toLowerCase();
  if (!s) return layers;
  const terms = s.split(/\s+/);
  return layers.filter(L => {
    const hay = [L.label, L.agency, L.group, L.state, L.notes, ...(L.tags || [])]
      .filter(Boolean).join(' ').toLowerCase();
    return terms.every(t => hay.includes(t));
  });
}
