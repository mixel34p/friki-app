import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { test } from 'node:test'
import { PGlite } from '@electric-sql/pglite'
import { createAlignmentConfig } from '../src/lib/alignment.js'

test('manga migration, catalog, real SQL/RLS, lists, stats and shared quotas in local Postgres', async t => {
  const db = new PGlite()
  const owner = '11111111-1111-4111-8111-111111111111'
  const other = '22222222-2222-4222-8222-222222222222'
  const mangaId = 'mal:manga:900719925474099312345'
  const role = async (name, user = '') => db.exec(`reset role; set role ${name}; select set_config('request.jwt.claim.sub','${user}',false);`)
  const admin = async () => db.exec('reset role')
  try {
    await db.exec(await readFile(new URL('./fixtures/manga-existing-schema.sql', import.meta.url), 'utf8'))
    await db.exec(await readFile(new URL('../supabase/migrations/20261115115020_add_manga_support.sql', import.meta.url), 'utf8'))
    await db.exec(await readFile(new URL('../supabase/migrations/20261115115216_manga_server_policies.sql', import.meta.url), 'utf8'))
    await db.query('insert into auth.users(id) values ($1),($2)', [owner, other])
    await db.query('insert into public.profiles(id,username,display_name) values ($1,$2,$2),($3,$4,$4)', [owner, 'fixture-owner', other, 'fixture-other'])
    await db.query("insert into manga(provider,external_type,external_id,title,alternative_titles,format,start_date,date_precision,source_url) values('mal','manga',$1,'Fixture manga',array['Alias de prueba'],'manga','1997','year','https://myanimelist.net/manga/'||$1)", [mangaId.slice(10)])
    await t.test('text key and uniqueness; server-only imports and cache', async () => {
      assert.equal((await db.query('select id from manga')).rows[0].id, mangaId)
      await assert.rejects(db.exec("insert into manga(provider,external_type,external_id,title,format,source_url) select provider,external_type,external_id,title,format,source_url from manga"), /duplicate key/)
      for (const name of ['anon', 'authenticated']) {
        await role(name, name === 'authenticated' ? owner : '')
        assert.equal((await db.query('select * from manga')).rows.length, 1)
        await assert.rejects(db.exec("insert into manga(provider,external_type,external_id,title,format) values('mal','manga','2','Not allowed','manga')"), /permission denied/)
        await assert.rejects(db.exec('select * from manga_provider_cache'), /permission denied/)
        await assert.rejects(db.exec("select take_manga_quota('x',1,60)"), /permission denied/)
      }
    })
    await t.test('owner creates and edits half-star log, spoiler and completion date', async () => {
      await role('authenticated', owner)
      await db.query("insert into library_entries(user_id,work_id,work_type,rating,review_text,contains_spoiler,finished_date) values($1,$2,'manga',3.5,'Fixture review',true,'2026-11-15')", [owner, mangaId])
      const row = (await db.query('select * from library_entries')).rows[0]
      assert.equal(String(row.rating), '3.5'); assert.equal(row.contains_spoiler, true)
      await db.query("update library_entries set review_text='Edited fixture',rating=.5 where user_id=$1", [owner])
      await assert.rejects(db.exec('update library_entries set rating=3.25'), /check constraint/)
      await assert.rejects(db.exec('update library_entries set rating=0'), /check constraint/)
      await assert.rejects(db.query('update library_entries set user_id=$1', [other]), /row-level security/)
      await assert.rejects(db.query("insert into library_entries(user_id,work_id,work_type) values($1,'mal:manga:2','manga')", [owner]), /Manga no encontrado/)
    })
    await t.test('another user cannot write, reassign or delete owner logs', async () => {
      await role('authenticated', other)
      assert.equal((await db.exec("update library_entries set rating=5 returning id"))[0].rows.length, 0)
      assert.equal((await db.exec('delete from library_entries returning id'))[0].rows.length, 0)
      await assert.rejects(db.query("insert into library_entries(user_id,work_id,work_type) values($1,$2,'manga')", [owner, mangaId]), /row-level security/)
      await db.query("insert into library_entries(user_id,work_id,work_type,rating) values($1,$2,'manga',5)", [other, mangaId])
    })
    await t.test('paginated discovery and stats aggregate real entries, independent of external score', async () => {
      const stats = (await db.query('select get_work_rating_summary($1,$2) stats', ['manga', mangaId])).rows[0].stats
      assert.equal(stats.membersCount, 2); assert.equal(stats.ratingsCount, 2); assert.equal(stats.avgRating, 2.75); assert.equal(stats.distribution[0].count, 1)
      const discovery = (await db.exec("select discover_manga(1,1,null,'popular') result"))[0].rows[0].result
      assert.equal(discovery.total, 1); assert.equal(discovery.items.length, 1); assert.equal(discovery.items[0].userRating, 2.75)
      assert.equal((await db.exec("select * from search_manga_catalog('Alias',20,0)"))[0].rows.length, 1)
      await assert.rejects(db.exec("select discover_manga(0,1000,null,'popular')"), /Invalid pagination/)
      await assert.rejects(db.exec("select discover_manga(1,null,null,'popular')"), /Invalid pagination/)
      await assert.rejects(db.exec("select search_manga_catalog('Alias',null,0)"), /Invalid search/)
    })
    await t.test('all list formats, template restriction, custom items and private-list RLS', async () => {
      await role('authenticated', owner)
      const item = { id: mangaId, name: 'Fixture manga', media_type: 'manga' }
      for (const listType of ['tierlist', 'grid', 'ranking', 'alignment']) {
        const config = listType === 'alignment' ? createAlignmentConfig() : {}
        const content = listType === 'alignment' ? { 'a:lawful:good': item } : listType === 'ranking' ? [item, { id: 'custom-test', name: 'Personalizado' }] : { S: [item] }
        await db.query('insert into user_lists(user_id,title,list_type,media_type,type_config,content,visibility) values($1,$2,$3,$4,$5,$6,$7)', [owner, `Fixture ${listType}`, listType, 'manga', config, content, listType === 'grid' ? 'private' : 'public'])
        if (listType !== 'ranking') await db.query('insert into list_templates(user_id,title,list_type,media_type,type_config,default_items) values($1,$2,$3,$4,$5,$6)', [owner, `Fixture ${listType}`, listType, 'manga', config, [item]])
      }
      assert.equal((await db.query('select * from get_lists_containing_work($1,$2,20)', [mangaId, 'manga'])).rows.length, 4)
      assert.equal((await db.query('select * from get_lists_containing_work($1,$2,20)', [mangaId, 'anime'])).rows.length, 0)
      await assert.rejects(db.query("insert into list_templates(user_id,title,list_type,media_type) values($1,'Invalid ranking','ranking','manga')", [owner]), /check constraint/)
      await role('authenticated', other)
      assert.equal((await db.query('select * from get_lists_containing_work($1,$2,20)', [mangaId, 'manga'])).rows.length, 3)
      assert.equal((await db.query("update user_lists set title='Attack' returning id")).rows.length, 0)
    })
    await t.test('wishlist, four favorites, post spoiler and space references retain text IDs', async () => {
      await role('authenticated', owner)
      const work = { id: mangaId, type: 'manga', title: 'Fixture manga' }
      await db.query('update profiles set wishlist=$1,favorite_manga=$1 where id=$2', [[work], owner])
      assert.equal((await db.query('select favorite_manga from profiles where id=$1', [owner])).rows[0].favorite_manga[0].id, mangaId)
      await assert.rejects(db.query('update profiles set favorite_manga=$1 where id=$2', [Array(5).fill(work), owner]), /check constraint/)
      await db.query("insert into posts(user_id,body,contains_spoiler,spoiler_work_type,spoiler_work_id) values($1,'Fixture spoiler',true,'manga',$2)", [owner, mangaId])
      await admin()
      await db.query('insert into spaces(name,owner_id,related_works) values($1,$2,$3)', ['Fixture space', owner, [work]])
      assert.equal((await db.query('select related_works from spaces')).rows[0].related_works[0].id, mangaId)
      assert.equal((await db.query('select get_spaces_for_work($1,$2) spaces', [mangaId, 'manga'])).rows[0].spaces.length, 1)
      assert.equal((await db.query('select get_spaces_for_work($1,$2) spaces', [mangaId, 'anime'])).rows[0].spaces.length, 0)
      assert.equal((await db.exec("select private.activity_resource_title('review',(select id from library_entries where review_text is not null limit 1)) title"))[0].rows[0].title, 'Fixture manga')
    })
    await t.test('coordinated quota and cache lease/expiry; owners can delete', async () => {
      await role('service_role')
      assert.equal((await db.exec("select take_manga_quota('fixture',1,60) allowed"))[0].rows[0].allowed, true)
      assert.equal((await db.exec("select take_manga_quota('fixture',1,60) allowed"))[0].rows[0].allowed, false)
      assert.equal((await db.exec("select lease_manga_cache('fixture') allowed"))[0].rows[0].allowed, true)
      assert.equal((await db.exec("select lease_manga_cache('fixture') allowed"))[0].rows[0].allowed, false)
      await db.exec("update manga_provider_cache set locked_until=now()-interval '1 second' where key='fixture'")
      assert.equal((await db.exec("select lease_manga_cache('fixture') allowed"))[0].rows[0].allowed, true)
      await role('authenticated', owner)
      assert.equal((await db.query('delete from library_entries where user_id=$1 returning id', [owner])).rows.length, 1)
    })
  } finally { await db.close() }
})
