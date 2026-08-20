import { CONFIG } from './config.js';
import { $, toast } from './util.js';
import { loadRegistry } from './registry.js';
import { LayerManager } from './layers.js';
import { buildPanel, wireChrome } from './panel.js';
import { buildScenarios } from './scenarios.js';
import { wireInspect } from './inspect.js';
import { mountAuth } from './supa.js';

// PMTiles serves every archive over HTTP range requests — one file per layer,
// no tile server. Register the protocol before any source is added.
const protocol = new pmtiles.Protocol();
maplibregl.addProtocol('pmtiles', protocol.tile);

const params = new URLSearchParams(location.search);
const basemapKey = params.get('basemap') || CONFIG.defaultBasemap;

const map = new maplibregl.Map({
  container: 'map',
  style: CONFIG.basemaps[basemapKey]?.url || CONFIG.basemaps[CONFIG.defaultBasemap].url,
  center: params.has('c') ? params.get('c').split(',').map(Number) : CONFIG.center,
  zoom: params.has('z') ? +params.get('z') : CONFIG.zoom,
  minZoom: CONFIG.minZoom,
  maxBounds: CONFIG.maxBounds,
  hash: false,
  attributionControl: { compact: true }
});
// If the basemap CDN is unreachable — an outage, a campus firewall, a train —
// fall back to a flat background rather than showing nothing at all. The data
// layers are the point; the basemap is context.
const FALLBACK_STYLE = {
  version: 8, name: 'fallback', sources: {},
  layers: [{ id: 'bg', type: 'background', paint: { 'background-color': '#0b1620' } }]
};
let usedFallback = false;
map.on('error', e => {
  const msg = e?.error?.message || '';
  if (!usedFallback && /style|Failed to fetch/i.test(msg) && !map.isStyleLoaded()) {
    usedFallback = true;
    console.warn('basemap unreachable, falling back to a flat background');
    map.setStyle(FALLBACK_STYLE);
  }
});

map.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), 'bottom-right');
map.addControl(new maplibregl.ScaleControl({ unit: 'imperial' }), 'bottom-right');
map.addControl(new maplibregl.GeolocateControl({ trackUserLocation: true }), 'bottom-right');

window.__map = map;   // tests reach in here

wireChrome();

map.on('load', async () => {
  const lm = new LayerManager(map);
  window.__lm = lm;

  let reg;
  try {
    reg = await loadRegistry();
  } catch (err) {
    console.error(err);
    toast('Could not load the layer registry.');
    return;
  }
  window.__registry = reg;

  const scen = buildScenarios(reg, lm);
  buildPanel(reg, lm, () => scen.render());
  wireInspect(map, lm);
  mountAuth();

  // Layers named in ?on=a,b,c come up switched on — this is how a syllabus
  // links to a specific comparison.
  const wanted = (params.get('on') || '').split(',').filter(Boolean);
  for (const id of wanted) {
    const L = reg.byId.get(id);
    if (L) await lm.add(L); else console.warn('unknown layer in ?on=', id);
  }
  if (!wanted.length) {
    for (const L of reg.layers.filter(l => l.default)) await lm.add(L);
  }

  // Keep the URL shareable without spamming history.
  let t;
  const sync = () => {
    clearTimeout(t);
    t = setTimeout(() => {
      const p = new URLSearchParams();
      const c = map.getCenter();
      p.set('c', `${c.lng.toFixed(4)},${c.lat.toFixed(4)}`);
      p.set('z', map.getZoom().toFixed(2));
      const on = [...lm.on.keys()];
      if (on.length) p.set('on', on.join(','));
      if (basemapKey !== CONFIG.defaultBasemap) p.set('basemap', basemapKey);
      history.replaceState(null, '', `?${p}`);
    }, 400);
  };
  map.on('moveend', sync);
  map.on('layerschange', sync);
  map.fire('layerschange');
});

if ('serviceWorker' in navigator && location.protocol === 'https:') {
  addEventListener('load', () => navigator.serviceWorker.register('/sw.js').catch(() => {}));
}
