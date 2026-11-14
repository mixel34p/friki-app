import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { build } from 'esbuild';
const require = createRequire(import.meta.url);
const { chromium } = require('C:/Users/Equipo/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const root = process.cwd();
const out = path.join(root, 'output/share-activity-qa');
await fs.mkdir(out, {recursive:true});
const mock = `
const cover = (label, color) => 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="100" height="160"><rect width="120" height="160" fill="'+color+'"/><text x="12" y="84" fill="white" font-family="Arial" font-size="15">'+label+'</text></svg>');
const date = h => new Date(Date.now()-h*3600000).toISOString();
const data = {
 posts: [
 {id:'post-a',user_id:'user-a',body:'Una de esas historias que se te quedan dentro. Qué ganas de hablar de ese final.',media:[],created_at:date(1)},
 {id:'post-hidden',user_id:'user-a',body:'PRIVATE SPOILER CONTENT',media:[{url:cover('Hidden','#99333a')}],contains_spoiler:true,spoiler_work_title:'Frieren',created_at:date(2)},
 {id:'post-old',user_id:'user-a',body:'Una publicación anterior',created_at:date(5)},
 {id:'post-b',user_id:'user-b',body:'Publicación de la segunda cuenta',created_at:date(.1)}],
 user_lists:[
 {id:'list-a',user_id:'user-a',title:'Mis imprescindibles para este otoño',list_type:'grid',visibility:'public',content:{c0:{image_url:cover('Favorites','#304559')}},created_at:date(1.5)},
 {id:'list-private',user_id:'user-a',title:'PRIVATE LIST',visibility:'private',created_at:date(.2)}],
 library_entries:[
 {id:'rating-only',user_id:'user-a',work_id:'9',work_type:'game',rating:5,review_text:null,created_at:date(.1)},
 {id:'review-game',user_id:'user-a',work_id:'7',work_type:'game',rating:4.5,review_text:'Un mundo en el que apetece perderse. La dirección artística y su música hacen el resto.',created_at:date(2)},
 {id:'review-anime',user_id:'user-a',work_id:'7',work_type:'anime',rating:null,review_text:'Hay algo muy especial en su manera de entender el paso del tiempo.',created_at:date(24)},
 {id:'review-spoiler',user_id:'user-a',work_id:'8',work_type:'game',rating:3.5,review_text:'PRIVATE REVIEW SPOILER',contains_spoiler:true,created_at:date(48)},
 {id:'review-b',user_id:'user-b',work_id:'9',work_type:'game',rating:4,review_text:'Reseña de la segunda cuenta',created_at:date(.1)}],
 games:[{id:7,name:'Hollow Knight',cover_url:cover('Hollow Knight','#284a55')},{id:8,name:'Outer Wilds',cover_url:cover('Outer Wilds','#9b602e')},{id:9,name:'Celeste',cover_url:cover('Celeste','#785064')}],
 anime:[{id:7,title:'Frieren',image_url:cover('Frieren','#49634e')}]
};
globalThis.__qaQueries=[];
globalThis.__qaFail=new URLSearchParams(location.search).get('scenario')==='error';
class Query {
 constructor(table){this.table=table;this.filters=[];this.max=Infinity;}
 select(){return this;} eq(k,v){this.filters.push(row=>String(row[k])===String(v));return this;}
 neq(k,v){this.filters.push(row=>row[k]!==v);return this;} not(k,op,v){this.filters.push(row=>row[k]!=v);return this;}
 in(k,values){this.filters.push(row=>values.map(String).includes(String(row[k])));return this;}
 order(k,{ascending=true}={}){this.sort=[k,ascending];return this;} limit(n){this.max=n;return this;}
 then(resolve,reject){
  globalThis.__qaQueries.push(this.table);
  return new Promise(done=>setTimeout(done,100)).then(()=>{
   if(globalThis.__qaFail && this.table==='posts')return {data:null,error:new Error('Simulated failure')};
   const empty=new URLSearchParams(location.search).get('scenario')==='empty';
   let rows=empty?[]:[...(data[this.table]||[])];
   rows=rows.filter(row=>this.filters.every(filter=>filter(row)));
   if(this.sort){const [key,asc]=this.sort;rows.sort((a,b)=>String(a[key]).localeCompare(String(b[key]))*(asc?1:-1));}
   return {data:rows.slice(0,this.max),error:null};
  }).then(resolve,reject);
 }
}
export const supabase={from:table=>new Query(table)};`;
const auth = `import {useState} from 'react'; export function useAuth(){const [id,setId]=useState('user-a');globalThis.__qaSetUser=setId;return {user:{id},profile:{username:id,display_name:'Tu perfil',theme_color:'#14b8a6'},updateProfile:async()=>{}};}`;
await build({stdin:{contents:`import React from 'react';import {createRoot} from 'react-dom/client';import {MemoryRouter} from 'react-router-dom';import {ToastProvider} from './src/components/Toast';import SharePage from './src/pages/SharePage';import './src/index.css';import './src/components/Layout.css';function Preview(){return <MemoryRouter initialEntries={['/share']}><ToastProvider><div className="layout"><aside className="app-sidebar"><a className="sidebar-brand" href="#"><span className="sidebar-brand-name">GeekSphere</span></a><div className="sidebar-top-space"/><nav className="sidebar-nav">{['Inicio','Espacios','Buscar','Compartir','Actividad','Mi perfil'].map(label=><a key={label} href="#" className={'sidebar-link'+(label==='Compartir'?' active':'')}>{label}</a>)}</nav></aside><main className="main share-main"><SharePage/></main></div></ToastProvider></MemoryRouter>}createRoot(document.getElementById('app')).render(<Preview/>);`,loader:'jsx',resolveDir:root},outfile:path.join(out,'preview.js'),bundle:true,format:'iife',jsx:'automatic',define:{'import.meta.env':'{}'},plugins:[{name:'qa-fixtures',setup(b){b.onResolve({filter:/[\\/]supabase(?:\.js)?$/},()=>({path:'supabase',namespace:'qa'}));b.onResolve({filter:/AuthContext(?:\.jsx)?$/},()=>({path:'auth',namespace:'qa'}));b.onLoad({filter:/.*/,namespace:'qa'},args=>({contents:args.path==='auth'?auth:mock,loader:'js',resolveDir:root}));}}],logLevel:'silent'});
await fs.writeFile(path.join(out,'index.html'),'<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><link rel="stylesheet" href="./preview.css"></head><body><div id="app"></div><script src="./preview.js"></script></body></html>');
let browser;
try {
 browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
 const page=await browser.newPage({viewport:{width:1440,height:1000},deviceScaleFactor:1,reducedMotion:'reduce'});
 const errors=[];page.on('pageerror',error=>errors.push(error.message));
 const url=pathToFileURL(path.join(out,'index.html')).href;
 await page.goto(url);await page.locator('.share-activity-section[aria-busy="false"]').first().waitFor();
 assert.equal(await page.locator('.share-activity-section').count(),2);
 assert.deepEqual(await page.locator('.share-activity-section').first().locator('.more-author-post-card').evaluateAll(nodes=>nodes.map(n=>n.getAttribute('href'))),['/posts/post-a','/posts/post-hidden','/posts/post-old']);
 assert.deepEqual(await page.locator('.share-activity-review').evaluateAll(nodes=>nodes.map(n=>n.getAttribute('href'))),['/reviews/review-game','/reviews/review-anime','/reviews/review-spoiler']);
 assert.deepEqual(await page.locator('.share-activity-review').evaluateAll(nodes=>nodes.map(n=>n.getAttribute('aria-label').split(', ')[0])),['Hollow Knight','Frieren','Outer Wilds']); assert.equal(await page.locator('.share-activity-rating').count(),2); assert.equal(await page.locator('.share-activity-rating').first().textContent(),'4,5'); assert.equal(await page.locator('.share-activity-review > img').first().evaluate(n=>getComputedStyle(n).objectFit),'cover'); assert.equal(await page.locator('.share-activity-section').first().evaluate(n=>getComputedStyle(n).borderStyle),'none');
 assert.equal(await page.getByText('PRIVATE SPOILER CONTENT').count(),0);
 assert.equal(await page.getByText('PRIVATE REVIEW SPOILER').count(),0);
 assert.equal(await page.getByText('PRIVATE LIST').count(),0);
 assert.equal(await page.getByText('Publicación de la segunda cuenta').count(),0);
 const boxes=await page.locator('.share-composer, .share-activity').evaluateAll(nodes=>nodes.map(n=>{const b=n.getBoundingClientRect();return {x:b.x,y:b.y,width:b.width,right:b.right};}));
 assert.ok(boxes[1].x>=boxes[0].right+20);assert.ok(Math.abs(boxes[1].y-boxes[0].y)<2);assert.ok(boxes[1].right<=1440);
 await page.screenshot({path:path.join(out,'desktop-1440.png'),fullPage:true});
 await page.setViewportSize({width:1280,height:900});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
 await page.screenshot({path:path.join(out,'desktop-1280.png'),fullPage:true});
 await page.evaluate(()=>globalThis.__qaSetUser('user-b'));
 await page.getByText('Publicación de la segunda cuenta').waitFor();
 assert.equal(await page.locator('a[href="/reviews/review-game"]').count(),0);
 assert.equal(await page.locator('a[href="/reviews/review-b"]').count(),1);
 await page.setViewportSize({width:390,height:844});await page.goto(url);
 assert.equal(await page.locator('.share-activity').count(),0);
 await page.waitForTimeout(250);assert.equal(await page.evaluate(()=>globalThis.__qaQueries.includes('posts')||globalThis.__qaQueries.includes('user_lists')),false);
 console.log('Mobile overflow diagnostic:',await page.evaluate(()=>({width:innerWidth,scroll:document.documentElement.scrollWidth,elements:[...document.querySelectorAll('body *')].filter(n=>n.getBoundingClientRect().right>innerWidth+2).map(n=>({tag:n.tagName,class:n.className,right:n.getBoundingClientRect().right})).slice(0,12)})));
 await page.screenshot({path:path.join(out,'mobile-390.png'),fullPage:true});
 await page.setViewportSize({width:1440,height:1000});await page.goto(url+'?scenario=empty');
 await page.getByText('Lo que compartas aparecerá aquí.').waitFor();await page.getByText('Tus próximas reseñas aparecerán aquí.').waitFor();
 await page.goto(url+'?scenario=error');await page.getByText('No se pudo cargar esta sección.').waitFor();
 assert.equal(await page.locator('.share-activity-review').count(),3);
 await page.evaluate(()=>globalThis.__qaFail=false);await page.getByRole('button',{name:'Reintentar',exact:true}).click();
 await page.locator('a[href="/posts/post-a"]').waitFor();assert.equal(await page.getByText('No se pudo cargar esta sección.').count(),0);
 assert.deepEqual(errors,[]);
 console.log('PASS: contenido reciente ordenado, solo el usuario actual, sin listas, carátulas completas y nota propia, reseñas con texto, portadas por tipo, spoilers ocultos, enlaces, cambio de cuenta, escritorio 1440/1280, móvil sin consultas extra, estados vacío/error y reintento.');
 console.log('Capturas: '+out);
} finally {if(browser)await browser.close();}
