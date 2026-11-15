// Browser checks use synthetic responses only; no account or remote data is changed.
import assert from 'node:assert/strict'
import { mkdir } from 'node:fs/promises'
import { pathToFileURL } from 'node:url'
const runtime = process.env.PLAYWRIGHT_MODULE || 'playwright'
const { chromium } = await import(/^[A-Z]:/i.test(runtime) ? pathToFileURL(runtime).href : runtime)
const browser = await chromium.launch({ headless: true, ...(process.env.PLAYWRIGHT_EXECUTABLE_PATH ? { executablePath: process.env.PLAYWRIGHT_EXECUTABLE_PATH } : {}) })
const base = process.env.TEST_BASE_URL || 'http://127.0.0.1:5173'
const owner = '11111111-1111-4111-8111-111111111111'
const postId = '22222222-2222-4222-8222-222222222222'
const listId = '33333333-3333-4333-8333-333333333333'
const reviewId = '44444444-4444-4444-8444-444444444444'
const user = { id:owner, aud:'authenticated', role:'authenticated', email:'saved-fixture@example.invalid' }
const art = (name,color) => 'data:image/svg+xml,' + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="240" height="360"><rect width="240" height="360" fill="${color}"/><circle cx="120" cy="110" r="70" fill="#ffffff" opacity=".12"/><text x="120" y="270" text-anchor="middle" fill="white" font-family="sans-serif" font-size="20">${name}</text></svg>`)
const game = {id:2,name:'Hollow Knight',cover_url:art('Hollow Knight','#273d4f'),genres:[],release_date:'2017',rating:90}
const anime = {id:3,title:'Frieren',image_url:art('Frieren','#426957')}
const manga = {id:'mal:manga:2',title:'Berserk',image_url:art('Berserk','#592d39')}
const errors=[]
async function setup({pwa=false,guest=false}={}) {
 const context=await browser.newContext({viewport:pwa?{width:390,height:844}:{width:1360,height:980}})
 const state={ profile:{id:owner,username:'fixture',display_name:'Marina',theme_color:'#c987f6',onboarding_completed:true,wishlist:[game,anime,manga].map((w,i)=>({id:w.id,type:['game','anime','manga'][i],title:w.name||w.title,image_url:w.cover_url||w.image_url,added_at:`2026-11-1${4-i}T12:00:00Z`}))}, saved:[
  {id:'saved-post',post_id:postId,list_id:null,review_id:null,created_at:'2026-11-15T12:00:00Z'},
  {id:'saved-list',post_id:null,list_id:listId,review_id:null,created_at:'2026-11-15T11:00:00Z'},
  {id:'saved-review',post_id:null,list_id:null,review_id:reviewId,created_at:'2026-11-15T10:00:00Z'},
 ], unavailable:false,failWrite:false, requests:[] }
 const post={id:postId,user_id:owner,body:'Una aventura que merece la pena volver a jugar. ¿Cuál es vuestro lugar favorito?',media:[{url:art('Un nuevo viaje','#36504f')}],created_at:'2026-11-15T10:00:00Z'}
 const list={id:listId,user_id:owner,title:'Mis aventuras favoritas',description:'Una selección para volver una y otra vez.',list_type:'tierlist',media_type:'game',visibility:'public',content:{S:[{id:2,name:game.name,image_url:game.cover_url}],A:[{id:3,name:anime.title,image_url:anime.image_url}]},type_config:{tiers:[{id:'S',label:'S',color:'#ef6a6a'},{id:'A',label:'A',color:'#e9b875'}]},created_at:'2026-11-15T09:00:00Z'}
 const review={id:reviewId,user_id:owner,work_id:'2',work_type:'game',rating:4.5,review_text:'El final de esta aventura es inolvidable. TEXTO_SPOILER_SECRETO',contains_spoiler:true,created_at:'2026-11-15T08:00:00Z'}
 await context.addInitScript(({pwa,user,guest})=>{
   if(pwa){const original=window.matchMedia.bind(window);window.matchMedia=query=>{const result=original(query);if(query.includes('display-mode:'))Object.defineProperty(result,'matches',{value:true});return result}}
   if(!guest){const jwt=`${btoa(JSON.stringify({alg:'HS256',typ:'JWT'}))}.${btoa(JSON.stringify({sub:user.id,role:'authenticated',exp:Math.floor(Date.now()/1000)+3600}))}.fixture`;localStorage.setItem('frikinet-auth',JSON.stringify({access_token:jwt,refresh_token:'fixture',expires_at:Math.floor(Date.now()/1000)+3600,expires_in:3600,token_type:'bearer',user}))}
 },{pwa,user,guest})
 await context.route('**/*',async route=>{
   const req=route.request(),url=new URL(req.url()),table=url.pathname.split('/').pop()
   if(url.origin===base||url.protocol==='data:') return route.continue()
   if(!url.hostname.endsWith('.supabase.co')) return route.abort()
   state.requests.push({table,method:req.method()})
   let data=[], body=req.postData()?req.postDataJSON():null
   if(req.method()==='OPTIONS') return route.fulfill({status:200})
   if(url.pathname.includes('/auth/v1/user')) data=user
   else if(table==='profiles'){if(req.method()==='PATCH') state.profile={...state.profile,...body};data=[state.profile]}
   else if(table==='saved_items') {
     if(req.method()==='POST'){
       if(state.failWrite)return route.fulfill({status:503,json:{message:'Synthetic save failure'}})
       const item=Array.isArray(body)?body[0]:body
       if(!state.saved.some(row=>['post_id','list_id','review_id'].some(key=>item[key]&&row[key]===item[key])))state.saved.push({id:'new-save',post_id:null,list_id:null,review_id:null,...item,created_at:'2026-11-15T14:00:00Z'})
     }
     if(req.method()==='DELETE')state.saved=state.saved.filter(row=>!['post_id','list_id','review_id'].some(key=>url.searchParams.get(key)===`eq.${row[key]}`))
     data=state.saved.filter(row=>['post_id','list_id','review_id'].every(key=>!url.searchParams.has(key)||url.searchParams.get(key)===`eq.${row[key]}`))
   } else if(table==='posts')data=[post]
   else if(table==='user_lists')data=state.unavailable?[]:[list]
   else if(table==='library_entries')data=[review]
   else if(table==='games')data=[game]
   else if(table==='anime')data=[anime]
   else if(table==='manga')data=[manga]
   const total=Array.isArray(data)?data.length:0
   if(Array.isArray(data)&&req.headers().accept?.includes('object'))data=data[0]||null
   if(req.method()==='HEAD')return route.fulfill({status:200,headers:{'content-range':`0-0/${total}`}})
   return route.fulfill({json:data,headers:{'content-range':`0-${Math.max(0,total-1)}/${total}`}})
 })
 const page=await context.newPage()
 page.on('pageerror',error=>errors.push(error.message))
 return {page,context,state}
}
async function checkSavedColor(page) {
 const button=page.locator('.save-item-button').first()
 await button.waitFor()
 const accent=await button.evaluate(el=>{const probe=document.createElement('span');probe.style.color='var(--review-page-accent)';el.parentElement.append(probe);const color=getComputedStyle(probe).color;probe.remove();return color})
 await page.waitForFunction(color=>{const button=document.querySelector('.save-item-button');return getComputedStyle(button).color===color&&getComputedStyle(button.querySelector('svg')).fill===color},accent)
 assert.equal(await button.evaluate(el=>getComputedStyle(el).cursor),'pointer')
 return accent
}
try {
 const {page,context,state}=await setup()
 await page.goto(base+'/saved')
 await page.locator('.saved-card').first().waitFor()
 assert.equal(await page.locator('.saved-card').count(),6)
 assert.equal(await page.locator('.saved-page-header button[aria-label="Volver"]').count(),0)
 assert.equal(await page.getByText('Lo que quieres tener a mano.').count(),0)
 await page.waitForFunction(()=>document.querySelectorAll('.saved-column').length>=3)
 assert.equal(await page.locator('.saved-card--list .saved-card-copy').count(),0)
 assert.equal(await page.locator('.saved-list-canvas .cl-tier-row').count(),2)
 assert.equal(await page.locator('.saved-card--review .home-post-avatar').count(),1)
 assert.equal(await page.locator('.saved-card--review .home-post-header .work-stars').count(),1)
 assert.equal(await page.locator('.saved-card--review .home-post-header time').count(),1)
 assert.equal(await page.locator('.saved-card--review .saved-review-text, .saved-card--review .saved-review-content, .saved-card--review .spoiler-notice').count(),0)
 assert.equal(await page.locator('.saved-card--review').evaluate(el=>el.querySelector('.saved-review-details').getBoundingClientRect().bottom<=el.querySelector('.saved-review-cover').getBoundingClientRect().top),true)
 for(const image of await page.locator('.saved-full-cover').all()){
   await image.scrollIntoViewIfNeeded()
   await image.evaluate(el=>el.complete?Promise.resolve():new Promise(resolve=>el.addEventListener('load',resolve,{once:true})))
   const dimensions=await image.evaluate(el=>({width:el.clientWidth,height:el.clientHeight,ratio:el.naturalHeight/el.naturalWidth}))
   assert.ok(Math.abs(dimensions.height-dimensions.width*dimensions.ratio)<2)
 }

 assert.equal(await page.getByText('TEXTO_SPOILER_SECRETO',{exact:false}).count(),0)
 assert.equal(await page.locator('.saved-page-count').count(),0)
 for(const type of ['post','list','review','work']){
   const href={post:'/posts/'+postId,list:'/lists/'+listId,review:'/reviews/'+reviewId,work:'/game/2'}[type]
   await page.locator(type === 'work' ? '.saved-card--work a[href="/game/2"]' : type === 'review' ? '.saved-card--review .home-post-header time' : `.saved-card--${type}.saved-card-open, .saved-card--${type} .saved-card-open`).first().click()
   await page.waitForURL(base+href)
   assert.equal(await page.locator('dialog[open], .saved-preview').count(),0)
   await page.goto(base+'/saved')
   await page.locator('.saved-card').first().waitFor()
 }
 await page.getByRole('button',{name:/^Obras/}).click()
 assert.equal(await page.locator('.saved-wishlist-note').count(),0)
 await page.waitForFunction(()=>document.querySelectorAll('.saved-card').length===3)
 assert.equal(await page.locator('.saved-card').count(),3)
 await page.locator('.saved-card--work a[href="/game/2"]').click()
 await page.waitForURL(base+'/game/2')
 await page.locator('.work-wishlist-button[aria-pressed="true"]').waitFor()
 await page.locator('.work-wishlist-button').click()
 await page.locator('.work-wishlist-button[aria-pressed="false"]').waitFor()
 assert.equal(state.profile.wishlist.length,2)
 await page.goto(base+'/posts/'+postId)
 await page.locator('.save-item-button[aria-pressed="true"]').waitFor()
 const postAccent=await checkSavedColor(page)
 await page.locator('.save-item-button').click()
 await page.locator('.save-item-button[aria-pressed="false"]').waitFor()
 assert.equal(state.saved.some(row=>row.post_id===postId),false)
 await page.locator('.save-item-button').hover()
 await page.waitForFunction(color=>getComputedStyle(document.querySelector('.save-item-button')).color===color,postAccent)
 state.failWrite=true
 await page.locator('.save-item-button').click()
 await page.getByText('No se pudo actualizar el guardado. Inténtalo de nuevo.').waitFor()
 assert.equal(await page.locator('.save-item-button').getAttribute('aria-pressed'),'false')
 state.failWrite=false
 await page.locator('.save-item-button').click()
 await page.locator('.save-item-button[aria-pressed="true"]').waitFor()
 assert.equal(state.saved.filter(row=>row.post_id===postId).length,1)
 await page.goto(base+'/reviews/'+reviewId)
 await page.locator('.save-item-button[aria-pressed="true"]').waitFor()
 await checkSavedColor(page)
 await page.goto(base+'/lists/'+listId)
 await page.locator('.save-item-button[aria-pressed="true"]').waitFor()
 await checkSavedColor(page)
 state.unavailable=true
 await page.goto(base+'/saved?filter=list')
 await page.getByText('Contenido no disponible',{exact:true}).waitFor()
 assert.equal(await page.locator('.saved-unavailable a').count(),0)
 await page.getByRole('button',{name:'Quitar de guardados',exact:true}).click()
 await page.waitForFunction(()=>document.querySelectorAll('.saved-card').length===0)
 await context.close()
 const pwa=await setup({pwa:true})
 await pwa.page.goto(base+'/saved')
 await pwa.page.locator('.saved-card').first().waitFor()
 await pwa.page.locator('.saved-page--pwa').evaluate(el=>Promise.all(el.getAnimations().map(animation=>animation.finished.catch(()=>{}))))
 assert.equal(await pwa.page.locator('.saved-page-header button[aria-label="Volver"]').count(),1)
 assert.equal(await pwa.page.locator('.saved-column').count(),2)
 assert.equal(await pwa.page.locator('.saved-page--pwa').evaluate(el=>el.parentElement===document.body),true)
 assert.equal(await pwa.page.evaluate(()=>!!document.elementFromPoint(10,innerHeight-10)?.closest('.saved-page--pwa')),true)
 assert.equal(await pwa.page.locator('.mobile-topbar').evaluate(el=>getComputedStyle(el).visibility),'hidden')
 assert.equal(await pwa.page.locator('.mobile-bottom-nav').evaluate(el=>getComputedStyle(el).visibility),'hidden')
 if(process.env.SAVED_TEST_OUTPUT){await mkdir(process.env.SAVED_TEST_OUTPUT,{recursive:true});await pwa.page.screenshot({path:process.env.SAVED_TEST_OUTPUT+'/saved-pwa.png'})}
 for(const type of ['post','list','review','work']){
   const href={post:'/posts/'+postId,list:'/lists/'+listId,review:'/reviews/'+reviewId,work:'/game/2'}[type]
   await pwa.page.locator(type === 'work' ? '.saved-card--work a[href="/game/2"]' : type === 'review' ? '.saved-card--review .home-post-header time' : `.saved-card--${type}.saved-card-open, .saved-card--${type} .saved-card-open`).first().click()
   await pwa.page.waitForURL(base+href)
   assert.equal(await pwa.page.locator('dialog[open], .saved-preview').count(),0)
   await pwa.page.goto(base+'/saved')
   await pwa.page.locator('.saved-card').first().waitFor()
   await pwa.page.locator('.saved-page--pwa').evaluate(el=>Promise.all(el.getAnimations().map(a=>a.finished.catch(()=>{}))))
 }
 for(const path of ['/posts/'+postId,'/reviews/'+reviewId,'/lists/'+listId]) {
   await pwa.page.goto(base+path)
   await pwa.page.locator('.save-item-button[aria-pressed="true"]').waitFor()
   const accent=await checkSavedColor(pwa.page)
   await pwa.page.locator('.save-item-button').hover()
   await pwa.page.waitForFunction(color=>getComputedStyle(document.querySelector('.save-item-button')).color===color,accent)
 }
 await pwa.context.close()
 const guest=await setup({guest:true})
 await guest.page.goto(base+'/home')
 await guest.page.locator('.home-post').first().waitFor()
 assert.equal(await guest.page.locator('.home-post .save-item-button').count(),0)
 await guest.page.goto(base+'/discover/lists')
 await guest.page.locator('.discover-list-card').first().waitFor()
 assert.equal(await guest.page.locator('.discover-list-card .save-item-button').count(),0)
 await guest.page.goto(base+'/posts/'+postId)
 await guest.page.locator('.save-item-button').waitFor()
 assert.equal(await guest.page.locator('.save-item-button').first().isEnabled(),true)
 await guest.page.locator('.save-item-button').first().click()
 await guest.page.waitForURL('**/register')
 await guest.context.close()
 assert.deepEqual(errors,[])
 console.log('Guardados: seis tarjetas de contenido y wishlist, navegación directa sin modales, spoilers, filtros, altas/bajas, errores, privacidad, acceso invitado y pantalla PWA comprobados con fixtures.')
} finally { await browser.close() }
