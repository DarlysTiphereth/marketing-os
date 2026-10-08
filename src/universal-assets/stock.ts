import {z} from 'zod';

const Request = z.object({provider:z.enum(['PEXELS','PIXABAY']), query:z.string().trim().min(1).max(100),
  kind:z.enum(['IMAGE','VIDEO']), language:z.string().regex(/^[a-z]{2}$/), human_request:z.boolean()}).strict().superRefine((q,ctx)=>{
    if(q.provider==='PIXABAY'&&!q.human_request)ctx.addIssue({code:'custom',message:'PIXABAY_HUMAN_REQUEST_REQUIRED'});
  });
const HttpUrl = z.string().url().refine(s=>{const u=new URL(s);return u.protocol==='https:'&&!u.username&&!u.password&&!u.searchParams.has('key');});
const SearchHit = z.object({id:z.string(), source_url:HttpUrl, creator:z.string().min(1), download_url:HttpUrl,
  width:z.number().int().positive(),height:z.number().int().positive()}).strict();
export type SearchHitT=z.infer<typeof SearchHit>;
export type SearchCache={get:(key:string)=>{at:number;hits:SearchHitT[]}|undefined;put:(key:string,value:{at:number;hits:SearchHitT[]})=>void};
const allowedDownload=(s:string,p:'PEXELS'|'PIXABAY')=>{const u=new URL(s);return u.protocol==='https:' && !u.username && !u.password &&
  (p==='PEXELS'?['videos.pexels.com','images.pexels.com'].includes(u.hostname):['pixabay.com','cdn.pixabay.com'].includes(u.hostname));};

// Bounded official queries and 24h cache; Pixabay additionally requires a human query. No scraping.
// Credentials live only in a closure; response bodies/errors/URLs with keys never reach callers or logs.
export class StockSearch {
  private calls=new Map<string,number>();
  private keys:Partial<Record<'PEXELS'|'PIXABAY',string>>;
  private cache:SearchCache;
  private http:typeof fetch;
  private clock:()=>number;
  constructor(keys:Partial<Record<'PEXELS'|'PIXABAY',string>>,cache:SearchCache,
    http:typeof fetch=fetch,clock:()=>number=Date.now) {this.keys=keys;this.cache=cache;this.http=http;this.clock=clock;}
  async search(input:unknown) {
    const q=Request.parse(input), key=JSON.stringify(q), now=this.clock(), cached=this.cache.get(key);
    if(cached && now>=cached.at && now-cached.at<86400000) return {status:'SEARCH_REVIEW_REQUIRED' as const,hits:cached.hits.map(h=>SearchHit.parse(h)),cached:true};
    const credential=this.keys[q.provider];
    if(!credential) return {status:'NO_AUTH' as const,hits:[],cached:false};
    // Conservatively cap this process to 10/hour/provider; API 429 is final, never retried or bypassed.
    const bucket=q.provider+':'+Math.floor(now/3600000), count=this.calls.get(bucket)??0;
    if(count>=10) return {status:'RATE_LIMITED' as const,hits:[],cached:false};
    this.calls.set(bucket,count+1);
    const url=new URL(q.provider==='PEXELS' ? (q.kind==='VIDEO'?'https://api.pexels.com/videos/search':'https://api.pexels.com/v1/search') :
      (q.kind==='VIDEO'?'https://pixabay.com/api/videos/':'https://pixabay.com/api/'));
    url.searchParams.set(q.provider==='PEXELS'?'query':'q',q.query);url.searchParams.set('per_page','5');
    if(q.provider==='PIXABAY'){url.searchParams.set('key',credential);url.searchParams.set('lang',q.language);url.searchParams.set('safesearch','true');}
    else {url.searchParams.set('locale',q.language);url.searchParams.set('orientation','portrait');}
    try {
      const response=await this.http(url,{headers:q.provider==='PEXELS'?{Authorization:credential}:{},redirect:'error',signal:AbortSignal.timeout(15000)});
      if(response.status===429) return {status:'RATE_LIMITED' as const,hits:[],cached:false};
      if(!response.ok) return {status:'PROVIDER_UNAVAILABLE' as const,hits:[],cached:false};
      const reader=response.body?.getReader();if(!reader) throw new Error();
      let size=0;const chunks:Uint8Array[]=[];
      for(;;){const r=await reader.read();if(r.done)break;size+=r.value.length;if(size>500000){await reader.cancel();throw new Error();}chunks.push(r.value);}
      const data=z.record(z.unknown()).parse(JSON.parse(Buffer.concat(chunks).toString('utf8')));
      const rows=z.array(z.record(z.unknown())).max(5).parse(data[q.provider==='PEXELS'?(q.kind==='VIDEO'?'videos':'photos'):'hits']);
      const hits=rows.map(row=>{
        let source:unknown,creator:unknown,file:unknown,width:unknown,height:unknown;
        if(q.provider==='PEXELS'){
          source=row.url;creator=z.object({name:z.string()}).parse(row.user??{name:row.photographer}).name;
          if(q.kind==='VIDEO'){
            const choices=z.array(z.object({link:z.string(),width:z.number(),height:z.number(),file_type:z.string()})).parse(row.video_files)
              .filter(f=>f.file_type==='video/mp4'&&f.width<=1920&&f.height<=1920).sort((a,b)=>b.width*b.height-a.width*a.height);
            const f=choices[0];if(!f)throw new Error();file=f.link;width=f.width;height=f.height;
          }else{file=z.object({large2x:z.string()}).parse(row.src).large2x;width=row.width;height=row.height;}
        }else{
          source=row.pageURL;creator=row.user;
          if(q.kind==='VIDEO'){const f=z.object({url:z.string(),width:z.number(),height:z.number()}).parse(z.record(z.unknown()).parse(row.videos).medium);file=f.url;width=f.width;height=f.height;}
          else{file=row.largeImageURL;width=row.imageWidth;height=row.imageHeight;}
        }
        const h=SearchHit.parse({id:String(row.id),source_url:source,creator,download_url:file,width,height});
        const page=new URL(h.source_url);
        if(!allowedDownload(h.download_url,q.provider)||!(q.provider==='PEXELS'?['www.pexels.com','pexels.com']:['pixabay.com']).includes(page.hostname))throw new Error();
        return h;
      });
      this.cache.put(key,{at:now,hits});
      return {status:'SEARCH_REVIEW_REQUIRED' as const,hits,cached:false};
    }catch{return {status:'PROVIDER_UNAVAILABLE' as const,hits:[],cached:false};}
  }
}
