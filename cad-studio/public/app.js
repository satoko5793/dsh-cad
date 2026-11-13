import {createViewer} from './viewer.js';
import {componentColor} from './viewer-math.js';
import {parameterSpecs,validateParameters} from './parameters.js';

const $=id=>document.getElementById(id);
let project=null,selectedRevision=null,pendingPreview=null,isBusy=false,stream=null,toastTimer;
let viewer=null,viewerState={parts:[],selected:-1,hovered:-1,loading:false,warning:'',explode:0,isolated:false};
const selectedComponent=()=>viewerState.parts[viewerState.selected]?.name;
async function api(url,options={}){const response=await fetch(url,{...options,headers:{'Content-Type':'application/json','X-Cad-Studio':'1',...options.headers}});const data=await response.json();if(!response.ok)throw new Error(data.error || '请求未完成');return data;}
function toast(text){$('toast').textContent=text;$('toast').hidden=false;clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('toast').hidden=true,6500);}
function setBusy(busy,text='正在生成模型…'){isBusy=busy;$('jobStatus').hidden=!busy;$('jobStatusText').textContent=text;syncControls();}
function draftParameters(){const values={};const specs=selectedRevision?parameterSpecs(selectedRevision.parameters,selectedRevision.parameterSpec):{};for(const input of document.querySelectorAll('[data-parameter]')){if(input.value.trim()===''||!Number.isFinite(Number(input.value)))throw new Error(`请填写${specs[input.dataset.parameter].label}`);values[input.dataset.parameter]=Number(input.value);}return validateParameters(values,specs);}
function changes(parameters){return selectedRevision?Object.entries(parameters).filter(([key,value])=>value!==selectedRevision.parameters[key]):[];}
function hasDraft(){return !!selectedRevision&&[...document.querySelectorAll('[data-parameter]')].some(input=>input.value.trim()===''||Number(input.value)!==selectedRevision.parameters[input.dataset.parameter]);}
function syncControls(){
  const dirty=hasDraft(),locked=isBusy||!!pendingPreview||dirty;
  $('send').disabled=locked;$('prompt').disabled=locked;$('newProject').disabled=locked;
  document.querySelectorAll('.suggestions button,.quick-edits button,.project-item,.version-item').forEach(b=>b.disabled=locked);
  document.querySelectorAll('[data-parameter]').forEach(input=>input.disabled=isBusy||!!pendingPreview);
  let error='';try{if(selectedRevision)draftParameters();}catch(e){error=e.message;}
  $('rebuild').disabled=isBusy||!!pendingPreview||!selectedRevision||!dirty||!!error;
  $('savePreview').disabled=isBusy;$('cancelPreview').disabled=isBusy;
  $('editPart').disabled=locked||!selectedComponent();$('clearPartContext').disabled=isBusy;
  $('resetParameters').hidden=!dirty||!!pendingPreview;$('resetParameters').disabled=isBusy;
  $('parameterNote').textContent=!selectedRevision?'先生成零件，再调整这里的尺寸。':pendingPreview?'检查预览，满意后保存；取消会恢复原尺寸。':error|| (dirty?`已修改 ${changes(Object.fromEntries([...document.querySelectorAll('[data-parameter]')].map(i=>[i.dataset.parameter,Number(i.value)]))).length} 项，点击“预览修改”查看效果。`:'修改尺寸后先预览，确认后再保存版本。');
  $('parameterNote').classList.toggle('invalid',!!error);
  for(const id of ['downloadStep','downloadStl','downloadSource'])$(id).disabled=!selectedRevision||!!pendingPreview||isBusy||dirty;
  const current=pendingPreview||dirty?2:selectedRevision?1:0;
  ['stepDescribe','stepView','stepEdit','stepExport'].forEach((id,index)=>{$(id).classList.toggle('current',index===current);$(id).classList.toggle('complete',index<current);});
}
function inlineText(node,text){const re=/(\*\*[^*]+\*\*|`[^`]+`)/g;let last=0;for(const match of text.matchAll(re)){node.append(document.createTextNode(text.slice(last,match.index)));const tag=match[0].startsWith('**')?'strong':'code',part=document.createElement(tag);part.textContent=match[0].slice(tag==='strong'?2:1,tag==='strong'?-2:-1);node.append(part);last=match.index+match[0].length;}node.append(document.createTextNode(text.slice(last)));}
function markdown(node,text){const lines=text.split('\n');let list=null;for(let i=0;i<lines.length;i++){const line=lines[i];if(!line.trim()){list=null;continue;}if(line.trim().startsWith('|')&&i+1<lines.length&&/^\s*\|?[\s:|-]+\|\s*$/.test(lines[i+1])){const wrap=document.createElement('div');wrap.className='markdown-table';const table=document.createElement('table');const cells=row=>row.trim().replace(/^\||\|$/g,'').split('|').map(s=>s.trim());const head=document.createElement('tr');for(const value of cells(line)){const th=document.createElement('th');inlineText(th,value);head.append(th);}table.append(head);i+=1;while(i+1<lines.length&&lines[i+1].trim().startsWith('|')){const tr=document.createElement('tr');for(const value of cells(lines[++i])){const td=document.createElement('td');inlineText(td,value);tr.append(td);}table.append(tr);}wrap.append(table);node.append(wrap);list=null;continue;}const bullet=line.match(/^\s*[-*]\s+(.+)/);if(bullet){if(!list){list=document.createElement('ul');node.append(list);}const li=document.createElement('li');inlineText(li,bullet[1]);list.append(li);continue;}list=null;const heading=line.match(/^#{1,3}\s+(.+)/),p=document.createElement(heading?'h3':'p');inlineText(p,heading?heading[1]:line);node.append(p);}}
function addMessage(role,text,error=false,componentName){if(componentName)text=`针对「${componentName}」：${text}`;const el=document.createElement('div');el.className=`message ${role}${error?' error':''}`;if(role==='assistant'){const avatar=document.createElement('div');avatar.className='assistant-avatar';avatar.textContent='✳';el.append(avatar);}const content=document.createElement('div');content.className='message-text';if(role==='assistant')markdown(content,text);else content.textContent=text;el.append(content);$('messages').append(el);$('messages').scrollTop=$('messages').scrollHeight;}
function renderMessages(){const box=$('messages');box.replaceChildren();if(!project.messages.length){const welcome=document.createElement('div');welcome.className='welcome-card';welcome.innerHTML=project.revisions.length?'<div class="assistant-avatar">✳</div><p>模型已就绪。</p><p>可以直接调整右侧尺寸，<br>或告诉我你想怎么修改这个零件。</p>':'<div class="assistant-avatar">✳</div><p>你好，我是你的 CAD 设计助手。</p><p>告诉我零件的形状和大致尺寸，<br>也可以从下面的简单示例开始。</p>';box.append(welcome);}else for(const message of project.messages)addMessage(message.role,message.text,message.error,message.componentName);$('suggestions').hidden=project.messages.length>0||project.revisions.length>0;}
async function renderProjectList(){const projects=await api('/api/projects');$('projectCount').textContent=projects.length;$('projects').replaceChildren();for(const p of projects){const button=document.createElement('button');button.className=`project-item${p.id===project?.id?' active':''}`;const icon=document.createElement('span');icon.className='project-icon';icon.textContent='◇';button.append(icon,document.createTextNode(p.title));button.title=p.title;button.onclick=()=>{if(isBusy)return toast('请等待当前建模结束。');openProject(p.id).catch(e=>toast(e.message));};$('projects').append(button);}return projects;}
function renderDetails(){const revision=pendingPreview||selectedRevision;const fields=$('parameterFields');fields.replaceChildren();$('parameterError').textContent='';if(!revision){const p=document.createElement('p');p.className='muted';p.textContent='生成后，这里会显示可修改的尺寸。';fields.append(p);}else {const specs=parameterSpecs(revision.parameters,revision.parameterSpec);for(const [key,value] of Object.entries(revision.parameters)){const spec=specs[key],field=document.createElement('div');field.className='parameter-field';const title=document.createElement('label');title.textContent=spec.label;title.htmlFor=`parameter-${key}`;const wrap=document.createElement('div');wrap.className='parameter-input';const input=document.createElement('input');input.type='number';input.step=String(spec.step);input.value=value;input.dataset.parameter=key;input.id=`parameter-${key}`;input.title=spec.label;if(spec.min!==undefined)input.min=String(spec.min);if(spec.max!==undefined)input.max=String(spec.max);const unit=document.createElement('span');unit.textContent=spec.unit;wrap.append(input,unit);input.oninput=()=>{field.classList.toggle('changed',Number(input.value)!==selectedRevision.parameters[key]);$('parameterError').textContent='';syncControls();};field.append(title,wrap);if(spec.min!==undefined||spec.max!==undefined){const hint=document.createElement('small');hint.className='parameter-range';hint.textContent=spec.min!==undefined&&spec.max!==undefined?`${spec.min}–${spec.max} ${spec.unit}`:spec.min!==undefined?`最小 ${spec.min} ${spec.unit}`:`最大 ${spec.max} ${spec.unit}`;field.append(hint);}fields.append(field);}}
  $('versionCount').textContent=`${project.revisions.length} 个版本`;$('versionList').replaceChildren();if(!project.revisions.length){const p=document.createElement('p');p.className='muted';p.textContent='每次成功建模都会保存一个版本。';$('versionList').append(p);}for(let i=project.revisions.length-1;i>=0;i--){const r=project.revisions[i],button=document.createElement('button');button.className=`version-item${r.id===revision?.id?' active':''}`;const number=document.createElement('span');number.className='version-number';number.textContent=`V${i+1}`;const details=document.createElement('span');details.className='version-detail';const strong=document.createElement('strong');strong.textContent=r.title;const small=document.createElement('small');small.textContent=new Date(r.createdAt).toLocaleString('zh-CN',{month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit'});details.append(strong,small);const check=document.createElement('span');check.className='version-check';check.textContent=r.id===revision?.id?'✓':'↗';button.append(number,details,check);button.onclick=()=>{if(isBusy)return toast('请等待当前建模结束。');selectRevision(r);};$('versionList').append(button);}
  for(const id of ['downloadStep','downloadStl','downloadSource'])$(id).disabled=!revision;$('rebuild').disabled=isBusy||!revision;
  $('projectTitle').textContent=project.title;$('versionBadge').textContent=pendingPreview?'修改预览 · 尚未保存':revision?`版本 ${project.revisions.findIndex(r=>r.id===revision.id)+1} · 已保存`:'尚未生成';
  $('previewReview').hidden=!pendingPreview;$('quickEdits').hidden=!selectedRevision;$('conversationTitle').textContent=selectedRevision?'接下来，想改哪里？':'先说说，你想做什么？';
  $('prompt').placeholder=selectedRevision?'例如：孔径改成 8 mm，其他尺寸保持不变…':'例如：做一个长 80、宽 40、厚 5 mm 的安装板…';
  if(pendingPreview){const specs=parameterSpecs(selectedRevision.parameters,selectedRevision.parameterSpec);$('previewChanges').textContent=changes(pendingPreview.parameters).map(([key,value])=>`${specs[key].label}：${selectedRevision.parameters[key]} → ${value} ${specs[key].unit}`).join('；');}
  $('modelInfo').hidden=!revision;$('emptyState').hidden=!!revision;
  $('geometryDetails').hidden=!revision;
  const components=revision?.geometry.components||[];
  $('componentPanel').hidden=!components.length;
  $('componentHeading').textContent=`模型模块 · ${components.length} 个`;
  $('componentList').replaceChildren();
  for(const [index,component] of components.entries()){
    const item=document.createElement('li'),button=document.createElement('button');button.type='button';button.dataset.component=String(index);button.className='component-card';button.setAttribute('aria-pressed','false');
    const dot=document.createElement('span');dot.className='part-dot';dot.style.background=componentColor(component.name);
    const text=document.createElement('span'),name=document.createElement('strong'),detail=document.createElement('small');name.textContent=component.name;detail.textContent=`${component.size.join(' × ')} mm · ${component.solids} 个实体`;text.append(name,detail);button.append(dot,text);
    button.onpointerenter=()=>viewer?.hover(index);button.onpointerleave=()=>viewer?.hover(-1);button.onfocus=()=>viewer?.hover(index);button.onblur=()=>viewer?.hover(-1);button.onclick=()=>viewer?.select(index);item.append(button);$('componentList').append(item);
  }
  if(revision){const g=revision.geometry;$('geometryMeasurements').textContent=`外形：${g.size.join(' × ')} mm\n体积：${g.volume} mm³\n表面积：${g.area} mm²\n`+(g.cylindricalSurfaces||[]).map((s,i)=>`圆柱面 ${i+1}：Ø${s.diameter}，中心 (${s.center.join(', ')}) mm`).join('\n');}
  if(revision){$('modelName').textContent=revision.title;$('modelSize').textContent=revision.geometry.size.map(v=>Number(v.toFixed(2))).join(' × ')+' mm';$('geometrySummary').textContent=`${pendingPreview?'预览已通过几何检查':'模型已保存'} · ${(revision.geometry.volume/1000).toFixed(2)} cm³`;}else $('geometrySummary').textContent='等待第一个设计';
  syncControls();
  syncViewerUI();
}
function fileUrl(revision,file){return `/api/projects/${project.id}/revisions/${revision.id}/${file}`;}
async function selectRevision(revision){selectedRevision=revision;pendingPreview=null;renderDetails();await showModel(revision?fileUrl(revision,'model.stl'):null);}
async function openProject(id){project=await api(`/api/projects/${id}`);localStorage.setItem('cad-studio-project',id);const url=new URL(location.href);url.searchParams.set('project',id);history.replaceState(null,'',url);renderMessages();await selectRevision(project.revisions.find(r=>r.id===project.activeRevision)||project.revisions.at(-1)||null);await renderProjectList();}
async function newProject(){if(isBusy)return;const p=await api('/api/projects',{method:'POST',body:'{}'});await openProject(p.id);$('prompt').focus();}
$('newProject').onclick=()=>newProject().catch(e=>toast(e.message));
document.querySelectorAll('[data-prompt]').forEach(button=>button.onclick=()=>{$('prompt').value=button.dataset.prompt;$('prompt').focus();});
document.querySelectorAll('[data-edit]').forEach(button=>button.onclick=()=>{if(isBusy||pendingPreview||hasDraft())return;$('prompt').value=button.dataset.edit;$('prompt').focus();});
$('editDimensions').onclick=()=>{$('parameterFields').scrollIntoView({behavior:'smooth',block:'center'});document.querySelector('[data-parameter]')?.focus({preventScroll:true});};
$('prompt').addEventListener('keydown',e=>{if(e.key==='Enter'&&!e.shiftKey&&!e.isComposing){e.preventDefault();$('chatForm').requestSubmit();}});
$('chatForm').onsubmit=async event=>{event.preventDefault();const text=$('prompt').value.trim();if(!text||isBusy||pendingPreview||hasDraft())return;const pid=project.id,componentName=selectedComponent();setBusy(true,'正在理解零件需求…');$('prompt').value='';$('suggestions').hidden=true;addMessage('user',text,false,componentName);
  try{const {jobId}=await api(`/api/projects/${pid}/chat`,{method:'POST',body:JSON.stringify({text,revisionId:selectedRevision?.id,componentName})});stream=new EventSource(`/api/jobs/${jobId}/events`);
    stream.addEventListener('status',e=>{$('jobStatusText').textContent=JSON.parse(e.data).text;});
    stream.addEventListener('assistant',e=>addMessage('assistant',JSON.parse(e.data).text));
    stream.addEventListener('done',async e=>{stream.close();stream=null;project=JSON.parse(e.data).project;$('chatConnection').textContent='已连接';setBusy(false);renderMessages();await selectRevision(project.revisions.find(r=>r.id===project.activeRevision)||selectedRevision);await renderProjectList();});
    stream.addEventListener('error',async e=>{if(!stream)return;stream.close();stream=null;const message=e.data?JSON.parse(e.data).message:'连接中断。任务可能仍在执行，请稍后重新打开项目查看。';setBusy(false);toast(message);try{await openProject(pid);}catch{};});
  }catch(error){setBusy(false);toast(error.message);await openProject(pid);}
};
$('rebuild').onclick=async()=>{if(!selectedRevision||isBusy||pendingPreview||!hasDraft())return;let parameters;try{parameters=draftParameters();}catch(error){return toast(error.message);}setBusy(true,'正在预览新尺寸，原版本保持不变…');$('parameterError').textContent='';try{const data=await api(`/api/projects/${project.id}/preview`,{method:'POST',body:JSON.stringify({revisionId:selectedRevision.id,parameters})});pendingPreview=data.preview;renderDetails();await showModel(`/api/projects/${project.id}/previews/${pendingPreview.id}/model.stl`);}catch(error){$('parameterError').textContent='这组尺寸无法生成有效实体，请检查孔径、厚度和边距。原版本已保留。';console.error(error);}finally{setBusy(false);}};
$('resetParameters').onclick=()=>{if(!isBusy&&!pendingPreview)renderDetails();};
$('cancelPreview').onclick=async()=>{if(!pendingPreview||isBusy)return;const preview=pendingPreview;setBusy(true,'正在恢复原尺寸…');try{await api(`/api/projects/${project.id}/previews/${preview.id}`,{method:'DELETE'});pendingPreview=null;renderDetails();await showModel(fileUrl(selectedRevision,'model.stl'));toast('已取消修改，原版本没有变化。');}catch(error){toast(error.message);}finally{setBusy(false);}};
$('savePreview').onclick=async()=>{if(!pendingPreview||isBusy)return;setBusy(true,'正在保存新版本…');try{const data=await api(`/api/projects/${project.id}/previews/${pendingPreview.id}/commit`,{method:'POST',body:'{}'});project=data.project;await selectRevision(data.revision);await renderProjectList();toast('新版本已保存，可以继续修改或下载。');}catch(error){toast(error.message);}finally{setBusy(false);}};
function download(file){if(!selectedRevision||pendingPreview||isBusy||hasDraft())return;const a=document.createElement('a');a.href=fileUrl(selectedRevision,file);a.download=`${project.title}-${file}`;a.click();for(const id of ['stepDescribe','stepView','stepEdit']){$(id).classList.remove('current');$(id).classList.add('complete');}$('stepExport').classList.add('current');}
$('downloadStep').onclick=()=>download('model.step');$('downloadStl').onclick=()=>download('model.stl');$('downloadSource').onclick=()=>download('model.py');

function syncViewerUI(){
  const state=viewerState,chosen=state.parts[state.selected],active=state.parts[state.hovered]||chosen;
  $('componentToolbar').hidden=state.parts.length<2;
  $('explodeRange').value=String(Math.round(state.explode*100));$('explodeValue').textContent=`${Math.round(state.explode*100)}%`;
  $('assembleView').disabled=state.explode===0;
  $('componentFocusBar').hidden=!(pendingPreview||selectedRevision)?.geometry.components?.length;
  $('focusPartName').textContent=active?`${state.hovered>=0?'正在指向':'已选中'} · ${active.name}`:'指向模型或下方名称，查看对应组件';
  $('focusPartDetail').textContent=active?`${active.size.join(' × ')} mm${chosen&&state.hovered>=0&&state.hovered!==state.selected?` · 修改对象：${chosen.name}`:''}`:'';
  $('focusPartDot').hidden=!active;if(active)$('focusPartDot').style.background=componentColor(active.name);
  $('isolatePart').disabled=!chosen;$('isolatePart').textContent=state.isolated?'显示全部':'只看选中';$('isolatePart').setAttribute('aria-pressed',String(state.isolated));
  $('editPart').textContent=chosen?'修改选中组件 ↗':'修改这个组件 ↗';
  $('clearPart').disabled=!chosen;
  $('partContext').hidden=!chosen;$('partContextName').textContent=chosen?`本次修改对象：${chosen.name}`:'';
  if(chosen)$('prompt').placeholder=`想怎么修改「${chosen.name}」？例如：把这个零件厚一点…`;
  else if(selectedRevision)$('prompt').placeholder='例如：孔径改成 8 mm，其他尺寸保持不变…';
  document.querySelectorAll('[data-component]').forEach(button=>{const i=Number(button.dataset.component);button.disabled=!state.parts[i];button.classList.toggle('hovered',i===state.hovered);button.classList.toggle('selected',i===state.selected);button.setAttribute('aria-pressed',String(i===state.selected));});
  $('viewerNotice').hidden=!state.loading&&!state.warning;$('viewerNotice').textContent=state.loading?'正在准备组件视图…':state.warning;
  syncControls();
}
try{viewer=createViewer({canvas:$('canvas'),viewport:$('viewport'),onChange:state=>{viewerState=state;syncViewerUI();},onError:toast});}
catch(error){toast('无法初始化三维视图，请确认浏览器支持 WebGL。');console.error(error);}
async function showModel(url){await viewer?.load(url?.replace(/model\.stl$/,'viewer'),url);}
$('resetView').onclick=()=>viewer?.fit();
function setWire(value){viewer?.setWire(value);$('wireView').classList.toggle('active',value);$('solidView').classList.toggle('active',!value);}
$('solidView').onclick=()=>setWire(false);$('wireView').onclick=()=>setWire(true);
$('explodeRange').oninput=event=>viewer?.setExplode(Number(event.target.value)/100);
$('explodeRange').onchange=()=>viewer?.fit();
$('assembleView').onclick=()=>{viewer?.setExplode(0);viewer?.fit();};
$('isolatePart').onclick=()=>viewer?.isolate(!viewerState.isolated);
$('clearPart').onclick=$('clearPartContext').onclick=()=>viewer?.select(-1);
$('editPart').onclick=()=>{if(!selectedComponent()||isBusy||pendingPreview||hasDraft())return;$('prompt').scrollIntoView({behavior:'smooth',block:'center'});$('prompt').focus({preventScroll:true});};
window.addEventListener('focus',()=>{if(!isBusy)renderProjectList().catch(error=>toast(error.message));});
try{const health=await api('/api/health');$('engineStatus').textContent=health.cad?'● CAD 引擎就绪':'◌ CAD 引擎安装中';if(health.harness)$('chatConnection').textContent='已连接';const list=await renderProjectList(),linked=new URL(location.href).searchParams.get('project'),saved=localStorage.getItem('cad-studio-project'),preferred=list.some(p=>p.id===linked)?linked:saved;if(preferred&&list.some(p=>p.id===preferred))await openProject(preferred);else if(list.length)await openProject(list[0].id);else await newProject();}catch(error){toast(error.message);$('engineStatus').textContent='服务连接失败';}
