import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const mobileRequire = createRequire(new URL('../mobile/package.json', import.meta.url));

test('patched fingerprint matcher preserves ignore and negation behavior', () => {
  const paths = mobileRequire('@expo/fingerprint/build/utils/Path.js');
  const patterns = ['**/node_modules/**', 'build/**/*', '!build/keep.ts'];
  for (const [file, expected] of [
    ['node_modules/package/index.js', true],
    ['../node_modules/package/index.js', true],
    ['build/output.js', true],
    ['build/keep.ts', false],
    ['src/index.ts', false],
  ] as const) assert.equal(paths.isIgnoredPath(file, patterns), expected, file);
  for (const file of ['src/a.ts', 'src/.hidden.ts', 'src/a.tsx'])
    assert.equal(paths.isIgnoredPath(file, ['src/*.{ts,tsx}']), true, file);
  assert.equal(paths.isIgnoredPath('src/a.ts', ['src/@(a|b).ts']), true);
  const directories = paths.buildDirMatchObjects(paths.buildPathMatchObjects(['cache/**/*']));
  assert.equal(paths.isIgnoredPathWithMatchObjects('cache', directories), true);
  assert.equal(paths.isIgnoredPathWithMatchObjects('src', directories), false);
});

test('patched query decoder preserves malformed and valid URI handling', () => {
  const query = mobileRequire('query-string');
  assert.equal(query.parse('name=hello%20world').name, 'hello world');
  assert.equal(query.parse('name=%E0%A4%A').name, '%E0%A4%A');
  assert.equal(query.parse('name=hello+world').name, 'hello world');
  assert.deepEqual(query.parse('tag=a&tag=b').tag, ['a', 'b']);
  const parsed = query.parseUrl('https://example.com/path?name=a%20b#section', {parseFragmentIdentifier: true});
  assert.equal(parsed.query.name, 'a b');
  assert.equal(parsed.fragmentIdentifier, 'section');
  assert.equal(query.parse('name=' + '%25'.repeat(5000)).name !== undefined, true);
});
