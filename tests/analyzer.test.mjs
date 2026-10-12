import test from 'node:test';
import assert from 'node:assert/strict';
import { analyzeSources, publicUrl, sanitizeSvg, fetchPublic } from '../lib/analyzer.ts';
import { demoHtml } from '../lib/demo.ts';
test('sample extracts source-grounded colors, fonts, icons, components and mobile query',()=>{
  const r=analyzeSources(demoHtml,[],'https://stylelens.chatgpt.site/demo');
  assert.ok(r.colors.some(c=>c.value==='#ED6429'));
  assert.ok(r.colors.some(c=>c.value==='#272D35'));
  assert.ok(r.fonts.some(f=>f.value.includes('Arial')));
  assert.equal(r.icons.length,3);assert.ok(r.components.some(c=>c.name==='Input'));
  assert.ok(r.breakpoints.some(b=>b.value.includes('768px')));
  assert.ok(r.colors.every(c=>c.evidence.length&&c.role==='Unassigned'));
});
test('rejects loopback, credentials, private IPv4/IPv6, unsafe protocol, custom port',()=>{
  for(const u of ['http://127.0.0.1','http://2130706433','http://0x7f000001','http://[::1]','http://localhost','http://foo.local','https://user:secret@site.com','file:///tmp/foo','https://website.com:3000'])assert.throws(()=>publicUrl(u));
  assert.equal(publicUrl('example.org').href,'https://example.org/');
});
test('SVG sanitizer strips executable, external, embedded and CSS payloads',()=>{
  const s=sanitizeSvg('<svg viewBox="0 0 24 24" onload="alert(1)"><script>fetch("secret")</script><foreignObject>bad</foreignObject><image href="https://evil.com"/><path d="M1 1L10 10" style="background:url(https://evil.com)" onclick="alert(1)" fill="url(https://evil.com)"/></svg>');
  assert.ok(s);assert.doesNotMatch(s,/script|onload|onclick|foreignObject|https:\/\/evil|url\(/i);assert.match(s,/<path/);
});
test('source metadata separates media/theme conditions and resolves base variables',()=>{
  const r=analyzeSources('<html><title>Test</title><body><style>:root{--accent:rgb(10 100 200)}.btn{color:var(--accent);border-radius:12px}@media(max-width:600px){.btn{font-size:14px;color:#ff0000}}@font-face{font-family:Example;src:url(a.woff)}</style></body></html>',[],'https://site.com/');
  assert.ok(r.colors.some(c=>c.value==='#0A64C8'));
  assert.ok(r.colors.find(c=>c.value==='#FF0000').evidence[0].condition.includes('@media'));
  assert.ok(r.fonts.some(f=>f.value==='Example'));assert.ok(r.radii.some(f=>f.value==='12px'));
});
test('redirects cannot turn an allowed URL into a private request',async()=>{
  const original=globalThis.fetch;
  globalThis.fetch=async u=>String(u).includes('dns-query')?Response.json({Status:0,Answer:[{type:1,data:'93.184.216.34'}]}):new Response('',{status:302,headers:{location:'http://127.0.0.1/'}});
  try{await assert.rejects(()=>fetchPublic('https://site.com/'),/공개/);}finally{globalThis.fetch=original;}
});
