import { fillPaint, fillOutlinePaint, linePaint, circlePaint, PROBE_FILTER } from './paint.js';
import { toast } from './util.js';

// Layer lifecycle. One registry entry can produce several MapLibre layers
// (a polygon gets a fill and an outline), so we track them by registry id.
export class LayerManager {
  constructor(map) {
    this.map = map;
    this.on = new Map();      // id -> { entry, mapLayerIds, sourceId }
    this.errors = [];
    // §3 lesson 2 again: MapLibre reports style errors on the event, not by
    // throwing. Listen, or you will debug an invisible layer for an hour.
    map.on('error', e => {
      const msg = e?.error?.message || String(e?.error || 'unknown map error');
      this.errors.push(msg);
      console.error('[maplibre]', msg);
    });
  }

  isOn(id) { return this.on.has(id); }
  activeEntries() { return [...this.on.values()].map(v => v.entry); }

  async add(entry) {
    if (this.on.has(entry.id)) return;
    const map = this.map;
    const sourceId = `src:${entry.id}`;

    if (!map.getSource(sourceId)) {
      if (entry.format === 'pmtiles') {
        map.addSource(sourceId, {
          type: 'vector',
          url: `pmtiles://${entry.url}`,
          attribution: entry.attribution || ''
        });
      } else if (entry.format === 'raster') {
        map.addSource(sourceId, {
          type: 'raster', tiles: [entry.url], tileSize: entry.tileSize || 256,
          minzoom: entry.minzoom ?? 0, maxzoom: entry.maxzoom ?? 16,
          attribution: entry.attribution || ''
        });
      } else {
        map.addSource(sourceId, {
          type: 'geojson', data: entry.url, attribution: entry.attribution || '',
          generateId: true
        });
      }
    }

    const ids = [];
    const base = {
      source: sourceId,
      ...(entry.format === 'pmtiles' ? { 'source-layer': entry.sourceLayer || entry.id } : {}),
      ...(entry.minzoom != null ? { minzoom: entry.minzoom } : {}),
      ...(entry.maxzoom != null ? { maxzoom: entry.maxzoom } : {})
    };
    const before = this.#insertBefore(entry);

    try {
      if (entry.format === 'raster') {
        map.addLayer({ id: `${entry.id}:raster`, type: 'raster', ...base,
          paint: { 'raster-opacity': entry.opacity ?? 0.8 } }, before);
        ids.push(`${entry.id}:raster`);
      } else if (entry.geom === 'polygon') {
        const l = { id: `${entry.id}:fill`, type: 'fill', ...base, paint: fillPaint(entry) };
        if (entry.probe) l.filter = PROBE_FILTER;
        map.addLayer(l, before);
        ids.push(l.id);
        if (!entry.probe) {
          map.addLayer({ id: `${entry.id}:line`, type: 'line', ...base,
            paint: fillOutlinePaint(entry) }, before);
          ids.push(`${entry.id}:line`);
        }
      } else if (entry.geom === 'line') {
        map.addLayer({ id: `${entry.id}:line`, type: 'line', ...base,
          layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: linePaint(entry) }, before);
        ids.push(`${entry.id}:line`);
      } else {
        map.addLayer({ id: `${entry.id}:circle`, type: 'circle', ...base,
          paint: circlePaint(entry) }, before);
        ids.push(`${entry.id}:circle`);
      }
    } catch (err) {
      toast(`Could not draw “${entry.label}”`);
      console.error(err);
      return;
    }

    // Trust nothing: confirm the layers actually exist in the style.
    const missing = ids.filter(i => !map.getLayer(i));
    if (missing.length) {
      toast(`“${entry.label}” failed to draw — see console`);
      console.error('layers silently absent after addLayer:', missing);
      return;
    }

    this.on.set(entry.id, { entry, mapLayerIds: ids, sourceId });
    this.#wireHover(entry, ids);
    map.fire('layerschange');
  }

  remove(id) {
    const rec = this.on.get(id);
    if (!rec) return;
    for (const l of rec.mapLayerIds) if (this.map.getLayer(l)) this.map.removeLayer(l);
    if (this.map.getSource(rec.sourceId)) this.map.removeSource(rec.sourceId);
    this.on.delete(id);
    this.map.fire('layerschange');
  }

  toggle(entry, want) {
    const on = want ?? !this.isOn(entry.id);
    return on ? this.add(entry) : this.remove(entry.id);
  }

  setFilter(id, filter) {
    const rec = this.on.get(id);
    if (!rec) return;
    for (const l of rec.mapLayerIds) {
      if (rec.entry.probe && l.endsWith(':fill')) continue;
      this.map.setFilter(l, filter);
    }
  }

  // Points on top, then lines, then polygons — so a 861k-point building layer
  // is never buried under a floodplain.
  #insertBefore(entry) {
    const order = { polygon: 0, line: 1, point: 2 };
    const mine = order[entry.geom] ?? 2;
    for (const rec of this.on.values()) {
      if ((order[rec.entry.geom] ?? 2) > mine) return rec.mapLayerIds[0];
    }
    return undefined;
  }

  #wireHover(entry, ids) {
    let hovered = null;
    const src = { source: `src:${entry.id}`,
      ...(entry.format === 'pmtiles' ? { sourceLayer: entry.sourceLayer || entry.id } : {}) };
    for (const l of ids) {
      this.map.on('mousemove', l, e => {
        if (!e.features?.length) return;
        this.map.getCanvas().style.cursor = 'pointer';
        if (hovered !== null) this.map.setFeatureState({ ...src, id: hovered }, { hover: false });
        hovered = e.features[0].id;
        if (hovered != null) this.map.setFeatureState({ ...src, id: hovered }, { hover: true });
      });
      this.map.on('mouseleave', l, () => {
        this.map.getCanvas().style.cursor = '';
        if (hovered !== null) this.map.setFeatureState({ ...src, id: hovered }, { hover: false });
        hovered = null;
      });
    }
  }
}
