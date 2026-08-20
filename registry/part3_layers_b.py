from part2_layers_a import soc, ags, agsmap, item, zipsrc, none, D5, D6, D7, DOS, ENC

LAYERS_B = [

# ── What the water actually did ────────────────────────────────────────────
dict(id="sandy-inundation", label="Sandy inundation zone (2012)", group="observed",
  geom="polygon", color="#7209b7", opacity=0.45, state="NY", agency="SBS, source USGS",
  vintage="2013-02", features=492,
  notes="Field-verified through February 2013. Historical — it will never update. Where the water actually went, against three maps that each claim to say where it would go. Use the split-polygon attachment: the single multipolygon kills tiling performance.",
  tags=["sandy","historical","observed"], license="not specified",
  source=soc("5xsi-dfpx", attachment="split")),

dict(id="usgs-sandy-hwm", label="Sandy high-water marks & storm-tide sensors", group="observed",
  geom="point", color="#d00000", radius=3.6, state="NY/NJ", agency="USGS",
  fields="Peak elevation, sensor type, deployment and recovery times",
  notes="38 storm-surge sensors and 300+ high-water marks. All ten coastal tide gages in southeastern New York exceeded major flood thresholds; peaks ran 7.38 to 11.75 ft. Provisional data — fine for teaching, not for a published risk claim. The same viewer holds Ida's high-water marks.",
  tags=["sandy","ida","observed","usgs","new jersey"], license="provisional",
  source=dict(type="usgs-stn", url="https://stn.wim.usgs.gov/fev/", event="Sandy")),

dict(id="floodnet-sensors", label="FloodNet street sensors", group="observed",
  geom="point", color="#4cc9f0", radius=3.4, state="NY",
  agency="DEP / CUNY / NYU", vintage="fortnightly", features=479, default=True,
  fields="sensor_id, date installed, tidally influenced, street, borough, NTA, lowest point height delta",
  notes="479 live street sensors. CUNY co-leads this, which makes it the obvious partner for the course.",
  tags=["community science","sensors","real time","cuny"], license="not specified",
  source=soc("kb2e-tjy3", lat="latitude", lon="longitude")),

dict(id="floodnet-events", label="FloodNet flood events", group="observed",
  geom="point", color="#00b4d8", radius=3.0, state="NY", agency="DEP / CUNY / NYU",
  fields="Max depth, time to max, drain time, duration above 4 / 12 / 24 inches",
  notes="The events table has no geometry of its own — join on sensor_id. Time-to-max and drain time are the two fields that turn a flood map into a flood story.",
  tags=["community science","sensors","events"], license="not specified",
  source=soc("aq7i-eu5q", join="kb2e-tjy3", on="sensor_id")),

dict(id="311-flooding", label="311 flooding complaints", group="observed",
  geom="point", color="#ffb703", radius=2.2, state="NY", agency="311",
  scenarioSet=dict(axes=[
    dict(id="descriptor", label="Complaint", field="descriptor",
      values=["Sewer Backup (Use Comments) (SA)","Catch Basin Clogged/Flooding (Use Comments) (SC)",
              "Street Flooding (SJ)","Manhole Overflow (Use Comments) (SA1)",
              "Culvert Blocked/Needs Cleaning (SE)","Highway Flooding (SH)",
              "Excessive Water In Basement (WEFB)"],
      default="Street Flooding (SJ)",
      display={"Sewer Backup (Use Comments) (SA)":"Sewer backup — 75,983",
               "Catch Basin Clogged/Flooding (Use Comments) (SC)":"Catch basin clogged — 44,593",
               "Street Flooding (SJ)":"Street flooding — 21,541",
               "Manhole Overflow (Use Comments) (SA1)":"Manhole overflow — 6,253",
               "Culvert Blocked/Needs Cleaning (SE)":"Culvert blocked — 3,782",
               "Highway Flooding (SH)":"Highway flooding — 531",
               "Excessive Water In Basement (WEFB)":"Water in basement — 6,285"})]),
  scenarioNote="311 measures reporting, not flooding. Differential propensity to call — by tenure, immigration status, language, and prior experience of non-response — is the classic confound, and it is exactly what ethnography can address and the API cannot. Note also that Sandy (Oct 2012) lives in dataset 76ig-c548 and Ida (Sep 2021) in erm2-nwe9: any before-and-after comparison crosses two datasets.",
  tags=["311","reporting","ida","sandy","ethnography"], license="not specified",
  source=dict(type="socrata-query", domain="data.cityofnewyork.us",
              id="erm2-nwe9", historic="76ig-c548",
              where="complaint_type in ('Sewer','Water System')")),

# ── Rainfall, stormwater and the sewer ─────────────────────────────────────
dict(id="stormwater-flood", label="NYC stormwater flood maps", group="pluvial",
  geom="polygon", color="#06d6a0", opacity=0.5, state="NY", agency="DEP", vintage="2024-07-03",
  scenarioSet=dict(axes=[
    dict(id="scenario", label="Rainfall scenario", field="scenario",
      values=["limited","moderate_current","moderate_2050","extreme_2080"],
      default="moderate_current",
      display={"limited":"1.77 in/hr, current sea level",
               "moderate_current":"2.13 in/hr, current sea level",
               "moderate_2050":"2.13 in/hr + 2050s SLR",
               "extreme_2080":"3.66 in/hr + 2080s SLR"})]),
  scenarioNote="This is the Ida layer — the pluvial one. Map Ida's deaths and basement flooding against the FEMA floodplain and there is almost no overlap. That is the finding, not an error: FEMA's product is coastal.",
  tags=["ida","cloudburst","pluvial","rainfall"], license="not specified",
  source=dict(type="socrata-zip", domain="data.cityofnewyork.us", id="9i7c-xyvv",
              blob="NYCFloodStormwaterFloodMaps.zip")),

dict(id="catch-basins", label="Catch basins", group="pluvial",
  geom="point", color="#6c757d", radius=1.4, state="NY", agency="DEP",
  features=154212, vintage="2025-12",
  notes="154,212 points and no condition field. A density layer, not a maintenance layer — which is itself the point when you set it beside 44,593 catch-basin-clogged complaints.",
  license="not specified", source=soc("2w2g-fk3i")),

dict(id="green-infrastructure", label="Green infrastructure assets", group="pluvial",
  geom="point", color="#80b918", radius=2.4, state="NY", agency="DEP",
  features=16231, vintage="monthly",
  fields="Asset type, status, sewer type, outfall, receiving waterbody, constructed date",
  notes="Rich enough to ask when as well as where — one of the few City layers that is.",
  license="not specified", source=soc("df32-vzax", lat="latitude", lon="longitude")),

dict(id="gi-regulated", label="Green infrastructure — regulated projects", group="pluvial",
  geom="polygon", color="#55a630", opacity=0.4, state="NY", agency="DEP", vintage="monthly",
  license="not specified", source=soc("fm4z-qud6")),

dict(id="gi-porous", label="Porous pavement", group="pluvial",
  geom="polygon", color="#aacc00", opacity=0.5, state="NY", agency="DEP", vintage="monthly",
  license="not specified", source=soc("n7f2-dyvt")),

dict(id="gi-medians", label="Green infrastructure medians", group="pluvial",
  geom="polygon", color="#70e000", opacity=0.5, state="NY", agency="DEP", vintage="monthly",
  license="not specified", source=soc("drep-uzs7")),

dict(id="ms4-outfalls", label="MS4 outfalls", group="pluvial",
  geom="point", color="#adb5bd", radius=2.6, state="NY", agency="DEP", stale=True,
  notes="With catch basins, the only sewer geometry the City releases. There is no CSO outfall layer, no sewer mains, no regulators, no interceptors.",
  license="not specified",
  source=ags("https://services.arcgis.com/at3rDjch5X7i9Bag/arcgis/rest/services/MS42020_Outfalls/FeatureServer")),

dict(id="ms4-drainage", label="MS4 drainage areas", group="pluvial",
  geom="polygon", color="#ced4da", opacity=0.28, state="NY", agency="DEP", stale=True,
  notes="Which outfall a given block drains to. Stale (2018/2020), but the topology has not moved.",
  license="not specified",
  source=ags("https://services.arcgis.com/at3rDjch5X7i9Bag/arcgis/rest/services/MS42020_DrainageAreas/FeatureServer")),

dict(id="dec-rainfall-1yr", label="1-year 24-hour rainfall isopleths", group="pluvial",
  geom="polygon", color="#4895ef", opacity=0.3, state="NY", agency="NYSDEC", gated=True,
  notes="Genuinely useful for cloudburst work and surfaced nowhere else. Carried by DEC's stormwater mapper.",
  license="NYSDEC — secondary distribution not allowed",
  source=agsmap("https://gisservices.dec.ny.gov/arcgis/rest/services/storm/storm/MapServer", [0])),

dict(id="dec-rainfall-90pct", label="90th-percentile rainfall isopleths", group="pluvial",
  geom="polygon", color="#4361ee", opacity=0.3, state="NY", agency="NYSDEC", gated=True,
  license="NYSDEC — secondary distribution not allowed",
  source=agsmap("https://gisservices.dec.ny.gov/arcgis/rest/services/storm/storm/MapServer", [1])),

dict(id="water-sewer-permits", label="Water & sewer permits", group="pluvial",
  geom="polygon", color="#8d99ae", opacity=0.3, state="NY", agency="DEP",
  features=371465,
  notes="No geometry of its own — join to MapPLUTO on BBL. A record of who was allowed to connect what, and when.",
  license="not specified", source=soc("hphy-6g7m", join="bbl")),

# ── Emergency management ───────────────────────────────────────────────────
dict(id="evac-zones", label="Hurricane evacuation zones", group="emergency",
  geom="polygon", color="#f4a261", state="NY", agency="NYCEM / DCP",
  vintage="2026-05-26", features=8, default=True, field="hurricane_",
  categories={"1":"#d00000","2":"#e85d04","3":"#f48c06","4":"#ffba08","5":"#ffd60a","6":"#fff3b0"},
  notes="Six zones, version 26b, revised quarterly. An administrative geography: it tells you who is told to leave, not where water goes. Pair it with the SLOSH inundation layer underneath.",
  license="not specified", source=ags(f"{D5}/NYC_Hurricane_Evacuation_Zone/FeatureServer")),

dict(id="slosh-inundation", label="Hurricane inundation (SLOSH)", group="emergency",
  geom="polygon", color="#ff9f1c", opacity=0.4, state="NY", agency="NYCEM / NHC", vintage="2020",
  notes="The National Hurricane Center's 2020 SLOSH model — NE1 basin, 10 m, surge at high tide. The physical layer under the administrative one.",
  license="not specified", source=soc("uk9f-6y9n")),

dict(id="evac-centers", label="Hurricane evacuation centers", group="emergency",
  geom="point", color="#fb8500", radius=3.4, state="NY", agency="NYCEM", features=60,
  license="not specified", source=soc("hhtf-5nvp")),
]
