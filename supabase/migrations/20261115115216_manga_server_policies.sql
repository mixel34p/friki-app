-- Explicit policies for the backend role; clients retain no table privileges or policies.
create policy manga_cache_backend_only on public.manga_provider_cache for all to service_role using (true) with check (true);
create policy manga_buckets_backend_only on public.manga_request_buckets for all to service_role using (true) with check (true);
