-- Gutter Genie: add a free-form `tag` column to gg_media_files.
--
-- Background: the gallery UI tags photos as Before / After / General, but it
-- currently maps those onto the existing `photo_type` column. A dedicated
-- `tag` column lets future tags be added without touching the legacy column.
--
-- Safe to run more than once (IF NOT EXISTS). The app code feature-detects
-- this column at runtime (see js/media-tags.js) and falls back to the
-- `photo_type` mapping when it is absent, so old app versions keep working
-- before AND after this migration.
--
-- Run in the Supabase SQL editor (project fhbqxujlnqlmzvulrdxt) or via
-- `supabase db push` if the project is linked locally.

alter table public.gg_media_files
  add column if not exists tag text;

comment on column public.gg_media_files.tag is
  'Free-form gallery tag (e.g. Before, After, General). App feature-detects this column and falls back to photo_type when absent.';

-- Keep values tidy: trim whitespace, treat empty strings as NULL.
create or replace function public.gg_media_files_tag_normalize()
returns trigger
language plpgsql
as $$
begin
  if new.tag is not null then
    new.tag := nullif(btrim(new.tag), '');
  end if;
  return new;
end;
$$;

drop trigger if exists gg_media_files_tag_normalize on public.gg_media_files;

create trigger gg_media_files_tag_normalize
  before insert or update of tag on public.gg_media_files
  for each row execute function public.gg_media_files_tag_normalize();

-- Backfill: seed tag from the legacy photo_type values where tag is empty,
-- so existing galleries keep their organization after the migration.
update public.gg_media_files
set tag = photo_type
where tag is null
  and photo_type is not null
  and photo_type <> '';
