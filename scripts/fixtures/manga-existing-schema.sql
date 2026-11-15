-- Schema-only test fixture based on inspection of the linked project, 2026-11-15.
-- No production data. Auth emulated through session claims in local Postgres.
create role anon;
create role authenticated;
create role service_role bypassrls;
create schema auth; create schema private; create schema extensions;
create table auth.users(id uuid primary key);
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true),'')::uuid $$;
grant usage on schema public,auth to anon,authenticated,service_role;
grant execute on function auth.uid() to anon,authenticated,service_role;
create table public.anime (
  id int8 not null,
  title text not null,
  slug text,
  image_url text,
  start_date date,
  score numeric,
  genres text[] default '{}'::text[],
  synopsis text,
  imported_at timestamptz default now(),
  banner_url text,
  status text,
  episodes int4,
  studios jsonb,
  anilist_is_sequel bool,
  anilist_metadata_checked_at timestamptz
);
create table public.games (
  id int8 not null,
  name text not null,
  slug text,
  cover_url text,
  release_date date,
  rating numeric,
  genres text[] default '{}'::text[],
  platforms text[] default '{}'::text[],
  summary text,
  imported_at timestamptz default now(),
  banner_url text,
  developers text[],
  igdb_category int4,
  igdb_version_parent int8,
  igdb_metadata_checked_at timestamptz,
  igdb_parent_game int8
);
create table public.library_entries (
  id uuid default gen_random_uuid() not null,
  user_id uuid not null,
  work_id text not null,
  work_type text not null,
  rating numeric,
  review_text text,
  contains_spoiler bool default false,
  finished_date date,
  created_at timestamptz default timezone('utc'::text, now()),
  updated_at timestamptz default timezone('utc'::text, now())
);
create table public.profiles (
  id uuid not null,
  username text not null,
  display_name text not null,
  avatar_url text,
  banner_url text,
  bio text,
  theme_color text default '#14b8a6'::text,
  location text,
  website text,
  favorite_games jsonb default '[]'::jsonb,
  favorite_anime jsonb default '[]'::jsonb,
  onboarding_completed bool default false,
  created_at timestamptz default timezone('utc'::text, now()),
  updated_at timestamptz default timezone('utc'::text, now()),
  color_pack text default 'teal'::text,
  color_bg text default '#080808'::text,
  color_card text default '#161616'::text,
  birthday date,
  looking_for text[] default '{}'::text[],
  activity_level text default 'casual'::text,
  pronouns text,
  favorite_game jsonb,
  anime_tags text[] default '{}'::text[],
  custom_tags text[] default '{}'::text[],
  social_links jsonb default '{}'::jsonb,
  featured_tierlists jsonb default '[]'::jsonb,
  favorite_genres text[] default '{}'::text[],
  platforms text[] default '{}'::text[],
  profile_song jsonb,
  badges text[] default ARRAY['early'::text],
  featured_badge text,
  favorite_animes jsonb[] default ARRAY[]::jsonb[],
  wishlist jsonb default '[]'::jsonb,
  pinned_list_id uuid,
  pinned_review_id uuid,
  name_font text default 'display'::text not null,
  bio_font text default 'sans'::text not null
);
create table public.user_lists (
  id uuid default gen_random_uuid() not null,
  user_id uuid not null,
  template_id uuid,
  title text not null,
  list_type text not null,
  media_type text not null,
  type_config jsonb default '{}'::jsonb not null,
  content jsonb default '{}'::jsonb not null,
  visibility text default 'public'::text not null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create table public.list_templates (
  id uuid default gen_random_uuid() not null,
  user_id uuid not null,
  title text not null,
  description text,
  list_type text not null,
  media_type text not null,
  type_config jsonb default '{}'::jsonb not null,
  default_items jsonb default '[]'::jsonb not null,
  visibility text default 'public'::text not null,
  uses_count int4 default 0 not null,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  cover_items jsonb default '[]'::jsonb not null
);
create table public.posts (
  id uuid default gen_random_uuid() not null,
  user_id uuid not null,
  body text default ''::text not null,
  media jsonb default '[]'::jsonb not null,
  contains_spoiler bool default false not null,
  is_sensitive bool default false not null,
  spoiler_work_id text,
  spoiler_work_type text,
  spoiler_work_title text,
  created_at timestamptz default now() not null
);
create table public.spaces (
  id uuid default gen_random_uuid() not null,
  name text not null,
  description text,
  avatar_url text,
  banner_url text,
  owner_id uuid not null,
  created_at timestamptz default timezone('utc'::text, now()) not null,
  is_verified bool default false,
  theme_color text default '#14b8a6'::text,
  related_works jsonb default '[]'::jsonb
);
CREATE OR REPLACE FUNCTION public.is_valid_alignment(config jsonb, contents jsonb DEFAULT '{}'::jsonb)
 RETURNS boolean
 LANGUAGE plpgsql
 IMMUTABLE
 SET search_path TO ''
AS $function$
declare
  axis_key text;
  axis jsonb;
  entry jsonb;
  ids text[];
  valid_keys text[] := array[]::text[];
  x_entry jsonb;
  y_entry jsonb;
  cell record;
begin
  if jsonb_typeof(config) is distinct from 'object'
     or config->'version' is distinct from '1'::jsonb then return false; end if;
  foreach axis_key in array array['x', 'y'] loop
    axis := config->'axes'->axis_key;
    if jsonb_typeof(axis) is distinct from 'object'
       or jsonb_typeof(axis->'label') is distinct from 'string'
       or char_length(axis->>'label') > 60
       or jsonb_typeof(axis->'entries') is distinct from 'array' then return false; end if;
    if jsonb_array_length(axis->'entries') not between 2 and 6 then return false; end if;
    ids := array[]::text[];
    for entry in select value from jsonb_array_elements(axis->'entries') loop
      if jsonb_typeof(entry) is distinct from 'object'
         or jsonb_typeof(entry->'id') is distinct from 'string'
         or (entry->>'id') !~ '^[a-zA-Z0-9_-]{1,80}$'
         or (entry->>'id') = any(ids)
         or jsonb_typeof(entry->'label') is distinct from 'string'
         or char_length(btrim(entry->>'label')) = 0
         or char_length(entry->>'label') > 60 then return false; end if;
      ids := array_append(ids, entry->>'id');
    end loop;
  end loop;
  if jsonb_typeof(contents) is distinct from 'object' then return false; end if;
  for y_entry in select value from jsonb_array_elements(config->'axes'->'y'->'entries') loop
    for x_entry in select value from jsonb_array_elements(config->'axes'->'x'->'entries') loop
      valid_keys := array_append(valid_keys, 'a:' || (x_entry->>'id') || ':' || (y_entry->>'id'));
    end loop;
  end loop;
  for cell in select key, value from jsonb_each(contents) loop
    if not (cell.key = any(valid_keys)) then return false; end if;
    if cell.value = 'null'::jsonb then continue; end if;
    if jsonb_typeof(cell.value) is distinct from 'object'
       or coalesce(jsonb_typeof(cell.value->'id'), '') not in ('string', 'number')
       or char_length(btrim(cell.value->>'id')) = 0
       or jsonb_typeof(cell.value->'name') is distinct from 'string'
       or char_length(btrim(cell.value->>'name')) = 0
       or (cell.value ? 'image_url' and jsonb_typeof(cell.value->'image_url') not in ('string', 'null')) then return false; end if;
  end loop;
  return true;
end;
$function$
;
alter table public.profiles add constraint profiles_username_check CHECK ((char_length(username) >= 3));
alter table public.profiles add constraint profiles_pkey PRIMARY KEY (id);
alter table public.profiles add constraint profiles_username_key UNIQUE (username);
alter table public.profiles add constraint profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table public.posts add constraint posts_body_max_length CHECK ((char_length(body) <= 2000));
alter table public.list_templates add constraint list_templates_media_type_check CHECK ((media_type = ANY (ARRAY['game'::text, 'anime'::text])));
alter table public.list_templates add constraint list_templates_visibility_check CHECK ((visibility = ANY (ARRAY['public'::text, 'private'::text])));
alter table public.list_templates add constraint list_templates_pkey PRIMARY KEY (id);
alter table public.list_templates add constraint list_templates_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table public.user_lists add constraint user_lists_media_type_check CHECK ((media_type = ANY (ARRAY['game'::text, 'anime'::text])));
alter table public.games add constraint games_pkey PRIMARY KEY (id);
alter table public.games add constraint games_slug_key UNIQUE (slug);
alter table public.anime add constraint anime_pkey PRIMARY KEY (id);
alter table public.user_lists add constraint user_lists_visibility_check CHECK ((visibility = ANY (ARRAY['public'::text, 'private'::text])));
alter table public.user_lists add constraint user_lists_pkey PRIMARY KEY (id);
alter table public.user_lists add constraint user_lists_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table public.user_lists add constraint user_lists_template_id_fkey FOREIGN KEY (template_id) REFERENCES list_templates(id) ON DELETE SET NULL;
alter table public.posts add constraint posts_media_array_max_three CHECK (
CASE
    WHEN (jsonb_typeof(media) = 'array'::text) THEN (jsonb_array_length(media) <= 3)
    ELSE false
END);
alter table public.posts add constraint posts_body_or_media_required CHECK (((char_length(btrim(body)) > 0) OR
CASE
    WHEN (jsonb_typeof(media) = 'array'::text) THEN (jsonb_array_length(media) > 0)
    ELSE false
END));
alter table public.list_templates add constraint list_templates_list_type_check CHECK ((list_type = ANY (ARRAY['tierlist'::text, 'ranking'::text, 'grid'::text, 'alignment'::text])));
alter table public.posts add constraint posts_spoiler_work_type_valid CHECK (((spoiler_work_type IS NULL) OR (spoiler_work_type = ANY (ARRAY['game'::text, 'anime'::text]))));
alter table public.posts add constraint posts_pkey PRIMARY KEY (id);
alter table public.posts add constraint posts_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table public.library_entries add constraint library_entries_work_type_check CHECK ((work_type = ANY (ARRAY['game'::text, 'anime'::text])));
alter table public.library_entries add constraint library_entries_pkey PRIMARY KEY (id);
alter table public.library_entries add constraint library_entries_user_id_work_id_work_type_key UNIQUE (user_id, work_id, work_type);
alter table public.library_entries add constraint library_entries_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table public.profiles add constraint profiles_pinned_list_id_fkey FOREIGN KEY (pinned_list_id) REFERENCES user_lists(id) ON DELETE SET NULL;
alter table public.profiles add constraint profiles_pinned_review_id_fkey FOREIGN KEY (pinned_review_id) REFERENCES library_entries(id) ON DELETE SET NULL;
alter table public.list_templates add constraint list_templates_no_ranking CHECK ((list_type <> 'ranking'::text));
alter table public.spaces add constraint spaces_pkey PRIMARY KEY (id);
alter table public.library_entries add constraint library_entries_rating_check CHECK (((rating IS NULL) OR ((rating >= 0.5) AND (rating <= (5)::numeric) AND ((rating * (2)::numeric) = trunc((rating * (2)::numeric))))));
alter table public.spaces add constraint spaces_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES profiles(id) ON DELETE CASCADE;
alter table public.profiles add constraint profiles_name_font_check CHECK ((name_font = ANY (ARRAY['display'::text, 'sans'::text, 'system'::text, 'humanist'::text, 'rounded'::text, 'serif'::text, 'book'::text, 'mono'::text, 'condensed'::text, 'pixel'::text, 'gothic'::text, 'handwriting'::text])));
alter table public.profiles add constraint profiles_bio_font_check CHECK ((bio_font = ANY (ARRAY['inherit'::text, 'display'::text, 'sans'::text, 'system'::text, 'humanist'::text, 'rounded'::text, 'serif'::text, 'book'::text, 'mono'::text, 'condensed'::text, 'pixel'::text, 'gothic'::text, 'handwriting'::text])));
alter table public.user_lists add constraint user_lists_list_type_check CHECK ((list_type = ANY (ARRAY['tierlist'::text, 'ranking'::text, 'grid'::text, 'alignment'::text])));
alter table public.list_templates add constraint list_templates_alignment_config_check CHECK (((list_type <> 'alignment'::text) OR (is_valid_alignment(type_config) IS TRUE)));
alter table public.user_lists add constraint user_lists_alignment_content_check CHECK (((list_type <> 'alignment'::text) OR (is_valid_alignment(type_config, content) IS TRUE)));
alter table public.anime enable row level security;
grant select on public.anime to anon;
grant all on public.anime to authenticated,service_role;
alter table public.games enable row level security;
grant select on public.games to anon;
grant all on public.games to authenticated,service_role;
alter table public.library_entries enable row level security;
grant select on public.library_entries to anon;
grant all on public.library_entries to authenticated,service_role;
alter table public.profiles enable row level security;
grant select on public.profiles to anon;
grant all on public.profiles to authenticated,service_role;
alter table public.user_lists enable row level security;
grant select on public.user_lists to anon;
grant all on public.user_lists to authenticated,service_role;
alter table public.list_templates enable row level security;
grant select on public.list_templates to anon;
grant all on public.list_templates to authenticated,service_role;
alter table public.posts enable row level security;
grant select on public.posts to anon;
grant all on public.posts to authenticated,service_role;
alter table public.spaces enable row level security;
grant select on public.spaces to anon;
grant all on public.spaces to authenticated,service_role;
create policy "Los perfiles son publicos" on public.profiles for SELECT to public using (true);
create policy "Los usuarios pueden crear su perfil" on public.profiles for INSERT to public with check ((auth.uid() = id));
create policy "Los usuarios pueden editar su perfil" on public.profiles for UPDATE to public using ((auth.uid() = id));
create policy "Los registros son publicos" on public.library_entries for SELECT to public using (true);
create policy "Los usuarios pueden insertar sus propios registros" on public.library_entries for INSERT to public with check ((auth.uid() = user_id));
create policy "Los usuarios pueden actualizar sus propios registros" on public.library_entries for UPDATE to public using ((auth.uid() = user_id));
create policy "Los usuarios pueden borrar sus propios registros" on public.library_entries for DELETE to public using ((auth.uid() = user_id));
create policy "list_templates_select" on public.list_templates for SELECT to public using (((visibility = 'public'::text) OR (auth.uid() = user_id)));
create policy "list_templates_insert" on public.list_templates for INSERT to public with check ((auth.uid() = user_id));
create policy "list_templates_update" on public.list_templates for UPDATE to public using ((auth.uid() = user_id));
create policy "list_templates_delete" on public.list_templates for DELETE to public using ((auth.uid() = user_id));
create policy "Games are publicly readable" on public.games for SELECT to public using (true);
create policy "Authenticated users can import games" on public.games for INSERT to authenticated with check (true);
create policy "Anime are publicly readable" on public.anime for SELECT to public using (true);
create policy "Authenticated users can import anime" on public.anime for INSERT to authenticated with check (true);
create policy "user_lists_select" on public.user_lists for SELECT to public using (((visibility = 'public'::text) OR (auth.uid() = user_id)));
create policy "user_lists_insert" on public.user_lists for INSERT to public with check ((auth.uid() = user_id));
create policy "user_lists_update" on public.user_lists for UPDATE to public using ((auth.uid() = user_id));
create policy "user_lists_delete" on public.user_lists for DELETE to public using ((auth.uid() = user_id));
create policy "Espacios visibles para todos" on public.spaces for SELECT to public using (true);
create policy "Autenticados pueden crear espacios" on public.spaces for INSERT to public with check ((auth.uid() = owner_id));
create policy "Owners can update spaces" on public.spaces for UPDATE to public using ((auth.uid() = owner_id));
create policy "Dueños pueden borrar sus espacios" on public.spaces for DELETE to authenticated using ((auth.uid() = owner_id));
create policy "Users can delete their own posts" on public.posts for DELETE to authenticated using ((auth.uid() = user_id));
create policy "Posts are readable by everyone" on public.posts for SELECT to public using (true);
create policy "Users can create their own posts" on public.posts for INSERT to authenticated with check ((auth.uid() = user_id));
create policy "Users can update their own posts" on public.posts for UPDATE to authenticated using ((auth.uid() = user_id)) with check ((auth.uid() = user_id));
