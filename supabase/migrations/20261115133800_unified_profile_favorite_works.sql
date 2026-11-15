alter table public.profiles
  add column if not exists favorite_works jsonb not null default '[]'::jsonb;

-- Keep the previous visible category order while moving old entries to one
-- ordered list. Cap the merged result at four before aggregating it.
with combined as (
  select p.id,
    coalesce((
      select jsonb_agg(chosen.item order by chosen.priority, chosen.position)
      from (
        select entry.item, entry.priority, entry.position
        from (
          select jsonb_build_object('id', g.value->'id', 'type', 'game', 'title', coalesce(g.value->>'name', g.value->>'title'), 'cover_url', coalesce(g.value->>'cover_url', g.value->>'image_url')) item, 1 priority, g.ordinality position
          from jsonb_array_elements(coalesce(to_jsonb(p.favorite_games), '[]'::jsonb)) with ordinality g(value, ordinality)
          union all
          select jsonb_build_object('id', a.value->'id', 'type', 'anime', 'title', coalesce(a.value->>'title', a.value->>'name'), 'cover_url', coalesce(a.value->>'cover_url', a.value->>'image_url')) item, 2, a.ordinality
          from jsonb_array_elements(coalesce(to_jsonb(p.favorite_animes), '[]'::jsonb)) with ordinality a(value, ordinality)
          union all
          select jsonb_build_object('id', m.value->'id', 'type', 'manga', 'title', coalesce(m.value->>'title', m.value->>'name'), 'cover_url', coalesce(m.value->>'cover_url', m.value->>'image_url')) item, 3, m.ordinality
          from jsonb_array_elements(coalesce(to_jsonb(p.favorite_manga), '[]'::jsonb)) with ordinality m(value, ordinality)
        ) entry
        where entry.item->>'id' is not null and entry.item->>'title' is not null
        order by entry.priority, entry.position
        limit 4
      ) chosen
    ), '[]'::jsonb) items
  from public.profiles p
  where p.favorite_works = '[]'::jsonb
)
update public.profiles p set favorite_works = combined.items from combined where p.id = combined.id;

alter table public.profiles drop constraint if exists profiles_favorite_works_check;
alter table public.profiles add constraint profiles_favorite_works_check
  check (case when jsonb_typeof(favorite_works) = 'array' then jsonb_array_length(favorite_works) <= 4 else false end);


