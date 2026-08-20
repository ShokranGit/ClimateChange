import { $, el, toast } from './util.js';

// The three map-edge controls, in the shape Fieldmap gives them: a coordinate
// bar, a north arrow that resets bearing, and a checkered scale with a unit
// toggle. The unit choice is shared — flipping the scale to feet flips the
// elevation readout too, because a student reading freeboard in feet should not
// have to read elevation in metres.

const UNIT_KEY = 'cc.units';
let units = localStorage.getItem(UNIT_KEY) === 'ft' ? 'ft' : 'm';
const unitListeners = new Set();
export const getUnits = () => units;
function setUnits(u) {
  units = u;
  localStorage.setItem(UNIT_KEY, u);
  unitListeners.forEach(f => f(u));
}

const M_PER_FT = 0.3048;

// ── coordinate bar ─────────────────────────────────────────────────────────
export function buildCoordBar(map) {
  const host = $('#coordbar');
  let format = localStorage.getItem('cc.coordfmt') || 'dd';   // dd | dms
  let pinned = null;         // a picked point, or null to follow the centre
  let geo = 'idle';

  const latEl = el('span', { class: 'v' });
  const lonEl = el('span', { class: 'v' });
  const altEl = el('span', { class: 'v', text: '—' });

  const copy = el('button', { class: 'cb-icon', title: 'Copy the coordinate' }, '⧉');
  copy.addEventListener('click', async () => {
    const { lat, lng } = point();
    try { await navigator.clipboard.writeText(`${lat.toFixed(5)}, ${lng.toFixed(5)}`); toast('Coordinate copied'); }
    catch { toast('Could not reach the clipboard'); }
  });

  const fmtBtn = el('button', { class: 'cb-seg', title: 'Switch between decimal degrees and degrees–minutes–seconds' },
    el('span', { class: 'k fmt', text: format === 'dd' ? 'LAT, LON' : 'D° M′ S″' }),
    el('span', { class: 'cb-icon', text: '⇄' }));
  fmtBtn.addEventListener('click', () => {
    format = format === 'dd' ? 'dms' : 'dd';
    localStorage.setItem('cc.coordfmt', format);
    fmtBtn.querySelector('.fmt').textContent = format === 'dd' ? 'LAT, LON' : 'D° M′ S″';
    render();
  });

  const geoBtn = el('button', { class: 'cb-seg geo', title: 'Use this device’s location' },
    el('span', { class: 'dot' }), el('span', { class: 'geo-label', text: 'Locate' }));
  geoBtn.addEventListener('click', () => {
    if (!navigator.geolocation) { setGeo('blocked'); return; }
    setGeo('asking');
    navigator.geolocation.getCurrentPosition(
      p => { setGeo('on'); map.easeTo({ center: [p.coords.longitude, p.coords.latitude], zoom: Math.max(map.getZoom(), 14) }); },
      () => setGeo('blocked'), { enableHighAccuracy: true, timeout: 8000 });
  });
  function setGeo(s) {
    geo = s;
    geoBtn.classList.toggle('blocked', s === 'blocked');
    geoBtn.classList.toggle('on', s === 'on');
    geoBtn.querySelector('.geo-label').textContent =
      s === 'blocked' ? 'Blocked' : s === 'on' ? 'Located' : s === 'asking' ? 'Asking…' : 'Locate';
  }

  const pickBtn = el('button', { class: 'cb-seg', title: 'Pin the readout to a point instead of the map centre' },
    el('span', { class: 'cb-icon', text: '◎' }), el('span', { class: 't', text: 'Pick' }));
  pickBtn.addEventListener('click', () => {
    if (pinned) { pinned = null; pickBtn.classList.remove('on'); render(); return; }
    pickBtn.classList.add('on');
    toast('Tap the map to pin a coordinate');
    map.once('click', e => { pinned = e.lngLat; render(); });
  });

  host.replaceChildren(
    el('div', { class: 'cb-seg' },
      el('span', { class: 'k', text: 'LAT' }), latEl,
      el('span', { class: 'k', text: 'LON' }), lonEl, copy),
    el('div', { class: 'cb-seg' }, el('span', { class: 'k', text: 'ALT' }), altEl),
    fmtBtn, geoBtn, pickBtn);

  const point = () => pinned || map.getCenter();

  function dms(v, [pos, neg]) {
    const h = v >= 0 ? pos : neg, a = Math.abs(v);
    const d = Math.floor(a), m = Math.floor((a - d) * 60), s = ((a - d - m / 60) * 3600).toFixed(1);
    return `${d}° ${String(m).padStart(2, '0')}′ ${String(s).padStart(4, '0')}″ ${h}`;
  }

  function render() {
    const { lat, lng } = point();
    if (format === 'dd') { latEl.textContent = lat.toFixed(5); lonEl.textContent = lng.toFixed(5); }
    else { latEl.textContent = dms(lat, ['N', 'S']); lonEl.textContent = dms(lng, ['E', 'W']); }
    host.classList.toggle('pinned', !!pinned);
    queueElevation(lat, lng);
  }

  // Elevation comes from the USGS Elevation Point Query Service, which returns
  // NAVD88 — the same datum every flood layer here uses. Debounced, and a dash
  // when it cannot be reached, because a wrong elevation is worse than none.
  let timer, seq = 0;
  function queueElevation(lat, lng) {
    clearTimeout(timer);
    timer = setTimeout(async () => {
      const mine = ++seq;
      try {
        const r = await fetch(`https://epqs.nationalmap.gov/v1/json?x=${lng.toFixed(6)}&y=${lat.toFixed(6)}&units=Meters&wkid=4326`);
        const j = await r.json();
        const metres = Number(j?.value);
        if (mine !== seq) return;
        altEl.textContent = Number.isFinite(metres) ? showAlt(metres) : '—';
        altEl.dataset.metres = Number.isFinite(metres) ? String(metres) : '';
      } catch { if (mine === seq) { altEl.textContent = '—'; altEl.dataset.metres = ''; } }
    }, 450);
  }
  function showAlt(metres) {
    return units === 'ft' ? `${(metres / M_PER_FT).toFixed(1)} ft` : `${metres.toFixed(1)} m`;
  }
  unitListeners.add(() => {
    const m = Number(altEl.dataset.metres);
    if (Number.isFinite(m) && altEl.dataset.metres !== '') altEl.textContent = showAlt(m);
  });

  setGeo('idle');
  map.on('move', render);
  render();
}

// ── north arrow ────────────────────────────────────────────────────────────
export function buildNorthArrow(map) {
  const host = $('#north');
  const needle = el('span', { class: 'needle' });
  const btn = el('button', { class: 'north-btn', title: 'Point north again' },
    el('span', { class: 'n', text: 'N' }), needle);
  btn.addEventListener('click', () => map.easeTo({ bearing: 0, pitch: 0, duration: 400 }));
  host.replaceChildren(btn);
  const sync = () => {
    needle.style.transform = `rotate(${-map.getBearing()}deg)`;
    btn.classList.toggle('turned', Math.abs(map.getBearing()) > 0.5);
  };
  map.on('rotate', sync); map.on('pitch', sync); sync();
}

// ── scale bar ──────────────────────────────────────────────────────────────
export function buildScaleBar(map) {
  const host = $('#scale');
  const bar = el('span', { class: 'scale-bar' });
  const zero = el('span', { class: 'scale-end', text: '0' });
  const max = el('span', { class: 'scale-end r' });
  const mBtn = el('button', { class: 'unit', text: 'm' });
  const ftBtn = el('button', { class: 'unit', text: 'ft' });
  mBtn.addEventListener('click', () => setUnits('m'));
  ftBtn.addEventListener('click', () => setUnits('ft'));

  host.replaceChildren(
    el('div', { class: 'scale-body' }, el('div', { class: 'scale-labels' }, zero, max), bar),
    el('div', { class: 'units' }, mBtn, ftBtn));

  // Metric rounds to 1, 2 or 5 times a power of ten. Imperial cannot: feet
  // rounded that way and then divided by 5,280 gives "3.8 mi". So it gets an
  // explicit ladder that crosses into miles at round numbers of miles.
  function niceMetric(v) {
    const p = Math.pow(10, Math.floor(Math.log10(v)));
    const f = v / p;
    return (f >= 5 ? 5 : f >= 2 ? 2 : 1) * p;
  }
  const FT = 5280;
  const IMPERIAL = [
    10, 20, 50, 100, 200, 500, 1000, 2000,          // feet
    FT, 2 * FT, 5 * FT, 10 * FT, 20 * FT, 50 * FT,  // 1, 2, 5, 10, 20, 50 miles
    100 * FT, 200 * FT, 500 * FT, 1000 * FT
  ];
  function niceImperial(feet) {
    let best = IMPERIAL[0];
    for (const v of IMPERIAL) if (v <= feet) best = v;
    return best;
  }

  function render() {
    const y = map.getContainer().clientHeight / 2;
    const w = map.getContainer().clientWidth;
    const a = map.unproject([0, y]), b = map.unproject([Math.min(120, w), y]);
    const metres = a.distanceTo(b);                    // over at most 120 px
    const perPx = metres / Math.min(120, w);

    let label, px;
    if (units === 'ft') {
      const feet = niceImperial(perPx * 110 / M_PER_FT);
      px = (feet * M_PER_FT) / perPx;
      label = feet >= FT ? `${(feet / FT).toLocaleString('en-US')} mi`
                         : `${feet.toLocaleString('en-US')} ft`;
    } else {
      const m = niceMetric(perPx * 110);
      px = m / perPx;
      label = m >= 1000 ? `${(m / 1000).toLocaleString('en-US')} km` : `${m} m`;
    }
    bar.style.width = `${Math.round(px)}px`;
    max.textContent = label;
    mBtn.classList.toggle('on', units === 'm');
    ftBtn.classList.toggle('on', units === 'ft');
  }

  unitListeners.add(render);
  map.on('move', render); map.on('resize', render);
  render();
}
