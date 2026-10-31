drop policy if exists "Users can delete own profile avatar objects" on storage.objects;

create policy "Users can delete own profile avatar objects"
on storage.objects
for delete
to authenticated
using (
    bucket_id = 'avatars'
    and (
        name like ('avatars/' || (select auth.uid()::text) || '.%')
        or name like ('avatars/' || (select auth.uid()::text) || '-%')
    )
);

drop policy if exists "Users can view own profile avatar objects" on storage.objects;

create policy "Users can view own profile avatar objects"
on storage.objects
for select
to authenticated
using (
    bucket_id = 'avatars'
    and (
        name like ('avatars/' || (select auth.uid()::text) || '.%')
        or name like ('avatars/' || (select auth.uid()::text) || '-%')
    )
);

drop policy if exists "Users can delete own profile banner objects" on storage.objects;

create policy "Users can delete own profile banner objects"
on storage.objects
for delete
to authenticated
using (
    bucket_id = 'avatars'
    and name like ('banners/' || (select auth.uid()::text) || '.%')
);

drop policy if exists "Users can view own profile banner objects" on storage.objects;

create policy "Users can view own profile banner objects"
on storage.objects
for select
to authenticated
using (
    bucket_id = 'avatars'
    and name like ('banners/' || (select auth.uid()::text) || '.%')
);

drop policy if exists "Users can upload own profile banner objects" on storage.objects;

create policy "Users can upload own profile banner objects"
on storage.objects
for insert
to authenticated
with check (
    bucket_id = 'avatars'
    and name like ('banners/' || (select auth.uid()::text) || '.%')
);

drop policy if exists "Users can update own profile banner objects" on storage.objects;

create policy "Users can update own profile banner objects"
on storage.objects
for update
to authenticated
using (
    bucket_id = 'avatars'
    and name like ('banners/' || (select auth.uid()::text) || '.%')
)
with check (
    bucket_id = 'avatars'
    and name like ('banners/' || (select auth.uid()::text) || '.%')
);
