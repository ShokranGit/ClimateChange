from part2_layers_a import soc, ags, agsmap, item, zipsrc, none, D5, D6, D7, DOS, ENC

MOCEJ = "mocej.nyc.data"

LAYERS_D = [

# ── Buildings & exposure ───────────────────────────────────────────────────
dict(id="building-elevation", label="Building elevation & subgrade", group="buildings",
  geom="point", color="#ffd166", radius=1.2, state="NY", agency="DCP",
  features=861876, vintage="2023-10", probe=True,
  fields="z_grade, z_floor (first-floor elevation, NAVD88 ft), subgrade basement flag",
  notes="861,876 building points. The only layer that lets a student compute freeboard — first-floor elevation minus base flood elevation. Rendered as a probe layer: a real fill over this many features crashes the renderer, so MapLibre downloads the tiles, draws none, and it stays queryable.",
  tags=["freeboard","basement","exposure"], license="not specified",
  source=soc("bsin-59hv")),

dict(id="climate-budget-exposure", label="Resiliency exposure forecast — coastal flooding", group="buildings",
  geom="polygon", color="#ee9b00", opacity=0.4, state="NY", agency="MOCEJ", vintage="2026-05-19",
  notes="NTA-level and without geometry of its own — join NTA_Code to the 2020 Neighborhood Tabulation Areas service. Compares a Control Scenario, with no coastal protection, against a Planned Action Scenario. The City costing its own future.",
  tags=["budget","nta","projection"], license="not specified",
  source=soc("7n9x-tbtd", join="NTA_Code")),

dict(id="climate-budget-inventory", label="Climate budgeting exposure inventory", group="buildings",
  geom="polygon", color="#ca6702", opacity=0.4, state="NY", agency="MOCEJ", vintage="2026-05-19",
  license="not specified", source=soc("dpq6-sy7w", join="NTA_Code")),

# ── Vulnerability & environmental justice ──────────────────────────────────
dict(id="fvi", label="Flood vulnerability index", group="vulnerability",
  geom="polygon", color="#c1121f", opacity=0.5, state="NY", agency="MOCEJ",
  fields="fshri (12 socioeconomic indicators), ss_cur / ss_50s / ss_80s storm surge, tid_20s / tid_50s / tid_80s tidal",
  notes="By census tract. Every field ships as text — cast before you compare.",
  tags=["justice","vulnerability","census tract"], license="not specified",
  source=soc("mrjc-v9pm")),

dict(id="redlining", label="Historically redlined areas (HOLC)", group="vulnerability",
  geom="polygon", color="#9d0208", opacity=0.4, state="NY", agency="MOCEJ",
  notes="Put this under the floodplain and over the environmental justice areas. Three layers, one publisher, one argument.",
  tags=["redlining","holc","justice","history"], license="not specified",
  source=item("777c786cb9604be9acb8ce5879a45ffe")),

dict(id="ej-areas", label="EJNYC environmental justice areas", group="vulnerability",
  geom="polygon", color="#e07a5f", opacity=0.35, state="NY", agency="MOCEJ",
  license="not specified",
  source=ags("https://services6.arcgis.com/yG5s3afENB5iO9fj/arcgis/rest/services/EJ_Areas/FeatureServer")),

dict(id="cejst", label="Federal disadvantaged communities (CEJST)", group="vulnerability",
  geom="polygon", color="#b5838d", opacity=0.35, state="NY/NJ", agency="MOCEJ / CEQ",
  notes="The federal definition, beside the city's and the state's. Where the three disagree is where the politics is.",
  tags=["justice","federal","new jersey"], license="not specified",
  source=dict(type="arcgis-owner", owner=MOCEJ, match="disadvantaged communities")),

dict(id="nys-dac", label="NYS disadvantaged communities (2023)", group="vulnerability",
  geom="polygon", color="#bc6c25", opacity=0.35, state="NY", agency="NYSERDA / CJWG",
  fields="coastal_flooding_storm_risk, inland_flooding_risk, days_above_90_degrees_2050, low_vegetative_cover",
  license="not specified", source=soc("2e6c-s6fp", dom="data.ny.gov")),

dict(id="nycha", label="NYCHA developments", group="vulnerability",
  geom="polygon", color="#780000", opacity=0.45, state="NY", agency="MOCEJ / NYCHA",
  notes="Public housing against the floodplain is the single most-cited overlay in the Sandy literature, and it is one layer away here.",
  tags=["housing","justice"], license="not specified",
  source=item("0e6c53d3dcc349f49a226a008465ccb5")),

dict(id="hvi", label="Heat vulnerability index", group="vulnerability",
  geom="polygon", color="#e85d04", opacity=0.45, state="NY", agency="DOHMH",
  notes="The other climate hazard. Heat and flood vulnerability do not fall on the same blocks, and the difference is worth an afternoon.",
  tags=["heat","justice"], license="not specified", source=soc("4mhf-duep")),

dict(id="stormwater-flooding-tract", label="Stormwater flooding by census tract", group="vulnerability",
  geom="polygon", color="#2a9d8f", opacity=0.4, state="NY", agency="MOCEJ",
  license="not specified",
  source=dict(type="arcgis-owner", owner=MOCEJ, match="stormwater flooding census tract")),

dict(id="peaker-plants", label="Peaker plants", group="vulnerability",
  geom="point", color="#6a040f", radius=4.5, state="NY", agency="MOCEJ",
  notes="Fired up on the hottest days, sited where objection was cheapest. Peakers, bus depots and last-mile warehouses together are the standard EJ triad.",
  tags=["justice","energy"], license="not specified",
  source=dict(type="arcgis-owner", owner=MOCEJ, match="peaker plants")),

dict(id="bus-depots", label="Bus depots", group="vulnerability",
  geom="point", color="#9d0208", radius=4, state="NY", agency="MOCEJ",
  license="not specified", source=dict(type="arcgis-owner", owner=MOCEJ, match="bus depots")),

dict(id="last-mile-warehouses", label="Last-mile warehouses", group="vulnerability",
  geom="point", color="#dc2f02", radius=4, state="NY", agency="MOCEJ",
  notes="The newest layer of the industrial waterfront, and the one arriving fastest.",
  tags=["justice","logistics","waterfront"], license="not specified",
  source=dict(type="arcgis-owner", owner=MOCEJ, match="last mile warehouses")),

dict(id="black-carbon", label="Black carbon", group="vulnerability",
  geom="polygon", color="#343a40", opacity=0.45, state="NY", agency="MOCEJ",
  license="not specified", source=dict(type="arcgis-owner", owner=MOCEJ, match="black carbon")),

dict(id="ny-rising", label="NY Rising community reconstruction areas", group="vulnerability",
  geom="polygon", color="#b5838d", opacity=0.35, state="NY", agency="NYS DOS / GOSR",
  notes="In New York City these were digitised from neighbourhoods and business recovery zones, then adjusted by Community Planning Committees using damage assessments. An administratively drawn neighbourhood boundary, produced by committee in response to a flood, still marked preliminary.",
  tags=["sandy","recovery","ethnography"], license="Copyright names GOSR",
  source=ags(f"{DOS}/NYRising_CommunityPlanningBoundaries/FeatureServer")),

dict(id="nfip-claims", label="NFIP redacted claims", group="vulnerability",
  geom="polygon", color="#4a4e69", opacity=0.4, state="NY/NJ", agency="FEMA",
  notes="Tabular and redacted to census tract, filterable server-side by countyCode. Where insurance actually paid, as against where the maps say it should have. A working reference implementation exists at github.com/mebauer/nfip-datasets.",
  tags=["insurance","fema","new jersey"], license="not specified",
  source=dict(type="fema-openfema", endpoint="FimaNfipClaims")),

dict(id="nfip-policies", label="NFIP policies in force", group="vulnerability",
  geom="polygon", color="#22223b", opacity=0.4, state="NY/NJ", agency="FEMA",
  notes="Who is insured, beside who claimed. The ratio is a map of confidence.",
  license="not specified", source=dict(type="fema-openfema", endpoint="FimaNfipPolicies")),

# ── Wetlands, habitat & land cover ─────────────────────────────────────────
dict(id="nyc-wetlands", label="NYC wetlands", group="ecology",
  geom="polygon", color="#52b788", opacity=0.45, state="NY", agency="DEP / UVM SAL", features=6544,
  notes="Explicitly carries no jurisdictional authority. For regulatory wetlands go to NYSDEC — and then read what DEC says about its own maps.",
  license="not specified", source=soc("p48c-iqtu")),

dict(id="forever-wild", label="Forever Wild preserves", group="ecology",
  geom="polygon", color="#40916c", opacity=0.45, state="NY", agency="Parks", features=139,
  license="not specified", source=soc("48va-85tp")),

dict(id="sig-habitats", label="Significant coastal fish & wildlife habitats", group="ecology",
  geom="polygon", color="#2a9d8f", opacity=0.35, state="NY", agency="NYS DOS", features=257,
  license="not specified", source=ags(f"{DOS}/SigHabs_NYSDOS_2014_new/FeatureServer")),

dict(id="tree-canopy", label="Tree canopy (2017)", group="ecology",
  geom="polygon", color="#1b4332", opacity=0.5, state="NY", agency="MOCEJ",
  license="not specified", source=dict(type="arcgis-owner", owner=MOCEJ, match="tree canopy 2017")),

dict(id="land-cover-2017", label="Land cover, 6-inch (2017)", group="ecology",
  geom="polygon", color="#95d5b2", opacity=0.5, state="NY", agency="DoITT", heavy=True,
  notes="1.33 GB and eight classes. Downsample to 1–5 m or aggregate to polygons before you go anywhere near a browser.",
  license="not specified", source=soc("he6d-2qns")),

dict(id="impervious", label="Impervious surface (2020)", group="ecology",
  geom="polygon", color="#6c757d", opacity=0.5, state="NY", agency="DEP", heavy=True,
  notes="4.96 GB. Do not load raw — join the percentage to MapPLUTO on BBL instead.",
  license="not specified", source=soc("uex9-rfq8")),

# ── The six NYSDEC layers ──────────────────────────────────────────────────
dict(id="dec-tidal-wetlands", label="DEC regulatory tidal wetlands", group="ecology",
  geom="polygon", color="#95d5b2", opacity=0.45, state="NY", agency="NYSDEC",
  features=10312, gated=True,
  notes="Layer 1, not 0. Troy Dam to the tip of Staten Island.",
  license="NYSDEC — secondary distribution not allowed",
  source=ags(f"{D6}/Regulatory_Tidal_Wetlands/FeatureServer", 1)),

dict(id="dec-coastal-erosion", label="DEC coastal erosion hazard areas", group="ecology",
  geom="polygon", color="#e9c46a", opacity=0.4, state="NY", agency="NYSDEC",
  features=543, gated=True,
  notes="DEC says explicitly this is an initial screening tool only, and that the legal boundaries are the paper maps filed with municipalities. A good teaching point about the gap between a shapefile and a regulation.",
  license="NYSDEC — secondary distribution not allowed",
  source=ags(f"{D6}/Coastal_Erosion_Hazard_Areas/FeatureServer")),

dict(id="dec-freshwater-wetlands", label="DEC informational freshwater wetlands", group="ecology",
  geom="polygon", color="#74c69d", opacity=0.4, state="NY", agency="NYSDEC",
  features=310908, gated=True,
  notes="Layer 2. 310,908 polygons statewide — clip before you do anything. Non-regulatory.",
  license="NYSDEC — secondary distribution not allowed",
  source=ags(f"{D6}/Informational_Freshwater_Wetland_Mapping/FeatureServer", 2)),

dict(id="dec-prev-freshwater", label="DEC previously mapped freshwater wetlands", group="ecology",
  geom="polygon", color="#b7e4c7", opacity=0.4, state="NY", agency="NYSDEC", gated=True,
  notes="Where the 2022 Act moved the jurisdiction line. The difference between this and the current layer is the reform, drawn.",
  license="NYSDEC — secondary distribution not allowed",
  source=ags(f"{D6}/Previously_Mapped_Freshwater_Wetlands/FeatureServer")),

dict(id="dec-hudson-tidal", label="Hudson River estuary tidal wetlands", group="ecology",
  geom="polygon", color="#40916c", opacity=0.4, state="NY", agency="NYSDEC", gated=True,
  license="NYSDEC — secondary distribution not allowed",
  source=ags(f"{D6}/Hudson_River_Estuary_Tidal_Wetlands/FeatureServer")),

dict(id="dec-remediation", label="DEC remediation parcels (brownfields)", group="vulnerability",
  geom="polygon", color="#bb3e03", opacity=0.55, state="NY", agency="NYSDEC",
  features=4534, gated=True,
  notes="Updated nightly. Intersect with the floodplain for the toxic-sites-in-the-flood-zone exercise. Small; tiles beautifully.",
  license="NYSDEC — secondary distribution not allowed",
  source=ags(f"{D6}/Remediation_Parcels/FeatureServer")),
]
