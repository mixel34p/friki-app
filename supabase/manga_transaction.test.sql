-- One controlled, uncommitted fixture on the linked database. Always rolled back.
-- No notifications, likes, accounts or external provider calls are generated.
begin;
do $$
declare owner_id uuid; other_id uuid; entry_id uuid; list_id uuid; denied boolean; changed integer;
  fixture_id text := 'mal:manga:999999999999999999999999999999';
begin
  select id into owner_id from public.profiles order by id limit 1;
  select id into other_id from public.profiles where id<>owner_id order by id limit 1;
  if owner_id is null or other_id is null then raise exception 'Two existing profiles are required for the controlled test'; end if;
  insert into public.manga(provider,external_type,external_id,title,format,source_url)
    values('mal','manga','999999999999999999999999999999','Prueba transaccional; no publicar','manga','https://myanimelist.net/manga/999999999999999999999999999999');
  execute 'set local role authenticated';
  perform set_config('request.jwt.claim.sub',owner_id::text,true);
  if (select count(*) from public.manga where id=fixture_id)<>1 then raise exception 'Catalog read failed'; end if;
  denied:=false;
  begin
    insert into public.manga(provider,external_type,external_id,title,format,source_url)
      values('mal','manga','999999999999999999999999999998','Must fail','manga','https://myanimelist.net');
  exception when insufficient_privilege then denied:=true; end;
  if not denied then raise exception 'Client catalog write was allowed'; end if;
  insert into public.library_entries(user_id,work_id,work_type,rating,review_text,contains_spoiler,finished_date)
    values(owner_id,fixture_id,'manga',.5,'Prueba transaccional',true,'2026-11-15') returning id into entry_id;
  update public.library_entries set rating=3.5,review_text='Prueba editada' where id=entry_id;
  denied:=false;
  begin update public.library_entries set rating=3.25 where id=entry_id;
  exception when check_violation then denied:=true; end;
  if not denied then raise exception 'Invalid half-star rating accepted'; end if;
  denied:=false;
  begin update public.library_entries set user_id=other_id where id=entry_id;
  exception when insufficient_privilege then denied:=true; end;
  if not denied then raise exception 'Owner reassignment accepted'; end if;
  if (public.get_work_rating_summary('manga',fixture_id)->>'avgRating')::numeric<>3.5 then raise exception 'Remote aggregation failed'; end if;
  insert into public.user_lists(user_id,title,list_type,media_type,content,visibility)
    values(owner_id,'Prueba transaccional; no publicar','ranking','manga',jsonb_build_array(jsonb_build_object('id',fixture_id,'name','Fixture','media_type','manga')),'private') returning id into list_id;
  if not exists(select 1 from public.get_lists_containing_work(fixture_id,'manga',20) where id=list_id) then raise exception 'List lookup failed'; end if;
  perform set_config('request.jwt.claim.sub',other_id::text,true);
  update public.library_entries set rating=5 where id=entry_id;
  get diagnostics changed=row_count;
  if changed<>0 then raise exception 'Another user edited the log'; end if;
  delete from public.library_entries where id=entry_id;
  get diagnostics changed=row_count;
  if changed<>0 then raise exception 'Another user deleted the log'; end if;
  if exists(select 1 from public.get_lists_containing_work(fixture_id,'manga',20) where id=list_id) then raise exception 'Private list leaked'; end if;
  perform set_config('request.jwt.claim.sub',owner_id::text,true);
  delete from public.library_entries where id=entry_id;
  get diagnostics changed=row_count;
  if changed<>1 then raise exception 'Owner deletion failed'; end if;
  execute 'reset role';
end $$;
rollback;
select 'passed; transaction rolled back' as manga_permission_checks;
