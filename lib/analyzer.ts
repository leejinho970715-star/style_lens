import { load } from 'cheerio/slim';
import parse from 'css-tree/parser';
import walk from 'css-tree/walker';
import generate from 'css-tree/generator';
import type { CssNode } from 'css-tree';
// Use the portable parser parts; the full lexer reads Node-only JSON files.
const css = { parse, walk, generate };
import { parse as parseColor, formatHex, formatHex8 } from 'culori';

export type Evidence = { source: string; selector: string; property: string; value: string; condition: string };
export type ColorToken = { value: string; count: number; role: string; label: string; evidence: Evidence[]; edited?: boolean };
export type ValueToken = { value: string; count: number; evidence: Evidence[] };
export type IconAsset = { name: string; svg: string; kind: string; source: string; stroke: string; fill: string };
export type ComponentAsset = { name: string; selector: string; source: string; condition: string; declarations: Record<string,string> };
export type GuideReport = {
  version: 1; url: string; title: string; analyzedAt: string; method: 'html-css';
  colors: ColorToken[]; fonts: ValueToken[]; fontSizes: ValueToken[]; fontWeights: ValueToken[]; lineHeights: ValueToken[];
  radii: ValueToken[]; shadows: ValueToken[]; spacing: ValueToken[]; breakpoints: ValueToken[];
  icons: IconAsset[]; iconLibraries: string[]; components: ComponentAsset[];
  variables: { name: string; value: string; source: string; condition: string }[];
  sources: { url: string; kind: string; status: string }[]; warnings: string[];
  stats: { stylesheets: number; declarations: number; svgFound: number; elapsedMs: number };
};

export function publicUrl(raw: string): URL {
  const u = new URL(raw.includes('://') ? raw : 'https://' + raw);
  if (!['https:', 'http:'].includes(u.protocol) || u.username || u.password || (u.port && !['80','443'].includes(u.port))) throw new Error('공개된 HTTP 또는 HTTPS 웹사이트 주소를 입력해주세요.');
  const host = u.hostname.toLowerCase().replace(/\.$/, '');
  if (!host.includes('.') || /[\[\]:]/.test(host) || /^[\d.]+$/.test(host) || /(^|\.)(localhost|local|internal|lan|test|invalid|example|home|onion)$/.test(host) || host.endsWith('.localhost')) throw new Error('공개 도메인의 웹사이트만 분석할 수 있어요.');
  u.hash = ''; u.hostname = host;
  return u;
}

function privateAddress(ip: string) {
  if (ip.includes(':')) return /^(::|fc|fd|fe[89ab]|ff|2001:db8)/i.test(ip) || /::ffff:/i.test(ip);
  const [a,b] = ip.split('.').map(Number);
  return a === 0 || a === 10 || a === 127 || a >= 224 || (a === 169 && b === 254) || (a === 172 && b >=16 && b<=31) || (a===192 && [0,168].includes(b)) || (a===100 && b>=64 && b<=127) || (a===198 && [18,19,51].includes(b)) || (a===203 && b===0);
}

export async function checkPublicHost(host: string) {
  const answers = await Promise.all(['A','AAAA'].map(async type => {
    const res = await fetch('https://cloudflare-dns.com/dns-query?name='+encodeURIComponent(host)+'&type='+type, { headers: { accept:'application/dns-json' }, signal:AbortSignal.timeout(4500) });
    if(!res.ok) throw new Error('도메인 확인에 실패했어요. 잠시 후 다시 시도해주세요.');
    const data = await res.json() as { Status: number; Answer?: { type: number; data: string }[] };
    if(data.Status !== 0) return [];
    return (data.Answer || []).filter(a=>[1,28].includes(a.type)).map(a=>a.data);
  }));
  const ips=answers.flat();
  if(!ips.length || ips.some(privateAddress)) throw new Error('외부에서 접근 가능한 공개 웹사이트 주소인지 확인해주세요.');
}

export async function fetchPublic(raw: string, limit=900_000, accepted='text') {
  let u=publicUrl(raw);
  for(let step=0;step<4;step++) {
    await checkPublicHost(u.hostname);
    const r=await fetch(u.href, { redirect:'manual', signal:AbortSignal.timeout(8000), headers:{'User-Agent':'StyleLens/1.0 (public website style analysis)','Accept':accepted==='html'?'text/html,application/xhtml+xml':'text/css,image/svg+xml,text/plain;q=0.8'} });
    if([301,302,303,307,308].includes(r.status)) { const location=r.headers.get('location'); if(!location)throw new Error('이동할 주소를 확인할 수 없어요.'); u=publicUrl(new URL(location,u).href); continue; }
    if(!r.ok) throw new Error(r.status===403?'사이트에서 외부 접근을 제한하고 있어요. 다른 공개 페이지를 시도해주세요.':`사이트 응답을 받지 못했어요 (HTTP ${r.status}).`);
    const type=r.headers.get('content-type') || '';
    if(accepted==='html' && !/html/i.test(type)) throw new Error('웹페이지 URL을 입력해주세요. 파일 주소는 분석할 수 없어요.');
    if(/application\/(pdf|octet-stream)|image\/(png|jpeg|webp)/i.test(type)) throw new Error('분석 가능한 텍스트 자료가 아니에요.');
    if(Number(r.headers.get('content-length')||0)>limit) throw new Error('자료 크기가 분석 한도를 초과했어요.');
    const reader=r.body?.getReader();if(!reader)throw new Error('빈 응답을 받았어요.');
    const decoder=new TextDecoder();let text='',size=0;
    try { while(true){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>limit)throw new Error('자료 크기가 분석 한도를 초과했어요.');text+=decoder.decode(value,{stream:true});} text+=decoder.decode(); } finally { await reader.cancel().catch(()=>{}); }
    return { text, url:u.href };
  }
  throw new Error('주소 이동이 너무 많아 분석을 중단했어요. 최종 페이지 주소를 입력해주세요.');
}

export function sanitizeSvg(raw: string): string | null {
  if(raw.length>65_000) return null;
  const $=load(raw,{xmlMode:true});const root=$('svg').first();if(!root.length)return null;
  const tags=new Set(['svg','g','path','circle','ellipse','rect','line','polyline','polygon','title','desc']);
  const attrs=new Set(['viewbox','d','cx','cy','r','rx','ry','x','y','x1','y1','x2','y2','points','width','height','fill','stroke','stroke-width','stroke-linecap','stroke-linejoin','fill-rule','clip-rule','opacity','transform','xmlns']);
  root.find('*').each((_,e)=>{if(!tags.has(e.tagName.toLowerCase()))$(e).remove();});
  root.add(root.find('*')).each((_,e)=>{ for(const [k,v] of Object.entries(e.attribs||{})) { if(!attrs.has(k.toLowerCase()) || /url\s*\(|javascript:|data:|https?:|[<>]/i.test(v) || v.length>10_000)$(e).removeAttr(k); }});
  root.attr('xmlns','http://www.w3.org/2000/svg');root.attr('width','48');root.attr('height','48');
  if(!root.attr('viewBox') && !root.attr('viewbox')) root.attr('viewBox','0 0 24 24');
  if(!root.find('path,circle,rect,line,ellipse,polygon,polyline').length)return null;
  return $.xml(root);
}

type Decl = Evidence;
export function analyzeSources(html: string, sheets: {text:string;url:string}[], url: string): GuideReport {
  const $=load(html);const warnings:string[]=[];const declarations:Decl[]=[];const variables:GuideReport['variables']=[];const media:ValueToken[]=[];
  const all=[...sheets];$('style').each((i,e)=>{all.push({text:$(e).text(),url:url+'#inline-style-'+(i+1)});});
  let parseFailures=0;
  function parseSheet(text:string,source:string,context:'stylesheet'|'declarationList'='stylesheet',inlineSelector='[style]') {
    if(text.length>900_000)return;
    try {const ast=css.parse(text,{context,parseValue:true,parseCustomProperty:true});let selector=inlineSelector;const conditions:string[]=[];const previous:string[]=[];
      css.walk(ast,{ enter(node:CssNode) {
        if(node.type==='Rule'){previous.push(selector);selector=node.prelude?css.generate(node.prelude).slice(0,220):inlineSelector;}
        if(node.type==='Atrule'){const pre=node.prelude?css.generate(node.prelude):'';conditions.push('@'+node.name+' '+pre);if(node.name==='media' && media.length<40)media.push({value:pre,count:1,evidence:[{source,selector:'@media',property:'media',value:pre,condition:pre}]});}
        if(node.type==='Declaration' && declarations.length<16000){const value=css.generate(node.value).slice(0,360);const d={source,selector,property:node.property.toLowerCase(),value,condition:conditions.join(' · ').slice(0,300)};declarations.push(d);if(d.property.startsWith('--')&&variables.length<160)variables.push({name:d.property,value:d.value,source,condition:d.condition});}
      },leave(node:CssNode){if(node.type==='Rule')selector=previous.pop()||inlineSelector;if(node.type==='Atrule')conditions.pop();}});
    } catch {parseFailures++;}
  }
  all.slice(0,20).forEach(s=>parseSheet(s.text,s.url));
  $('[style]').slice(0,700).each((i,e)=>parseSheet($(e).attr('style')||'',url+'#inline-attribute-'+(i+1),'declarationList',e.tagName+(e.attribs.id?'#'+e.attribs.id:'')));
  const vars=new Map(variables.filter(v=>!v.condition).map(v=>[v.name,v.value]));
  function resolve(value:string){for(let i=0;i<4;i++)value=value.replace(/var\(\s*(--[\w-]+)\s*(?:,\s*([^()]+))?\)/g,(m,k,f)=>vars.get(k)||f||m);return value;}
  const colors=new Map<string,ColorToken>();
  for(const d of declarations){if(!/(color|background|border|shadow|fill|stroke|outline)$/.test(d.property)&&!d.property.startsWith('--'))continue;let value=resolve(d.value);let candidates:string[]=[];
    try {const ast=css.parse(value,{context:'value'});css.walk(ast,n=>{if(n.type==='Hash')candidates.push('#'+n.value);else if(n.type==='Identifier')candidates.push(n.name);else if(n.type==='Function'&&/^(rgba?|hsla?|hwb|lab|lch|oklab|oklch|color)$/i.test(n.name))candidates.push(css.generate(n));});}catch{}
    for(const candidate of new Set(candidates)){const c=parseColor(candidate);if(!c||(c.alpha??1)===0)continue;const hex=((c.alpha??1)<1?formatHex8(c):formatHex(c))?.toUpperCase();if(!hex)continue;const t=colors.get(hex)||{value:hex,count:0,role:'Unassigned',label:'',evidence:[]};t.count++;if(t.evidence.length<5)t.evidence.push(d);colors.set(hex,t);if(colors.size>500)break;}
  }
  function tokens(properties:string[],cap=20){const m=new Map<string,ValueToken>();for(const d of declarations){if(!properties.includes(d.property)||d.condition.includes('@font-face'))continue;const value=resolve(d.value);if(/^(initial|inherit|unset|revert|none|normal)$/.test(value))continue;const t=m.get(value)||{value,count:0,evidence:[]};t.count++;if(t.evidence.length<3)t.evidence.push(d);m.set(value,t);}return [...m.values()].sort((a,b)=>b.count-a.count).slice(0,cap);}
  const fonts=tokens(['font-family'],12);
  // @font-face names are evidence of declared fonts even when a stylesheet only uses shorthand.
  for(const d of declarations.filter(d=>d.property==='font-family'&&d.condition.includes('@font-face'))){if(fonts.length>=12)break;if(!fonts.some(f=>f.value===d.value))fonts.push({value:d.value,count:1,evidence:[d]});}
  const icons:IconAsset[]=[];const svgFound=$('svg').length;let stripped=0;
  $('svg').slice(0,30).each((i,e)=>{const svg=sanitizeSvg($.html(e));if(!svg){stripped++;return;}if(icons.some(a=>a.svg===svg))return;const name=($(e).attr('aria-label')||$(e).find('title').text()||$(e).attr('id')||'Inline SVG '+(i+1)).slice(0,90);icons.push({name,svg,kind:'Inline SVG',source:url,stroke:$(e).attr('stroke-width')||$(e).find('[stroke-width]').first().attr('stroke-width')||'미지정',fill:$(e).attr('fill')||$(e).find('[fill]').first().attr('fill')||'미지정'});});
  const scan=html+'\n'+sheets.map(s=>s.text).join('\n');const fingerprints=[['Font Awesome',/fontawesome|font-awesome|fa-solid|fa-brands/i],['Material Icons',/material-icons|material-symbols/i],['Lucide',/lucide[- ]|data-lucide/i],['Bootstrap Icons',/bootstrap-icons|\bbi bi-/i],['Heroicons',/heroicons/i]] as const;
  const iconLibraries=fingerprints.filter(([,r])=>r.test(scan)).map(([name])=>name+' 표식 발견');
  const components:ComponentAsset[]=[];const allowed=['background','background-color','color','border','border-color','border-radius','box-shadow','padding','font-size','font-weight','line-height','height','gap'];
  const grouped=new Map<string,ComponentAsset>();
  for(const d of declarations){if(!allowed.includes(d.property)||d.condition.includes('@font-face'))continue;let kind='';if(/button|\.btn\b|\[.*role.*button/i.test(d.selector))kind='Button';else if(/input|textarea|select|\.form-control/i.test(d.selector))kind='Input';else if(/\.card\b|\.panel\b/i.test(d.selector))kind='Card';else if(/\b(h[1-6])\b/i.test(d.selector))kind='Heading';if(!kind)continue;const k=d.source+'|'+d.selector+'|'+d.condition;const c=grouped.get(k)||{name:kind,selector:d.selector,source:d.source,condition:d.condition,declarations:{}};c.declarations[d.property]=resolve(d.value);grouped.set(k,c);}
  for(const c of grouped.values()){if(Object.keys(c.declarations).length>1)components.push(c);if(components.length>=12)break;}
  if(parseFailures)warnings.push(`${parseFailures}개 스타일 자료를 완전히 읽지 못했어요.`);
  if(stripped)warnings.push('외부 참조나 복잡한 SVG는 안전한 아이콘 미리보기에서 제외했어요.');
  warnings.push('공개 HTML·CSS의 선언값 분석입니다. JavaScript 실행 후 화면, 실제 사용 빈도, Hover 상태와 Font의 실제 로딩 여부는 확인하지 않습니다.');
  if($('script').length>4&&$('body').text().trim().length<300)warnings.push('동적으로 구성되는 페이지라 분석 자료가 부족할 수 있어요.');
  if(!colors.size)warnings.push('추출할 수 있는 색상을 찾지 못했어요. 이 사이트의 동적 스타일이나 외부 자료를 읽지 못했을 수 있습니다.');
  if(declarations.length>=16000)warnings.push('큰 사이트라 처음 16,000개 스타일 선언까지만 분석했어요.');
  return {version:1,url,title:($('head > title').first().text()||new URL(url).hostname).trim().slice(0,150),analyzedAt:new Date().toISOString(),method:'html-css',colors:[...colors.values()].sort((a,b)=>b.count-a.count).slice(0,24),fonts,fontSizes:tokens(['font-size']),fontWeights:tokens(['font-weight'],10),lineHeights:tokens(['line-height'],10),radii:tokens(['border-radius'],12),shadows:tokens(['box-shadow'],8),spacing:tokens(['gap','padding','margin','row-gap','column-gap'],16),breakpoints:media.filter((t,i,a)=>a.findIndex(v=>v.value===t.value)===i),icons:icons.slice(0,16),iconLibraries,components,variables,sources:[],warnings,stats:{stylesheets:sheets.length,declarations:declarations.length,svgFound,elapsedMs:0}};
}

export async function analyzeUrl(raw:string):Promise<GuideReport> {
  const started=Date.now();const main=await fetchPublic(raw,1_300_000,'html');const $=load(main.text);const urls:string[]=[];
  $('link[rel]').each((_,e)=>{if(!/\bstylesheet\b/i.test($(e).attr('rel')||''))return;try{const u=publicUrl(new URL($(e).attr('href')||'',main.url).href).href;if(!urls.includes(u))urls.push(u);}catch{}});
  const sourceStatus:GuideReport['sources']=[{url:main.url,kind:'HTML',status:'읽음'}];const sheets:{text:string;url:string}[]=[];
  // Fetch in batches: bounded connections, bytes, imports and CPU.
  for(let i=0;i<Math.min(urls.length,8);i+=4){const result=await Promise.allSettled(urls.slice(i,i+4).map(u=>fetchPublic(u,350_000)));result.forEach((r,j)=>{if(r.status==='fulfilled'){sheets.push(r.value);sourceStatus.push({url:r.value.url,kind:'CSS',status:'읽음'});}else sourceStatus.push({url:urls[i+j],kind:'CSS',status:'읽지 못함'});});}
  const imports:string[]=[];for(const s of sheets.slice(0,8)){for(const match of s.text.matchAll(/@import\s+(?:url\(\s*)?["']([^"']+)["']/g)){try{const u=publicUrl(new URL(match[1],s.url).href).href;if(!urls.includes(u)&&!imports.includes(u))imports.push(u);}catch{}}}
  for(const u of imports.slice(0,3)){if(Date.now()-started>22_000){sourceStatus.push({url:u,kind:'CSS @import',status:'시간 한도로 제외'});continue;}try{const s=await fetchPublic(u,250_000);sheets.push(s);sourceStatus.push({url:s.url,kind:'CSS @import',status:'읽음'});}catch{sourceStatus.push({url:u,kind:'CSS @import',status:'읽지 못함'});}}
  const report=analyzeSources(main.text,sheets,main.url);report.sources=sourceStatus;
  const ext:string[]=[];$('img[src]').each((_,e)=>{const src=$(e).attr('src')||'';if(!/\.svg(?:[?#]|$)/i.test(src))return;try{const u=publicUrl(new URL(src,main.url).href).href;if(!ext.includes(u))ext.push(u);}catch{}});
  for(const u of ext.slice(0,3)){if(Date.now()-started>30_000){sourceStatus.push({url:u,kind:'SVG',status:'시간 한도로 제외'});continue;}try{const s=await fetchPublic(u,60_000);const svg=sanitizeSvg(s.text);if(svg){report.icons.push({name:decodeURIComponent(new URL(u).pathname.split('/').pop()||'External SVG'),svg,kind:'SVG image',source:u,stroke:'원본 참조',fill:'원본 참조'});sourceStatus.push({url:u,kind:'SVG',status:'읽음'});}}catch{sourceStatus.push({url:u,kind:'SVG',status:'읽지 못함'});}}
  if(urls.length>8)report.warnings.push(`외부 CSS ${urls.length}개 중 앞의 8개와 일부 @import를 분석했어요.`);
  if(sourceStatus.some(s=>s.status!=='읽음'))report.warnings.push('일부 외부 자료를 읽지 못해 분석 결과가 불완전할 수 있어요. Sources에서 확인해주세요.');
  if(!report.icons.length)report.warnings.push('미리보기 가능한 SVG 아이콘을 찾지 못했어요. CSS 아이콘, 이미지 스프라이트, 동적 아이콘은 포함되지 않을 수 있습니다.');
  report.stats.elapsedMs=Date.now()-started;return report;
}
