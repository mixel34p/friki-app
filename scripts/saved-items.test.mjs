import test, { after } from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import vm from 'node:vm'
import { transformSync } from 'esbuild'
import { PGlite } from '@electric-sql/pglite'
import { WORK_TYPES } from '../src/lib/workTypes.js'

const source = await readFile(new URL('../src/lib/savedItemsService.js', import.meta.url), 'utf8')
const compiled = transformSync(source, { format: 'cjs' }).code
const module = { exports: {} }
vm.runInNewContext(compiled, { module, exports: module.exports, require: name => name === './workTypes' ? { WORK_TYPES } : {} })
const { mergeSavedItems } = module.exports

test('mixed saved index deduplicates wishlist by media type and sorts by save date', () => {
  const result = mergeSavedItems([{id:'saved',post_id:'post',created_at:'2026-11-15'}], [
    {id: 1, type:'game', title:'Game', added_at:'2026-11-16'},
    {id: 1, type:'game', title:'Duplicate'}, {id: 1, type:'anime', title:'Anime'},
    {id: 'mal:manga:1', type:'manga', title:'Manga'}, {id: 3,type:'invalid'},
  ])
  assert.equal(result.length, 4)
  assert.equal(result[0].key, 'work:game:1')
  assert.equal(result[1].key, 'post:post')
  assert.equal(new Set(result.map(item => item.key)).size, 4)
})

const db = new PGlite()
const owner = '00000000-0000-0000-0000-000000000001'
const other = '00000000-0000-0000-0000-000000000002'
const post = '10000000-0000-0000-0000-000000000001'
const list = '20000000-0000-0000-0000-000000000001'
const privateList = '20000000-0000-0000-0000-000000000002'
const review = '30000000-0000-0000-0000-000000000001'
await db.exec(`
  create role authenticated; create role anon; create schema auth;
  create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true),'')::uuid $$;
  grant usage on schema auth to authenticated, anon;
  create table auth.users(id uuid primary key);
  insert into auth.users values ('${owner}'),('${other}');
  create table public.posts(id uuid primary key, user_id uuid);
  create table public.user_lists(id uuid primary key, user_id uuid, visibility text);
  create table public.library_entries(id uuid primary key, user_id uuid, review_text text);
  insert into posts values ('${post}','${other}');
  insert into user_lists values ('${list}','${other}','public'),('${privateList}','${other}','private');
  insert into library_entries values ('${review}','${other}','A real review');
  alter table posts enable row level security;
  alter table user_lists enable row level security;
  alter table library_entries enable row level security;
  create policy posts_read on posts for select using(true);
  create policy lists_read on user_lists for select using(visibility='public' or user_id=auth.uid());
  create policy reviews_read on library_entries for select using(true);
  grant select on posts,user_lists,library_entries to authenticated, anon;
`)
await db.exec(await readFile(new URL('../supabase/migrations/20261115223822_saved_content.sql', import.meta.url), 'utf8'))
async function asUser(id, action) {
  await db.exec(`begin; set local role authenticated; select set_config('request.jwt.claim.sub','${id}',true);`)
  try { return await action() } finally { await db.exec('rollback') }
}

test('owners can save all three types, read them and remove them; duplicates are idempotent', async () => {
  await asUser(owner, async () => {
    for (const [column,id] of [['post_id',post],['list_id',list],['review_id',review]]) {
      await db.query(`insert into saved_items(user_id,${column}) values($1,$2) on conflict(user_id,${column}) do nothing`,[owner,id])
      await db.query(`insert into saved_items(user_id,${column}) values($1,$2) on conflict(user_id,${column}) do nothing`,[owner,id])
    }
    assert.equal((await db.query('select * from saved_items')).rows.length,3)
    await db.query('delete from saved_items where user_id=$1 and post_id=$2',[owner,post])
    assert.equal((await db.query('select * from saved_items')).rows.length,2)
  })
})
test('saved contents stay private across users and cannot be deleted by another user', async () => {
  await db.query('insert into saved_items(user_id,post_id) values($1,$2)',[owner,post])
  await asUser(other, async () => {
    assert.equal((await db.query('select * from saved_items')).rows.length,0)
    await db.query('delete from saved_items where user_id=$1',[owner])
    assert.equal((await db.query('select * from saved_items')).rows.length,0)
  })
  assert.equal((await db.query('select * from saved_items')).rows.length,1)
})
test('cannot save as another user or bookmark inaccessible private lists', async () => {
  await assert.rejects(asUser(other, () => db.query('insert into saved_items(user_id,post_id) values($1,$2)',[owner,post])), /row.level security/i)
  await assert.rejects(asUser(owner, () => db.query('insert into saved_items(user_id,list_id) values($1,$2)',[owner,privateList])), /row.level security/i)
})
test('references do not bypass visibility after a saved list becomes private', async () => {
  await db.query('insert into saved_items(user_id,list_id) values($1,$2)',[owner,list])
  await db.query("update user_lists set visibility='private' where id=$1",[list])
  await asUser(owner, async () => {
    const result = await db.query('select s.id,l.id as content from saved_items s left join user_lists l on l.id=s.list_id where s.list_id=$1',[list])
    assert.equal(result.rows.length,1)
    assert.equal(result.rows[0].content,null)
  })
})
test('requires exactly one existing content reference and cascades target deletion', async () => {
  await assert.rejects(db.query('insert into saved_items(user_id) values($1)',[owner]), /saved_items_one_target/)
  await assert.rejects(db.query('insert into saved_items(user_id,post_id,review_id) values($1,$2,$3)',[owner,post,review]), /saved_items_one_target/)
  await assert.rejects(db.query('insert into saved_items(user_id,post_id) values($1,$2)',[other,'10000000-0000-0000-0000-000000000099']), /foreign key/)
  await db.query('delete from posts where id=$1',[post])
  assert.equal((await db.query('select * from saved_items where post_id=$1',[post])).rows.length,0)
})
test('anonymous sessions cannot read bookmarks', async () => {
  await db.exec('begin; set local role anon;')
  try { await assert.rejects(db.query('select * from saved_items'), /permission denied/) }
  finally { await db.exec('rollback') }
})
after(() => db.close())
