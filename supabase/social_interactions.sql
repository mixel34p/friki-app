-- Drop existing tables to ensure clean slate
drop table if exists tierlist_comments;
drop table if exists tierlist_likes;

-- Tierlist Likes
create table if not exists tierlist_likes (
  user_id uuid references public.profiles(user_id) on delete cascade not null,
  tierlist_id uuid references tierlists(id) on delete cascade not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  primary key (user_id, tierlist_id)
);

-- Tierlist Comments
create table if not exists tierlist_comments (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references public.profiles(user_id) on delete cascade not null,
  tierlist_id uuid references tierlists(id) on delete cascade not null,
  content text not null check (length(trim(content)) > 0),
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable RLS
alter table tierlist_likes enable row level security;
alter table tierlist_comments enable row level security;

-- Policies for Likes
create policy "Users can view all likes" 
  on tierlist_likes for select 
  using (true);

create policy "Users can toggle their own likes" 
  on tierlist_likes for insert 
  with check (auth.uid() = user_id);

create policy "Users can remove their own likes" 
  on tierlist_likes for delete 
  using (auth.uid() = user_id);

-- Policies for Comments
create policy "Users can view all comments" 
  on tierlist_comments for select 
  using (true);

create policy "Users can insert their own comments" 
  on tierlist_comments for insert 
  with check (auth.uid() = user_id);

create policy "Users can delete their own comments" 
  on tierlist_comments for delete 
  using (auth.uid() = user_id);
  
-- Optional: Policy for Tierlist owner to delete any comment on their tierlist
create policy "Tierlist owners can delete comments on their lists" 
  on tierlist_comments for delete 
  using (
    exists (
      select 1 from tierlists 
      where id = tierlist_comments.tierlist_id 
      and user_id = auth.uid()
    )
  );

-- Add likes_count to tierlists
alter table tierlists add column if not exists likes_count integer default 0;

-- Function to handle likes count
create or replace function handle_likes_count()
returns trigger as $$
begin
  if (TG_OP = 'INSERT') then
    update tierlists set likes_count = likes_count + 1 where id = new.tierlist_id;
    return new;
  elsif (TG_OP = 'DELETE') then
    update tierlists set likes_count = likes_count - 1 where id = old.tierlist_id;
    return old;
  end if;
  return null;
end;
$$ language plpgsql security definer;

-- Trigger for likes count
drop trigger if exists on_like_change on tierlist_likes;
create trigger on_like_change
after insert or delete on tierlist_likes
for each row execute procedure handle_likes_count();

-- 🔧 MAINTENANCE: Sync all like counts to ensure consistency
-- This fixes any mismatch caused by dropping tables previously
UPDATE tierlists T
SET likes_count = (
    SELECT count(*)
    FROM tierlist_likes L
    WHERE L.tierlist_id = T.id
);
