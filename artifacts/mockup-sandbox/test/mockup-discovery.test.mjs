// Run: node --test test/mockup-discovery.test.mjs
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { mockupPreviewPlugin } from '../mockupPreviewPlugin.ts';

test('native discovery preserves nesting and ignores private/hidden files', async t => {
  const root = await mkdtemp(path.join(tmpdir(), 'mockup-discovery-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  for (const file of [
    'Card.tsx', 'nested/Panel.tsx', '_Private.tsx', '_private/Hidden.tsx',
    '.hidden/Hidden.tsx', '.Hidden.tsx', 'nested/_Hidden.tsx', 'readme.txt',
  ]) {
    const absolute = path.join(root, 'src/components/mockups', file);
    await mkdir(path.dirname(absolute), { recursive: true });
    await writeFile(absolute, '');
  }
  const plugin = mockupPreviewPlugin();
  plugin.configResolved({ root });
  await plugin.buildStart();
  const generated = await readFile(path.join(root, 'src/.generated/mockup-components.ts'), 'utf8');
  assert.match(generated, /"\.\/components\/mockups\/Card\.tsx"/);
  assert.match(generated, /"\.\/components\/mockups\/nested\/Panel\.tsx"/);
  assert.match(generated, /import\("\.\.\/components\/mockups\/Card\.tsx"\)/);
  assert.doesNotMatch(generated, /Private|Hidden|readme/);
  await rm(path.join(root, 'src/components/mockups/Card.tsx'));
  await plugin.buildStart();
  const refreshed = await readFile(path.join(root, 'src/.generated/mockup-components.ts'), 'utf8');
  assert.doesNotMatch(refreshed, /Card/);
  assert.match(refreshed, /Panel/);
});
