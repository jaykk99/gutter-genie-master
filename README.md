Live: https://gutter-genie-master.pages.dev/

# gutter-genie-master

Gutter Genie Master App: business hub for the Gutter Genie gutter-cleaning
business (Winnipeg / Steinbach / Grunthal). Jay's daily-driver dashboard.

**Live site:** https://gutter-genie-master.pages.dev

Pure static HTML: no build step, no dependencies to install. Cloudflare Pages
serves `index.html` directly. The old Vercel deployment is disabled (the team
was paused in Oct 2026); the linked satellite apps that still point at
`*.vercel.app` come back when hosting is re-pointed.

## Pages

- `index.html`: Business Hub. Home view with live job stats (skeleton
  loaders, last-synced timestamp, refresh, error state with retry), quick
  actions (call, email, new quote, new job), and app cards with per-app
  link-health status dots (reachable / unreachable / unknown). Health is
  re-checked every 5 minutes; results are cached in localStorage so offline
  opens show the last known state with its age, and a failing primary URL is
  probed against its backup URL before the app is marked down. Sidebar nav
  loads each app in a sandboxed iframe with a loading spinner and a
  "taking too long" error bar (retry + open-in-new-tab). Online/offline
  indicator in the topbar. A service worker (`sw.js`) caches the hub shell
  so the dashboard opens with no connection. Keyboard: `1`–`9` opens apps in
  card order, `0`/`H` goes home.
- `jobs.html`: Jobs Tracker. Searchable job log (customer, address, zone,
  phone, status, quote, notes) reading the `gg_projects` Supabase table, with
  realtime updates, CSV export (exports the current filter/sort), tappable
  phone numbers, and a Notion link.
  Click any sortable column header (Customer, Status, Quote, Updated) to sort;
  click again to flip direction. Each row has a status dropdown for inline
  status changes and a checkbox for batch work: select several jobs, then
  apply one status or delete them in a single action. A pipeline bar shows
  total jobs, total quoted dollars, and per-status counts. Zone filter is
  built from the loaded jobs.
  refreshes a localStorage cache; jobs added while offline are queued and
  auto-synced to the cloud on the next successful load (marked "unsynced"
  until then). Table shows skeleton rows while loading, a last-synced
  timestamp, and a retry button on errors.

## Data

Both pages use a public Supabase **anon key** (embedded, safe for browsers,
it is rate-limited by Row Level Security). No API keys or secrets are required
to run the app.

## Local run

Serve the folder (recommended: some features assume http):

```bash
python3 -m http.server 8080
# then open http://localhost:8080/
```

## Tests

Pure, dependency-free logic lives in `js/media-tags.js` (UMD: works in the
browser and in node) and is covered by a node test suite:

```bash
npm test   # node --test test/media-tags.test.js
```

Also: `node --check` on both pages' inline scripts, plus a Node harness that
stubs the DOM/Supabase/fetch and exercises the real page logic:
stats rendering + error states, link-health checks, offline cache writes,
offline job queueing, and pending-sync flush on reconnect. (Harness is
throwaway: kept in /tmp during development, not committed.)

## Gallery photo tagging: `tag` column migration

The gallery tags photos Before / After / General. The app code that will use
the new column is ready; the column itself needs one SQL run:

1. Open the Supabase SQL editor for the Gutter Genie project.
2. Run `supabase/migrations/001_gg_media_files_add_tag.sql`.

The migration is idempotent (`IF NOT EXISTS`), adds a trim/empty-to-NULL
trigger, and backfills `tag` from the legacy `photo_type` values.

`js/media-tags.js` is the runtime companion: it feature-detects the `tag`
column on first use and degrades gracefully when the migration has not been
applied yet:

- `detectTagSupport(sb)` probes `select tag ... limit 1` and returns
  `{ tagColumn, reason }`. A missing-column error (`42703` / "column \"tag\"
  does not exist") means "fall back"; auth/network failures are reported as
  `query-failed` and are never mistaken for a missing column. Results are
  memoized per client; `resetSupportCache()` clears it (e.g. right after you
  run the migration).
- `resolveTag(row, support)` returns the effective tag: the `tag` column when
  available, otherwise the `photo_type` fallback (canonicalizing
  before/after/general, passing anything else through untouched).
- `tagWritePayload(tag, support)` builds the insert/update payload against
  whichever column is live.
- `filterByTag(rows, tag, support)` filters rows by their resolved tag.

Wire it into the gallery app with:

```html
<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
<script src="js/media-tags.js"></script>
<script>
const sb = supabase.createClient(SB_URL, SB_KEY);
const support = await GGMediaTags.detectTagSupport(sb);
// read
const { data } = await sb.from('gg_media_files').select('*');
const before = GGMediaTags.filterByTag(data, 'Before', support);
// write
await sb.from('gg_media_files').update(GGMediaTags.tagWritePayload('After', support)).eq('id', id);
</script>
```
