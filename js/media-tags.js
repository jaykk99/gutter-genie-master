/* gutter-genie-master: gallery tag support with graceful degradation.
 *
 * The `tag` column on gg_media_files is added by
 * supabase/migrations/001_gg_media_files_add_tag.sql. Until that migration
 * has been applied, this module detects the missing column at runtime and
 * falls back to the legacy `photo_type` column, so the gallery keeps working
 * either way.
 *
 * UMD: loads as window.GGMediaTags in the browser, or require() in node.
 * Dependency-free: pass your supabase client in; nothing is imported.
 */
(function (root, factory) {
  var api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.GGMediaTags = api;
})(typeof self !== 'undefined' ? self : global, function () {
  'use strict';

  // Canonical gallery tags. The column itself is free-form (the DB trigger
  // trims whitespace and nulls empties), but the UI speaks these three.
  var KNOWN_TAGS = ['Before', 'After', 'General'];

  function trim(s) {
    return String(s == null ? '' : s).replace(/^\s+|\s+$/g, '');
  }

  /** Normalize a tag value: trimmed, '' -> null, max 60 chars. */
  function normalizeTag(tag) {
    var t = trim(tag);
    if (!t) return null;
    return t.slice(0, 60);
  }

  /**
   * Map a legacy photo_type value onto a tag. Known values are canonicalized
   * ('before' -> 'Before'); anything else non-empty passes through as-is so
   * no data is lost in the fallback path.
   */
  function photoTypeToTag(photoType) {
    var t = trim(photoType);
    if (!t) return null;
    var lower = t.toLowerCase();
    for (var i = 0; i < KNOWN_TAGS.length; i++) {
      if (KNOWN_TAGS[i].toLowerCase() === lower) return KNOWN_TAGS[i];
    }
    return t.slice(0, 60);
  }

  /**
   * The effective tag for a gg_media_files row.
   * support: { tagColumn: boolean } from detectTagSupport().
   */
  function resolveTag(row, support) {
    row = row || {};
    if (support && support.tagColumn) {
      var t = normalizeTag(row.tag);
      if (t) return t;
      // tag column exists but this row predates the backfill: fall through
      // to the legacy column rather than showing "untagged".
    }
    return photoTypeToTag(row.photo_type);
  }

  /**
   * Build the write payload for tagging a row. Uses the `tag` column when
   * the DB has it, otherwise writes the legacy `photo_type` column so older
   * databases keep working.
   */
  function tagWritePayload(tag, support) {
    var t = normalizeTag(tag);
    if (support && support.tagColumn) return { tag: t };
    return { photo_type: t ? t.toLowerCase() : null };
  }

  /**
   * True when a Supabase/PostgREST error means "the tag column does not
   * exist" (as opposed to a network/auth failure, which must NOT be treated
   * as "column missing").
   */
  function isMissingColumnError(error) {
    if (!error) return false;
    if (error.code === '42703') return true; // postgres undefined_column
    var msg = String(error.message || '') + ' ' + String(error.details || '') + ' ' + String(error.hint || '');
    return /column\s+"?tag"?\s+does not exist/i.test(msg) ||
           /could not find the '?tag'? column/i.test(msg);
  }

  /**
   * Feature-detect the tag column. Never throws: any failure degrades to
   * { tagColumn: false } with a reason. Results are memoized per client.
   *
   * Returns a promise of { tagColumn: boolean, reason: 'ok' |
   * 'missing-column' | 'query-failed' }.
   */
  var supportCache = typeof WeakMap !== 'undefined' ? new WeakMap() : null;
  function detectTagSupport(sb) {
    if (!sb || typeof sb.from !== 'function') {
      return Promise.resolve({ tagColumn: false, reason: 'no-client' });
    }
    if (supportCache && supportCache.has(sb)) {
      return supportCache.get(sb);
    }
    var p = Promise.resolve()
      .then(function () {
        return sb.from('gg_media_files').select('tag').limit(1);
      })
      .then(function (res) {
        res = res || {};
        if (res.error) {
          return {
            tagColumn: false,
            reason: isMissingColumnError(res.error) ? 'missing-column' : 'query-failed'
          };
        }
        return { tagColumn: true, reason: 'ok' };
      })
      .catch(function () {
        return { tagColumn: false, reason: 'query-failed' };
      });
    if (supportCache) supportCache.set(sb, p);
    return p;
  }

  /** Clear the memoized detection (tests, or after running the migration). */
  function resetSupportCache() {
    if (supportCache) supportCache = new WeakMap();
  }

  /**
   * Filter a list of gg_media_files rows by tag, using the resolved
   * (column-or-fallback) tag. tag null/'' matches everything.
   */
  function filterByTag(rows, tag, support) {
    var want = normalizeTag(tag);
    if (!want) return (rows || []).slice();
    var lower = want.toLowerCase();
    return (rows || []).filter(function (r) {
      var t = resolveTag(r, support);
      return t && t.toLowerCase() === lower;
    });
  }

  return {
    KNOWN_TAGS: KNOWN_TAGS,
    normalizeTag: normalizeTag,
    photoTypeToTag: photoTypeToTag,
    resolveTag: resolveTag,
    tagWritePayload: tagWritePayload,
    isMissingColumnError: isMissingColumnError,
    detectTagSupport: detectTagSupport,
    resetSupportCache: resetSupportCache,
    filterByTag: filterByTag
  };
});
