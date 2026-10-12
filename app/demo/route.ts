import { demoHtml } from '@/lib/demo';
export function GET(){return new Response(demoHtml,{headers:{'Content-Type':'text/html; charset=utf-8'}});}
