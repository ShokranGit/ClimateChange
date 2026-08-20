#!/usr/bin/env node
// Vercel build step. Writes the two public Supabase values into public/js/env.js.
// The anon key is meant to be public; the service_role key must never appear here.
import fs from 'node:fs';
const url = process.env.SUPABASE_URL || '';
const key = process.env.SUPABASE_ANON_KEY || '';
if (key.includes('service_role')) { console.error('refusing to write a service_role key'); process.exit(1); }
fs.writeFileSync('public/js/env.js',
  `window.__SUPABASE_URL__ = ${JSON.stringify(url)};\n` +
  `window.__SUPABASE_ANON_KEY__ = ${JSON.stringify(key)};\n`);
console.log(url ? `env.js written for ${url}` : 'env.js written with no Supabase configured');
