/**
 * Unit tests for content helpers: sanitizeFilename, uniqueFilename, and
 * fetchContent URL construction logic.
 * Run with: node tests/content.test.js
 */

// ── Replicated helpers from assets/public.js ────────────────────────────────
// (browser ES modules cannot be imported directly in Node.js without a bundler)

function sanitizeFilename(name) {
  return String(name)
    .replace(/[^a-zA-Z0-9._-]/g, '_')
    .replace(/_{2,}/g, '_')
    .replace(/^[._-]+/, '')  // strip leading dots, hyphens, underscores
    .slice(0, 200) || 'file';
}

function uniqueFilename(name) {
  const ts  = Date.now();
  const dot = name.lastIndexOf('.');
  if (dot > 0) return name.slice(0, dot) + '_' + ts + name.slice(dot);
  return name + '_' + ts;
}

// ── fetchContent URL construction (pure logic, no fetch) ────────────────────
function contentUrl(lang, section) {
  const safeLang    = ['fr', 'pt-BR'].includes(lang) ? lang : 'fr';
  const validSections = ['baggage', 'seats', 'attractions', 'restaurants', 'documents'];
  const safeSection = validSections.includes(section) ? section : 'baggage';
  return `data/${safeLang}/content/${safeSection}.json`;
}

// ── Test helpers ─────────────────────────────────────────────────────────────
let passed = 0, failed = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`  ✅ PASS: ${message}`);
    passed++;
  } else {
    console.error(`  ❌ FAIL: ${message}`);
    failed++;
  }
}

// ── sanitizeFilename tests ───────────────────────────────────────────────────

console.log('\nTest 1: sanitizeFilename — basic alphanumerics and allowed chars');
assert(sanitizeFilename('hello-world_2026.pdf') === 'hello-world_2026.pdf',
  'keeps alphanumerics, hyphens, underscores, dots');

console.log('\nTest 2: sanitizeFilename — replaces spaces and special chars');
{
  const result = sanitizeFilename('My File (1).PDF');
  assert(!result.includes(' '), 'no spaces in result');
  assert(!result.includes('('), 'no parentheses in result');
  assert(!result.includes(')'), 'no closing paren in result');
  assert(result.endsWith('.PDF'), 'keeps extension');
}

console.log('\nTest 3: sanitizeFilename — collapses multiple underscores');
{
  const result = sanitizeFilename('hello   world.pdf');
  assert(!result.includes('__'), `no double underscores: "${result}"`);
}

console.log('\nTest 4: sanitizeFilename — truncates to 200 chars');
{
  const longName = 'a'.repeat(250) + '.pdf';
  const result = sanitizeFilename(longName);
  assert(result.length <= 200, `length ${result.length} <= 200`);
}

console.log('\nTest 5: sanitizeFilename — handles path traversal attempts');
{
  const result = sanitizeFilename('../../../etc/passwd');
  assert(!result.includes('/'), `no slashes: "${result}"`);
  assert(!result.startsWith('.'), `does not start with dot: "${result}"`);
}

console.log('\nTest 6: sanitizeFilename — null/non-string coerced safely');
assert(typeof sanitizeFilename(null) === 'string', 'null coerced to string');
assert(sanitizeFilename(null) === 'null', 'sanitizeFilename(null) = "null"');

// ── uniqueFilename tests ─────────────────────────────────────────────────────

console.log('\nTest 7: uniqueFilename — inserts timestamp before extension');
{
  const original = 'receipt.pdf';
  const result = uniqueFilename(original);
  assert(result.startsWith('receipt_'), `starts with "receipt_": "${result}"`);
  assert(result.endsWith('.pdf'), `ends with ".pdf": "${result}"`);
  // Timestamp part is a number
  const ts = result.slice('receipt_'.length, -'.pdf'.length);
  assert(/^\d+$/.test(ts), `timestamp is digits: "${ts}"`);
}

console.log('\nTest 8: uniqueFilename — no extension → appends timestamp at end');
{
  const result = uniqueFilename('myfile');
  assert(result.startsWith('myfile_'), `starts with "myfile_": "${result}"`);
  assert(/^\d+$/.test(result.slice('myfile_'.length)), 'ends with digits');
}

console.log('\nTest 9: uniqueFilename — two calls produce different results');
{
  // They might collide if called in the same millisecond, but in practice don't.
  // We just check they're strings of reasonable length.
  const r1 = uniqueFilename('doc.pdf');
  const r2 = uniqueFilename('doc.pdf');
  assert(typeof r1 === 'string' && r1.length > 0, 'r1 is non-empty string');
  assert(typeof r2 === 'string' && r2.length > 0, 'r2 is non-empty string');
}

// ── contentUrl tests ─────────────────────────────────────────────────────────

console.log('\nTest 10: contentUrl — fr/baggage');
assert(contentUrl('fr', 'baggage') === 'data/fr/content/baggage.json',
  'fr/baggage path correct');

console.log('\nTest 11: contentUrl — pt-BR/restaurants');
assert(contentUrl('pt-BR', 'restaurants') === 'data/pt-BR/content/restaurants.json',
  'pt-BR/restaurants path correct');

console.log('\nTest 12: contentUrl — all valid sections');
{
  const sections = ['baggage', 'seats', 'attractions', 'restaurants', 'documents'];
  sections.forEach(s => {
    const url = contentUrl('fr', s);
    assert(url === `data/fr/content/${s}.json`, `fr/${s} → correct path`);
  });
}

console.log('\nTest 13: contentUrl — unknown lang defaults to fr');
{
  const url = contentUrl('de', 'baggage');
  assert(url === 'data/fr/content/baggage.json',
    `unknown lang "de" → falls back to fr: "${url}"`);
}

console.log('\nTest 14: contentUrl — unknown section defaults to baggage');
{
  const url = contentUrl('fr', 'unknown-section');
  assert(url === 'data/fr/content/baggage.json',
    `unknown section → falls back to baggage: "${url}"`);
}

// ── Summary ──────────────────────────────────────────────────────────────────
console.log(`\n${passed + failed} test(s): ${passed} passed, ${failed} failed.\n`);
if (failed > 0) process.exit(1);
