-- A pure, invoker function: it reads no tables and changes no access policies.
create or replace function public.is_valid_alignment(config jsonb, contents jsonb default '{}'::jsonb)
returns boolean
language plpgsql
immutable
security invoker
set search_path = ''
as $$
declare
  axis_key text;
  axis jsonb;
  entry jsonb;
  ids text[];
  valid_keys text[] := array[]::text[];
  x_entry jsonb;
  y_entry jsonb;
  cell record;
begin
  if jsonb_typeof(config) is distinct from 'object'
     or config->'version' is distinct from '1'::jsonb then return false; end if;
  foreach axis_key in array array['x', 'y'] loop
    axis := config->'axes'->axis_key;
    if jsonb_typeof(axis) is distinct from 'object'
       or jsonb_typeof(axis->'label') is distinct from 'string'
       or char_length(axis->>'label') > 60
       or jsonb_typeof(axis->'entries') is distinct from 'array' then return false; end if;
    if jsonb_array_length(axis->'entries') not between 2 and 6 then return false; end if;
    ids := array[]::text[];
    for entry in select value from jsonb_array_elements(axis->'entries') loop
      if jsonb_typeof(entry) is distinct from 'object'
         or jsonb_typeof(entry->'id') is distinct from 'string'
         or (entry->>'id') !~ '^[a-zA-Z0-9_-]{1,80}$'
         or (entry->>'id') = any(ids)
         or jsonb_typeof(entry->'label') is distinct from 'string'
         or char_length(btrim(entry->>'label')) = 0
         or char_length(entry->>'label') > 60 then return false; end if;
      ids := array_append(ids, entry->>'id');
    end loop;
  end loop;
  if jsonb_typeof(contents) is distinct from 'object' then return false; end if;
  for y_entry in select value from jsonb_array_elements(config->'axes'->'y'->'entries') loop
    for x_entry in select value from jsonb_array_elements(config->'axes'->'x'->'entries') loop
      valid_keys := array_append(valid_keys, 'a:' || (x_entry->>'id') || ':' || (y_entry->>'id'));
    end loop;
  end loop;
  for cell in select key, value from jsonb_each(contents) loop
    if not (cell.key = any(valid_keys)) then return false; end if;
    if cell.value = 'null'::jsonb then continue; end if;
    if jsonb_typeof(cell.value) is distinct from 'object'
       or coalesce(jsonb_typeof(cell.value->'id'), '') not in ('string', 'number')
       or char_length(btrim(cell.value->>'id')) = 0
       or jsonb_typeof(cell.value->'name') is distinct from 'string'
       or char_length(btrim(cell.value->>'name')) = 0
       or (cell.value ? 'image_url' and jsonb_typeof(cell.value->'image_url') not in ('string', 'null')) then return false; end if;
  end loop;
  return true;
end;
$$;

alter table public.list_templates drop constraint list_templates_list_type_check;
alter table public.list_templates add constraint list_templates_list_type_check
  check (list_type in ('tierlist', 'ranking', 'grid', 'alignment'));
alter table public.user_lists drop constraint user_lists_list_type_check;
alter table public.user_lists add constraint user_lists_list_type_check
  check (list_type in ('tierlist', 'ranking', 'grid', 'alignment'));

alter table public.list_templates add constraint list_templates_alignment_config_check
  check (list_type <> 'alignment' or public.is_valid_alignment(type_config) is true);
alter table public.user_lists add constraint user_lists_alignment_content_check
  check (list_type <> 'alignment' or public.is_valid_alignment(type_config, content) is true);

comment on function public.is_valid_alignment(jsonb, jsonb) is
  'Validates v1 alignment axes (2-6 entries each) and a sparse map of stable cell IDs to items or null.';
