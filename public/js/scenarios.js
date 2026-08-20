import { $, el } from './util.js';

// The scenario chooser. NYSERDA ships 32 floodplains — 8 sea-level-rise
// increments × 4 annual-chance events — and DEP ships 4 stormwater scenarios.
// Both are one tileset with an attribute per axis, so switching scenario is a
// setFilter, not a re-fetch.
export function buildScenarios(reg, lm) {
  const host = $('#scenario-controls');
  const empty = $('#scenario-empty');
  const state = new Map();   // layerId -> { axisId: value }

  function currentFilter(L) {
    const s = state.get(L.id) || {};
    const clauses = L.scenarioSet.axes
      .filter(a => s[a.id] != null)
      .map(a => ['==', ['to-string', ['get', a.field || a.id]], String(s[a.id])]);
    return clauses.length ? ['all', ...clauses] : null;
  }

  function apply(L) {
    const f = currentFilter(L);
    if (f) lm.setFilter(L.id, f);
    updateLabel(L);
  }

  function updateLabel(L) {
    const s = state.get(L.id) || {};
    const node = host.querySelector(`[data-summary="${L.id}"]`);
    if (!node) return;
    node.textContent = L.scenarioSet.axes
      .map(a => `${a.label}: ${(a.display?.[s[a.id]]) ?? s[a.id]}`)
      .join('   ·   ');
  }

  function render() {
    const active = lm.activeEntries().filter(L => L.scenarioSet);
    host.replaceChildren();
    empty.hidden = active.length > 0;
    for (const L of active) {
      if (!state.has(L.id)) {
        state.set(L.id, Object.fromEntries(
          L.scenarioSet.axes.map(a => [a.id, a.default ?? a.values[0]])));
      }
      const block = el('div', { class: 'group' },
        el('h2', {}, el('span', { text: L.label })),
        el('p', { class: 'blurb', 'data-summary': L.id }));
      for (const axis of L.scenarioSet.axes) {
        const s = state.get(L.id);
        const idx = Math.max(0, axis.values.indexOf(s[axis.id]));
        const val = el('span', { class: 'val', text: String(axis.display?.[s[axis.id]] ?? s[axis.id]) });
        const input = el('input', {
          type: 'range', min: 0, max: axis.values.length - 1, step: 1, value: idx
        });
        input.addEventListener('input', () => {
          const v = axis.values[+input.value];
          state.get(L.id)[axis.id] = v;
          val.textContent = String(axis.display?.[v] ?? v);
          apply(L);
        });
        block.append(el('div', { class: 'field' },
          el('label', {}, axis.label, val), input));
      }
      if (L.scenarioNote) block.append(el('p', { class: 'note warn', text: L.scenarioNote }));
      host.append(block);
      apply(L);
    }
  }

  lm.map.on('layerschange', render);
  render();
  return { render };
}
