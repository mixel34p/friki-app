-- Keep community ratings separate. Use the provider's catalog score to order works
-- that have no community ratings yet, including the newly seeded manga catalog.
create or replace function public.discover_manga(
  page_number integer default 1,
  page_size integer default 24,
  genre_filter text default null,
  sort_order text default 'popular'
)
returns jsonb
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare result jsonb;
begin
  if page_number is null or page_size is null or sort_order is null
     or page_number not between 1 and 10000 or page_size not between 1 and 50
     or sort_order not in ('popular', 'rated') then
    raise exception 'Invalid pagination';
  end if;

  with stats as (
    select work_id, count(*) as registrations, count(rating) as rating_count, avg(rating) as user_rating
    from public.library_entries where work_type = 'manga' group by work_id
  ), filtered as (
    select m.*, coalesce(s.registrations, 0) as registrations,
      coalesce(s.rating_count, 0) as "ratingCount", s.user_rating as "userRating"
    from public.manga m left join stats s on s.work_id = m.id
    where genre_filter is null or genre_filter = any(m.genres)
  ), paged as (
    select * from filtered
    order by
      case when sort_order = 'rated' then "userRating" end desc nulls last,
      case when sort_order = 'popular' then registrations end desc,
      case when sort_order = 'rated' and "userRating" is null then external_score end desc nulls last,
      case when sort_order = 'popular' then external_score end desc nulls last,
      registrations desc, title, id
    limit page_size offset (page_number - 1) * page_size
  )
  select jsonb_build_object(
    'items', coalesce((select jsonb_agg(paged) from paged), '[]'::jsonb),
    'total', (select count(*) from filtered),
    'genres', (select coalesce(jsonb_agg(g order by g), '[]'::jsonb)
      from (select distinct unnest(genres) g from public.manga) genres)
  ) into result;

  return result;
end;
$$;

revoke all on function public.discover_manga(integer, integer, text, text) from public;
grant execute on function public.discover_manga(integer, integer, text, text) to anon, authenticated;
