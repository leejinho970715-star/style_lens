import { analyzeUrl, analyzeSources } from '@/lib/analyzer';
import { demoHtml } from '@/lib/demo';
import { SITE_ORIGIN, PAGES_ORIGIN } from '@/lib/site-config';
const recent=new Map<string,{start:number;count:number}>();
function headers(request:Request){const origin=request.headers.get('origin');const allowed=[SITE_ORIGIN,PAGES_ORIGIN,new URL(request.url).origin];return {'Cache-Control':'no-store','Vary':'Origin',...(origin&&allowed.includes(origin)?{'Access-Control-Allow-Origin':origin,'Access-Control-Allow-Methods':'POST, OPTIONS','Access-Control-Allow-Headers':'Content-Type'}:{})};}
export function OPTIONS(request:Request){return new Response(null,{status:204,headers:headers(request)});}
export async function POST(request:Request) {
  const h=headers(request),origin=request.headers.get('origin');
  const json=(value:unknown,status=200)=>Response.json(value,{status,headers:h});
  if(origin&&![SITE_ORIGIN,PAGES_ORIGIN,new URL(request.url).origin].includes(origin))return json({error:'StyleLens 페이지에서 다시 요청해주세요.'},403);
  if(Number(request.headers.get('content-length')||0)>4096)return json({error:'요청이 너무 커요.'},413);
  const ip=request.headers.get('cf-connecting-ip')||'local',now=Date.now();
  const previous=recent.get(ip);const counter=previous&&now-previous.start<60000?previous:{start:now,count:0};
  if(counter.count>=12)return json({error:'요청이 많아요. 1분 뒤 다시 시도해주세요.'},429);
  counter.count++;if(recent.size>1000)recent.clear();recent.set(ip,counter);
  try {
    const reader=request.body?.getReader();if(!reader)throw new Error('웹사이트 URL을 입력해주세요.');let bytes=0;let body='';const decoder=new TextDecoder();
    try{while(true){const {done,value}=await reader.read();if(done)break;bytes+=value.byteLength;if(bytes>4096)throw new Error('요청이 너무 커요.');body+=decoder.decode(value,{stream:true});}body+=decoder.decode();}finally{await reader.cancel().catch(()=>{});}
    const {url}=JSON.parse(body) as {url?:unknown};if(typeof url!=='string'||url.length>2000||!url.trim())throw new Error('웹사이트 URL을 입력해주세요.');
    let target:URL;try{const trimmed=url.trim();target=new URL(trimmed.includes('://')?trimmed:'https://'+trimmed);}catch{throw new Error('웹사이트 주소를 올바르게 입력해주세요. 예: https://website.com');}
    let report;
    if([SITE_ORIGIN,new URL(request.url).origin].includes(target.origin)&&target.pathname==='/demo'){report=analyzeSources(demoHtml,[],target.href);report.sources=[{url:target.href,kind:'샘플 HTML · Inline CSS',status:'읽음'}];}
    else{report=await analyzeUrl(target.href);}
    return json(report);
  }catch(e){return json({error:e instanceof Error?e.message:'분석 중 오류가 발생했어요. 다른 페이지를 시도해주세요.'},422);}
}
