import { $, $$, el, fmt } from './util.js';
import { searchLayers } from './registry.js';

const SWATCH = L => el('i', { class: 'swatch', style: `background:${L.color || '#8d99ae'}` });

export function buildPanel(reg, lm, onScenarioChange) {
  const host = $('#layer-groups');
  const search = $('#layer-search');
  const count = $('#layer-count');

  const render = (q = '') => {
    const visible = new Set(searchLayers(reg.layers, q).map(L => L.id));
    host.replaceChildren();
    for (const g of reg.groups) {
      const shown = g.layers.filter(L => visible.has(L.id));
      if (!shown.length) continue;
      const body = el('div', { class: 'group-body' },
        shown.map(L => layerRow(L, lm, onScenarioChange)));
      const head = el('h2', {},
        el('span', { text: `${g.label} (${shown.length})` }),
        el('span', { class: 'chev', text: '▾' }));
      const grp = el('div', { class: 'group' }, head,
        g.blurb ? el('p', { class: 'blurb', text: g.blurb }) : null, body);
      head.addEventListener('click', () => grp.classList.toggle('collapsed'));
      host.append(grp);
    }
    if (!host.children.length) {
      host.append(el('p', { class: 'note', text: `Nothing matches “${q}”.` }));
    }
  };

  const refreshCount = () => {
    count.textContent = `${lm.on.size} of ${reg.layers.length} layers on`;
  };

  search.addEventListener('input', () => render(search.value));
  lm.map.on('layerschange', refreshCount);
  render();
  refreshCount();
  return { render: () => render(search.value) };
}

function layerRow(L, lm, onScenarioChange) {
  const cb = el('input', { type: 'checkbox', checked: lm.isOn(L.id) });
  cb.addEventListener('change', async () => {
    cb.disabled = true;
    await lm.toggle(L, cb.checked);
    cb.checked = lm.isOn(L.id);
    cb.disabled = false;
    onScenarioChange?.();
  });
  const badges = [];
  if (L.gated)  badges.push(el('span', { class: 'badge gated', text: 'DEC — not re-served' }));
  if (L.stale)  badges.push(el('span', { class: 'badge stale', text: 'stale' }));
  if (L.scenarioSet) badges.push(el('span', { class: 'badge new', text: 'scenarios' }));

  const meta = [L.agency, L.features ? `${fmt(L.features)} features` : null, L.vintage]
    .filter(Boolean).join(' · ');

  const row = el('label', { class: 'layer' }, cb, SWATCH(L),
    el('span', {},
      el('span', { class: 'name' }, L.label, ...badges),
      el('span', { class: 'meta', text: meta })));
  return row;
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
