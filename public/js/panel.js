import { $, $$, el, fmt } from './util.js';
import { searchLayers, scopeOf } from './registry.js';

// Status chips read as one row, so the language has to be short and true.
const STATUS = {
  live:    { label: 'live',        cls: 'ok',    title: 'Fetched from the publisher when you switch it on' },
  baked:   { label: 'baked',       cls: 'ok',    title: 'A local copy, fetched whole' },
  pending: { label: 'not yet',     cls: 'wait',  title: 'Described here, not yet fetchable in the browser' },
  gated:   { label: 'DEC — held',  cls: 'gated', title: 'NYSDEC forbids secondary distribution' },
  absent:  { label: 'not published', cls: 'absent', title: 'Searched for and confirmed missing from the public record' }
};

const FILTERS = [
  { id: 'all',      label: 'Everything', test: () => true },
  { id: 'ready',    label: 'Ready now',  test: L => L.drawable },
  { id: 'scenario', label: 'Scenarios',  test: L => !!L.scenarioSet },
  { id: 'pending',  label: 'Not yet',    test: L => L.status === 'pending' || L.status === 'gated' },
  { id: 'absent',   label: 'Absences',   test: L => L.status === 'absent' }
];

const SCOPES = [
  { id: 'ny',   label: 'New York' },
  { id: 'nj',   label: 'New Jersey' },
  { id: 'both', label: 'Both shores' }
];

export function buildPanel(reg, lm, onScenarioChange) {
  const host = $('#layer-groups');
  const search = $('#layer-search');
  const count = $('#layer-count');
  const chipHost = $('#panel-chips');

  const state = { filter: 'all', scopes: new Set(['ny', 'nj', 'both']), collapsed: new Set() };

  // ── chips ────────────────────────────────────────────────────────────────
  // Fieldmap puts the borough switches above the layer list and says plainly
  // what switching one off does. Same idea, one scale up: which side of the
  // harbour a layer covers.
  function renderChips() {
    chipHost.replaceChildren(
      el('p', { class: 'chip-label', text: 'Where' }),
      el('div', { class: 'chips' }, SCOPES.map(s => {
        const on = state.scopes.has(s.id);
        return el('button', {
          class: `chip${on ? ' on' : ''}`, 'aria-pressed': String(on), text: s.label,
          onclick: () => {
            state.scopes.has(s.id) ? state.scopes.delete(s.id) : state.scopes.add(s.id);
            if (!state.scopes.size) SCOPES.forEach(x => state.scopes.add(x.id));
            renderChips(); render();
          }
        });
      })),
      el('p', { class: 'chip-label', text: 'Show' }),
      el('div', { class: 'chips' }, FILTERS.map(f =>
        el('button', {
          class: `chip${state.filter === f.id ? ' on' : ''}`,
          'aria-pressed': String(state.filter === f.id), text: f.label,
          onclick: () => { state.filter = f.id; renderChips(); render(); }
        })))
    );
  }

  function visible(q) {
    const f = FILTERS.find(x => x.id === state.filter);
    const matches = new Set(searchLayers(reg.layers, q).map(L => L.id));
    return reg.layers.filter(L =>
      matches.has(L.id) && f.test(L) && state.scopes.has(scopeOf(L)));
  }

  const render = (q = search.value || '') => {
    const shownIds = new Set(visible(q).map(L => L.id));
    host.replaceChildren();
    for (const g of reg.groups) {
      const shown = g.layers.filter(L => shownIds.has(L.id));
      if (!shown.length) continue;
      const collapsed = state.collapsed.has(g.id);
      const ready = shown.filter(L => L.drawable).length;
      const head = el('h2', { role: 'button', tabindex: '0' },
        el('span', { text: g.label }),
        el('span', { class: 'grouptally', text: ready === shown.length
          ? `${shown.length}` : `${ready}/${shown.length}` }),
        el('span', { class: 'chev', text: '▾' }));
      const grp = el('div', { class: `group${collapsed ? ' collapsed' : ''}` }, head,
        g.blurb ? el('p', { class: 'blurb', text: g.blurb }) : null,
        el('div', { class: 'group-body' }, shown.map(L => layerRow(L, lm, onScenarioChange))));
      const toggle = () => {
        state.collapsed.has(g.id) ? state.collapsed.delete(g.id) : state.collapsed.add(g.id);
        grp.classList.toggle('collapsed');
      };
      head.addEventListener('click', toggle);
      head.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(); } });
      host.append(grp);
    }
    if (!host.children.length) {
      host.append(el('p', { class: 'note', text: q ? `Nothing matches “${q}”.` : 'Nothing matches those filters.' }));
    }
  };

  const refreshCount = () => {
    const c = reg.counts || {};
    count.textContent = `${lm.on.size} on · ${reg.drawable.length} ready of ${reg.layers.length}`;
    count.title = `live ${c.live || 0} · baked ${c.baked || 0} · not yet ${c.pending || 0}`
                + ` · DEC-held ${c.gated || 0} · confirmed absent ${c.absent || 0}`;
  };

  search.addEventListener('input', () => render(search.value));
  // A layer can go on or off without its checkbox being the cause: ?on= in the
  // URL, a scenario preset, a base map switch putting layers back. The panel
  // has to follow the manager rather than remember what was ticked.
  const syncChecks = () => {
    for (const cb of document.querySelectorAll('#layer-groups input[type=checkbox][data-layer-id]')) {
      const on = lm.isOn(cb.dataset.layerId);
      if (cb.checked !== on) cb.checked = on;
    }
  };
  lm.map.on('layerschange', () => { refreshCount(); syncChecks(); });
  renderChips();
  render();
  refreshCount();
  syncChecks();
  return { render: () => render(search.value) };
}

function layerRow(L, lm, onScenarioChange) {
  const st = STATUS[L.status] || STATUS.pending;
  const badges = [];
  if (L.scenarioSet) {
    const n = L.scenarioSet.axes.reduce((p, a) => p * a.values.length, 1);
    badges.push(el('span', { class: 'badge new', title: 'Has a scenario chooser',
      text: `${n} scenarios` }));
  }
  if (L.partial) badges.push(el('span', { class: 'badge stale',
    title: `The publisher caps a single query at ${L.partial} features. Bake it to get the whole layer.`,
    text: `first ${fmt(L.partial)}` }));
  if (L.heavy) badges.push(el('span', { class: 'badge stale', title: 'Gigabytes — downsample before use', text: 'very large' }));
  if (L.stale) badges.push(el('span', { class: 'badge stale', text: 'stale' }));
  if (L.status !== 'live' && L.status !== 'baked')
    badges.push(el('span', { class: `badge ${st.cls}`, title: st.title, text: st.label }));

  const meta = [L.agency, L.features ? `${fmt(L.features)} features` : null, L.vintage]
    .filter(Boolean).join(' · ');

  const body = el('span', { class: 'layer-body' },
    el('span', { class: 'name' }, L.label, ...badges),
    meta ? el('span', { class: 'meta', text: meta }) : null,
    L.drawable ? null : el('span', { class: 'reason', text: L.reason || '' }));

  if (!L.drawable) {
    const row = el('div', { class: 'layer off', title: L.notes || '' },
      el('i', { class: 'swatch dim', style: `background:${L.color || '#8d99ae'}` }), body);
    return row;
  }

  const cb = el('input', { type: 'checkbox', checked: lm.isOn(L.id) });
  cb.dataset.layerId = L.id;
  cb.addEventListener('change', async () => {
    cb.disabled = true;
    await lm.toggle(L, cb.checked);
    cb.checked = lm.isOn(L.id);
    cb.disabled = false;
    onScenarioChange?.();
  });
  return el('label', { class: 'layer', title: L.notes || '' },
    cb, el('i', { class: 'swatch', style: `background:${L.color || '#8d99ae'}` }), body);
}

export function wireChrome() {
  const panel = $('#panel'), toggle = $('#panel-toggle');
  const open = v => { panel.hidden = !v; toggle.setAttribute('aria-expanded', String(v)); };
  toggle.addEventListener('click', () => open(panel.hidden));
  $('#panel-close').addEventListener('click', () => open(false));
  open(window.innerWidth > 720);

  $$('.tabs button').forEach(b => b.addEventListener('click', () => {
    $$('.tabs button').forEach(x => x.setAttribute('aria-selected', String(x === b)));
    $$('.tab-body').forEach(x => { x.hidden = x.id !== `tab-${b.dataset.tab}`; });
  }));
}
