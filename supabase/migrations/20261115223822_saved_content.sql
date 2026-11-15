create table public.saved_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  post_id uuid references public.posts(id) on delete cascade,
  list_id uuid references public.user_lists(id) on delete cascade,
  review_id uuid references public.library_entries(id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint saved_items_one_target check (num_nonnulls(post_id, list_id, review_id) = 1),
  constraint saved_items_user_post unique (user_id, post_id),
  constraint saved_items_user_list unique (user_id, list_id),
  constraint saved_items_user_review unique (user_id, review_id)
);
create index saved_items_user_recent_idx on public.saved_items(user_id, created_at desc, id);
create index saved_items_post_idx on public.saved_items(post_id) where post_id is not null;
create index saved_items_list_idx on public.saved_items(list_id) where list_id is not null;
create index saved_items_review_idx on public.saved_items(review_id) where review_id is not null;
alter table public.saved_items enable row level security;
revoke all on public.saved_items from anon, authenticated;
grant select, insert, delete on public.saved_items to authenticated;
create policy "Read own saved items" on public.saved_items for select to authenticated
  using ((select auth.uid()) = user_id);
create policy "Save accessible content" on public.saved_items for insert to authenticated
  with check (
    (select auth.uid()) = user_id and (
      (post_id is not null and exists (select 1 from public.posts p where p.id = post_id))
      or (list_id is not null and exists (select 1 from public.user_lists l where l.id = list_id and (l.visibility = 'public' or l.user_id = (select auth.uid()))))
      or (review_id is not null and exists (select 1 from public.library_entries r where r.id = review_id and length(btrim(coalesce(r.review_text, ''))) > 0))
    )
  );
create policy "Delete own saved items" on public.saved_items for delete to authenticated
  using ((select auth.uid()) = user_id);
comment on table public.saved_items is 'Private bookmarks. Content remains subject to its original RLS policies.';
