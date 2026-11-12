import http from 'node:http';
import path from 'node:path';
import { readFile, readdir, access } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { ROOT, DATA, projectDir, loadProject, saveProject, buildModel, validId, previewModel, loadPreview, previewDir, commitPreview, discardPreview } from './build.mjs';
import { Harness } from './harness.mjs';

const PORT=Number(process.env.PORT || 3090), HOST='127.0.0.1';
const jobs=new Map(), sessions=new Map(), busy=new Set();
function emit(job,event,data){job.events.push({event,data});for(const res of job.clients)res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);}
const harness=new Harness((method,p)=>{
  const job=[...jobs.values()].find(j=>j.sessionId===p?.sessionId && !j.done);if(!job)return;
  if(method==='session.event'){
    const e=p.event;
    if(e.type==='assistant/message'){
      const text=(e.data.message.content || []).filter(b=>b.type==='text').map(b=>b.text).join('\n');
      if(text.trim()){job.texts.push(text);emit(job,'assistant',{text});}
    }
    if(e.type==='tool/call')emit(job,'status',{text:'正在构建 CAD 实体…'});
    if(e.type==='tool/result')emit(job,'status',{text:'正在检查建模结果…'});
    if(e.type==='turn/end' && e.data.reason?.kind==='error')job.turnError=e.data.reason.error?.message || '模型请求未完成，请检查 API 状态后重试。';
  }
});
function json(res,status,data){res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});res.end(JSON.stringify(data));}
async function body(req){let text='';for await(const chunk of req){text+=chunk;if(text.length>100000)throw new Error('Request too large');}return JSON.parse(text || '{}');}
function safeError(error){return String(error.message || error).replace(/sk-[A-Za-z0-9_-]+/g,'[redacted]').slice(0,1800);}
async function createProject(title='未命名零件') {const p={id:randomUUID(),title,createdAt:new Date().toISOString(),updatedAt:new Date().toISOString(),messages:[],revisions:[],activeRevision:null};await saveProject(p);return p;}
async function runChat(job,text,revisionId){
  try {
    emit(job,'status',{text:'正在理解零件需求…'});
    const p=await loadProject(job.projectId);p.messages.push({role:'user',text,createdAt:new Date().toISOString()});await saveProject(p);
    const revision=p.revisions.find(r=>r.id===revisionId) || p.revisions.find(r=>r.id===p.activeRevision);
    let context=`应用项目 ID: ${p.id}。cad_build 必须使用这个 projectId。\n`;
    if(revision){const source=await readFile(path.join(projectDir(p.id),'revisions',revision.id,'model.py'),'utf8');context+=`当前选中版本（后续修改基于此版本）：\n参数：${JSON.stringify(revision.parameters)}\n建模脚本：\n${source}\n`;}
    if(job.newSession && p.messages.length>1)context+=`最近对话：${JSON.stringify(p.messages.slice(-9,-1))}\n`;
    await harness.prompt(job.sessionId,`${context}\n用户本次需求：\n${text}`);
    if(job.turnError)throw new Error(job.turnError);
    const latest=await loadProject(p.id);const reply=job.texts.join('\n\n') || (latest.revisions.length>p.revisions.length?'模型已生成，可以在右侧查看并继续修改。':'本次没有生成模型，请补充零件的形状和尺寸。');
    latest.messages.push({role:'assistant',text:reply,createdAt:new Date().toISOString()});await saveProject(latest);
    emit(job,'done',{project:latest});
  } catch(error){const message=safeError(error);try{const p=await loadProject(job.projectId);p.messages.push({role:'assistant',text:`本次操作未完成：${message}`,error:true,createdAt:new Date().toISOString()});await saveProject(p);}catch{}emit(job,'error',{message});}
  finally {job.done=true;busy.delete(job.projectId);for(const res of job.clients)res.end();job.clients.clear();setTimeout(()=>jobs.delete(job.id),600000).unref();}
}
const server=http.createServer(async(req,res)=>{
  try {
    if(req.headers.host!==`${HOST}:${PORT}` && req.headers.host!==`localhost:${PORT}`)return json(res,403,{error:'Invalid host'});
    const origin=req.headers.origin;
    if(origin && origin!==`http://${HOST}:${PORT}` && origin!==`http://localhost:${PORT}`)return json(res,403,{error:'Cross-origin request rejected'});
    res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Referrer-Policy','no-referrer');res.setHeader('X-Frame-Options','DENY');
    const url=new URL(req.url,`http://${HOST}:${PORT}`), parts=url.pathname.split('/').filter(Boolean);
    if(parts[0]==='api') {
      if(req.method!=='GET' && req.headers['x-cad-studio']!=='1')return json(res,403,{error:'Missing request header'});
      if(url.pathname==='/api/health') {let cad=false;try{await access(path.join(ROOT,'.venv','Scripts','python.exe'));await access(path.join(ROOT,'.venv','Lib','site-packages','cadquery','__init__.py'));cad=true;}catch{}return json(res,200,{cad,harness:!!harness.ready,provider:'DeepSeek API',model:'DeepSeek Flash',local:true});}
      if(url.pathname==='/api/projects' && req.method==='GET') {let dirs=[];try{dirs=await readdir(DATA,{withFileTypes:true});}catch{}const projects=[];for(const d of dirs){if(d.isDirectory()&&validId(d.name)){try{const p=await loadProject(d.name);projects.push({id:p.id,title:p.title,updatedAt:p.updatedAt,versions:p.revisions.length});}catch{}}}return json(res,200,projects.sort((a,b)=>b.updatedAt.localeCompare(a.updatedAt)));}
      if(url.pathname==='/api/projects' && req.method==='POST')return json(res,201,await createProject());
      if(parts[1]==='jobs' && parts[3]==='events' && req.method==='GET') {const job=jobs.get(parts[2]);if(!job)return json(res,404,{error:'任务不存在，请刷新项目。'});res.writeHead(200,{'Content-Type':'text/event-stream','Cache-Control':'no-cache','Connection':'keep-alive'});for(const e of job.events)res.write(`event: ${e.event}\ndata: ${JSON.stringify(e.data)}\n\n`);if(job.done)return res.end();job.clients.add(res);const heartbeat=setInterval(()=>res.write(': ping\n\n'),15000);req.on('close',()=>{clearInterval(heartbeat);job.clients.delete(res);});return;}
      if(parts[1]==='projects' && validId(parts[2])) {
        const id=parts[2];
        if(parts.length===3 && req.method==='GET')return json(res,200,await loadProject(id));
        if(parts[3]==='preview' && req.method==='POST'){
          if(busy.has(id))return json(res,409,{error:'当前项目仍在生成，请稍候。'});
          const b=await body(req);busy.add(id);
          try{return json(res,200,{preview:await previewModel({projectId:id,baseRevisionId:b.revisionId,parameters:b.parameters})});}
          catch(error){return json(res,422,{error:safeError(error)});}
          finally{busy.delete(id);}
        }
        if(parts[3]==='previews' && validId(parts[4])){
          const previewId=parts[4];
          if(parts[5]==='model.stl' && req.method==='GET'){
            await loadPreview(id,previewId);const data=await readFile(path.join(previewDir(id,previewId),'model.stl'));
            res.writeHead(200,{'Content-Type':'model/stl','Cache-Control':'no-store'});return res.end(data);
          }
          if(parts[5]==='commit' && req.method==='POST'){
            if(busy.has(id))return json(res,409,{error:'当前项目仍在生成，请稍候。'});
            busy.add(id);try{const revision=await commitPreview(id,previewId);return json(res,200,{revision,project:await loadProject(id)});}finally{busy.delete(id);}
          }
          if(parts.length===5 && req.method==='DELETE'){
            if(busy.has(id))return json(res,409,{error:'当前项目仍在生成，请稍候。'});
            await discardPreview(id,previewId);return json(res,200,{ok:true});
          }
        }
        if(parts[3]==='chat' && req.method==='POST'){
          if(busy.has(id))return json(res,409,{error:'当前项目仍在生成，请稍候。'});
          const b=await body(req);if(typeof b.text!=='string'||!b.text.trim()||b.text.length>12000)return json(res,400,{error:'请输入有效的零件需求（最多 12000 字）。'});
          await loadProject(id);const newSession=!sessions.has(id);if(newSession)sessions.set(id,randomUUID());
          const job={id:randomUUID(),projectId:id,sessionId:sessions.get(id),newSession,texts:[],events:[],clients:new Set(),done:false};jobs.set(job.id,job);busy.add(id);json(res,202,{jobId:job.id});void runChat(job,b.text.trim(),b.revisionId);return;
        }
        if(parts[3]==='rebuild' && req.method==='POST'){
          if(busy.has(id))return json(res,409,{error:'当前项目仍在生成，请稍候。'});
          const b=await body(req),p=await loadProject(id),r=p.revisions.find(r=>r.id===b.revisionId);if(!r)return json(res,404,{error:'版本不存在'});
          busy.add(id);try{const source=await readFile(path.join(projectDir(id),'revisions',r.id,'model.py'),'utf8');const revision=await buildModel({projectId:id,title:r.title,source,parameters:b.parameters});return json(res,200,{revision,project:await loadProject(id)});}finally{busy.delete(id);}
        }
        if(parts[3]==='revisions' && validId(parts[4]) && ['model.stl','model.step','model.py','parameters.json'].includes(parts[5]) && req.method==='GET'){
          const p=await loadProject(id);if(!p.revisions.some(r=>r.id===parts[4]))return json(res,404,{error:'版本不存在'});
          const file=path.join(projectDir(id),'revisions',parts[4],parts[5]);let data=await readFile(file);
          if(parts[5]==='model.py') {const r=p.revisions.find(r=>r.id===parts[4]);data=Buffer.from(`# Generated by 构形 CAD. Dimensions are in millimeters.\nimport cadquery as cq\nimport math\n\nparams = ${JSON.stringify(r.parameters,null,2)}\n\n${data.toString('utf8')}\n\ncq.exporters.export(result, 'model.step')\ncq.exporters.export(result, 'model.stl')\n`);}
          res.writeHead(200,{'Content-Type':parts[5].endsWith('.stl')?'model/stl':parts[5].endsWith('.step')?'model/step':'text/plain; charset=utf-8','Content-Disposition':`inline; filename="${parts[5]}"`});return res.end(data);
        }
      }
      return json(res,404,{error:'接口不存在'});
    }
    let file;
    if(url.pathname.startsWith('/vendor/three/'))file=path.join(ROOT,'node_modules','three',url.pathname.slice('/vendor/three/'.length));
    else file=path.join(ROOT,'public',url.pathname==='/'?'index.html':url.pathname);
    const allowedRoot=url.pathname.startsWith('/vendor/three/')?path.join(ROOT,'node_modules','three'):path.join(ROOT,'public');
    if(!path.resolve(file).startsWith(allowedRoot+path.sep))return json(res,403,{error:'Invalid path'});
    const mime={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.svg':'image/svg+xml'};
    const data=await readFile(file);res.writeHead(200,{'Content-Type':mime[path.extname(file)]||'application/octet-stream','Cache-Control':'no-cache'});res.end(data);
  } catch(error){json(res,error.code==='ENOENT'?404:500,{error:safeError(error)});}
});
server.listen(PORT,HOST,()=>console.log(`构形 CAD: http://${HOST}:${PORT}`));
for(const signal of ['SIGINT','SIGTERM'])process.on(signal,async()=>{server.close();await harness.close();process.exit(0);});
