/* Unit tests for js/media-tags.js (run with: node --test test/media-tags.test.js) */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const T = require('../js/media-tags.js');

// Mock supabase client: from(table).select(cols).limit(n) -> canned response.
function mockClient(responder) {
  return {
    from: (table) => ({
      select: (cols) => ({
        limit: (n) => Promise.resolve(responder(table, cols, n)),
      }),
    }),
  };
}

test('normalizeTag trims, nulls empties, caps length', () => {
  assert.equal(T.normalizeTag('  Before '), 'Before');
  assert.equal(T.normalizeTag(''), null);
  assert.equal(T.normalizeTag('   '), null);
  assert.equal(T.normalizeTag(null), null);
  assert.equal(T.normalizeTag('x'.repeat(100)).length, 60);
});

test('photoTypeToTag canonicalizes known values, passes others through', () => {
  assert.equal(T.photoTypeToTag('before'), 'Before');
  assert.equal(T.photoTypeToTag('AFTER'), 'After');
  assert.equal(T.photoTypeToTag('general'), 'General');
  assert.equal(T.photoTypeToTag('  before  '), 'Before');
  assert.equal(T.photoTypeToTag('marketing'), 'marketing');
  assert.equal(T.photoTypeToTag(''), null);
  assert.equal(T.photoTypeToTag(null), null);
});

test('resolveTag prefers tag column, falls back to photo_type', () => {
  const withCol = { tagColumn: true };
  const withoutCol = { tagColumn: false };
  assert.equal(T.resolveTag({ tag: 'After', photo_type: 'before' }, withCol), 'After');
  assert.equal(T.resolveTag({ tag: null, photo_type: 'before' }, withCol), 'Before',
    'tag column exists but row predates backfill -> legacy column');
  assert.equal(T.resolveTag({ tag: 'After', photo_type: 'before' }, withoutCol), 'Before',
    'no tag column -> legacy column wins');
  assert.equal(T.resolveTag({}, withoutCol), null);
});

test('tagWritePayload writes the right column per support', () => {
  assert.deepEqual(T.tagWritePayload('Before', { tagColumn: true }), { tag: 'Before' });
  assert.deepEqual(T.tagWritePayload('  ', { tagColumn: true }), { tag: null });
  assert.deepEqual(T.tagWritePayload('Before', { tagColumn: false }), { photo_type: 'before' });
  assert.deepEqual(T.tagWritePayload('', { tagColumn: false }), { photo_type: null });
});

test('isMissingColumnError only matches missing-column errors', () => {
  assert.equal(T.isMissingColumnError(null), false);
  assert.equal(T.isMissingColumnError({}), false);
  assert.equal(T.isMissingColumnError({ code: '42703', message: 'x' }), true);
  assert.equal(T.isMissingColumnError({ message: 'column "tag" does not exist' }), true);
  assert.equal(T.isMissingColumnError({ message: "Could not find the 'tag' column of 'gg_media_files' in the schema cache" }), true);
  assert.equal(T.isMissingColumnError({ message: 'JWT expired' }), false);
  assert.equal(T.isMissingColumnError({ message: 'Failed to fetch' }), false,
    'network failure must NOT look like a missing column');
});

test('detectTagSupport: column present', async () => {
  T.resetSupportCache();
  const sb = mockClient(() => ({ data: [{ tag: 'Before' }], error: null }));
  const res = await T.detectTagSupport(sb);
  assert.deepEqual(res, { tagColumn: true, reason: 'ok' });
});

test('detectTagSupport: missing column degrades gracefully', async () => {
  T.resetSupportCache();
  const sb = mockClient(() => ({ data: null, error: { code: '42703', message: 'column "tag" does not exist' } }));
  const res = await T.detectTagSupport(sb);
  assert.deepEqual(res, { tagColumn: false, reason: 'missing-column' });
});

test('detectTagSupport: auth/network failure is not missing-column', async () => {
  T.resetSupportCache();
  const sb = mockClient(() => ({ data: null, error: { message: 'JWT expired', code: 'PGRST301' } }));
  const res = await T.detectTagSupport(sb);
  assert.deepEqual(res, { tagColumn: false, reason: 'query-failed' });
});

test('detectTagSupport: throwing client never throws', async () => {
  T.resetSupportCache();
  const sb = { from: () => { throw new Error('boom'); } };
  const res = await T.detectTagSupport(sb);
  assert.deepEqual(res, { tagColumn: false, reason: 'query-failed' });
});

test('detectTagSupport: no client', async () => {
  const res = await T.detectTagSupport(null);
  assert.deepEqual(res, { tagColumn: false, reason: 'no-client' });
});

test('detectTagSupport memoizes per client', async () => {
  T.resetSupportCache();
  let calls = 0;
  const sb = mockClient(() => { calls++; return { data: [], error: null }; });
  await T.detectTagSupport(sb);
  await T.detectTagSupport(sb);
  assert.equal(calls, 1);
});

test('filterByTag matches resolved tags case-insensitively', () => {
  const rows = [
    { tag: 'Before', photo_type: 'x' },
    { tag: null, photo_type: 'after' },
    { tag: null, photo_type: null },
  ];
  const withCol = { tagColumn: true };
  assert.equal(T.filterByTag(rows, 'before', withCol).length, 1);
  assert.equal(T.filterByTag(rows, 'AFTER', withCol).length, 1);
  assert.equal(T.filterByTag(rows, '', withCol).length, 3, 'empty tag matches all');
  assert.equal(T.filterByTag(rows, 'General', withCol).length, 0);
});
