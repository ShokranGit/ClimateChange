export const $  = (s, r = document) => r.querySelector(s);
export const $$ = (s, r = document) => [...r.querySelectorAll(s)];

export function el(tag, attrs = {}, ...kids) {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v == null || v === false) continue;
    if (k === 'class') n.className = v;
    else if (k === 'text') n.textContent = v;
    else if (k.startsWith('on')) n.addEventListener(k.slice(2).toLowerCase(), v);
    else n.setAttribute(k, v === true ? '' : v);
  }
  for (const k of kids.flat()) if (k != null) n.append(k);
  return n;
}

let toastTimer;
export function toast(msg, ms = 3200) {
  const t = $('#toast');
  if (!t) return;
  t.textContent = msg; t.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { t.hidden = true; }, ms);
}

// §3 lesson 4: map.once('idle') never fires while anything else is fetching.
// Every idle-wait must be bounded.
export function idle(map, timeoutMs = 8000) {
  return new Promise(resolve => {
    let done = false;
    const finish = ok => { if (!done) { done = true; map.off('idle', onIdle); resolve(ok); } };
    const onIdle = () => finish(true);
    map.once('idle', onIdle);
    setTimeout(() => finish(false), timeoutMs);
  });
}

// True once the style *definition* is parsed — which is all map.addSource and
// map.addLayer require. Deliberately not isStyleLoaded(): that also waits for
// every source's tiles, and a background tab gets no frames, so it requests no
// tiles and the answer stays false forever. MapLibre is pinned (with an SRI
// hash) so reading _loaded is safe; isStyleLoaded is the fallback if it moves.
export function styleAccepting(map) {
  const s = map.style;
  return s && typeof s._loaded === 'boolean' ? s._loaded : map.isStyleLoaded();
}

// Resolves once the style is usable. MapLibre only fires `load` after its first
// render, and a background tab gets no animation frames — so a tab opened in the
// background would sit forever with an empty panel if initialisation waited on
// `load`. Anything that does not touch the style should not wait at all.
export function whenStyleReady(map, timeoutMs = 30000) {
  if (styleAccepting(map)) return Promise.resolve(true);
  return new Promise(resolve => {
    let done = false;
    const check = () => { if (styleAccepting(map)) finish(true); };
    const poll = setInterval(check, 100);
    const timer = setTimeout(() => finish(false), timeoutMs);
    function finish(ok) {
      if (done) return;
      done = true;
      clearInterval(poll);
      clearTimeout(timer);
      map.off('load', check);
      map.off('styledata', check);
      resolve(ok);
    }
    map.on('load', check);
    map.on('styledata', check);
    check();
  });
}

export const fmt = n =>
  n == null ? '' : typeof n === 'number' ? n.toLocaleString('en-US') : String(n);

// New York time helpers. §3 lesson 8: the first version of the shade clock was
// UTC and put the 2pm sun in the east. Declare these once; never redeclare.
const NY = 'America/New_York';
export function nyOffsetMs(d = new Date()) {
  const s = new Intl.DateTimeFormat('en-US', {
    timeZone: NY, timeZoneName: 'shortOffset'
  }).formatToParts(d).find(p => p.type === 'timeZoneName').value;
  const m = /GMT([+-])(\d+)(?::(\d+))?/.exec(s);
  if (!m) return 0;
  const sign = m[1] === '-' ? -1 : 1;
  return sign * ((+m[2]) * 60 + (+(m[3] || 0))) * 60000;
}
export const fromNY = (d = new Date()) => new Date(d.getTime() + nyOffsetMs(d));
export const nyDateValue = (d = new Date()) => fromNY(d).toISOString().slice(0, 10);
