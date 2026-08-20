from part2_layers_a import soc, ags, agsmap, item, zipsrc, none, D5, D6, D7, DOS, ENC

LAYERS_C = [

# ── The waterfront edge ────────────────────────────────────────────────────
dict(id="wpaa", label="Waterfront public access areas", group="waterfront",
  geom="polygon", color="#90be6d", state="NY", agency="DCP", features=78,
  fields="38 columns including Chair Certification and CPC Approval dates",
  notes="Privately owned, publicly accessible. The paperwork trail of a right of way.",
  tags=["access","public space","zoning"], license="not specified", source=soc("388s-pnvc")),

dict(id="wpaa-footprints", label="WPAA building footprints", group="waterfront",
  geom="polygon", color="#a7c957", opacity=0.4, state="NY", agency="DCP",
  license="not specified", source=soc("bug9-xeqp")),

dict(id="wpaa-access-points", label="WPAA access points", group="waterfront",
  geom="point", color="#d4e09b", radius=3.0, state="NY", agency="DCP",
  notes="The doors. Where a person may actually step from the street onto the water's edge.",
  license="not specified", source=soc("9y58-8zvz")),

dict(id="public-waterfront", label="Publicly owned waterfront", group="waterfront",
  geom="polygon", color="#43aa8b", state="NY", agency="DCP", features=199,
  license="not specified", source=soc("jr73-mxkz")),

dict(id="boat-launches", label="Human-powered boat launches", group="waterfront",
  geom="point", color="#4cc9f0", radius=4, state="NY", agency="DCP", features=63, default=True,
  notes="Sixty-three places a person may put a kayak in the water. One of the two best ethnographic hooks in the survey.",
  tags=["kayak","access","ethnography"], license="not specified",
  source=soc("pxkn-awzt")),

dict(id="fishing-sites", label="Saltwater fishing sites", group="waterfront",
  geom="point", color="#f9c74f", radius=4, state="NY", agency="DCP", features=107,
  field="Ownership",
  notes="Who fishes where, and on whose land, is a question a map can pose and only fieldwork can answer.",
  tags=["fishing","access","ethnography"], license="not specified", source=soc("mvte-j9h9")),

dict(id="parks-waterfront", label="Waterfront parks", group="waterfront",
  geom="polygon", color="#74c69d", opacity=0.4, state="NY", agency="Parks",
  notes="Filtered to WATERFRONT = true from Parks Properties. This is how you get Brooklyn Bridge Park, the East River Esplanade and Freshkills — there are no separate layers for them.",
  license="not specified", source=soc("enfh-gkve", where="waterfront='true'")),

dict(id="planimetric-shoreline", label="Planimetric shoreline", group="waterfront",
  geom="line", color="#e8f1f5", width=1.2, state="NY", agency="DoITT", features=413,
  notes="Use this one for drawing. For analysis use the tidally coordinated shoreline instead.",
  license="not specified", source=soc("59xk-wagz")),

dict(id="tidal-shoreline", label="Tidally coordinated shoreline", group="waterfront",
  geom="line", color="#48cae4", width=1.4, state="NY", agency="DCP", vintage="2017 lidar",
  notes="Coordinated against Kings Point, Bergen West, Sandy Hook and The Battery. Use this one for analysis.",
  license="not specified", source=soc("pawq-tjb4")),

dict(id="wrp", label="Waterfront Revitalization Program boundary", group="regulation",
  geom="polygon", color="#577590", opacity=0.28, state="NY", agency="DCP", vintage="2026-03",
  notes="Use the live service, not the 2015 shapefile cbn4-bn4p.",
  license="not specified", source=ags(f"{D5}/WRP_Final/FeatureServer")),

dict(id="waterfront-access-plans", label="Waterfront access plans", group="regulation",
  geom="polygon", color="#6d6875", opacity=0.3, state="NY", agency="DCP", stale=True,
  notes="Where the City wrote a bespoke access rule for a stretch of shore instead of applying the general one.",
  license="not specified", source=soc("mtfi-jmfv")),

dict(id="coastal-boundary", label="Landward coastal area boundary", group="regulation",
  geom="line", color="#a8dadc", width=1.6, state="NY", agency="NYS DOS",
  notes="The line that legally defines the coastal zone.",
  license="not specified", source=ags(f"{DOS}/CoastalBoundary_Polyline_May2022/FeatureServer")),

dict(id="restrictive-declarations", label="Restrictive declaration sites", group="regulation",
  geom="polygon", color="#8e7dbe", opacity=0.35, state="NY", agency="DCP", vintage="2026-07",
  notes="Waterfront public-access obligations are often recorded as deed restrictions, so this is the legal instrument sitting behind the WPAA geography.",
  license="not specified", source=soc("cmni-fvnx")),

dict(id="zoning-special-districts", label="Special purpose districts (incl. Special Coastal Risk)", group="regulation",
  geom="polygon", color="#bc6c25", opacity=0.3, state="NY", agency="DCP",
  notes="The Special Coastal Risk District — Zoning Resolution Article XIII Chapter 7 — should live in the nysp special-purpose feature class of this geodatabase. That is an assumption; check it on download.",
  tags=["zoning","unverified"], license="not specified",
  source=dict(type="socrata-zip", domain="data.cityofnewyork.us", id="mm69-vrje",
              inner="nysp", note="six feature classes, 3.1 MB")),

# ── The harbour as worked space ────────────────────────────────────────────
dict(id="usace-channels", label="USACE navigation channels", group="harbour",
  geom="polygon", color="#8ecae6", opacity=0.3, state="NY/NJ", agency="USACE", features=58,
  notes="Ambrose, Anchorage, Kill Van Kull, Arthur Kill. The harbour as a maintained industrial surface — and a bi-state one.",
  tags=["new jersey","bi-state"], license="no access constraints",
  source=ags(f"{D7}/National_Channel_Framework/FeatureServer")),

dict(id="usace-ehydro", label="USACE eHydro survey footprints", group="harbour",
  geom="polygon", color="#219ebc", opacity=0.25, state="NY/NJ", agency="USACE", features=779,
  notes="779 dated channel-survey footprints — a record of when somebody last measured the bottom.",
  license="no access constraints", source=ags(f"{D7}/eHydro_Survey_Data/FeatureServer")),

dict(id="enc-shoreline-construction", label="Shoreline construction (NOAA chart)", group="harbour",
  geom="polygon", color="#ffb703", opacity=0.6, state="NY/NJ", agency="NOAA ENC", features=961,
  notes="Piers, wharves, bulkheads, seawalls. The City publishes no dataset of the structures holding its own shoreline in place — for some 520 miles of edge, everything usable comes from the navy's chartmakers. Rebuilt every Saturday night.",
  tags=["piers","bulkhead","seawall","absence","new jersey"],
  license="no access constraints", source=agsmap(ENC, [138, 85, 1])),

dict(id="enc-piles", label="Pilings (NOAA chart)", group="harbour",
  geom="point", color="#fb8500", radius=2.2, state="NY/NJ", agency="NOAA ENC", features=1667,
  notes="1,667 pilings — the ghosts of piers otherwise gone from every map the city keeps.",
  license="no access constraints", source=agsmap(ENC, [58])),

dict(id="enc-berths", label="Berths (NOAA chart)", group="harbour",
  geom="polygon", color="#fd9e02", opacity=0.5, state="NY/NJ", agency="NOAA ENC",
  license="no access constraints", source=agsmap(ENC, [49, 116, 169])),

dict(id="enc-dredged", label="Dredged areas (NOAA chart)", group="harbour",
  geom="polygon", color="#f48c06", opacity=0.3, state="NY/NJ", agency="NOAA ENC",
  license="no access constraints", source=agsmap(ENC, [228])),

dict(id="nos-hydro-archive", label="NOS hydrographic survey archive", group="harbour",
  geom="point", color="#dda15e", radius=2.4, state="NY/NJ", agency="NOAA NCEI",
  notes="11,000+ smooth sheets from the mid-1800s onward. An archive as much as a dataset: a century and a half of successive soundings of the same harbour, which is the closest thing here to a historical bathymetry.",
  tags=["history","bathymetry","archive"], license="no access constraints",
  source=dict(type="ncei", url="https://www.ncei.noaa.gov/products/nos-hydrographic-survey")),

dict(id="battery-tide-gauge", label="The Battery tide gauge (8518750)", group="harbour",
  geom="point", color="#e63946", radius=6, state="NY", agency="NOAA CO-OPS",
  fields="Water level, hourly height, high/low, monthly mean",
  notes="A time series, not a map — lat 40.700554, lon −74.01417. No key required, but rate-limited: budget for throttling. The record behind every sea-level number on this site.",
  tags=["tide","time series","the battery"], license="no access constraints",
  source=dict(type="coops", station="8518750",
              url="https://api.tidesandcurrents.noaa.gov/api/prod/datagetter")),
]
