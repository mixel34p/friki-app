-- Social interactions for regular posts (not user lists).
-- Run once in the Supabase SQL editor after posts.sql.

create table if not exists public.post_likes (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint post_likes_post_user_unique unique (post_id, user_id)
);

create index if not exists post_likes_post_id_idx
  on public.post_likes (post_id);

create table if not exists public.post_comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  parent_comment_id uuid references public.post_comments(id) on delete cascade,
  content text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint post_comments_content_length check (char_length(btrim(content)) between 1 and 2000)
);

create index if not exists post_comments_post_created_idx
  on public.post_comments (post_id, created_at);
create index if not exists post_comments_parent_comment_id_idx
  on public.post_comments (parent_comment_id);

alter table public.post_likes enable row level security;
alter table public.post_comments enable row level security;

drop policy if exists "Anyone can read post likes" on public.post_likes;
create policy "Anyone can read post likes"
  on public.post_likes for select
  using (true);

drop policy if exists "Users can like posts as themselves" on public.post_likes;
create policy "Users can like posts as themselves"
  on public.post_likes for insert to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "Users can remove their own post likes" on public.post_likes;
create policy "Users can remove their own post likes"
  on public.post_likes for delete to authenticated
  using (auth.uid() = user_id);

drop policy if exists "Anyone can read post comments" on public.post_comments;
create policy "Anyone can read post comments"
  on public.post_comments for select
  using (true);

drop policy if exists "Users can create post comments as themselves" on public.post_comments;
create policy "Users can create post comments as themselves"
  on public.post_comments for insert to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "Users can edit their own post comments" on public.post_comments;
create policy "Users can edit their own post comments"
  on public.post_comments for update to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Users can delete their own post comments" on public.post_comments;
create policy "Users can delete their own post comments"
  on public.post_comments for delete to authenticated
  using (auth.uid() = user_id);

grant select on public.post_likes, public.post_comments to anon, authenticated;
grant insert, delete on public.post_likes to authenticated;
grant insert, update, delete on public.post_comments to authenticated;
