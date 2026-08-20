# Helpers -------------------------------------------------------------------
def soc(i, dom="data.cityofnewyork.us", **kw):  return dict(type="socrata", domain=dom, id=i, **kw)
def ags(url, layer=0, **kw):                    return dict(type="arcgis", url=url, layer=layer, **kw)
def agsmap(url, layers, **kw):                  return dict(type="arcgis-map", url=url, layers=layers, **kw)
def item(i, **kw):                              return dict(type="arcgis-item", id=i, **kw)
def zipsrc(url, **kw):                          return dict(type="zip", url=url, **kw)
def none(why):                                  return dict(type="absent", why=why)

D5 = "https://services5.arcgis.com/GfwWNkhOj9bNBqoJ/arcgis/rest/services"
D6 = "https://services6.arcgis.com/DZHaqZm9cxOD4CWM/arcgis/rest/services"
D7 = "https://services7.arcgis.com/n1YM8pTrFmm7L4hs/arcgis/rest/services"
DOS = "https://services2.arcgis.com/okXm0pb6aWH6XOGI/arcgis/rest/services"
ENC = "https://encdirect.noaa.gov/arcgis/rest/services/encdirect/enc_harbour/MapServer"

LAYERS_A = [

# ── The two regulatory floodplains ─────────────────────────────────────────
dict(id="firm-2015-prelim", label="2015 Preliminary FIRM", group="regulatory",
  geom="polygon", color="#ef476f", opacity=0.35, state="NY", agency="DCP / FEMA",
  vintage="2015", features=4914, field="FLD_ZONE",
  fields="Flood zone, base flood elevation (STATIC_BFE), zone subtype",
  notes="The floodplain the NYC Building Code requires for new and substantially improved buildings. FEMA agreed in October 2016 that its models overstated flood elevations by one to two and a half feet citywide, and committed to reissue. No revised maps have been adopted.",
  tags=["fema","firm","building code"], license="not specified",
  source=ags(f"{D5}/S_FLD_HAZ_AR/FeatureServer")),

dict(id="firm-2007-effective", label="2007 Effective FIRM", group="regulatory",
  geom="polygon", color="#118ab2", opacity=0.35, state="NY", agency="DCP / FEMA",
  vintage="2007", field="FLD_ZONE",
  fields="Flood zone, base flood elevation, zone subtype",
  notes="The floodplain flood insurance rates actually run off. Simultaneously operative with the 2015 Preliminary FIRM, and inconsistent with it.",
  tags=["fema","firm","insurance"], license="not specified",
  source=ags(f"{D5}/2007_Effective_FIRMs/FeatureServer")),

dict(id="nfhl-effective", label="FEMA National Flood Hazard Layer", group="federal",
  geom="polygon", color="#0077b6", opacity=0.3, state="NY/NJ", agency="FEMA",
  fields="Flood hazard zones, base flood elevations, cross sections, LOMRs",
  notes="32 sublayers, EPSG:4269, maxRecordCount 2000. The bi-state product — this is how New Jersey gets a regulatory floodplain here. WFS caps at 1,000 features: page or tile by bbox.",
  tags=["fema","nfhl","new jersey","bi-state"], license="not specified",
  source=agsmap("https://hazards.fema.gov/arcgis/rest/services/public/NFHL/MapServer", [28])),

dict(id="nfhl-preliminary", label="FEMA preliminary / pending NFHL", group="federal",
  geom="polygon", color="#48cae4", opacity=0.3, state="NY/NJ", agency="FEMA",
  notes="What FEMA proposes but has not adopted. Put it beside the effective layer and the appeal history becomes visible.",
  license="not specified",
  source=agsmap("https://hazards.fema.gov/arcgis/rest/services/PrelimPending/Prelim_NFHL/MapServer", [28])),

dict(id="fema-nri", label="FEMA National Risk Index (census tract)", group="federal",
  geom="polygon", color="#9d4edd", opacity=0.4, state="NY/NJ", agency="FEMA",
  fields="Composite risk, expected annual loss, social vulnerability, community resilience, by hazard",
  notes="Clip by FIPS 36005 / 36047 / 36061 / 36081 / 36085 for the five boroughs, and the NJ counties for the other side of the harbour. Shapefiles use -9999 for nulls — cast before you average.",
  tags=["risk","census tract","new jersey"], license="not specified",
  source=zipsrc("https://hazards.fema.gov/nri/data-resources", note="county and tract, CSV / Shapefile / FileGDB")),

# ── Future floodplains and sea level rise ──────────────────────────────────
dict(id="nyserda-slr", label="NYS Sea Level Rise & Future Floodplain Extent", group="future",
  geom="polygon", color="#4361ee", opacity=0.42, state="NY", agency="NYSERDA",
  vintage="2026-02-14", default=False,
  scenarioSet=dict(axes=[
    dict(id="slr", label="Sea level rise", field="slr_in",
         values=["0","12","18","24","36","48","60","72"], default="24",
         display={"0":"0 in (today)","12":"12 in","18":"18 in","24":"24 in",
                  "36":"36 in","48":"48 in","60":"60 in","72":"72 in"}),
    dict(id="event", label="Annual chance event", field="event",
         values=["10pct","2pct","1pct","0_2pct"], default="1pct",
         display={"10pct":"10% (10-year)","2pct":"2% (50-year)",
                  "1pct":"1% (100-year)","0_2pct":"0.2% (500-year)"})]),
  scenarioNote="32 floodplains: 8 sea-level-rise increments against 4 annual-chance events. No licence is stated anywhere for this dataset — confirm with NYSERDA before re-serving publicly.",
  tags=["sea level rise","nyserda","scenario","statewide"],
  license="NONE STATED — verify before public re-serving",
  source=ags("https://services7.arcgis.com/ZR2wjW0JGwgm9bhz/arcgis/rest/services/NYSERDA_Sea_Level_Rise_Viewer_2025_WFL1/FeatureServer")),

dict(id="dcp-future-floodplains", label="DCP future floodplains", group="future",
  geom="polygon", color="#5a189a", opacity=0.4, state="NY", agency="DCP",
  scenarioSet=dict(axes=[
    dict(id="horizon", label="Horizon", field="horizon",
         values=["2020s","2050s","2080s","2100"], default="2050s",
         display={"2020s":"2020s — 500-yr, +11 in","2050s":"2050s — 100-yr, +31 in",
                  "2080s":"2080s — +58 in","2100":"2100 — +75 in"})]),
  scenarioNote="All four are built on the 2015 Preliminary FIRMs, which the City successfully appealed — so they overstate depth by 1 to 2.5 ft. They remain the City's published future floodplains regardless. The 2080s and 2100 versions were stripped to geometry and an Id.",
  tags=["npcc","projection","sea level rise"], license="not specified",
  source=dict(type="socrata-family", domain="data.cityofnewyork.us",
              members={"2020s":"aqw3-vugz","2050s":"27ya-gqtm","2080s":"ek8y-fsqz","2100":"rf9r-c4pz"})),

dict(id="npcc-msl", label="Mean sea level rise projections (NPCC 2019)", group="future",
  geom="polygon", color="#3a0ca3", opacity=0.35, state="NY", agency="DCP / NPCC",
  scenarioSet=dict(axes=[
    dict(id="horizon", label="Horizon", field="horizon",
         values=["2050s","2080s","2100s"], default="2080s",
         display={"2050s":"2050s","2080s":"2080s","2100s":"2100s"})]),
  license="not specified",
  source=dict(type="socrata-family", domain="data.cityofnewyork.us",
              members={"2050s":"8n8s-np59","2080s":"w7sh-mt94","2100s":"v3xw-ufub"})),

dict(id="mmhw", label="Mean monthly high water", group="future",
  geom="polygon", color="#00b4d8", opacity=0.45, state="NY", agency="DCP",
  scenarioSet=dict(axes=[
    dict(id="horizon", label="Horizon", field="horizon",
         values=["2020s","2050s","2080s","2100s"], default="2050s",
         display={"2020s":"2020s","2050s":"2050s","2080s":"2080s","2100s":"2100s"})]),
  scenarioNote="The best proxy in the survey for chronic tidal — sunny-day — flooding. Pair it with the Flood Vulnerability Index's tid_* fields and ask which blocks are wet on an ordinary Tuesday, no storm involved.",
  tags=["tidal","sunny day flooding","chronic"], license="not specified",
  source=dict(type="socrata-family", domain="data.cityofnewyork.us",
              members={"2020s":"asn3-45u6","2050s":"eqyn-hsuk","2080s":"qyh3-ddat","2100s":"mzds-2cdc"})),

dict(id="dcp-future-2080-npcc", label="Future floodplain 2080s, 100-yr (NPCC)", group="future",
  geom="polygon", color="#7209b7", opacity=0.4, state="NY", agency="DCP",
  notes="The one DCP future-floodplain service that permits Extract as well as Query.",
  license="not specified", source=ags(f"{D5}/Future_Floodplains_2080_100yr_NPCC/FeatureServer")),

dict(id="mocej-coastal-surge", label="Coastal surge floodplain (MOCEJ)", group="future",
  geom="polygon", color="#e63946", opacity=0.35, state="NY", agency="MOCEJ",
  scenarioSet=dict(axes=[
    dict(id="horizon", label="Horizon", field="horizon",
         values=["2020s","2030s","2050s","2080s","2100s","2150s"], default="2050s",
         display={"2020s":"2020s","2030s":"2030s","2050s":"2050s","2080s":"2080s","2100s":"2100s","2150s":"2150s"}),
    dict(id="event", label="Annual chance event", field="event",
         values=["100yr","500yr"], default="100yr",
         display={"100yr":"1% (100-year)","500yr":"0.2% (500-year)"})]),
  scenarioNote="MOCEJ publishes coastal surge out to the 2150s — further than any other City product here. Almost none of the account's 255 items carry licenceInfo.",
  tags=["mocej","surge","projection"], license="not specified",
  source=dict(type="arcgis-owner", owner="mocej.nyc.data", match="coastal surge floodplain")),

dict(id="mocej-tidal", label="Tidal flooding (MOCEJ)", group="future",
  geom="polygon", color="#f77f00", opacity=0.35, state="NY", agency="MOCEJ",
  scenarioSet=dict(axes=[
    dict(id="horizon", label="Horizon", field="horizon",
         values=["2020s","2030s","2050s","2080s","2100s","2150s"], default="2050s",
         display={"2020s":"2020s","2030s":"2030s","2050s":"2050s","2080s":"2080s","2100s":"2100s","2150s":"2150s"})]),
  license="not specified",
  source=dict(type="arcgis-owner", owner="mocej.nyc.data", match="tidal flooding")),

dict(id="noaa-slr-depth", label="NOAA sea level rise depth", group="future",
  geom="raster", format="raster", color="#0096c7", opacity=0.6, state="NY/NJ", agency="NOAA OCM",
  scenarioSet=dict(axes=[
    dict(id="ft", label="Sea level rise", field="ft",
         values=["0","1","2","3","4","5","6","7","8","9","10"], default="3",
         display={str(n): f"{n} ft" for n in range(11)})]),
  scenarioNote="66 depth rasters for New York at half-foot steps, plus 63 connectivity rasters that distinguish water actually connected to the sea from bathtub artefacts. Every folder ships a URLlist file, so the whole set is trivially scriptable. For a vector pipeline use the merged polygons instead.",
  tags=["noaa","sea level rise","new jersey","bi-state","raster"],
  license="no access constraints",
  source=dict(type="noaa-slr", base="https://coast.noaa.gov/slrdata/", region="NY")),

dict(id="noaa-slr-polygons", label="NOAA SLR merged inundation polygons", group="future",
  geom="polygon", color="#0077b6", opacity=0.4, state="NY/NJ", agency="NOAA OCM",
  notes="The vector route into NOAA's sea-level-rise product, and the cleanest bi-state coverage in the survey.",
  license="no access constraints",
  source=zipsrc("https://coast.noaa.gov/slrdata/Ancillary/NOAA%20OCM%20SLR%20MergedPolygons%20Shapes%200426.zip")),

dict(id="noaa-hightide-flooding", label="NOAA high-tide flooding extent", group="future",
  geom="raster", format="raster", color="#48cae4", opacity=0.55, state="NY/NJ", agency="NOAA OCM",
  scenarioSet=dict(axes=[
    dict(id="level", label="Severity", field="level", values=["minor","moderate","major"], default="minor",
         display={"minor":"Minor","moderate":"Moderate","major":"Major"})]),
  notes="Cloud-optimised GeoTIFFs. The Battery is forecast 16–22 flood days in 2026–27; 9 were observed in 2025–26, the lowest since 2016.",
  license="no access constraints",
  source=dict(type="noaa-slr", base="https://coast.noaa.gov/slrdata/", product="high-tide-flooding")),
]
