import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,writeFileSync,rmSync} from 'node:fs';
import os from 'node:os';import path from 'node:path';
import {AssetRecord,Scene,dimensions} from '../src/universal-assets/contracts.ts';
import {routeScene,resolveScene,executableCapability} from '../src/universal-assets/router.ts';
import {factoryAssets,assertFactoryBinding} from '../src/universal-assets/factory.ts';
import {verifyRecord,hashBytes,confinedFile} from '../src/universal-assets/library.ts';
import {StockSearch} from '../src/universal-assets/stock.ts';

const now=new Date('2026-10-08T12:00:00Z'), h='a'.repeat(64), proof='b'.repeat(64);
const cinema=Object.fromEntries(dimensions.map(k=>[k,'warm-still']));
const scene=(extra={})=>Scene.parse({id:'counter',brand_id:'grand',product_id:'soap',product_version:'1',category:'laundry',language:'pt',format:'9:16',
  use:'INTERNAL_STUDY',fidelity:'GENERIC_VISUAL',kind:'IMAGE',claim_ids:[],approved_claim_ids:[],query:'laundry counter',cinema,
  min_quality:.6,min_realism:.6,min_match:.7,max_elapsed_s:120,previous_asset_hash:null,allowed_strategies:['EXISTING_LICENSED','STOCK_SEARCH','SYNTHETIC_IMAGE','IMAGE_TO_VIDEO','PRODUCT_COMPOSITE','APPROVED_REUSE'],campaign_asset_hashes:[],...extra});
const asset=(extra={})=>AssetRecord.parse({id:'counter-image',source_url:'https://www.pexels.com/photo/1/',creator:'Author',license:'Pexels',license_version:'snapshot-2026-10-08',
  retrieval_date:'2026-10-08T00:00:00Z',allowed_use:['INTERNAL_STUDY','ADVERTISEMENT'],asset_hash:h,local_ref:'.mos/asset.png',bytes:10,kind:'IMAGE',proof_ref:'.mos/license.json',proof_hash:proof,
  rights_verified:true,redistribute_original:false,retention_until:null,product_relevance:.8,quality_score:.8,realism_score:.9,
  fidelity:'GENERIC_VISUAL',synthetic:false,faceless_verified:true,scope:null,evidence:null,approval:null,cost_brl:0,elapsed_s:2,
  tags:{category:['laundry'],use:['background'],scenario:['home'],aesthetic:['warm'],audience:['household'],language:['neutral'],format:['9:16'],compatibility:['soap']},cinema,derivation:null,...extra});
const candidate=(extra={})=>({asset:asset(extra),strategy:'EXISTING_LICENSED' as const});
const capability=(extra={})=>({id:'cloud',strategy:'SYNTHETIC_IMAGE',status:'LIMITED_FREE',cloud:true,commercial_license_verified:true,additional_cost_brl:0,
  quota_verified:true,remaining_calls:1,max_elapsed_s:60,expires_at:'2026-10-09T00:00:00Z',evidence_url:'https://example.com/terms',...extra});
test('router is deterministic; metadata changes invalidate factory replay',()=>{
  const p=factoryAssets('VIDEO',[scene()],[candidate()],now);
  assert.equal(p.status,'STUDY_READY');assert.deepEqual(p,factoryAssets('VIDEO',[scene()],[candidate()],now));
  assert.equal(assertFactoryBinding(p,[scene()],[candidate()],now).length,1);
  assert.throws(()=>assertFactoryBinding(p,[scene()],[candidate({quality_score:.7})],now),/STALE/);
});
test('license, time, budget, retention and faceless unknowns fail closed',()=>{
  for(const extra of [{rights_verified:false},{cost_brl:null},{cost_brl:.01},{elapsed_s:null},{elapsed_s:121},{faceless_verified:false},
    {allowed_use:['ADVERTISEMENT']},{retention_until:'2026-10-07T00:00:00Z'},{quality_score:.2},{realism_score:.1}])
    assert.equal(routeScene(scene(),[candidate(extra)],now).status,'REJECTED');
});
test('generic stock cannot prove GRAND, and AI cannot become real demonstration',()=>{
  assert.equal(routeScene(scene({fidelity:'REAL_DEMONSTRATION'}),[candidate()],now).status,'REJECTED');
  assert.equal(routeScene(scene({claim_ids:['clean'],approved_claim_ids:['clean']}),[candidate()],now).status,'REJECTED');
  assert.throws(()=>asset({synthetic:true,fidelity:'REAL_DEMONSTRATION',scope:{brand_id:'grand',product_id:'soap',product_version:'1'}}),/SYNTHETIC/);
});
test('exact product/version and claim evidence are required for verified results',()=>{
  const a=asset({fidelity:'VERIFIED_RESULT',scope:{brand_id:'grand',product_id:'soap',product_version:'1'},evidence:{source_url:'https://example.com/report',proof_ref:'.mos/report.json',proof_hash:proof,verified:true,claim_ids:['clean']}});
  const s=scene({fidelity:'VERIFIED_RESULT',claim_ids:['clean'],approved_claim_ids:['clean']});
  assert.equal(routeScene(s,[{asset:a,strategy:'EXISTING_LICENSED'}],now).status,'STUDY_READY');
  for(const extra of [{brand_id:'other'},{product_version:'2'},{claim_ids:['stain'],approved_claim_ids:['stain']},{approved_claim_ids:[]}])
    assert.equal(routeScene(scene({...s,...extra}),[{asset:a,strategy:'EXISTING_LICENSED'}],now).status,'REJECTED');
});
test('cinematic fit beats keywords; missing cinematic analysis cannot earn a match',()=>{
  const bad=asset({id:'keyword-laundry',quality_score:1,cinema:Object.fromEntries(dimensions.map(k=>[k,null]))});
  const p=routeScene(scene(),[candidate(),{asset:bad,strategy:'EXISTING_LICENSED'}],now);
  assert.equal(p.selected?.asset.id,'counter-image');assert.ok(p.ranked.find(x=>x.asset.id===bad.id)?.reasons.includes('CINEMATIC_MISMATCH'));
});
test('campaign reuse requires approval bound to bytes AND brand/product/version',()=>{
  const s=scene({allowed_strategies:['APPROVED_REUSE']});
  assert.equal(routeScene(s,[{asset:asset(),strategy:'APPROVED_REUSE'}],now).status,'REJECTED');
  const approved=asset({approval:{reviewer:'Human',asset_hash:h,scope:{brand_id:'grand',product_id:'soap',product_version:'1'}}});
  assert.equal(routeScene(s,[{asset:approved,strategy:'APPROVED_REUSE'}],now).status,'STUDY_READY');
  assert.equal(routeScene(scene({...s,product_id:'another'}),[{asset:approved,strategy:'APPROVED_REUSE'}],now).status,'REJECTED');
});
test('unverified, paid, expired, local GPU and quota exhausted capabilities never execute',()=>{
  for(const extra of [{status:'NOT_TESTED'},{status:'PAID_ONLY'},{additional_cost_brl:null},{additional_cost_brl:.01},
    {quota_verified:false},{remaining_calls:0},{cloud:false},{commercial_license_verified:false},{expires_at:'2026-10-07T00:00:00Z'}])
    assert.equal(executableCapability(capability(extra),scene(),now),false);
});
test('acquisition materializes before READY and verifies bytes; no duplicate route retries',async()=>{
  let calls=0;
  const ports={existing:async()=>[],acquire:async()=>{calls++;return [{asset:asset({synthetic:true}),strategy:'SYNTHETIC_IMAGE' as const}];},verify:async()=>false};
  assert.equal((await resolveScene(scene(),[capability(),capability()],ports,now)).status,'REJECTED');assert.equal(calls,1);
  const p=await resolveScene(scene(),[capability()],{...ports,verify:async()=>true},now);
  assert.equal(p.status,'STUDY_READY');assert.equal(p.scale,'SUSPENDED');assert.equal(p.human_approval,'PENDING');
});
test('factory ports isolate campaigns and never grant publication for any consumer',()=>{
  for(const c of ['STATIC','VIDEO','FACELESS','SELLER','AFFILIATE'] as const)assert.equal(factoryAssets(c,[scene()],[candidate()],now).publication,false);
  assert.throws(()=>factoryAssets('SELLER',[scene(),scene({id:'other',brand_id:'other'})],[candidate()],now),/SCOPE/);
});
test('synthetic product imagery requires authentic source composition, never invented packaging',()=>{
  const scope={brand_id:'grand',product_id:'soap',product_version:'1'};
  assert.throws(()=>asset({synthetic:true,fidelity:'PRODUCT_VISUAL',scope}),/AUTHENTIC/);
  const original=asset({id:'packshot',fidelity:'PRODUCT_VISUAL',scope});
  const composed=asset({id:'composed',asset_hash:'c'.repeat(64),synthetic:true,fidelity:'PRODUCT_VISUAL',scope,
    derivation:{strategy:'PRODUCT_COMPOSITE',input_hashes:[h]}});
  const s=scene({fidelity:'PRODUCT_VISUAL',allowed_strategies:['PRODUCT_COMPOSITE']});
  assert.equal(routeScene(s,[{asset:composed,strategy:'PRODUCT_COMPOSITE'}],now).status,'REJECTED');
  assert.equal(routeScene(s,[{asset:composed,strategy:'PRODUCT_COMPOSITE'},{asset:original,strategy:'EXISTING_LICENSED'}],now).status,'STUDY_READY');
});
test('replay rechecks rights expiry even when snapshot fingerprint is unchanged',()=>{
  const c=candidate({retention_until:'2026-10-09T00:00:00Z'}),p=factoryAssets('STATIC',[scene()],[c],now);
  assert.throws(()=>assertFactoryBinding(p,[scene()],[c],new Date('2026-10-10T00:00:00Z')),/STALE_OR_BLOCKED/);
});
test('composition source chain cannot be bypassed by labeling output existing or approved',()=>{
  const scope={brand_id:'grand',product_id:'soap',product_version:'1'}, original=asset({id:'packshot',fidelity:'PRODUCT_VISUAL',scope});
  const composed=asset({id:'composed',asset_hash:'c'.repeat(64),synthetic:true,fidelity:'PRODUCT_VISUAL',scope,derivation:{strategy:'PRODUCT_COMPOSITE',input_hashes:[h]}});
  const s=scene({fidelity:'PRODUCT_VISUAL'});
  assert.equal(routeScene(s,[{asset:composed,strategy:'EXISTING_LICENSED'}],now).status,'REJECTED');
  assert.equal(routeScene(s,[{asset:composed,strategy:'EXISTING_LICENSED'},{asset:original,strategy:'EXISTING_LICENSED'}],now).status,'STUDY_READY');
});
test('duplicate IDs and unsupported strategies are invalid boundaries',()=>{
  assert.throws(()=>routeScene(scene(),[candidate(),candidate()],now),/DUPLICATE/);
  assert.throws(()=>routeScene(scene(),[{asset:asset(),strategy:'UNVERIFIED' as never}],now),/./);
});
test('registry checks exact bytes, license proof, limits and path traversal',()=>{
  const root=mkdtempSync(path.join(os.tmpdir(),'mos-asset-'));
  try {
    writeFileSync(path.join(root,'asset.png'),'image');writeFileSync(path.join(root,'license.json'),'proof');
    const a=asset({local_ref:'asset.png',proof_ref:'license.json',bytes:5,asset_hash:hashBytes('image'),proof_hash:hashBytes('proof')});
    assert.equal(verifyRecord(root,a).bytes,5);assert.throws(()=>verifyRecord(root,a,4),/STORAGE/);
    assert.throws(()=>confinedFile(root,'../escape'),/./);assert.throws(()=>confinedFile(root,'C:/Users/local'),/./);
    writeFileSync(path.join(root,'license.json'),'changed');assert.throws(()=>verifyRecord(root,a),/HASH/);
  }finally{rmSync(root,{recursive:true,force:true});}
});
test('official stock search fails without credentials and requires a human request',async()=>{
  const client=new StockSearch({}, {get:()=>undefined,put:()=>{}},async()=>{throw new Error('must not call');});
  const q={provider:'PIXABAY',query:'laundry',kind:'IMAGE',language:'pt',human_request:true};
  assert.equal((await client.search(q)).status,'NO_AUTH');await assert.rejects(client.search({...q,human_request:false}));
});
test('official API preserves credits, cache 24h, limits queries and redacts failure secrets',async()=>{
  let calls=0;const cache=new Map();
  const client=new StockSearch({PEXELS:'secret-test-only'}, {get:k=>cache.get(k),put:(k,v)=>cache.set(k,v)},async()=>{
    calls++;return new Response(JSON.stringify({photos:[{id:1,url:'https://www.pexels.com/photo/1/',photographer:'Author',src:{large2x:'https://images.pexels.com/a.jpg'},width:1080,height:1920}]}));},()=>now.getTime());
  const q={provider:'PEXELS',query:'laundry',kind:'IMAGE',language:'pt',human_request:false};
  assert.equal((await client.search(q)).hits[0]?.creator,'Author');assert.equal((await client.search(q)).cached,true);assert.equal(calls,1);
  const bad=new StockSearch({PIXABAY:'do-not-log-me'},{get:()=>undefined,put:()=>{}},async()=>{throw new Error('do-not-log-me');});
  assert.equal(JSON.stringify(await bad.search({...q,provider:'PIXABAY',human_request:true})).includes('do-not-log-me'),false);
  for(let i=0;i<10;i++)await client.search({...q,query:'different-'+i});assert.equal((await client.search({...q,query:'another'})).status,'RATE_LIMITED');
});
test('search cache expires after 24h and hostile download hosts are rejected',async()=>{
  let time=now.getTime(),calls=0;const cache=new Map();
  const q={provider:'PIXABAY',query:'laundry',kind:'IMAGE',language:'pt',human_request:true};
  const client=new StockSearch({PIXABAY:'test-key'},{get:k=>cache.get(k),put:(k,v)=>cache.set(k,v)},async()=>{
    calls++;return new Response(JSON.stringify({hits:[{id:1,pageURL:'https://pixabay.com/photos/1/',user:'Creator',largeImageURL:'https://cdn.pixabay.com/a.jpg',imageWidth:1080,imageHeight:1920}]}));},()=>time);
  await client.search(q);time+=86400000;await client.search(q);assert.equal(calls,2);
  const hostile=new StockSearch({PIXABAY:'test-key'},{get:()=>undefined,put:()=>{}},async()=>new Response(JSON.stringify({hits:[{id:1,pageURL:'https://pixabay.com/photos/1/',user:'Creator',largeImageURL:'https://localhost/a.jpg',imageWidth:1080,imageHeight:1920}]})));
  assert.equal((await hostile.search(q)).status,'PROVIDER_UNAVAILABLE');
});
