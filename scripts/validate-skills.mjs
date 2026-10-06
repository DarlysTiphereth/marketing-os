import { readdir, readFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
import path from 'node:path';

// These repo-owned skills deliberately use only two plain scalar YAML fields.
// Fail on richer syntax rather than pretending this is a general YAML parser.
const sections = ['PURPOSE', 'WHEN TO USE', 'INPUTS', 'PRECONDITIONS', 'PROCESS', 'OUTPUTS',
  'FAILURE CONDITIONS', 'QUALITY CRITERIA', 'DEPENDENCIES'];
let count = 0;
for (const entry of await readdir('skills', { withFileTypes: true })) {
  if (!entry.isDirectory()) continue;
  const text = await readFile(path.join('skills', entry.name, 'SKILL.md'), 'utf8');
  const match = /^---\r?\n([\s\S]*?)\r?\n---\r?\n/.exec(text);
  assert.ok(match, `${entry.name}: missing frontmatter`);
  const fields = {};
  for (const line of match[1].split(/\r?\n/)) {
    const field = /^(name|description): ([^\r\n]+)$/.exec(line);
    assert.ok(field && !Object.hasOwn(fields, field[1]), `${entry.name}: unsupported/duplicate YAML field`);
    assert.ok(!/[:{}\[\]<>\n]/.test(field[2]), `${entry.name}: use plain scalar frontmatter`);
    fields[field[1]] = field[2].trim();
  }
  assert.equal(fields.name, entry.name);
  assert.match(fields.name, /^[a-z0-9]+(?:-[a-z0-9]+)*$/);
  assert.ok(fields.name.length <= 64 && fields.description?.length > 0 && fields.description.length <= 1024);
  assert.ok(!text.includes('[TODO:'));
  for (const section of sections) assert.ok(text.includes(`## ${section}\n\n`), `${entry.name}: missing ${section}`);
  count++;
  console.log(`PASS ${entry.name}`);
}
assert.equal(count, 7, 'Expected the seven requested repo skills');
console.log(`${count} skills valid (repo scalar frontmatter + required sections)`);
