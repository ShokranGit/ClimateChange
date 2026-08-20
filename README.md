# ClimateChange — Flooding, Climate and the Waterfront (NY / NJ)

A teaching platform for a CUNY Graduate Center course on flooding, climate change
and the urban waterfront. Sibling to [Fieldmap](https://fieldmap-lake.vercel.app);
same pipeline, different question.

Centred on New York City, framed over New York and New Jersey.

## Stack

- Static site, no framework. Plain ES modules in `public/`.
- **MapLibre GL JS 5.24.0**, vendored at `public/vendor/`
- **PMTiles 4.5.0** for baked layers — one archive per layer, served over HTTP
  range requests
- **Supabase** for course membership and student layers, behind row-level security
- **Vercel** for hosting

## How layers work

`scripts/registry.src.json` is the single source of truth. Each entry carries the
public metadata the browser needs *and* a `source` block describing where the data
comes from. `scripts/gen-index.mjs` turns it into `public/layers/index.json`, in
one of two modes:

| mode | what it emits | when |
|---|---|---|
| `--remote` (default) | a direct query URL against the publisher's REST endpoint; the browser fetches GeoJSON live | small layers, always current, works on the first deploy |
| `--baked` | `/layers/<id>.geojson` or `.pmtiles` if that file is on disk | large layers, offline use, immunity to a publisher moving a URL mid-semester |

```
npm run index          # remote mode
npm run bake           # fetch everything into public/layers/ (needs network)
npm run index:baked    # switch the registry over to whatever got baked
npm run serve          # http://127.0.0.1:8099, with working Range support
npm test               # 34 assertions
```

Baking runs in **GitHub Actions** (`.github/workflows/bake-layers.yml`), weekly and
on demand — not locally, because several sources move: FloodNet refreshes
fortnightly, the NOAA ENC is rebuilt every Saturday night, DEC remediation parcels
nightly.

**Parking a layer** is moving one entry from `layers` to `parked` in the source
registry. The app reads only `layers`.

## The six gated layers

NYSDEC's layers carry *"Secondary Distribution of the data is not allowed"* plus a
credit requirement. They are marked `"gated": true` and are excluded from the
public registry entirely — not baked, not hot-linked. `INCLUDE_GATED=1` overrides
this for local classroom use. Do not deploy with it set until DEC's position is in
writing.

NYSERDA's sea-level-rise data states no licence anywhere. Same caution applies.

## Hard-won things encoded here

Each of these cost real time in the Fieldmap build. They are now tests, not memories.

1. **tippecanoe v2.49 silently drops ~80% of features** when given per-feature
   `minzoom` hints. Build three tilesets per borough at fixed zoom bands and
   `tile-join`. Then count the features in the finished tileset — silence is not
   success. (`scripts/bake-layers.mjs` reports a count for every layer and flags
   any that misses its expected count by more than 10%.)
2. **MapLibre refuses two zoom-based interpolations in one paint expression**, and
   reports it on the map's `error` event rather than by throwing — `addLayer`
   appears to succeed and the layer silently never exists. Every builder in
   `public/js/paint.js` emits at most one, with `case` nested inside it, and
   `test/paint.test.mjs` walks the expression tree to prove it.
3. **A real fill over ~1M footprints crashes the renderer.** Set `"probe": true`
   on the layer: MapLibre downloads the tiles, draws none, and it stays queryable.
4. **`map.once('idle')` never fires while anything else is fetching.** `util.js`
   exports a bounded `idle()`; use it.
5. **Big single multipolygons kill tiling performance.** The Sandy Inundation Zone
   ships a split-polygon attachment for exactly this reason.
6. **Never cache range requests in the service worker.** A cached 200 served where
   a 206 was asked for hands the PMTiles reader garbage.
7. **Bump `VERSION` in `public/sw.js` on every deploy.** A stale shell against a
   new registry is this app's most confusing failure mode.
8. **Verify against the live site, not the container.** Vercel takes 30–90 s to
   publish.
9. **Timezones.** Use `fromNY` / `nyDateValue` / `nyOffsetMs` from `util.js`. Do
   not redeclare them.
10. **Socrata's `updatedAt` is a metadata timestamp.** Use `rowsUpdatedAt`.

## Coordinate systems

- **EPSG:2263** — NAD83 New York State Plane Long Island, US survey foot. Nearly
  all NYC city data.
- **EPSG:4269 (NAD83)** — FEMA NFHL. **EPSG:4326** — NOAA ENC, USACE, and
  everything this app renders.
- Vertical datum for flood work is **NAVD88**. Do not mix it with MLLW or MHHW
  without saying so.

## Supabase

`supabase/schema.sql` creates courses, memberships, layers, features and
fieldnotes, with RLS on every table: a student sees their own work always, and a
classmate's only once it is explicitly shared. Run it in the SQL editor of the new
project, then set `SUPABASE_URL` and `SUPABASE_ANON_KEY` in the Vercel project —
`scripts/write-env.mjs` writes them into `public/js/env.js` at build time. The
`service_role` key must never be set here; the build refuses it.

## Still to come

- New Jersey layers. The bi-state sources (FEMA NFHL, NOAA sea-level-rise, USACE
  channels, NOAA ENC) already cover both states; NJDEP/NJGIN needs its own survey.
- The NYSERDA 32-scenario grid baked and tiled — the centrepiece.
- 311 flood complaints as a query, not a layer; the Battery tide-gauge time series;
  freeboard (first-floor elevation minus base flood elevation).
