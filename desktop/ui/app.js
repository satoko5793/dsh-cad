/* No Node access here. All native actions go through the narrow preload API. */
import {FollowLatest} from './scroll.mjs';
const $=id=>document.getElementById(id);
let current=null,renderedMessages='',attachmentKey='',draftTimer,callBusy=false;
const followLatest=new FollowLatest($('messages'),$('latest'));
new ResizeObserver(()=>followLatest.changed()).observe($('messages'));
const messageNodes=new Map();
function formattedText(text){
  const fragment=document.createDocumentFragment();
  // Construct DOM nodes only: model HTML and local image paths never become markup.
  text=text.replace(/!\[[^\]]*\]\([^\n]*\)/g,'（截图见 CAD 观察面板）');
  for(const [index,line] of text.split('\n').entries()){
    if(index)fragment.append(document.createElement('br'));
    const clean=line.replace(/^#{1,4}\s+/,'').replace(/^[-*]\s+/,'• ');
    for(const part of clean.split(/(\*\*[^*]+\*\*|`[^`]+`)/g)){
      if(part.startsWith('**')&&part.endsWith('**')){const strong=document.createElement('strong');strong.textContent=part.slice(2,-2);fragment.append(strong);}
      else if(part.startsWith('`')&&part.endsWith('`')){const code=document.createElement('code');code.textContent=part.slice(1,-1);fragment.append(code);}
      else fragment.append(document.createTextNode(part));
    }
  }
  return fragment;
}
async function call(method,payload){
  try{const result=await window.harness.call(method,payload);if(result?.ok===false)throw Error(result.error);return result;}
  catch(error){$('error').textContent=error.message;$('error').hidden=false;return null;}
}
function showMessages(messages){
  const key=JSON.stringify(messages);if(key===renderedMessages)return;renderedMessages=key;
  const container=$('messages');
  if(messages.length)container.querySelector('.welcome')?.remove();
  for(const [id,node] of messageNodes)if(!messages.some(m=>m.id===id)){node.remove();messageNodes.delete(id);}
  if(!messages.length){const welcome=document.createElement('div');welcome.className='welcome';const title=document.createElement('h2');title.textContent='你想做点什么？';const note=document.createElement('p');note.textContent='连接 FreeCAD，创建可继续修改的原生多零件设计。';const examples=document.createElement('div');examples.className='examples';for(const text of ['做一个带盖控制盒','做一个小龙门架','生成一个简化飞机']){const button=document.createElement('button');button.className='example';button.textContent=text;button.onclick=()=>{$('draft').value=text;void call('draft',text);$('draft').focus();};examples.append(button);}welcome.append(title,note,examples);container.append(welcome);}
  for(const message of messages){
    let item=messageNodes.get(message.id);
    if(!item){item=document.createElement('article');item.className='message '+(message.role==='user'?'user':'assistant');const author=document.createElement('div');author.className='message-author';author.textContent=message.role==='user'?'你':'构形';item.append(author,document.createElement('div'));messageNodes.set(message.id,item);container.append(item);if(message.role==='user')followLatest.follow=true;}
    const key=JSON.stringify(message);if(item._key===key)continue;item._key=key;
    const content=item.lastChild,opened=new Set([...content.querySelectorAll('details[open]')].map(n=>n.dataset.key));content.replaceChildren();
    const paragraph=text=>{const p=document.createElement('p');p.className='message-text';if(message.role==='user')p.textContent=text;else p.append(formattedText(text));content.append(p);};
    const details=(key,title,text,kind,state)=>{const d=document.createElement('details');d.className=kind;d.dataset.key=key;d.dataset.state=state||'';d.open=opened.has(key);const summary=document.createElement('summary');summary.textContent=title;const pre=document.createElement('pre');pre.textContent=text;d.append(summary,pre);content.append(d);};
    const toolsShown=new Set();
    const toolCard=(id,block={})=>{const t=message.tools?.find(t=>t.id===id)||{},name=t.name||block.name||'工具',label=({freecad_inspect:'读取工程',freecad_capture:'观察 CAD',freecad_propose:'准备操作计划',skill_read:'加载技能'})[name]||name,status=({running:'执行中',done:'已返回',error:'失败',interrupted:'已中断'})[t.state]||(message.streaming?'准备中':'已结束');details('tool-'+id,`${status} · ${label}`,`${name}\n输入\n${typeof t.arguments==='object'?JSON.stringify(t.arguments,null,2):t.arguments||block.arguments||''}\n\n结果\n${t.result||'等待工具返回'}`,'tool-card',t.state);toolsShown.add(id);};
    if(message.attempts?.length){for(const a of message.attempts){if(a.state==='abandoned'){details(a.id,'已中断的输出',Object.values(a.blocks).filter(b=>b.type==='text').map(b=>b.text).join('\n'),'attempt-abandoned');continue;}for(const [index,b] of Object.entries(a.blocks)){if(b.type==='text'&&b.text)paragraph(b.text);if(b.type==='reasoning'&&b.text)details(a.id+'-'+index,'思考 · 模型提供的内容',b.text,'reasoning');if(b.type==='tool-call')toolCard(b.id,b);}}}
    else if(message.text)paragraph(message.text);
    for(const t of message.tools||[])if(!toolsShown.has(t.id))toolCard(t.id);
    if(message.streaming){const status=document.createElement('div');status.className='stream-status';status.textContent=message.tools?.some(t=>t.state==='running')?'正在使用工具…':message.attempts?.length?'正在生成…':'正在连接模型…';content.append(status);}
    if(message.interrupted)paragraph('本轮已中断，已生成内容保留。');
  }
  followLatest.changed();
}
function render(state){
  current=state;document.body.classList.toggle('compact',state.window.small);
  $('app-version').textContent=state.app?.version?`CAD 助手 · v${state.app.version}`:'CAD 助手 · 开发版';
  $('toggle').textContent=state.window.small?'展开':'缩为小窗';$('toggle').setAttribute('aria-expanded',String(!state.window.small));
  $('pin').hidden=!state.window.small;$('pin').textContent=state.window.pinned?'已置顶':'置顶';$('pin').setAttribute('aria-pressed',String(state.window.pinned));
  showMessages(state.messages);
  // Polling never overwrites a draft under the user's cursor or changes focus.
  if(document.activeElement!==$('draft')&&$('draft').value!==state.draft)$('draft').value=state.draft;
  const c=state.context,doc=c.document,selections=c.selection||[];
  $('sidebar-connection').textContent=c.connected?`已连接 · ${(c.version||[]).join('.')} · ${c.instance?.slice(0,6)||''}`:'尚未连接';
  const upgrade=c.connected&&(c.protocol!==2||!c.capabilities?.includes('displayed_view'));
  $('connect').disabled=c.connected&&!upgrade;$('connect').textContent=upgrade?'升级连接':'连接 FreeCAD';$('compact-connect').hidden=c.connected&&!upgrade;$('compact-connect').textContent=upgrade?'升级':'连接';
  $('focus-cad').hidden=!c.connected||upgrade;$('open').disabled=!c.connected||upgrade;
  $('connection-dot').classList.toggle('connected',c.connected);
  $('context-document').textContent=c.connected?(doc?.label||'FreeCAD 已连接 · 无活动工程'):'尚未连接 CAD';
  const selectionText=selections.length?selections.map(s=>(findComponent(s.object,doc?.components||[])?.name||s.object)+(s.subelements.length?' / '+s.subelements.join(', '):'')).join('、'):'未选择对象';
  $('context-selection').textContent=c.connected?selectionText:'连接后会读取活动工程与选择';
  $('inspector-title').textContent=c.connected?(doc?.label||'无活动工程'):'等待连接';
  $('cad-version').textContent='FreeCAD '+(c.version||[]).join('.');$('document-file').textContent=c.connected?(doc?.file||'尚未保存'):'—';
  $('selection-detail').textContent=c.connected?selectionText:'—';$('diameter-label').textContent=doc?.components?'原生零件':'原生孔径';$('diameters').textContent=c.connected&&doc?.components?`${doc.components.length} 个 · 每件实体已检查`:c.connected&&doc?.diameters?doc.diameters.map(v=>Number(v.toFixed(3))).join(' / ')+' mm':'—';
  $('save').disabled=!c.connected||!doc?.owned||['planning','executing','uncertain'].includes(state.phase);
  $('plan').hidden=!state.plan;$('plan-description').textContent=state.plan?.description||'';
  $('confirm').disabled=state.phase!=='ready';$('pause').disabled=!['ready','paused'].includes(state.phase);$('pause').textContent=state.phase==='paused'?'继续':'暂停';$('cancel').disabled=state.phase==='executing';
  $('cancel-running').hidden=state.phase!=='planning';
  $('send').disabled=['preparing','planning','executing','uncertain'].includes(state.phase)||callBusy;
  $('status').textContent=state.status;$('shortcut').textContent=state.window.shortcut.includes('失败')?state.window.shortcut:state.window.shortcut+' 呼出';
  $('model-name').textContent=state.model.name;
  const busy=['preparing','planning','executing','uncertain'].includes(state.phase);
  $('capture').disabled=!c.connected||upgrade||busy;
  $('settings-save').disabled=busy;$('skill-import').disabled=busy;
  const observation=state.observation;$('observation-panel').hidden=!observation;
  if(observation){if($('observation-image').src!==observation.dataUrl)$('observation-image').src=observation.dataUrl;$('observation-caption').textContent=`CAD 观察 · ${observation.document} · ${observation.view} · ${new Date(observation.time*1000).toLocaleTimeString()}`;$('observation-note').textContent=(observation.fingerprint===c.fingerprint?'当前工程':'工程已变化，截图仅作历史参考')+' · '+(observation.source==='user'?'手动预览，未发送给模型':observation.vision?'已提供图片给模型':'模型未声明图片输入能力');}
  const nextKey=JSON.stringify(state.attachments);if(nextKey!==attachmentKey){attachmentKey=nextKey;$('attachments').replaceChildren();for(const a of state.attachments){const chip=document.createElement('span');chip.className='attachment';chip.textContent=a.name+' · 未解析';$('attachments').append(chip);}}
  renderDetails(state);
}
async function send(){const text=$('draft').value.trim();if(!text||callBusy)return;followLatest.jump();clearTimeout(draftTimer);$('error').hidden=true;callBusy=true;$('send').disabled=true;await call('draft',text);const result=await call('send',text);if(result?.ok)$('draft').value='';callBusy=false;if(current)render(current);}
$('send').onclick=send;$('draft').addEventListener('keydown',event=>{if(event.key==='Enter'&&!event.shiftKey&&!event.isComposing){event.preventDefault();void send();}});
$('draft').addEventListener('input',()=>{clearTimeout(draftTimer);const text=$('draft').value;draftTimer=setTimeout(()=>void call('draft',text),200);});
$('draft').addEventListener('blur',()=>{clearTimeout(draftTimer);void call('draft',$('draft').value);});
for(const [id,method] of [['pin','pin'],['minimize','minimize'],['close','close'],['connect','connect'],['compact-connect','connect'],['save','save'],['attach','attach'],['pause','pause'],['cancel','cancel'],['cancel-running','cancel'],['open','open'],['focus-cad','focus-cad'],['capture','capture']])$(id).onclick=()=>{ $('error').hidden=true;void call(method);};
$('toggle').onclick=async()=>{clearTimeout(draftTimer);await call('draft',$('draft').value);await call('toggle');};
$('confirm').onclick=()=>{const id=current?.plan?.id;if(id){$('confirm').disabled=true;void call('confirm',id);}};
window.harness.onState(render);
void call('state').then(state=>{if(state)render(state);});

let partsKey='',parameterKey='',parameterExpected='',planKey='',historyKey='';
const findComponent=(object,parts)=>parts.find(c=>object===c.object||object.startsWith(c.object+'__'));
const number=value=>Number(value.toFixed(3)).toString();
function renderDetails(state){
  const context=state.context,doc=context.connected?context.document:null,parts=doc?.components||[],busy=['preparing','planning','executing','uncertain'].includes(state.phase);
  $('component-panel').hidden=!parts.length;$('compact-parts').hidden=!parts.length;
  const key=JSON.stringify(parts);if(key!==partsKey){partsKey=key;$('components').replaceChildren();$('part-selector').replaceChildren();const placeholder=document.createElement('option');placeholder.value='';placeholder.textContent='在 CAD 中选择零件';placeholder.disabled=true;$('part-selector').append(placeholder);for(const part of parts){const button=document.createElement('button');button.type='button';button.className='component-row';button.dataset.component=part.id;const name=document.createElement('strong');name.textContent=part.name;const measure=document.createElement('small');measure.textContent='外形 '+part.dimensions.map(number).join(' × ')+' mm';button.append(name,measure);button.onclick=()=>void call('select-component',part.id);$('components').append(button);const option=document.createElement('option');option.value=part.id;option.textContent=part.name;$('part-selector').append(option);}}
  const selections=context.selection||[],selected=selections.length===1?findComponent(selections[0].object,parts):null;
  $('part-selector').value=selected?.id||'';$('part-selector').disabled=busy;
  for(const button of $('components').querySelectorAll('button')){button.setAttribute('aria-pressed',String(selected?.id===button.dataset.component));button.disabled=busy;}
  $('parameter-panel').hidden=!doc?.design;
  const nextParameters=doc?.design?doc.token+JSON.stringify(doc.design.parameters):'';
  parameterExpected=context.fingerprint;
  if(nextParameters!==parameterKey){parameterKey=nextParameters;$('parameter-fields').replaceChildren();if(doc?.design){const entries=Object.entries(doc.design.parameters);$('parameter-title').textContent=`设计尺寸 · ${entries.length} 项`;for(const [key,p] of entries){const label=document.createElement('label');label.className='parameter-field';const title=document.createElement('span');title.textContent=p.label+(p.unit===undefined||p.unit?' ('+(p.unit??'mm')+')':'');const input=document.createElement('input');input.type='number';input.step='any';input.value=p.value;input.required=true;input.dataset.parameter=key;if(p.min!==undefined)input.min=p.min;if(p.max!==undefined)input.max=p.max;label.append(title,input);$('parameter-fields').append(label);}}}
  const readOnly=doc?.editable===false;$('parameter-warning').hidden=!readOnly;$('parameter-warning').textContent=doc?.error||'检测到手动修改，请先核对；当前不会用旧参数覆盖原生工程。';
  for(const input of $('parameter-form').querySelectorAll('input,button'))input.disabled=busy||readOnly;
  const nextPlan=JSON.stringify(state.plan?.details||[]);if(nextPlan!==planKey){planKey=nextPlan;const details=state.plan?.details||[];$('plan-details').hidden=!details.length;$('plan-values').replaceChildren();for(const p of details){const row=document.createElement('div'),name=document.createElement('span'),value=document.createElement('span');name.textContent=p.label;value.textContent=(p.before===undefined?'':p.before+' → ')+p.after+' '+p.unit;row.append(name,value);$('plan-values').append(row);}}
  const progress=context.progress,active=state.phase==='executing'&&progress?.active;$('progress-area').hidden=!active;
  if(active){$('progress-label').textContent=`${progress.current} / ${progress.total} · ${progress.label}`;$('execution-progress').max=progress.total||1;$('execution-progress').value=progress.current||0;}
  const nextHistory=JSON.stringify(state.history||[]);if(nextHistory!==historyKey){historyKey=nextHistory;$('history').replaceChildren();for(const task of (state.history||[]).slice(-6).reverse()){const row=document.createElement('div');row.className='history-item';const status=document.createElement('strong');status.textContent=({done:'已完成',error:'未完成',uncertain:'待核对','needs-review':'待核对',executing:'执行中'})[task.state]||task.state;const description=document.createElement('p');description.textContent=task.description;row.append(status,description);$('history').append(row);}}
}
$('part-selector').onchange=()=>{if($('part-selector').value)void call('select-component',$('part-selector').value);};
$('parameter-form').onsubmit=event=>{event.preventDefault();const changes={};for(const input of $('parameter-fields').querySelectorAll('input')){const key=input.dataset.parameter;if(input.valueAsNumber!==current.context.document.design.parameters[key].value)changes[key]=input.valueAsNumber;}$('error').hidden=true;void call('parameters',{changes,expected:parameterExpected});};
$('parameter-reset').onclick=()=>{parameterKey='';if(current)renderDetails(current);};

function renderSettings(){
  const config=current?.agentConfig;if(!config)return;
  const row=(container,id,title,description,checked,type,file)=>{const label=document.createElement('label');label.className='capability-row';const input=document.createElement('input');input.type='checkbox';input.dataset[type]=id;input.checked=checked;const text=document.createElement('span'),name=document.createElement('strong'),note=document.createElement('small');name.textContent=title;note.textContent=description;text.append(name,note);if(file){const location=document.createElement('small');location.className='skill-path';location.textContent=file;text.append(location);}label.append(input,text);container.append(label);};
  $('tool-settings').replaceChildren();$('skill-settings').replaceChildren();
  for(const t of config.toolCatalog)row($('tool-settings'),t.id,t.name,t.description,config.tools.includes(t.id),'tool');
  for(const s of config.skills)row($('skill-settings'),s.id,s.name+' · '+s.source,s.description,s.enabled,'skill',s.file);
}
$('settings').onclick=async()=>{await call('agent-config-refresh');renderSettings();$('settings-feedback').textContent='';$('settings-dialog').showModal();$('settings-dialog').scrollTop=0;};
$('settings-close').onclick=()=>$('settings-dialog').close();
$('skill-import').onclick=async()=>{const result=await call('skill-import');if(result?.ok){renderSettings();$('settings-feedback').textContent='技能列表已更新';}else $('settings-feedback').textContent=$('error').textContent;};
$('settings-form').onsubmit=async event=>{event.preventDefault();const tools=[...$('tool-settings').querySelectorAll('input:checked')].map(n=>n.dataset.tool),disabledSkills=[...$('skill-settings').querySelectorAll('input:not(:checked)')].map(n=>n.dataset.skill);const result=await call('agent-config',{tools,disabledSkills});$('settings-feedback').textContent=result?.ok?'已保存，下一轮对话生效':$('error').textContent;};
