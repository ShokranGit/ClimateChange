import { $, el, fmt } from './util.js';

const HIDE = new Set(['the_geom', 'shape_leng', 'shape_area', 'shape__length', 'shape__area', 'objectid']);

export function wireInspect(map, lm) {
  const box = $('#inspect');
  map.on('click', e => {
    const ids = [...lm.on.values()].flatMap(r => r.mapLayerIds).filter(i => map.getLayer(i));
    const hits = ids.length ? map.queryRenderedFeatures(e.point, { layers: ids }) : [];
    if (!hits.length) { box.hidden = true; box.replaceChildren(); return; }
    box.replaceChildren();
    for (const f of hits.slice(0, 4)) {
      const entry = lm.on.get(f.layer.id.replace(/:(fill|line|circle|raster)$/, ''))?.entry;
      const rows = Object.entries(f.properties || {})
        .filter(([k, v]) => !HIDE.has(k.toLowerCase()) && v !== '' && v != null)
        .slice(0, 24)
        .map(([k, v]) => el('tr', {}, el('td', { text: k }), el('td', { text: fmt(v) })));
      box.append(
        el('h3', { text: entry?.label || f.layer.id }),
        rows.length ? el('table', {}, ...rows)
                    : el('p', { class: 'note', text: 'This feature carries no attributes — geometry only.' })
      );
      if (entry?.notes) box.append(el('p', { class: 'note', text: entry.notes }));
    }
    box.hidden = false;
  });
  box.addEventListener('click', ev => { if (ev.target === box) box.hidden = true; });
}
