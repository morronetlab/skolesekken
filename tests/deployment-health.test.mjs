import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import health from '../netlify/functions/health.mjs';

test('backend health function can run and returns JSON', async () => {
  const response = await health();
  assert.equal(response.status, 200);
  assert.match(response.headers.get('content-type'), /application\/json/);
  assert.equal((await response.json()).status, 'ok');
});

test('Netlify configuration bundles PDF dependencies and routes health check', () => {
  const config = readFileSync(new URL('../netlify.toml', import.meta.url), 'utf8');
  assert.match(config, /node_bundler\s*=\s*"esbuild"/);
  assert.match(config, /external_node_modules\s*=\s*\["pdfjs-dist"\]/);
  assert.match(config, /from\s*=\s*"\/api\/health"/);
});
