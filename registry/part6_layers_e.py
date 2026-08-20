from part2_layers_a import soc, ags, agsmap, item, zipsrc, none, D5, D6, D7, DOS, ENC

LAYERS_E = [

# ── Water quality & health ─────────────────────────────────────────────────
dict(id="harbor-water-quality", label="Harbor water quality", group="water-quality",
  geom="point", color="#00b4d8", radius=3, state="NY", agency="DEP",
  features=98288, absent_geometry=True,
  notes="98,288 measurements, 43 columns, and no coordinates. The schema carries a sampling-location code and no geometry: a century-old sampling programme whose measurements are public and whose places are not. Listed here so the absence is visible rather than silently omitted.",
  tags=["absence","water quality"], license="not specified", source=soc("5uug-f49n")),

dict(id="beach-water-samples", label="Beach water samples (enterococci)", group="water-quality",
  geom="point", color="#90e0ef", radius=3, state="NY", agency="DOHMH", features=30605,
  notes="Joins on beach name. The one water-quality series with a place attached, and the one that closes beaches.",
  license="not specified", source=soc("2xir-kwzz", join="beach_name")),

dict(id="dohmh-waterways", label="DOHMH waterways indicators (NTA)", group="water-quality",
  geom="polygon", color="#0096c7", opacity=0.4, state="NY", agency="DOHMH",
  fields="Dissolved oxygen, bacteria, aggregated to neighbourhood tabulation area",
  notes="The practical route to mapping harbour water quality without first solving the station-geometry problem.",
  license="not specified",
  source=dict(type="dohmh", url="https://a816-dohbesp.nyc.gov/IndicatorPublic/data-explorer/waterways/?id=2427")),

dict(id="hyperlocal-temperature", label="Hyperlocal temperature sensors", group="water-quality",
  geom="point", color="#f4845f", radius=2.6, state="NY", agency="DOHMH",
  features=475, vintage="hourly",
  notes="Roughly 475 street sensors reporting hourly — the same distributed-sensor model as FloodNet, pointed at heat instead of water.",
  tags=["heat","sensors","community science"], license="not specified",
  source=soc("qdq3-9eqn", lat="latitude", lon="longitude")),

# ── Terrain, bathymetry & imagery ──────────────────────────────────────────
dict(id="topobathy-2017", label="Topobathymetric DEM, 1 m (2017)", group="terrain",
  geom="raster", format="raster", opacity=0.85, state="NY", agency="NYS ITS",
  notes="Green and near-infrared lidar with bathymetry integrated, so it does not stop at the waterline — the only elevation product here that describes the bottom as well as the bank. exportTilesAllowed is false: rendering service only. For files, use the NOAA product.",
  tags=["lidar","bathymetry","navd88"], license="not specified",
  source=dict(type="image-server",
              url="https://elevation.its.ny.gov/arcgis/rest/services/NYC_TopoBathymetric_2017_1_meter/ImageServer")),

dict(id="topobathy-2017-tiles", label="Topobathy lidar DEM, 1 ft (2017) — tiles", group="terrain",
  geom="raster", format="raster", state="NY", agency="NOAA", heavy=True,
  notes="31 GeoTIFF tiles, EPSG:6539 horizontal and 6360 vertical, collected May–July 2017. Clip via the Digital Coast Data Access Viewer rather than pulling the bulk S3 prefix. No access constraints.",
  license="no access constraints",
  source=dict(type="noaa-inport", item="64732")),

dict(id="usgs-3dep", label="USGS 3DEP elevation", group="terrain",
  geom="raster", format="raster", state="NY/NJ", agency="USGS",
  notes="Free of charge and without use restrictions — the cleanest licence in the whole survey, and the only elevation source that covers both states uniformly.",
  tags=["new jersey","bi-state","elevation"], license="no use restrictions",
  source=dict(type="usgs-3dep")),

dict(id="orthoimagery", label="NYC orthoimagery", group="terrain",
  geom="raster", format="raster", state="NY", agency="NYS GIS Clearinghouse",
  scenarioSet=dict(axes=[
    dict(id="epoch", label="Year", field="epoch",
      values=["2006","2008","2010","2012","2014","2016","2018","2020","2022","2024"],
      default="2024",
      display={y: y for y in ["2006","2008","2010","2012","2014","2016","2018","2020","2022","2024"]})]),
  scenarioNote="Ten epochs from 2006 to 2024, per borough. Step through them over a stretch of shore and the landfill, the buyout, and the new bulkhead all become visible without a single attribute. Registration is no longer required — the Clearinghouse dropped password protection in January 2023.",
  tags=["imagery","history","change"], license="not specified",
  source=dict(type="nys-ortho",
              pattern="https://gisdata.ny.gov/ortho/nysdop12/new_york_city/spcs/zips/boro_{boro}_sp{yy}.zip")),

# ── Getting there, and getting out ─────────────────────────────────────────
dict(id="ferry-landings", label="NYC Ferry landings", group="transport",
  geom="point", color="#00b4d8", radius=4.5, state="NY", agency="NYC Ferry",
  notes="From stops.txt in the GTFS feed. The only explicit licence found anywhere in this survey, and it is the most restrictive of the lot — revocable, non-transferable, non-assignable. The federal navy-chart data is freer than the city's ferry timetable.",
  tags=["ferry","licence","transit"], license="REVOCABLE, non-transferable, non-assignable",
  source=dict(type="gtfs", url="http://nycferry.connexionz.net/rtt/public/resource/gtfs.zip", part="stops")),

dict(id="ferry-routes", label="NYC Ferry routes", group="transport",
  geom="line", color="#0077b6", width=1.6, state="NY", agency="NYC Ferry",
  notes="From shapes.txt. The waterborne commute, which is also the evacuation route nobody plans around.",
  license="REVOCABLE, non-transferable, non-assignable",
  source=dict(type="gtfs", url="http://nycferry.connexionz.net/rtt/public/resource/gtfs.zip", part="shapes")),

# ── Confirmed absent ───────────────────────────────────────────────────────
dict(id="absent-shoreline-structures", label="Piers, wharves, bulkheads, seawalls, revetments, riprap",
  group="absences", absent=True, agency="City of New York",
  notes="Catalogue queries for 'pier marine terminal bulkhead', 'landing terminal dock' and 'marina boat launch kayak dock' all return zero. For a city with some 520 miles of shoreline, the structures holding the edge in place are absent from the municipal commons. Everything usable comes from the NOAA chart layers in this site.",
  source=none("no City dataset exists; use the NOAA ENC layers instead")),

dict(id="absent-waterfront-plan-gis", label="2021 Comprehensive Waterfront Plan GIS",
  group="absences", absent=True, agency="DCP",
  notes="A 155 MB PDF and six topic PDFs. The City's principal waterfront planning document is not machine-readable.",
  source=none("shipped as PDF only")),

dict(id="absent-coastal-projects", label="Coastal protection project alignments",
  group="absences", absent=True, agency="DDC / MOCR / USACE",
  notes="No official geometry for any of them. East Side Coastal Resiliency: the only vector data sits on a personal ArcGIS account from 2022 — usable as a teaching artefact, not a source of record. Lower Manhattan Coastal Resiliency: one JPEG. Living Breakwaters: a completed $111M structure in the harbour with no published alignment.",
  source=none("no official geometry published")),

dict(id="absent-buyouts", label="Staten Island Sandy buyout footprints",
  group="absences", absent=True, agency="GOSR",
  notes="Oakwood Beach, Ocean Breeze and Graham Beach are not published as state GIS. Probably the most ethnographically loaded flood geography in the city, and it has no shapefile.",
  tags=["sandy","buyout","ethnography"], source=none("not published as state GIS")),

dict(id="absent-cso", label="CSO outfalls, sewer mains, regulators, interceptors",
  group="absences", absent=True, agency="DEP",
  notes="Catch basins and MS4 outfalls are the only sewer geometry the City releases. The volunteer Open Sewer Atlas reconstructs 4,850 CSO and stormwater outfalls, distributed by email request and labelled NOT OFFICIAL — infrastructure the utility maps but does not publish.",
  source=none("unpublished; partial volunteer reconstruction at openseweratlas.tumblr.com")),

dict(id="absent-bluebelt", label="Bluebelt and Cloudburst programme boundaries",
  group="absences", absent=True, agency="DEP",
  notes="Both programmes exist only as prose and PDFs.",
  source=none("undownloadable")),

dict(id="absent-mta-panynj", label="MTA and Port Authority flood and resilience geodata",
  group="absences", absent=True, agency="MTA / PANYNJ",
  notes="The two agencies with the most flood-exposed infrastructure in the harbour publish PDFs.",
  source=none("not published")),

dict(id="absent-smia", label="Significant Maritime and Industrial Areas",
  group="absences", absent=True, agency="DCP",
  notes="Seven polygons defining the working waterfront, distributed by Local Area Network access. You email wrp@planning.nyc.gov.",
  source=none("distributed by email request")),

dict(id="absent-1609-shoreline", label="1609 shoreline and landfill extent",
  group="absences", absent=True, agency="—",
  notes="No published vector for either. The Welikia Map Explorer shows the 1609 landscape — 33,209 clickable blocks built from 614 georeferenced historical maps — but it is viewable, not downloadable. NYPL holds 7,799 digitised historical maps and a Map Warper toolkit: students can trace a shoreline, and nobody has published the traces. Warning: NYC Open Data's Landfills dataset 6gvx-hydd is solid-waste landfills — a naming collision worth flagging.",
  tags=["history","welikia","nypl"], source=none("no published vector; traceable from NYPL scans")),

dict(id="absent-hats", label="USACE NY & NJ Harbor and Tributaries Study (HATS)",
  group="absences", absent=True, agency="USACE",
  notes="Reached Draft Final / State and Agency Review in March 2026 and is not public. Scope has narrowed from a basin-wide barrier study to near-term Actionable Elements at Oakwood Beach, Harlem River and East Riser. PDFs and a StoryMap only; no GIS.",
  tags=["new jersey","bi-state"], source=none("not public as of March 2026")),
]
