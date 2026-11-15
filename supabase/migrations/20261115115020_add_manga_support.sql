-- Additive catalog. Existing anime/IGDB keys and historical JSON are unchanged.
create table public.manga (
  provider text not null check (provider = 'mal'),
  external_type text not null check (external_type = 'manga'),
  external_id text not null check (external_id ~ '^[1-9][0-9]{0,29}$'),
  id text generated always as (provider || ':' || external_type || ':' || external_id) stored primary key,
  title text not null check (char_length(title) between 1 and 500),
  alternative_titles text[] not null default '{}',
  image_url text,
  start_date text check (start_date ~ '^[0-9]{4}(-[0-9]{2}(-[0-9]{2})?)?$'),
  date_precision text check (date_precision in ('year','month','day')),
  synopsis text,
  genres text[] not null default '{}',
  authors jsonb not null default '[]' check (jsonb_typeof(authors) = 'array'),
  publication_status text,
  format text not null check (format in ('manga','one_shot','manhwa','manhua')),
  chapters integer check (chapters > 0),
  volumes integer check (volumes > 0),
  external_score numeric check (external_score between 0 and 10),
  external_score_scale integer not null default 10 check (external_score_scale = 10),
  source_url text not null,
  metadata_checked_at timestamptz not null default now(),
  detail_expires_at timestamptz,
  unique (provider, external_type, external_id)
);
alter table public.manga enable row level security;
revoke all on public.manga from anon, authenticated;
grant select on public.manga to anon, authenticated;
grant all on public.manga to service_role;
create policy manga_public_read on public.manga for select to anon, authenticated using (true);
create index manga_title_search on public.manga using gin (to_tsvector('simple', title));
create index manga_title_order on public.manga(title, id);
create index manga_genres on public.manga using gin(genres);
-- Trigram index uses the extension already installed by Supabase where available.
do $$ begin
  if exists (select 1 from pg_extension where extname = 'pg_trgm') then
    execute 'create index manga_title_trgm on public.manga using gin (title extensions.gin_trgm_ops)';
  end if;
end $$;

create function public.search_manga_catalog(search_query text, result_limit integer default 20, result_offset integer default 0)
returns setof public.manga language plpgsql stable security invoker set search_path = '' as $$
declare pattern text;
begin
  if search_query is null or result_limit is null or result_offset is null or char_length(btrim(search_query)) not between 2 and 100 or result_limit not between 1 and 50 or result_offset not between 0 and 1000 then raise exception 'Invalid search'; end if;
  pattern := '%' || replace(replace(replace(btrim(search_query), E'\\', E'\\\\'), '%', E'\\%'), '_', E'\\_') || '%';
  return query select m.* from public.manga m where m.title ilike pattern or exists(select 1 from unnest(m.alternative_titles) title where title ilike pattern)
    order by case when lower(m.title)=lower(btrim(search_query)) then 0 else 1 end,m.title,m.id limit result_limit offset result_offset;
end $$;
revoke all on function public.search_manga_catalog(text,integer,integer) from public;
grant execute on function public.search_manga_catalog(text,integer,integer) to anon, authenticated;

create function public.recommend_manga(result_limit integer default 6)
returns setof public.manga language plpgsql stable security invoker set search_path = '' as $$
begin
  if result_limit is null or result_limit not between 1 and 30 then raise exception 'Invalid limit'; end if;
  return query with preferred as (
    select distinct unnest(m.genres) genre from public.library_entries e join public.manga m on m.id=e.work_id
    where e.work_type='manga' and e.user_id=(select auth.uid()) and (e.rating is null or e.rating>=3)
  ), stats as (select work_id,count(*) registrations from public.library_entries where work_type='manga' group by work_id)
  select m.* from public.manga m left join stats s on s.work_id=m.id
    where not exists(select 1 from public.library_entries e where e.user_id=(select auth.uid()) and e.work_type='manga' and e.work_id=m.id)
    order by (select count(*) from preferred where genre=any(m.genres)) desc, coalesce(s.registrations,0) desc,m.title,m.id limit result_limit;
end $$;
revoke all on function public.recommend_manga(integer) from public;
grant execute on function public.recommend_manga(integer) to anon, authenticated;

alter table public.library_entries drop constraint library_entries_work_type_check;
alter table public.library_entries add constraint library_entries_work_type_check check (work_type in ('game','anime','manga'));
alter table public.user_lists drop constraint user_lists_media_type_check;
alter table public.user_lists add constraint user_lists_media_type_check check (media_type in ('game','anime','manga'));
alter table public.list_templates drop constraint list_templates_media_type_check;
alter table public.list_templates add constraint list_templates_media_type_check check (media_type in ('game','anime','manga'));
alter table public.posts drop constraint posts_spoiler_work_type_valid;
alter table public.posts add constraint posts_spoiler_work_type_valid check (spoiler_work_type is null or spoiler_work_type in ('game','anime','manga'));
alter table public.profiles add column favorite_manga jsonb not null default '[]'
  check (jsonb_typeof(favorite_manga) = 'array' and jsonb_array_length(favorite_manga) <= 4);
-- Explicit ownership checks, including preventing reassignment of the owner.
alter policy "Los usuarios pueden actualizar sus propios registros" on public.library_entries to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
alter policy "Los usuarios pueden insertar sus propios registros" on public.library_entries to authenticated
  with check ((select auth.uid()) = user_id);
alter policy "Los usuarios pueden borrar sus propios registros" on public.library_entries to authenticated
  using ((select auth.uid()) = user_id);
alter policy user_lists_update on public.user_lists to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
alter policy list_templates_update on public.list_templates to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create index if not exists library_entries_work_recent on public.library_entries(work_type, work_id, created_at desc);
-- A manga log must refer to a catalog identity imported by the server.
create function public.validate_manga_log() returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  if new.work_type = 'manga' and not exists (select 1 from public.manga where id = new.work_id) then
    raise exception 'Manga no encontrado en el catálogo' using errcode = '23503';
  end if;
  return new;
end $$;
revoke all on function public.validate_manga_log() from public;
create trigger validate_manga_log before insert or update of work_id, work_type on public.library_entries for each row execute function public.validate_manga_log();

-- Server-only shared cache, lease, circuit breaker and counters. No client can reserve quota.
create table public.manga_provider_cache (
  key text primary key check (char_length(key) <= 300),
  payload jsonb,
  expires_at timestamptz,
  locked_until timestamptz
);
create table public.manga_request_buckets (
  key text primary key,
  hits integer not null default 0,
  expires_at timestamptz not null
);
alter table public.manga_provider_cache enable row level security;
alter table public.manga_request_buckets enable row level security;
revoke all on public.manga_provider_cache, public.manga_request_buckets from public, anon, authenticated;
grant all on public.manga_provider_cache, public.manga_request_buckets to service_role;
create function public.take_manga_quota(bucket_key text, max_hits integer, window_seconds integer default 60)
returns boolean language plpgsql security invoker set search_path = '' as $$
declare current_hits integer;
begin
  if bucket_key is null or max_hits is null or window_seconds is null or char_length(bucket_key) > 300 or max_hits not between 1 and 10000 or window_seconds not between 1 and 86400 then raise exception 'Invalid quota'; end if;
  insert into public.manga_request_buckets as b(key,hits,expires_at) values(bucket_key,1,now()+make_interval(secs=>window_seconds))
    on conflict(key) do update set hits = case when b.expires_at <= now() then 1 else b.hits+1 end,
      expires_at = case when b.expires_at <= now() then now()+make_interval(secs=>window_seconds) else b.expires_at end
    returning hits into current_hits;
  delete from public.manga_request_buckets where expires_at < now()-interval '1 day';
  return current_hits <= max_hits;
end $$;
create function public.lease_manga_cache(cache_key text) returns boolean language plpgsql security invoker set search_path = '' as $$
declare acquired text;
begin
  insert into public.manga_provider_cache(key) values(cache_key) on conflict do nothing;
  update public.manga_provider_cache set locked_until=now()+interval '20 seconds'
    where key=cache_key and (locked_until is null or locked_until < now()) and (expires_at is null or expires_at < now()) returning key into acquired;
  return acquired is not null;
end $$;
revoke all on function public.take_manga_quota(text,integer,integer), public.lease_manga_cache(text) from public, anon, authenticated;
grant execute on function public.take_manga_quota(text,integer,integer), public.lease_manga_cache(text) to service_role;

create function public.get_work_rating_summary(work_type_input text, work_id_input text)
returns jsonb language plpgsql stable security invoker set search_path = '' as $$
declare result jsonb;
begin
  if work_type_input is null or work_id_input is null or work_type_input not in ('game','anime','manga') or char_length(work_id_input) not between 1 and 160 then raise exception 'Invalid identity'; end if;
  select jsonb_build_object('membersCount',count(*),'ratingsCount',count(rating),'avgRating',avg(rating),
    'reviewsCount',count(*) filter(where nullif(btrim(review_text),'') is not null),
    'distribution',(select jsonb_agg(jsonb_build_object('rating',v/2.0,'count',(select count(*) from public.library_entries e where e.work_type=work_type_input and e.work_id=work_id_input and e.rating=v/2.0))) from generate_series(1,10) v),
    'recentMembers',coalesce((select jsonb_agg(p) from (select pr.id,pr.username,pr.avatar_url,pr.theme_color from public.library_entries e join public.profiles pr on pr.id=e.user_id where e.work_type=work_type_input and e.work_id=work_id_input order by e.created_at desc limit 5)p),'[]'::jsonb))
  into result from public.library_entries where work_type=work_type_input and work_id=work_id_input;
  return result;
end $$;
revoke all on function public.get_work_rating_summary(text,text) from public;
grant execute on function public.get_work_rating_summary(text,text) to anon,authenticated;

create function public.discover_manga(page_number integer default 1, page_size integer default 24, genre_filter text default null, sort_order text default 'popular')
returns jsonb language plpgsql stable security invoker set search_path = '' as $$
declare result jsonb;
begin
  if page_number is null or page_size is null or sort_order is null or page_number not between 1 and 10000 or page_size not between 1 and 50 or sort_order not in ('popular','rated') then raise exception 'Invalid pagination'; end if;
  with stats as (select work_id,count(*) registrations,count(rating) rating_count,avg(rating) user_rating from public.library_entries where work_type='manga' group by work_id),
  filtered as (select m.*,coalesce(s.registrations,0) registrations,coalesce(s.rating_count,0) as "ratingCount",s.user_rating as "userRating" from public.manga m left join stats s on s.work_id=m.id where genre_filter is null or genre_filter=any(m.genres)),
  paged as (select * from filtered order by case when sort_order='rated' then "userRating" end desc nulls last,registrations desc,title,id limit page_size offset (page_number-1)*page_size)
  select jsonb_build_object('items',coalesce((select jsonb_agg(paged) from paged),'[]'::jsonb),'total',(select count(*) from filtered),
    'genres',(select coalesce(jsonb_agg(g order by g),'[]'::jsonb) from (select distinct unnest(genres) g from public.manga) genres)) into result;
  return result;
end $$;
revoke all on function public.discover_manga(integer,integer,text,text) from public;
grant execute on function public.discover_manga(integer,integer,text,text) to anon,authenticated;

create function public.get_lists_containing_work(work_id_input text, work_type_input text, limit_count integer default 20)
returns setof public.user_lists language plpgsql stable security invoker set search_path = '' as $$
begin
  if work_type_input is null or work_id_input is null or limit_count is null or work_type_input not in ('anime','game','manga') or char_length(work_id_input) not between 1 and 160 or limit_count not between 1 and 100 then raise exception 'Invalid request'; end if;
  return query select l.* from public.user_lists l where exists (
    select 1 from jsonb_path_query(l.content,'strict $.** ? (@.type() == "object")') item
    where coalesce(item->>'catalog_id',item->>'id')=work_id_input and coalesce(item->>'media_type',l.media_type)=work_type_input)
    order by l.created_at desc limit limit_count;
end $$;
revoke all on function public.get_lists_containing_work(text,text,integer) from public;
grant execute on function public.get_lists_containing_work(text,text,integer) to anon,authenticated;

create function public.get_spaces_for_work(work_id_input text, work_type_input text)
returns jsonb language plpgsql stable security invoker set search_path = '' as $$
begin
  if work_type_input is null or work_id_input is null or work_type_input not in ('game','anime','manga') or char_length(work_id_input) not between 1 and 160 then raise exception 'Invalid identity'; end if;
  return (select coalesce(jsonb_agg(matching_spaces),'[]'::jsonb) from (
    select s.* from public.spaces s where exists (
      select 1 from jsonb_array_elements(coalesce(s.related_works,'[]'::jsonb)) work
      where work->>'id'=work_id_input and coalesce(work->>'type',work->>'media_type')=work_type_input
    ) order by s.created_at desc limit 20
  ) matching_spaces);
end $$;
revoke all on function public.get_spaces_for_work(text,text) from public;
grant execute on function public.get_spaces_for_work(text,text) to anon,authenticated;
-- Extend existing private notification helper without changing its privileges.
CREATE OR REPLACE FUNCTION private.activity_preview_image(p_resource_type text, p_resource_id uuid)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
    v_image text;
BEGIN
    IF p_resource_id IS NULL THEN
        RETURN NULL;
    END IF;

    IF p_resource_type = 'post' THEN
        SELECT (
            SELECT media_item.value ->> 'url'
            FROM jsonb_array_elements(
                CASE
                    WHEN jsonb_typeof(post.media) = 'array' THEN post.media
                    WHEN jsonb_typeof(post.media) = 'object' THEN jsonb_build_array(post.media)
                    ELSE '[]'::jsonb
                END
            ) AS media_item(value)
            WHERE media_item.value ->> 'url' IS NOT NULL
            LIMIT 1
        ) INTO v_image
        FROM public.posts AS post
        WHERE post.id = p_resource_id
          AND NOT COALESCE(post.contains_spoiler, false)
          AND NOT COALESCE(post.is_sensitive, false);
        RETURN v_image;
    ELSIF p_resource_type = 'list' THEN
        SELECT private.first_preview_image(list.content)
        INTO v_image
        FROM public.user_lists AS list
        WHERE list.id = p_resource_id;
        RETURN v_image;
    ELSIF p_resource_type = 'review' THEN
        SELECT CASE entry.work_type
            WHEN 'game' THEN game.cover_url
            WHEN 'anime' THEN anime.image_url
            WHEN 'manga' THEN manga.image_url
            ELSE NULL
        END
        INTO v_image
        FROM public.library_entries AS entry
        LEFT JOIN public.games AS game ON entry.work_type = 'game' AND game.id::text = entry.work_id
        LEFT JOIN public.anime AS anime ON entry.work_type = 'anime' AND anime.id::text = entry.work_id
        LEFT JOIN public.manga AS manga ON entry.work_type = 'manga' AND manga.id = entry.work_id
        WHERE entry.id = p_resource_id;
        RETURN v_image;
    ELSIF p_resource_type = 'tierlist' AND to_regclass('public.tierlists') IS NOT NULL THEN
        BEGIN
            EXECUTE 'SELECT screenshot_url FROM public.tierlists WHERE id = $1'
                INTO v_image USING p_resource_id;
        EXCEPTION WHEN undefined_column THEN
            v_image := NULL;
        END;

        IF v_image IS NOT NULL THEN
            RETURN v_image;
        END IF;

        BEGIN
            EXECUTE 'SELECT private.first_preview_image(content) FROM public.tierlists WHERE id = $1'
                INTO v_image USING p_resource_id;
        EXCEPTION WHEN undefined_column THEN
            v_image := NULL;
        END;

        IF v_image IS NOT NULL THEN
            RETURN v_image;
        END IF;

        IF to_regclass('public.tierlist_items') IS NOT NULL THEN
            BEGIN
                EXECUTE $query$
                    SELECT COALESCE(anime.image_url, game.cover_url)
                    FROM public.tierlist_items AS item
                    JOIN public.tierlists AS tierlist ON tierlist.id = item.tierlist_id
                    LEFT JOIN public.games AS game ON game.id::text = item.media_id::text AND tierlist.media_type = 'game'
                    LEFT JOIN public.anime AS anime ON anime.id::text = item.media_id::text AND tierlist.media_type = 'anime'
                    WHERE item.tierlist_id = $1
                    ORDER BY item.tier
                    LIMIT 1
                $query$ INTO v_image USING p_resource_id;
            EXCEPTION WHEN undefined_column OR undefined_table THEN
                v_image := NULL;
            END;
        END IF;
        RETURN v_image;
    END IF;

    RETURN NULL;
END;
$function$
;

-- Extend existing private notification helper without changing its privileges.
CREATE OR REPLACE FUNCTION private.activity_resource_title(p_resource_type text, p_resource_id uuid)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
    v_title text;
BEGIN
    IF p_resource_id IS NULL THEN
        RETURN NULL;
    END IF;

    IF p_resource_type = 'list' THEN
        SELECT list.title INTO v_title FROM public.user_lists AS list WHERE list.id = p_resource_id;
    ELSIF p_resource_type = 'review' THEN
        SELECT CASE entry.work_type WHEN 'game' THEN game.name WHEN 'anime' THEN anime.title WHEN 'manga' THEN manga.title ELSE NULL END
        INTO v_title
        FROM public.library_entries AS entry
        LEFT JOIN public.games AS game ON entry.work_type = 'game' AND game.id::text = entry.work_id
        LEFT JOIN public.anime AS anime ON entry.work_type = 'anime' AND anime.id::text = entry.work_id
        LEFT JOIN public.manga AS manga ON entry.work_type = 'manga' AND manga.id = entry.work_id
        WHERE entry.id = p_resource_id;
    ELSIF p_resource_type = 'tierlist' AND to_regclass('public.tierlists') IS NOT NULL THEN
        BEGIN
            EXECUTE 'SELECT title FROM public.tierlists WHERE id = $1' INTO v_title USING p_resource_id;
        EXCEPTION WHEN undefined_column THEN
            v_title := NULL;
        END;
    END IF;

    RETURN v_title;
END;
$function$
;
