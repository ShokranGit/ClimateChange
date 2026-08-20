#!/usr/bin/env node
// The app loads MapLibre, PMTiles and supabase-js from jsDelivr with
// subresource-integrity hashes. This pulls the identical files out of the npm
// tarballs into public/vendor/ — gitignored — so the test suite can run without
// the network, and so anyone who wants a fully self-hosted copy can have one.
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

const WANT = [
  ['maplibre-gl@5.24.0', 'dist/maplibre-gl.js', 'maplibre-gl-5.24.0.js'],
  ['maplibre-gl@5.24.0', 'dist/maplibre-gl.css', 'maplibre-gl-5.24.0.css'],
  ['pmtiles@4.5.0', 'dist/pmtiles.js', 'pmtiles-4.5.0.js'],
  ['@supabase/supabase-js@2.112.3', 'dist/umd/supabase.js', 'supabase-js-2.112.3.js']
];

const OUT = 'public/vendor';
fs.mkdirSync(OUT, { recursive: true });
if (WANT.every(([, , name]) => fs.existsSync(path.join(OUT, name)))) {
  console.log('vendor files already present');
  process.exit(0);
}

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'vendor-'));
for (const spec of [...new Set(WANT.map(w => w[0]))]) {
  execSync(`npm pack ${spec}`, { cwd: tmp, stdio: 'ignore' });
}
for (const tgz of fs.readdirSync(tmp).filter(f => f.endsWith('.tgz'))) {
  execSync(`tar xzf ${tgz}`, { cwd: tmp });
  fs.renameSync(path.join(tmp, 'package'), path.join(tmp, tgz.replace('.tgz', '')));
}
for (const [spec, inner, name] of WANT) {
  const slug = spec.replace('@supabase/', 'supabase-').replace('@', '-');
  const dir = fs.readdirSync(tmp).find(d => d.startsWith(slug) && !d.endsWith('.tgz'));
  if (!dir) throw new Error(`could not find unpacked ${spec}`);
  fs.copyFileSync(path.join(tmp, dir, inner), path.join(OUT, name));
  console.log(`vendored ${name}`);
}
