// query-string 7 is CommonJS; the patched decoder is ESM. Preserve its default export.
// Remove this bridge when the supported Expo release updates query-string.
import assert from 'node:assert/strict';
import {readFileSync, writeFileSync} from 'node:fs';
import {createRequire} from 'node:module';
const require = createRequire(new URL('../../mobile/package.json', import.meta.url));
assert.equal(require('query-string/package.json').version, '7.1.3', 'Review bridge for new query-string');
const entry = require.resolve('query-string');
const original = "const decodeComponent = require('decode-uri-component');";
const replacement = "const decodeModule = require('decode-uri-component');\nconst decodeComponent = decodeModule.default || decodeModule;";
const source = readFileSync(entry, 'utf8');
if (!source.includes(replacement)) {
  assert.equal(source.split(original).length, 2, 'Unexpected decoder import; refusing to patch');
  writeFileSync(entry, source.replace(original, replacement));
}
assert.equal(require('query-string').parse('check=hello%20world').check, 'hello world');
console.log('Mobile query decoder interop verified');
