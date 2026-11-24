/** Zero-dependency development/API server. Static site remains runnable without it. */
import http from 'node:http';
import {readFile,stat} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {join,extname,normalize,sep} from 'node:path';
import {calcMetrics,availableRows,geography} from './docs/app/core.js';
import {computeGrant} from './docs/app/grant.js';
import {validateNarrative} from './docs/app/narrative.js';
const site=join(fileURLToPath(new URL('.',import.meta.url)),'docs');
const port=Number(process.env.PORT)||3000;
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.json':'application/json; charset=utf-8','.css':'text/css; charset=utf-8','.png':'image/png','.svg':'image/svg+xml','.ico':'image/x-icon'};
const cache=new Map();
async function json(name){if(!cache.has(name))cache.set(name,JSON.parse(await readFile(join(site,'data',name),'utf8')));return cache.get(name)}
function send(res,code,data,type='application/json'){res.writeHead(code,{'Content-Type':type,'X-Content-Type-Options':'nosniff','Cache-Control':'no-store'});res.end(type==='application/json'?JSON.stringify(data):data)}
async function parseBody(req, maxBytes = 2048) {
 let size = 0; const chunks=[];
 for await (const chunk of req) {
  size += chunk.length;
  if (size > maxBytes) throw new Error('Request too large');
  chunks.push(chunk);
 }
 return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}
async function optionalNarrative(facts) {
 const key=process.env.NARRATIVE_API_KEY;
 const endpoint=process.env.NARRATIVE_API_URL;
 const model=process.env.NARRATIVE_MODEL;
 if(!key || !endpoint || !model)return {available:false,reason:'AI not configured'};
 const controller=new AbortController();
 const timeout=setTimeout(()=>controller.abort(),9000);
 try {
  const prompt='Write 3-5 short paragraphs suitable for a grant review. Use ONLY the numbered facts provided; EVERY sentence MUST cite relevant [F#] fact IDs. Do not invent figures, claims, causes, activities, currencies or outcomes. No markdown tables. All data are synthetic.';
  const response=await fetch(endpoint,{
   method:'POST',signal:controller.signal,headers:{'Content-Type':'application/json','Authorization':`Bearer ${key}`},
   body:JSON.stringify({model,messages:[{role:'system',content:prompt},{role:'user',content:JSON.stringify(facts)}],temperature:0,max_tokens:700})
  });
  if(!response.ok)throw new Error(`AI service HTTP ${response.status}`);
  const payload=await response.json();
  const narrative=payload?.choices?.[0]?.message?.content;
  if(typeof narrative!=='string')throw new Error('AI response has no text');
  return {available:true,narrative};
 }finally{clearTimeout(timeout)}
}
const server=http.createServer(async (req,res)=>{
 try{const url=new URL(req.url||'/',`http://${req.headers.host||'localhost'}`);
 if(url.pathname==='/api/health')return send(res,200,{status:'ok',engine:'deterministic',runtimeAI:Boolean(process.env.NARRATIVE_API_KEY && process.env.NARRATIVE_API_URL && process.env.NARRATIVE_MODEL)});
 if(url.pathname==='/api/narrative'){
  if(req.method!=='POST')return send(res,405,{error:'POST required'});
  let body;
  try{body=await parseBody(req)}catch{return send(res,400,{error:'Invalid JSON or request too large'});}
  const grant=body?.grant,month=body?.month;
  if(!/^GRANT_(AA|BB|CC)_2025$/.test(grant)||!/^2025-0[789]$/.test(month))return send(res,400,{error:'Invalid grant or month'});
  const report=computeGrant(await json('schools.json'),await json('grants.json'),await json('finance.json'),await json('media.json'),grant,month);
  try {
   const model=await optionalNarrative(report.facts);
   if(!model.available)return send(res,200,{mode:'deterministic',reason:model.reason,narrative:report.narrative,violations:[]});
   const validation=validateNarrative(model.narrative,report.facts);
   if(!validation.valid)return send(res,200,{mode:'deterministic',reason:'AI output did not pass fact checks',narrative:report.narrative,violations:validation.violations});
   return send(res,200,{mode:'ai',reason:'AI text passed structural and numeric checks',narrative:model.narrative,violations:[]});
  }catch(e){return send(res,200,{mode:'deterministic',reason:'AI service unavailable',narrative:report.narrative,violations:[]})}
 }
 if(url.pathname==='/api/summary'){
  const month=url.searchParams.get('month')||'2025-09';if(!/^2025-0[789]$/.test(month))return send(res,400,{error:'Invalid month'});
  const f={month,district:url.searchParams.get('district')||'',block:url.searchParams.get('block')||'',grade:url.searchParams.get('grade')||'all',subject:url.searchParams.get('subject')||'all'};
  if(!['all','6','7','8'].includes(f.grade)||!['all','science','math'].includes(f.subject))return send(res,400,{error:'Invalid grade/subject'});
  const rows=availableRows(await json('schools.json'),f);return send(res,200,{filters:f,metrics:calcMetrics(rows,f.grade,f.subject),districts:geography(rows,'district',f.grade,f.subject)});
 }
 if(url.pathname==='/api/grant'){
  const grant=url.searchParams.get('grant')||'GRANT_AA_2025',month=url.searchParams.get('month')||'2025-09';
  if(!/^GRANT_(AA|BB|CC)_2025$/.test(grant)||!/^2025-0[789]$/.test(month))return send(res,400,{error:'Invalid grant or month'});
  const report=computeGrant(await json('schools.json'),await json('grants.json'),await json('finance.json'),await json('media.json'),grant,month);
  return send(res,200,report);
 }
 let path=decodeURIComponent(url.pathname);if(path==='/')path='/index.html';
 const file=normalize(join(site,path));if(!file.startsWith(site+sep))return send(res,403,{error:'Forbidden'});
 try{const info=await stat(file);if(!info.isFile())return send(res,404,{error:'Not found'});}catch{return send(res,404,{error:'Not found'})}
 const body=await readFile(file);res.writeHead(200,{'Content-Type':mime[extname(file)]||'application/octet-stream','X-Content-Type-Options':'nosniff','Cache-Control':path.endsWith('.json')?'no-cache':'public,max-age=3600'});res.end(body);
 }catch(err){console.error(err);send(res,500,{error:'Server error'})}
});
server.listen(port,()=>console.log(`Chalkline running at http://localhost:${port}`));
