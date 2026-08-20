// Static configuration. No secrets beyond the Supabase anon key, which is
// public by design — row-level security is what protects the data.
export const CONFIG = {
  // NYC, but framed so a pinch-out shows the whole two-state region.
  center: [-73.97, 40.70],
  zoom: 9.5,
  minZoom: 5,
  // NY + NJ, generously padded. NY: -79.76..-71.85 / 40.49..45.02
  //                             NJ: -75.56..-73.89 / 38.93..41.36
  maxBounds: [[-80.6, 38.3], [-71.0, 45.6]],
  basemaps: {
    muted:  { label: 'Muted',    url: 'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json' },
    dark:   { label: 'Dark',     url: 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json' },
    detail: { label: 'Detailed', url: 'https://basemaps.cartocdn.com/gl/voyager-gl-style/style.json' }
  },
  defaultBasemap: 'dark',
  registry: '/layers/index.json',
  supabase: {
    url: window.__SUPABASE_URL__ || '',
    anonKey: window.__SUPABASE_ANON_KEY__ || ''
  }
};
