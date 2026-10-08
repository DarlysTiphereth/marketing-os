import {readFileSync,writeFileSync} from 'node:fs';
import path from 'node:path';import {fileURLToPath} from 'node:url';
import {openChrome} from '../factories/static/src/render.ts';
import {run,TOOLS,sha256File} from '../experiments/remotion/pipeline/lib.ts';
const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'), OUT=path.join(ROOT,'.mos/universal-assets');
const report=JSON.parse(readFileSync(path.join(OUT,'report.json'),'utf8'));
const old=path.join(ROOT,'.mos/commerce/grand-commerce-pilot-a5942ee92319/ugc-faceless.mp4');
if(sha256File(old)!=='adb52f95c55cc86ceb819e328d956c7abffd548d8055569007ea0b6d825c6f27')throw new Error('OLD_BENCHMARK_HASH_MISMATCH');
const clips=[{id:'rejected',title:'Anterior rejeitado · GRAND',file:old},...report.samples.map(s=>{
  const file=path.join(ROOT,s.output);if(sha256File(file)!==s.asset_hash)throw new Error('STALE_SAMPLE');return{id:s.id,title:s.title,file};})];
const esc=s=>s.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
for(const c of clips)for(const [i,t] of [0,.5,2.5,4.5].entries())run(TOOLS.ffmpeg,['-v','error','-y','-ss',String(t),'-i',c.file,'-frames:v','1','-vf','scale=432:768','-threads','1',path.join(OUT,c.id+'-frame-'+i+'.png')]);
const card=(c,frames=false)=>`<article><h2>${esc(c.title)}</h2>${frames?`<img src="${c.id}-frame-1.png">`:`<video controls playsinline preload="metadata" src="${c.id==='rejected'?('../commerce/grand-commerce-pilot-a5942ee92319/ugc-faceless.mp4'):c.id+'.mp4'}"></video>`}<p>${c.id==='rejected'?'Benchmark antigo: vídeo pequeno em moldura, direção rejeitada.':c.id==='a-stock'?'Stock licenciado + embalagem real.':c.id==='b-ai'?'Cenário IA + embalagem real. Movimento 2D, sem I2V.':'IA + stock têxtil + embalagem real.'}</p></article>`;
const style=`body{font-family:Arial,sans-serif;background:#111922;color:#edf1f2;margin:0;padding:30px}h1{font-size:30px;margin:0 0 12px}h2{font-size:18px}.grid{display:grid;grid-template-columns:repeat(4,1fr);gap:20px}article{background:#1c2835;border-radius:12px;padding:14px}video,img{width:100%;aspect-ratio:9/16;object-fit:cover;border-radius:6px}p{font-size:14px;line-height:1.5;color:#bac9d7}.story{display:grid;grid-template-columns:repeat(4,1fr);gap:8px}button{padding:12px 20px;background:#efd9a8;border:0;border-radius:6px;color:#14263d;cursor:pointer}`;
const html=`<!doctype html><meta charset="utf-8"><title>Universal Assets · revisão GRAND</title><style>${style}</style><h1>Três rotas. Uma embalagem real.</h1><p>Estudos de seis segundos. Stock, IA e composição são materiais ilustrativos, sem prova de eficácia. TECHNICAL_QC PASS; CREATIVE_QC / BRAND_QC / HUMAN_APPROVAL PENDING; COMMERCE_QC BLOCKED. Escala suspensa.</p><button onclick="document.querySelectorAll('video').forEach(v=>{v.currentTime=0;v.play()})">Comparar abertura</button><div class="grid">${clips.map(c=>card(c)).join('')}</div><h2>Storyboard visual · 0s / 0,5s / 2,5s / 4,5s</h2>${clips.slice(1).map(c=>`<h2>${esc(c.title)}</h2><div class="story">${[0,1,2,3].map(i=>`<img src="${c.id}-frame-${i}.png">`).join('')}</div>`).join('')}<p>Limitações: packshot frontal de resolução útil limitada; perspectiva e iluminação da foto não foram recriadas; som de água CC0 editado, sem sincronismo de filmagem; nenhuma oferta, testemunho ou teste real do produto. O cenário de IA foi gerado dentro do Codex; nenhuma GPU ou serviço novo contratado.</p>`;
writeFileSync(path.join(OUT,'review.html'),html);
const browser=await openChrome();
try{const page=await browser.newPage({viewport:{width:1440,height:1100},deviceScaleFactor:1});
  await page.setContent(`<!doctype html><meta charset="utf-8"><style>${style}</style><h1>Anterior / Stock / IA / Hybrid</h1><p>Mesmo instante: 0,5s · estudos internos · sem aprovação criativa</p><div class="grid">${clips.map(c=>card(c,true).replace(`src="${c.id}-frame-1.png"`,`src="data:image/png;base64,${readFileSync(path.join(OUT,c.id+'-frame-1.png')).toString('base64')}"`)).join('')}</div>`);
  await page.evaluate(async()=>Promise.all([...document.images].map(i=>i.decode())));await page.screenshot({path:path.join(OUT,'comparison.png')});await page.close();
}finally{await browser.close();}
console.log('Review board + visual storyboards + comparison created; HUMAN_APPROVAL pending.');
