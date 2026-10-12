import { analyzeUrl } from '../lib/analyzer.ts';
const url=process.argv[2]||'https://www.w3.org/';
try{const r=await analyzeUrl(url);console.log(JSON.stringify({url:r.url,colors:r.colors.length,fonts:r.fonts.length,icons:r.icons.length,components:r.components.length,stylesheets:r.stats.stylesheets,failed:r.sources.filter(s=>s.status!=='읽음').length,elapsedMs:r.stats.elapsedMs}));if(!r.colors.length)process.exitCode=1;}catch(e){console.error(e.message);process.exitCode=1;}
