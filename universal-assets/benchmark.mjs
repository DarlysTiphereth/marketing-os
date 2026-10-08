// Three bounded 6-second internal studies. No external inference/download, no paid API, no scaling.
import {existsSync,mkdirSync,readFileSync,writeFileSync,statSync} from 'node:fs';
import path from 'node:path';import {fileURLToPath} from 'node:url';
import {AssetRecord,dimensions} from '../src/universal-assets/contracts.ts';
import {loadLibrary,verifyRecord,hashBytes,confinedFile} from '../src/universal-assets/library.ts';
import {factoryAssets,assertFactoryBinding} from '../src/universal-assets/factory.ts';
import {fingerprint} from '../src/universal-assets/router.ts';
import {StockSearch} from '../src/universal-assets/stock.ts';
import {pendingGates,scaleDecision} from '../src/creative-quality/director.ts';
import {openChrome} from '../factories/static/src/render.ts';
import {Cas} from '../ops/storage/cas.ts';
import {LIMITS} from '../ops/config.ts';
import {run,TOOLS,sha256File,writeJson} from '../experiments/remotion/pipeline/lib.ts';

const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'), OUT=path.join(ROOT,'.mos/universal-assets');
const start=Date.now();mkdirSync(OUT,{recursive:true});
const product=JSON.parse(readFileSync(path.join(ROOT,'factories/shared/products/grand/sabao-liquido-premium-5l.json'),'utf8'));
const scope={brand_id:product.brand_id,product_id:product.product_id,product_version:sha256File(path.join(ROOT,'factories/shared/products/grand/sabao-liquido-premium-5l.json'))};
if(scope.brand_id!=='grand'||scope.product_id!=='sabao-liquido-premium-5l')throw new Error('PRODUCT_SCOPE_MISMATCH');
for(const text of ['GRAND Sabão Líquido Premium','5 L','Conheça a GRAND'])
  if(!product.claims.some(c=>c.approval==='USER_APPROVED'&&c.text===text))throw new Error('UNAPPROVED_COPY');
const edl=JSON.parse(readFileSync(path.join(ROOT,'experiments/remotion/cinematic/edit.json'),'utf8'));
const proofRef='universal-assets/licenses.json', proofHash=sha256File(path.join(ROOT,proofRef));
const licenses=JSON.parse(readFileSync(path.join(ROOT,proofRef),'utf8'));
const font=path.join(ROOT,'factories/static/node_modules/@fontsource-variable/archivo/files/archivo-latin-wght-normal.woff2');
if(sha256File(font)!=='8f704806dbedeaaeca334b11ec348bc3ac3a439d6431544b3afb54f534ee4967')throw new Error('FONT_HASH_MISMATCH');
const files={water:edl.sources.water.local,denim:edl.sources.denim.local,packshot:product.assets.packshot.local_path_hint,atelier:'.mos/universal-assets/atelier-ai.png',
  font:path.relative(ROOT,font).replaceAll('\\','/'),foley:'.mos/creative-recovery/assets/swim.wav'};
const expected={water:edl.sources.water.sha256,denim:edl.sources.denim.sha256,packshot:product.assets.packshot.sha256,atelier:licenses.generated_background.asset_hash,
  font:'8f704806dbedeaaeca334b11ec348bc3ac3a439d6431544b3afb54f534ee4967',foley:'9a968e9083ca7979b225838c218e59d9f4da7fa5ddbd20567cd4b45a3c8814f8'};
const profile=(warm=false)=>Object.fromEntries(dimensions.map(k=>[k,({motion:'restrained',framing:'close',lighting:warm?'warm-window':'soft-daylight',camera_direction:'stable',color:warm?'ivory-blue':'blue-neutral',perspective:'eye-level',texture:'tactile',continuity:warm?'atelier':'laundry',narrative:'material',composition:'off-center',text_space:'upper-left',product_compatibility:'laundry'})[k]]));
const cinematicBrief={
  denim:{...profile(),motion:'drift',framing:'macro',perspective:'above-textiles',texture:'cotton',composition:'full-frame'},
  water:{...profile(),motion:'fluid',framing:'wide',lighting:'sun-reflections',perspective:'overhead',texture:'liquid',narrative:'movement',composition:'full-frame'},
  atelier:{...profile(true),motion:'still',framing:'wide',texture:'stone-cotton'},
  packshot:{...profile(),motion:'still',framing:'front',perspective:'frontal',texture:'plastic',narrative:'identity',composition:'alpha-packshot',text_space:'none'},
};
const inventory=Object.entries(files).map(([id,ref])=>{
  const f=confinedFile(ROOT,ref);if(sha256File(f)!==expected[id])throw new Error('SOURCE_HASH_MISMATCH:'+id);
  const l=id==='packshot'?licenses.internal_packshot:id==='atelier'?licenses.generated_background:id==='font'?licenses.font:id==='foley'?licenses.foley:licenses.pexels;
  const a=AssetRecord.parse({id,source_url:id==='water'||id==='denim'?l.assets[id].source_url:l.source_url,
    creator:id==='water'||id==='denim'?l.assets[id].creator:l.creator,license:l.license,license_version:l.license_version,
    retrieval_date:new Date().toISOString(),allowed_use:l.allowed_use,asset_hash:expected[id],local_ref:ref,bytes:statSync(f).size,
    kind:['water','denim'].includes(id)?'VIDEO':id==='font'?'FONT':id==='foley'?'AUDIO':'IMAGE',proof_ref:proofRef,proof_hash:proofHash,rights_verified:true,
    redistribute_original:false,retention_until:null,product_relevance:id==='packshot'?1:.75,quality_score:id==='atelier'?.72:.7,
    realism_score:id==='atelier'?.72:.85,fidelity:id==='packshot'?'PRODUCT_VISUAL':'GENERIC_VISUAL',synthetic:id==='atelier',
    faceless_verified:true,scope:id==='packshot'?scope:null,evidence:null,approval:null,cost_brl:0,elapsed_s:0,
    tags:{category:['laundry'],use:[id==='packshot'?'identity':'background'],scenario:['home'],aesthetic:[id==='atelier'?'warm-editorial':'tactile-stock'],
      audience:['household'],language:['neutral'],format:['9:16'],compatibility:['laundry']},cinema:cinematicBrief[id]??Object.fromEntries(dimensions.map(k=>[k,null])),derivation:null});
  verifyRecord(ROOT,a);return a;
});
writeJson(path.join(OUT,'library.json'),inventory);
const library=loadLibrary(ROOT,'.mos/universal-assets/library.json');
const cas=new Cas();
const manifest=cas.load(), stored=Object.values(manifest.objects).reduce((sum,x)=>sum+x.bytes,0);
const additional=library.filter(a=>!manifest.objects[a.asset_hash]).reduce((sum,a)=>sum+a.bytes,0);
if(!Number.isFinite(LIMITS.cacheMaxBytes)||stored+additional>LIMITS.cacheMaxBytes)throw new Error('EXISTING_CAS_STORAGE_BUDGET_EXCEEDED');
for(const a of library)cas.put(confinedFile(ROOT,a.local_ref),{name:'universal-assets:'+a.id,class:'candidate',run_id:'grand-three-strategies'});
const cache=new Map();const stock=new StockSearch({...(process.env.PEXELS_API_KEY?{PEXELS:process.env.PEXELS_API_KEY}:{}),
  ...(process.env.PIXABAY_API_KEY?{PIXABAY:process.env.PIXABAY_API_KEY}:{})},{get:k=>cache.get(k),put:(k,v)=>cache.set(k,v)});
// Report presence only; do not execute live queries automatically, especially Pixabay human-request API.
writeJson(path.join(OUT,'provider-status.json'),{PEXELS:process.env.PEXELS_API_KEY?'AUTH_PRESENT_NOT_TESTED':'NO_AUTH',
  PIXABAY:process.env.PIXABAY_API_KEY?'AUTH_PRESENT_NOT_TESTED':'NO_AUTH',MIXKIT:'NOT_SUPPORTED',image_tool:'ONE_GENERATION_EXECUTED_IN_CODEX',i2v:'NOT_TESTED'});
void stock;
const scene=(a)=>({id:'scene-'+a.id,...scope,category:'laundry',language:'pt',format:'9:16',use:'INTERNAL_STUDY',fidelity:a.fidelity,kind:a.kind,
  claim_ids:[],approved_claim_ids:product.claims.filter(c=>c.approval==='USER_APPROVED').map(c=>c.claim_id),query:'laundry material',cinema:cinematicBrief[a.id],
  min_quality:.65,min_realism:.65,min_match:.7,max_elapsed_s:120,previous_asset_hash:null,
  allowed_strategies:[a.id==='atelier'?'SYNTHETIC_IMAGE':'EXISTING_LICENSED'],campaign_asset_hashes:[]});
const candidates=library.map(a=>({asset:a,strategy:a.id==='atelier'?'SYNTHETIC_IMAGE':'EXISTING_LICENSED'}));
const experiments=[
  {id:'a-stock',title:'A · Stock-first',inputs:['denim','water','packshot'],shots:[['denim',.4,2],['water',.7,2],['denim',3,2]],warm:false},
  {id:'b-ai',title:'B · AI-first',inputs:['atelier','packshot'],shots:[['atelier',0,2],['atelier',0,2],['atelier',0,2]],warm:true},
  {id:'c-hybrid',title:'C · Hybrid',inputs:['atelier','denim','packshot'],shots:[['atelier',0,2],['denim',1,2],['atelier',0,2]],warm:true},
];
const browser=await openChrome(), reports=[],compositions=[];
const uri=(ref,type)=>`data:${type};base64,${readFileSync(confinedFile(ROOT,ref)).toString('base64')}`;
const fontData=readFileSync(font).toString('base64');
async function plate(name,background,phase,warm){
  const page=await browser.newPage({viewport:{width:1080,height:1920},deviceScaleFactor:1});
  const ink=warm?'#14263d':'#fff', tone=warm?'#eee9dd':'#0a203780';
  // Real product pixels retain aspect ratio. No generated label, invented bottle or pseudo-3D rotation.
  const photo=`<img id="product" src="${uri(files.packshot,'image/png')}" style="position:absolute;left:280px;top:540px;width:750px;height:750px;filter:drop-shadow(10px 15px 13px #08152355)">`;
  const bg=background?`<img style="position:absolute;inset:0;width:1080px;height:1920px;object-fit:cover" src="${uri(background,'image/png')}">`:'';
  const headline=phase===0?'GRAND':phase===1?'Sabão Líquido<br>Premium':'Conheça a GRAND';
  await page.setContent(`<!doctype html><meta charset="utf-8"><style>@font-face{font-family:A;src:url(data:font/woff2;base64,${fontData});font-weight:100 900}body{margin:0;width:1080px;height:1920px;background:transparent;font-family:A} .copy{position:absolute;left:78px;color:${ink};max-width:900px;line-height:1.06} </style>${bg}
    ${background?'':`<div style="position:absolute;inset:0;background:linear-gradient(${tone},transparent 60%,#08152399)"></div>`}
    <div class="copy" style="top:280px;font-size:${phase===0?105:66}px;font-weight:${phase===0?850:650};letter-spacing:-2px">${headline}</div>
    <div class="copy" style="top:435px;font-size:29px;letter-spacing:5px">${phase===2?'SABÃO LÍQUIDO PREMIUM':'5 L'}</div>
    ${phase===1&&!background?'':photo}
    <div class="copy" style="top:1490px;font-size:24px;line-height:1.35">Estudo interno · ${warm?'Cenário sintético / composição':'Stock ilustrativo / composição'}<br>Sem demonstração de eficácia</div>`);
  await page.evaluate(async()=>{await document.fonts.ready;await Promise.all([...document.images].map(i=>i.decode()));});
  const boxes=await page.evaluate(()=>[...document.querySelectorAll('.copy')].map(e=>{const b=e.getBoundingClientRect();return{x:b.x,y:b.y,w:b.width,h:b.height,text:e.textContent};}));
  if(boxes.some(b=>b.x<60||b.x+b.w>1020||b.y<230||b.y+b.h>1600))throw new Error('SAFE_ZONE_FAILED');
  const f=path.join(OUT,name+'.png');await page.screenshot({path:f,omitBackground:!background});await page.close();
  return {file:f,boxes};
}
try{
  for(const ex of experiments){
    const t=Date.now(), relevant=library.filter(a=>ex.inputs.includes(a.id)), scenes=relevant.map(scene);
    const plan=factoryAssets('VIDEO',scenes,candidates);if(plan.status!=='STUDY_READY')throw new Error('ASSET_PLAN_BLOCKED');
    assertFactoryBinding(plan,scenes,candidates);for(const a of relevant)verifyRecord(ROOT,a);
    // Bind actual render inputs to the router result, rather than silently rendering the requested IDs.
    const selectedFiles=Object.fromEntries(plan.scenes.map(p=>[p.scene.id.replace('scene-',''),p.selected.asset.local_ref]));
    for(const a of relevant)if(selectedFiles[a.id]!==a.local_ref)throw new Error('SCENE_PLAN_REQUIRES_CREATIVE_REVISION');
    writeJson(path.join(OUT,ex.id+'-plan.json'),plan);
    for(let i=0;i<3;i++){
      const [id,at,duration]=ex.shots[i], synthetic=id==='atelier';
      const hybrid=ex.id==='c-hybrid'&&synthetic;
      const p=await plate(ex.id+'-plate-'+i,synthetic&&!hybrid?files.atelier:null,i,ex.warm&&synthetic&&!hybrid);
      let args, filter;
      if(hybrid){
        args=['-loop','1','-threads','1','-i',confinedFile(ROOT,selectedFiles.atelier),'-ss',i===0?'0.4':'3','-threads','1','-i',confinedFile(ROOT,selectedFiles.denim),'-loop','1','-threads','1','-i',p.file];
        filter=`[0:v]scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,setsar=1,fps=30,format=rgb24[bg];[1:v]scale=1080:1920:force_original_aspect_ratio=increase,crop=432:1920:324:0,setsar=1,fps=30,eq=saturation=.75,format=rgb24[cloth];[bg][cloth]overlay=0:0:format=rgb[split];[2:v]format=rgba[art];[split][art]overlay=0:0:format=rgb,scale=out_color_matrix=bt709:out_range=tv,format=yuv420p[out]`;
      }else if(synthetic){
        args=['-loop','1','-threads','1','-i',p.file];
        // Editorial 2D camera motion; explicitly NOT a generative image-to-video model.
        filter=`[0:v]scale=2160:3840,zoompan=z='1.015+0.0003*on':x='iw/2-iw/zoom/2':y='ih/2-ih/zoom/2':d=60:s=1080x1920:fps=30,format=yuv420p[out]`;
      }else{
        args=['-ss',String(at),'-threads','1','-i',confinedFile(ROOT,selectedFiles[id]),'-loop','1','-threads','1','-i',p.file];
        filter=`[0:v]scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,setsar=1,fps=30,eq=saturation=.75:contrast=1.035,format=rgb24[v];[1:v]format=rgba[o];[v][o]overlay=0:0:format=rgb,scale=out_color_matrix=bt709:out_range=tv,format=yuv420p[out]`;
      }
      run(TOOLS.ffmpeg,['-v','error','-y',...args,'-filter_complex_threads','1','-filter_complex',filter,'-map','[out]','-an','-t',String(duration),
        '-c:v','libx264','-preset','veryfast','-crf','18','-threads','2','-r','30','-pix_fmt','yuv420p','-colorspace','bt709','-color_primaries','bt709','-color_trc','bt709',path.join(OUT,ex.id+'-'+i+'.mp4')]);
    }
    writeFileSync(path.join(OUT,ex.id+'-concat.txt'),[0,1,2].map(i=>`file '${ex.id}-${i}.mp4'`).join('\n')+'\n');
    const foley=path.join(ROOT,'.mos/creative-recovery/assets/swim.wav');
    if(sha256File(foley)!=='9a968e9083ca7979b225838c218e59d9f4da7fa5ddbd20567cd4b45a3c8814f8')throw new Error('CC0_FOLEY_HASH_MISMATCH');
    const file=path.join(OUT,ex.id+'.mp4');
    run(TOOLS.ffmpeg,['-v','error','-y','-f','concat','-safe','1','-i',path.join(OUT,ex.id+'-concat.txt'),'-stream_loop','-1','-i',foley,
      '-map','0:v','-map','1:a','-c:v','copy','-af','highpass=f=180,lowpass=f=6000,afade=t=in:d=0.1,afade=t=out:st=5.7:d=0.3,loudnorm=I=-16:TP=-1.5:LRA=8',
      '-c:a','aac','-b:a','192k','-ar','48000','-ac','2','-t','6','-movflags','+faststart',file]);
    const p=JSON.parse(run(TOOLS.ffprobe,['-v','error','-count_frames','-show_streams','-show_format','-of','json',file]).stdout),v=p.streams.find(x=>x.codec_type==='video'),a=p.streams.find(x=>x.codec_type==='audio');
    const detection=run(TOOLS.ffmpeg,['-hide_banner','-nostats','-i',file,'-vf','blackdetect=d=0.1:pic_th=0.98','-af','ebur128=peak=true','-f','null','-']).stderr;
    const summary=detection.slice(detection.lastIndexOf('Summary:')),lufs=Number(summary.match(/I:\s+(-?[\d.]+) LUFS/)?.[1]),peak=Number(summary.match(/Peak:\s+(-?[\d.]+) dBFS/)?.[1]);
    const checks={duration:Math.abs(Number(p.format.duration)-6)<.1,frames:Number(v.nb_read_frames)===180,size:v.width===1080&&v.height===1920,
      codec:v.codec_name==='h264'&&v.pix_fmt==='yuv420p',audio:a.codec_name==='aac'&&a.sample_rate==='48000'&&a.channels===2,
      no_black:!/black_start:/.test(detection),loudness:lufs>=-18&&lufs<=-14,peak:peak<=-1};
    const gates=pendingGates(Object.values(checks).every(Boolean)),binding=fingerprint({plan,video_hash:sha256File(file)});
    const report={id:ex.id,title:ex.title,output:path.relative(ROOT,file).replaceAll('\\','/'),asset_hash:sha256File(file),elapsed_s:(Date.now()-t)/1000,
      technical:{checks,lufs,peak},gates,production:scaleDecision(gates,binding),review_fingerprint:binding,inputs:relevant.map(a=>({id:a.id,hash:a.asset_hash,source:a.source_url})),
      fidelity:'PRODUCT_VISUAL',synthetic_setting:ex.id!=='a-stock',generative_video:false,additional_contracted_cost_brl:0,paid_api_calls:0};
    reports.push(report);writeJson(path.join(OUT,ex.id+'-report.json'),report);
    if(!Object.values(checks).every(Boolean))throw new Error('TECHNICAL_QC_FAILED');
    compositions.push(AssetRecord.parse({...library.find(a=>a.id==='packshot'),id:ex.id+'-composition',source_url:'urn:marketing-os:composition:'+ex.id,
      creator:'Marketing OS deterministic renderer',license:'INTERNAL_STUDY_COMPOSITION_OF_RECORDED_SOURCES',license_version:'benchmark.v1',
      asset_hash:report.asset_hash,local_ref:report.output,bytes:statSync(file).size,kind:'VIDEO',elapsed_s:report.elapsed_s,
      synthetic:ex.id!=='a-stock',cinema:profile(ex.warm),derivation:{strategy:'PRODUCT_COMPOSITE',input_hashes:[...relevant,...library.filter(a=>['font','foley'].includes(a.id))].map(a=>a.asset_hash)}}));
    console.log(ex.id+': rendered 6s; TECHNICAL PASS; CREATIVE/HUMAN PENDING');
  }
}finally{await browser.close();}
writeJson(path.join(OUT,'library.json'),[...library,...compositions]);loadLibrary(ROOT,'.mos/universal-assets/library.json');
writeJson(path.join(OUT,'report.json'),{schema_version:'universal-assets-benchmark.v1',renderer_sha256:sha256File(fileURLToPath(import.meta.url)),elapsed_s:(Date.now()-start)/1000,
  tools:{node:process.version,ffmpeg:run(TOOLS.ffmpeg,['-version']).stdout.split('\n')[0]},samples:reports,scale:'SUSPENDED',publication:false,
  foley:{source:'https://opengameart.org/content/skippy-fish-water-sound-collection',creator:'jcpmcdonald',license:'CC0',sha256:'9a968e9083ca7979b225838c218e59d9f4da7fa5ddbd20567cd4b45a3c8814f8'}});
