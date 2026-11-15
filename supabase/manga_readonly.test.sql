-- Read-only production smoke checks. No rows inserted or user data returned.
select exists(select 1 from information_schema.tables where table_schema='public' and table_name='manga') as catalog_exists;
select relname, relrowsecurity from pg_class where oid in ('public.manga'::regclass,'public.manga_provider_cache'::regclass,'public.manga_request_buckets'::regclass);
select has_table_privilege('anon','public.manga','SELECT') as public_read,
  has_table_privilege('authenticated','public.manga','INSERT') as client_insert_must_be_false,
  has_function_privilege('anon','public.take_manga_quota(text,integer,integer)','EXECUTE') as public_quota_must_be_false;
select public.discover_manga(1,24,null,'popular') as discovery;
