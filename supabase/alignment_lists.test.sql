-- Transactional integration checks: all fixtures are rolled back.
begin;
do $$
declare
  owner_id uuid;
  other_id uuid := gen_random_uuid();
  template_id uuid;
  list_id uuid;
  public_id uuid;
  affected integer;
  config jsonb := '{"version":1,"axes":{"x":{"label":"Orden","entries":[{"id":"x1","label":"Legal"},{"id":"x2","label":"Caótico"}]},"y":{"label":"Bondad","entries":[{"id":"y1","label":"Bueno"},{"id":"y2","label":"Malvado"}]}}}';
  contents jsonb := '{"a:x1:y1":{"id":"hero","name":"Héroe","image_url":"https://example.invalid/hero.png"},"a:x2:y2":null}';
begin
  if not public.is_valid_alignment(config, contents) then raise exception 'Valid rectangular alignment rejected'; end if;
  if public.is_valid_alignment(config, '{"unknown":null}') then raise exception 'Unknown cell accepted'; end if;
  if public.is_valid_alignment(config, '{"a:x1:y1":false}') then raise exception 'Invalid item accepted'; end if;
  if public.is_valid_alignment(jsonb_set(config, '{axes,x,entries,1,id}', '"x1"')) then raise exception 'Duplicate ID accepted'; end if;
  if public.is_valid_alignment(null) or public.is_valid_alignment('{}') then raise exception 'Invalid config accepted'; end if;
  if public.is_valid_alignment(config, null) then raise exception 'Null contents accepted'; end if;

  select id into owner_id from auth.users order by created_at limit 1;
  if owner_id is null then raise exception 'An existing user is needed for transactional RLS checks'; end if;
  insert into public.list_templates(user_id,title,list_type,media_type,visibility,type_config)
    values(owner_id,'[transactional test] alignment','alignment','game','private',config) returning id into template_id;
  insert into public.user_lists(user_id,title,list_type,media_type,visibility,type_config,content,template_id)
    values(owner_id,'[transactional test] private alignment','alignment','game','private',config,contents,template_id) returning id into list_id;
  insert into public.user_lists(user_id,title,list_type,media_type,visibility,type_config,content)
    values(owner_id,'[transactional test] public alignment','alignment','game','public',config,contents) returning id into public_id;

  perform set_config('request.jwt.claim.sub', other_id::text, true);
  perform set_config('request.jwt.claims', jsonb_build_object('sub',other_id,'role','authenticated')::text, true);
  execute 'set local role authenticated';
  if exists(select 1 from public.user_lists where id = list_id) then raise exception 'Private list leaked to another user'; end if;
  if exists(select 1 from public.list_templates where id = template_id) then raise exception 'Private template leaked'; end if;
  if not exists(select 1 from public.user_lists where id = public_id) then raise exception 'Public list hidden'; end if;
  update public.user_lists set title = 'Unauthorized update' where id = list_id;
  get diagnostics affected = row_count;
  if affected <> 0 then raise exception 'Another user changed the list'; end if;
  begin
    insert into public.user_lists(user_id,title,list_type,media_type,visibility,type_config,content)
      values(owner_id,'Unauthorized insertion','alignment','game','private',config,contents);
    raise exception 'Another user inserted with the owner ID';
  exception when insufficient_privilege then null;
  end;
  execute 'reset role';

  perform set_config('request.jwt.claim.sub', '', true);
  perform set_config('request.jwt.claims', '{"role":"anon"}', true);
  execute 'set local role anon';
  if exists(select 1 from public.user_lists where id = list_id) then raise exception 'Private list leaked to visitor'; end if;
  if not exists(select 1 from public.user_lists where id = public_id) then raise exception 'Visitor cannot read public list'; end if;
  execute 'reset role';

  perform set_config('request.jwt.claim.sub', owner_id::text, true);
  perform set_config('request.jwt.claims', jsonb_build_object('sub',owner_id,'role','authenticated')::text, true);
  execute 'set local role authenticated';
  if not exists(select 1 from public.list_templates where id = template_id) then raise exception 'Owner cannot read template'; end if;
  update public.user_lists set title = '[transactional test] edited' where id = list_id;
  get diagnostics affected = row_count;
  if affected <> 1 then raise exception 'Owner cannot update list'; end if;
  begin
    update public.user_lists set content = '{"a:x1:y1":[{"id":"hero","name":"Héroe"}]}' where id = list_id;
    raise exception 'Editor-only array content accepted in database';
  exception when check_violation then null;
  end;
  begin
    update public.list_templates set type_config = '{}' where id = template_id;
    raise exception 'Invalid template config accepted';
  exception when check_violation then null;
  end;
  update public.list_templates set type_config = jsonb_set(config, '{axes,x,entries,0,label}', '"Renombrado"') where id = template_id;
  if (select type_config from public.user_lists where id = list_id) <> config then raise exception 'Published snapshot changed with template'; end if;
  delete from public.list_templates where id = template_id;
  if not exists(select 1 from public.user_lists l where l.id = list_id and l.template_id is null and l.type_config = config and l.content = contents)
    then raise exception 'List lost its snapshot when deleting its template'; end if;
  execute 'reset role';
end;
$$;
rollback;
select 'Alignment validation, persistence, ownership, visibility and template snapshots passed; fixtures rolled back.' as result;
