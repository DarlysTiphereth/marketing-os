// Extract actual frames and make a private, offline comparison. No third render or publishing.
import {mkdirSync, readFileSync, writeFileSync, existsSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {TOOLS, run, sha256File, writeJson} from '../experiments/remotion/pipeline/lib.ts';
import {openChrome} from '../factories/static/src/render.ts';
const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'), OUT=path.join(ROOT,'.mos/creative-recovery');
const framesDir=path.join(OUT,'frames');mkdirSync(framesDir,{recursive:true});
const sources={grand:'.mos/commerce/grand-commerce-pilot-a5942ee92319/ugc-faceless.mp4',
  mock:'.mos/commerce/mock-affiliate-pilot-1f94bc0f3113/ugc-faceless.mp4',
  cinematic:'experiments/remotion/cinematic/runs/2026-10-08T02-36-26-994Z_01884224a7/final.mp4',
  vector:'experiments/remotion/runs/2026-10-08T00-47-22-459Z_v-31bf548c4d26/final.mp4',
  a:'.mos/creative-recovery/a-sample.mp4',b:'.mos/creative-recovery/b-sample.mp4'};
const browser=await openChrome(), page=await browser.newPage();
const inventory=[], images={};
const report=JSON.parse(readFileSync(path.join(OUT,'report.json'),'utf8'));
const esc=s=>s.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
async function pngDecode(jpeg, output) {
  const source='data:image/jpeg;base64,'+readFileSync(jpeg).toString('base64');
  const encoded=await page.evaluate(async s=>{const i=new Image();i.src=s;await i.decode();const c=document.createElement('canvas');
    c.width=i.width;c.height=i.height;c.getContext('2d').drawImage(i,0,0);return c.toDataURL('image/png').split(',')[1];},source);
  writeFileSync(output,Buffer.from(encoded,'base64'));return 'data:image/png;base64,'+encoded;
}
try {
  for(const [id,relative] of Object.entries(sources)) {
    const file=path.join(ROOT,relative);
    if(!existsSync(file)){
      if(id==='a'||id==='b') throw new Error('MISSING_CURRENT_SAMPLE');
      inventory.push({id,file:relative,status:'MISSING_PRIOR_LOCAL_MEDIA'});continue;
    }
    if((id==='a'||id==='b') && sha256File(file)!==report.samples.find(s=>s.sample===id)?.video_sha256)
      throw new Error('STALE_REVIEW_MEDIA');
    const p=JSON.parse(run(TOOLS.ffprobe,['-v','error','-show_format','-of','json',file]).stdout),dur=Number(p.format.duration);
    const times=id==='a'||id==='b'?[0,.5,1,2.7,4.2,6.7]:[0,.5,1,Math.min(6,dur*.4),dur*.7,dur-.2];
    images[id]=[];
    for(let k=0;k<times.length;k++) {
      const jpeg=path.join(framesDir,`${id}-${k}.jpg`), png=path.join(framesDir,`${id}-${k}.png`);
      run(TOOLS.ffmpeg,['-v','error','-y','-ss',String(times[k]),'-i',file,'-frames:v','1',
        '-vf','scale=360:640:out_color_matrix=bt601:out_range=pc','-q:v','1',jpeg]);
      images[id].push({src:await pngDecode(jpeg,png),time:times[k],file:path.relative(ROOT,png).replaceAll('\\','/')});
    }
    inventory.push({id,file:relative,sha256:sha256File(file),duration_s:dur,frames:images[id].map(({time,file})=>({time,file}))});
  }
  writeJson(path.join(OUT,'audit-inventory.json'),inventory);
  const cards=(id)=>images[id]?.map(f=>`<figure><img src="${f.src}"><figcaption>${f.time.toFixed(1)}s</figcaption></figure>`).join('')??'<p>Mídia anterior ausente neste checkout.</p>';
  const concepts=JSON.parse(readFileSync(path.join(ROOT,'creative-quality/concepts.json'),'utf8'));
  const media=(id)=>path.relative(OUT,path.join(ROOT,sources[id])).replaceAll('\\','/');
  const pair=(old,current,title)=>`<section class="pair"><h2>${title}</h2><div class="twovideos"><div><h3>Anterior — rejeitado</h3><video preload="metadata" playsinline controls poster="${images[old]?.[1].src??''}" src="${esc(media(old))}"></video></div><div><h3>Amostra — aprovação pendente</h3><video preload="metadata" playsinline controls poster="${images[current][1].src}" src="${esc(media(current))}"></video></div></div><button class="sync" data-old="${old}" data-new="${current}">Comparar os primeiros 7s</button><p>Comparação de direção visual, não teste A/B de vendas. Ao sincronizar, o áudio anterior fica mudo para evitar dois mixes simultâneos. Os controles individuais permitem ouvir cada versão.</p></section>`;
  const html=`<!doctype html><html lang="pt-BR"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Creative Quality — revisão visual</title><style>
  *{box-sizing:border-box}body{margin:0;background:#eeeae2;color:#192325;font-family:Arial,sans-serif}main{max-width:1280px;margin:auto;padding:48px 28px}h1{font-size:48px;letter-spacing:-2px;max-width:800px;margin:16px 0}h2{font-size:28px}p{line-height:1.55;max-width:880px}.status{display:inline-block;padding:10px 14px;background:#192325;color:#fff;letter-spacing:1px;font-size:12px}.line{border-top:1px solid #ada99f;margin-top:32px;padding-top:20px}.filmstrip{display:grid;grid-template-columns:repeat(6,1fr);gap:10px}.story{display:grid;grid-template-columns:repeat(3,1fr);gap:18px}figure{margin:0}img{display:block;width:100%;height:auto}figcaption{font-size:12px;margin-top:8px;color:#46504d}.twovideos{display:grid;grid-template-columns:1fr 1fr;gap:24px}video{display:block;width:100%;max-height:600px;background:#111}button{background:#d85931;color:#fff;border:0;padding:13px 18px;margin-top:18px;cursor:pointer}.pair{margin-top:40px}.gates{display:grid;grid-template-columns:repeat(5,1fr);gap:8px}.gate{padding:14px;background:#fff;font-size:12px}.gate b{display:block;margin-top:10px;font-size:15px}.limits{padding:22px;background:#fff4df;border-left:4px solid #d85931}.audit{margin-top:32px}textarea{width:100%;min-height:100px;border:1px solid #aaa;padding:12px;font:inherit}@media(max-width:800px){h1{font-size:32px}.filmstrip{grid-template-columns:repeat(3,1fr)}.gates{grid-template-columns:1fr 1fr}.twovideos{gap:12px}.story{grid-template-columns:1fr}}
  </style><main><span class="status">ESCALA SUSPENSA · REVISÃO HUMANA PENDENTE</span><h1>Fotografia e gesto.<br>Antes de quantidade.</h1><p>Duas amostras de sete segundos para julgar abertura, direção de arte, legibilidade, ritmo, áudio e plausibilidade. Não há aprovação comercial ou resultado de vendas.</p>
  <div class="limits"><b>Limite essencial</b><p>A é um beauty shot composto com o packshot autêntico de 800×800. B demonstra lavagem manual de categoria com stock licenciado: não mostra uso nem eficácia da GRAND, e não é um depoimento. Falta captação própria para concluir esse conceito como publicidade de produto.</p></div>
  <div class="gates line">${Object.entries(report.samples[0].gates).map(([name,g])=>`<div class="gate">${name}<b>${g.status}</b></div>`).join('')}</div>
  ${pair('grand','a','A · Cinematográfico — produto e matéria')}${pair('mock','b','B · UGC faceless — ação e proximidade')}
  <h2 class="line">Storyboard visual dos dois conceitos</h2><p>Frames reais das amostras, ligados à sequência aprovada para estudo no plano de direção. Não é storyboard gerado por IA nem garantia de qualidade.</p>
  ${['a','b'].map((id,i)=>`<h3>${esc(concepts[i].title)}</h3><div class="story">${[1,3,5].map((k,n)=>`<figure><img src="${images[id][k].src}"><figcaption>${images[id][k].time.toFixed(1)}s · ${esc(concepts[i].narrative[n].action)}</figcaption></figure>`).join('')}</div>`).join('')}
  <h2 class="line">Abertura e primeiro segundo — sem seleção favorável</h2>${['grand','mock','a','b'].map(id=>`<h3>${id.toUpperCase()}</h3><div class="filmstrip">${cards(id)}</div>`).join('')}
  <h2 class="line">Outros renders anteriores</h2>${['cinematic','vector'].map(id=>`<div class="audit"><h3>${id}</h3><div class="filmstrip">${cards(id)}</div></div>`).join('')}
  <h2 class="line">Revisão criativa humana</h2><p>A e B têm direção distinta? A abertura chama atenção? O produto parece composto? A lavagem parece real? O som serve ao gesto? O CTA é claro? Qual amostra deve ser rejeitada, ajustada ou aprovada para evolução?</p><textarea aria-label="Notas de revisão" placeholder="Anote críticas concretas e tempos dos frames. Nenhuma decisão nesta página inicia produção."></textarea><p>Envie sua decisão explicitamente no chat, identificando A/B e os ajustes. Os fingerprints em a-review.json e b-review.json vinculam a avaliação aos bytes atuais. Nenhum comando de escala ou publicação é executado nesta entrega.</p></main>
  <script>document.querySelectorAll('.sync').forEach(button=>button.addEventListener('click',()=>{const section=button.closest('section'),[old,now]=section.querySelectorAll('video');document.querySelectorAll('video').forEach(v=>v.pause());old.currentTime=0;now.currentTime=0;old.muted=true;now.muted=false;Promise.allSettled([old.play(),now.play()]);const stop=()=>{if(now.currentTime>=7){old.pause();now.pause();now.removeEventListener('timeupdate',stop)}};now.addEventListener('timeupdate',stop)}));</script></html>`;
  writeFileSync(path.join(OUT,'review.html'),html);
  // A compact, honest before/after panel using the same timestamp in all four videos.
  const panel=await page.evaluate(async input=>{const c=document.createElement('canvas');c.width=1440;c.height=750;const x=c.getContext('2d');x.fillStyle='#eeeae2';x.fillRect(0,0,1440,750);for(let k=0;k<input.length;k++){if(input[k].src){const im=new Image();im.src=input[k].src;await im.decode();x.drawImage(im,k*360,70,360,640);}else{x.fillStyle='#192325';x.font='18px sans-serif';x.fillText('Anterior indisponível',k*360+15,150);}x.fillStyle='#192325';x.font='bold 18px sans-serif';x.fillText(input[k].title,k*360+15,35);x.font='14px sans-serif';x.fillText('Frame 0.5s · avaliação pendente',k*360+15,735);}return c.toDataURL('image/png').split(',')[1];},
    [{src:images.grand?.[1].src??null,title:'GRAND anterior'},{src:images.a[1].src,title:'A · Cinematográfico'},
      {src:images.mock?.[1].src??null,title:'MOCK anterior'},{src:images.b[1].src,title:'B · Gesto real / categoria'}]);
  writeFileSync(path.join(OUT,'comparison.png'),Buffer.from(panel,'base64'));
} finally {await browser.close();}
console.log('Private review board, visual storyboards and exact-time comparison ready. HUMAN_APPROVAL pending.');
