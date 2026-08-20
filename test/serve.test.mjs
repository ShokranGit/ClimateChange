import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';

// PMTiles is nothing but HTTP range requests. A dev or test server that answers
// 200 where a 206 was asked for looks fine and hands the reader garbage.
const PORT = 8123;
let srv;

before(async () => {
  srv = spawn('node', ['scripts/serve.mjs'], { env: { ...process.env, PORT: String(PORT) } });
  await new Promise(r => setTimeout(r, 700));
});
after(() => srv?.kill());

const url = p => `http://127.0.0.1:${PORT}${p}`;

test('serves the shell', async () => {
  const r = await fetch(url('/index.html'));
  assert.equal(r.status, 200);
  assert.match(await r.text(), /Flooding, Climate/);
});

test('answers a range request with 206 and the right slice', async () => {
  const full = await (await fetch(url('/layers/index.json'))).text();
  const r = await fetch(url('/layers/index.json'), { headers: { Range: 'bytes=10-19' } });
  assert.equal(r.status, 206);
  assert.equal(r.headers.get('accept-ranges'), 'bytes');
  assert.match(r.headers.get('content-range'), /^bytes 10-19\/\d+$/);
  assert.equal(await r.text(), full.slice(10, 20));
});

test('rejects an unsatisfiable range with 416', async () => {
  const r = await fetch(url('/layers/index.json'), { headers: { Range: 'bytes=99999999-' } });
  assert.equal(r.status, 416);
});

test('does not escape the document root', async () => {
  const r = await fetch(url('/../../etc/passwd'));
  assert.ok(r.status === 404 || r.status === 400, `got ${r.status}`);
});
