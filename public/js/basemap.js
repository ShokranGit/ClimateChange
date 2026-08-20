import { el, $, toast, whenStyleReady } from './util.js';

// Basemaps, in the order a student meets them. Each carries a one-line reason
// to pick it — a list of names alone makes the choice arbitrary.
export const BASEMAPS = [
  { id: 'muted', name: 'Muted', swatch: '#dfe4e6',
    blurb: 'Pale and quiet, so the flood layers read on top',
    style: 'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json' },
  { id: 'detailed', name: 'Detailed', swatch: '#e8e0d0',
    blurb: 'Street names, ferry piers, park paths',
    style: 'https://basemaps.cartocdn.com/gl/voyager-gl-style/style.json' },
  { id: 'night', name: 'Night', swatch: '#13202b',
    blurb: 'Dark, for reading a bright screen after dark',
    style: 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json' },
  { id: 'satellite', name: 'Satellite', swatch: '#3d4a35',
    blurb: 'Aerial imagery, with place names over it',
    style: rasterStyle(
      'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
      'Esri, Maxar, Earthstar Geographics', true) },
  { id: 'chart', name: 'Nautical chart', swatch: '#e8dcc0',
    blurb: "NOAA's own harbour chart — soundings, channels, aids to navigation",
    style: rasterStyle('https://tileservice.charts.noaa.gov/tiles/50000_1/{z}/{x}/{y}.png',
                       'NOAA Office of Coast Survey', false) }
];

// A raster basemap still needs a style document. Labels ride on top as a
// separate translucent CARTO layer, which is why satellite keeps its names.
function rasterStyle(tiles, attribution, labels) {
  const s = {
    version: 8, name: 'raster',
    sources: { base: { type: 'raster', tiles: [tiles], tileSize: 256, attribution, maxzoom: 19 } },
    layers: [
      { id: 'bg', type: 'background', paint: { 'background-color': '#0b1620' } },
      { id: 'base', type: 'raster', source: 'base', paint: { 'raster-opacity': 1 } }
    ]
  };
  if (labels) {
    s.sources.labels = {
      type: 'raster', tileSize: 256, maxzoom: 19,
      tiles: ['https://basemaps.cartocdn.com/rastertiles/dark_only_labels/{z}/{x}/{y}@2x.png'],
      attribution: '© OpenStreetMap contributors © CARTO'
    };
    s.layers.push({ id: 'labels', type: 'raster', source: 'labels',
                    paint: { 'raster-opacity': 0.85 } });
  }
  return s;
}

// setStyle throws away every source and layer on the map, so anything the
// student had switched on has to be put back once the new style settles.
// Forgetting this is the classic basemap-switch bug: the picker works, and all
// the data silently disappears.
export async function setBasemap(map, lm, bm) {
  const active = lm.activeEntries();
  const restore = new Promise(res => map.once('styledata', res));
  map.setStyle(bm.style, { diff: false });
  await restore;
  // styledata fires before the style is actually usable; adding a source in
  // that window throws. Wait for the real thing rather than guessing at 60ms.
  await whenStyleReady(map, 15000);
  for (const entry of active) {
    lm.on.delete(entry.id);          // the style took the layer with it
    await lm.add(entry);
  }
  map.fire('layerschange');
}

export function buildBasemapPicker(map, lm, current = 'night') {
  const host = $('#basemap');
  let open = false;
  let id = current;

  const value = el('span', { class: 'basemap-value', text: name(id) });
  const chev = el('span', { class: 'chev', text: '▾' });
  const head = el('button', { class: 'basemap-head', 'aria-expanded': 'false' },
    el('span', { class: 'chip-label', text: 'Base map' }), value, chev);
  const list = el('div', { class: 'basemap-list', hidden: true });

  function name(x) { return BASEMAPS.find(b => b.id === x)?.name || x; }

  function renderList() {
    list.replaceChildren(...BASEMAPS.map(b => {
      const row = el('button', { class: `basemap-opt${b.id === id ? ' on' : ''}` },
        el('i', { class: 'basemap-swatch', style: `background:${b.swatch}` }),
        el('span', {},
          el('span', { class: 'name', text: b.name }),
          el('span', { class: 'blurb', text: b.blurb })),
        b.id === id ? el('span', { class: 'tick', text: '✓' }) : null);
      row.addEventListener('click', async () => {
        if (b.id === id) return;
        id = b.id;
        value.textContent = b.name;
        renderList();
        row.disabled = true;
        try { await setBasemap(map, lm, b); }
        catch (e) { console.error(e); toast(`Could not switch to ${b.name}`); }
        row.disabled = false;
      });
      return row;
    }));
  }

  head.addEventListener('click', () => {
    open = !open;
    list.hidden = !open;
    head.setAttribute('aria-expanded', String(open));
    head.classList.toggle('open', open);
  });

  renderList();
  host.replaceChildren(head, list);
  return { get id() { return id; } };
}
