-- Reviews System Schema

-- 1. Reviews Table
create table if not exists reviews (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references public.profiles(user_id) on delete cascade not null,
  work_id text not null, -- ID of the game or anime
  work_type text not null check (work_type in ('game', 'anime')),
  title text,
  content text not null check (length(trim(content)) > 0),
  rating integer not null check (rating >= 1 and rating <= 5),
  is_spoiler boolean default false,
  
  -- Denormalized counts for sorting and display
  reaction_count integer default 0,
  count_good_point integer default 0,
  count_interesting integer default 0,
  count_strong_opinion integer default 0,
  
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 2. Review Reactions Table
create table if not exists review_reactions (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references public.profiles(user_id) on delete cascade not null,
  review_id uuid references reviews(id) on delete cascade not null,
  reaction_type text not null check (reaction_type in ('good_point', 'interesting', 'strong_opinion')),
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  unique(user_id, review_id) -- One reaction per user per review
);

-- 3. Review Comments Table (Replies)
create table if not exists review_comments (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references public.profiles(user_id) on delete cascade not null,
  review_id uuid references reviews(id) on delete cascade not null,
  content text not null check (length(trim(content)) > 0),
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable RLS
alter table reviews enable row level security;
alter table review_reactions enable row level security;
alter table review_comments enable row level security;

-- Policies for Reviews
create policy "Reviews are viewable by everyone" on reviews for select using (true);
create policy "Users can create reviews" on reviews for insert with check (auth.uid() = user_id);
create policy "Users can update own reviews" on reviews for update using (auth.uid() = user_id);
create policy "Users can delete own reviews" on reviews for delete using (auth.uid() = user_id);

-- Policies for Reactions
create policy "Reactions are viewable by everyone" on review_reactions for select using (true);
create policy "Users can react" on review_reactions for insert with check (auth.uid() = user_id);
create policy "Users can delete own reaction" on review_reactions for delete using (auth.uid() = user_id);
-- Update often simpler as delete + insert, or allow update if changing type
create policy "Users can update own reaction" on review_reactions for update using (auth.uid() = user_id);

-- Policies for Comments
create policy "Comments are viewable by everyone" on review_comments for select using (true);
create policy "Users can comment" on review_comments for insert with check (auth.uid() = user_id);
create policy "Users can delete own comment" on review_comments for delete using (auth.uid() = user_id);

-- Indexes for performance
create index reviews_work_idx on reviews(work_type, work_id);
create index review_reactions_review_idx on review_reactions(review_id);
create index review_comments_review_idx on review_comments(review_id);

-- Functions and Triggers for Reaction Counts

create or replace function handle_review_reaction()
returns trigger as $$
begin
  if (TG_OP = 'INSERT') then
    update reviews
    set 
      reaction_count = reaction_count + 1,
      count_good_point = count_good_point + (case when new.reaction_type = 'good_point' then 1 else 0 end),
      count_interesting = count_interesting + (case when new.reaction_type = 'interesting' then 1 else 0 end),
      count_strong_opinion = count_strong_opinion + (case when new.reaction_type = 'strong_opinion' then 1 else 0 end)
    where id = new.review_id;
    return new;
  elsif (TG_OP = 'DELETE') then
    update reviews
    set 
      reaction_count = reaction_count - 1,
      count_good_point = count_good_point - (case when old.reaction_type = 'good_point' then 1 else 0 end),
      count_interesting = count_interesting - (case when old.reaction_type = 'interesting' then 1 else 0 end),
      count_strong_opinion = count_strong_opinion - (case when old.reaction_type = 'strong_opinion' then 1 else 0 end)
    where id = old.review_id;
    return old;
  elsif (TG_OP = 'UPDATE') then
    -- Handle type change
    if (old.reaction_type != new.reaction_type) then
      update reviews
      set 
        count_good_point = count_good_point - (case when old.reaction_type = 'good_point' then 1 else 0 end) + (case when new.reaction_type = 'good_point' then 1 else 0 end),
        count_interesting = count_interesting - (case when old.reaction_type = 'interesting' then 1 else 0 end) + (case when new.reaction_type = 'interesting' then 1 else 0 end),
        count_strong_opinion = count_strong_opinion - (case when old.reaction_type = 'strong_opinion' then 1 else 0 end) + (case when new.reaction_type = 'strong_opinion' then 1 else 0 end)
      where id = new.review_id;
    end if;
    return new;
  end if;
  return null;
end;
$$ language plpgsql security definer;

create trigger on_review_reaction_change
after insert or delete or update on review_reactions
for each row execute procedure handle_review_reaction();
