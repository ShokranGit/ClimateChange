#!/usr/bin/env python3
"""Assembles scripts/registry.src.json from the parts in this directory.

Keeping the registry as Python rather than hand-edited JSON means the ~106
entries stay diffable, the shared endpoint constants are written once, and a
typo in a group id fails here instead of silently producing an empty panel.
"""
import json, sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from part1_groups import GROUPS
from part2_layers_a import LAYERS_A
from part3_layers_b import LAYERS_B
from part4_layers_c import LAYERS_C
from part5_layers_d import LAYERS_D
from part6_layers_e import LAYERS_E

layers = LAYERS_A + LAYERS_B + LAYERS_C + LAYERS_D + LAYERS_E

# ── validate ───────────────────────────────────────────────────────────────
gids = {g["id"] for g in GROUPS}
seen, problems = set(), []
for L in layers:
    if L["id"] in seen: problems.append(f'duplicate id {L["id"]}')
    seen.add(L["id"])
    if L["group"] not in gids: problems.append(f'{L["id"]}: unknown group {L["group"]}')
    if not L.get("absent") and "geom" not in L: problems.append(f'{L["id"]}: no geom')
    if "source" not in L: problems.append(f'{L["id"]}: no source')
    for a in (L.get("scenarioSet") or {}).get("axes", []):
        if a.get("default") and a["default"] not in a["values"]:
            problems.append(f'{L["id"]}/{a["id"]}: default not in values')
        if a.get("display"):
            missing = [v for v in a["values"] if v not in a["display"]]
            if missing: problems.append(f'{L["id"]}/{a["id"]}: no label for {missing}')
if problems:
    print("\n".join(problems)); sys.exit(1)

variants = 0
for L in layers:
    n = 1
    for a in (L.get("scenarioSet") or {}).get("axes", []): n *= len(a["values"])
    variants += n

out = {
  "version": 2,
  "note": "Built by registry/build.py — edit the parts there, not this file. "
          "`source` blocks are read by scripts/bake-layers.mjs in CI; the browser ignores them.",
  "groups": GROUPS,
  "layers": layers,
  "parked": [],
  "parked_note": "Nothing parked. Parking a layer is moving one entry from `layers` into `parked` — the app reads only `layers`.",
}
# Machine-generated and machine-read: the authored form is registry/*.py, so
# there is nothing to gain from pretty-printing 106 entries.
with open("scripts/registry.src.json", "w") as f:
    json.dump(out, f, separators=(",", ":"), ensure_ascii=False)

by_group = {}
for L in layers: by_group.setdefault(L["group"], []).append(L)
print(f"{len(layers)} entries, {variants} counting every scenario variant, {len(GROUPS)} groups")
for g in GROUPS:
    n = len(by_group.get(g["id"], []))
    print(f"  {g['label']:<45} {n}")
print(f"  gated (NYSDEC)   {sum(1 for L in layers if L.get('gated'))}")
print(f"  absent           {sum(1 for L in layers if L.get('absent'))}")
print(f"  scenario sets    {sum(1 for L in layers if L.get('scenarioSet'))}")
