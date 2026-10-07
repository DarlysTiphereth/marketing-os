import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const git = args => execFileSync('git', args, { cwd: root, encoding: 'utf8' });
const evidence = git(['ls-files', '--eol']);
process.stdout.write(evidence);
const fixtures = git(['ls-files', '-z', '--', 'brands', 'products']).split('\0')
  .filter(file => file.endsWith('.json') && !file.includes('/sources/raw/'));
assert.ok(fixtures.length > 0, 'expected tracked textual fixtures');
const lines = new Map(evidence.trim().split(/\r?\n/).map(line => {
  const tab = line.indexOf('\t'); return [line.slice(tab + 1), line.slice(0, tab)];
}));
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
for (const file of fixtures) {
  const attributes = git(['check-attr', '-z', 'text', 'eol', '--', file]).split('\0');
  assert.equal(attributes[2], 'set', `${file}: text must be explicit`);
  assert.equal(attributes[5], 'lf', `${file}: eol must be LF`);
  assert.match(lines.get(file) ?? '', /^i\/lf\s+w\/lf\s+/, `${file}: index and working tree must be LF`);
  assert.ok(!(await readFile(path.join(root, file))).includes(Buffer.from('\r')), `${file}: unexpected CR bytes`);
}
for (const brand of ['grand', 'safezone']) {
  const product = JSON.parse(await readFile(path.join(root, `products/${brand}/test-product.json`), 'utf8'));
  for (const source of product.source_references) {
    assert.equal(sha(await readFile(path.join(root, source.source_location))), source.source_hash, `${brand}: source byte hash drift`);
  }
  const assets = JSON.parse(await readFile(path.join(root, `brands/${brand}/assets.json`), 'utf8'));
  for (const asset of assets) {
    assert.equal(sha(await readFile(path.join(root, asset.source))), asset.content_hash, `${brand}: template byte hash drift`);
  }
}
console.log(`PASS Git attributes, index/worktree LF and source/template byte hashes: ${fixtures.length} textual fixtures`);
