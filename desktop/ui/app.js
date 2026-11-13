/* No Node access here. All native actions go through the narrow preload API. */
const $=id=>document.getElementById(id);
let current=null,renderedMessages='',attachmentKey='',draftTimer,callBusy=false;
async function call(method,payload){
  try{const result=await window.harness.call(method,payload);if(result?.ok===false)throw Error(result.error);return result;}
  catch(error){$('error').textContent=error.message;$('error').hidden=false;return null;}
}
function showMessages(messages){
  const key=JSON.stringify(messages);if(key===renderedMessages)return;renderedMessages=key;
  const container=$('messages'),nearBottom=container.scrollHeight-container.scrollTop-container.clientHeight<80;
  container.replaceChildren();
  if(!messages.length){const welcome=document.createElement('div');welcome.className='welcome';const title=document.createElement('h2');title.textContent='你想做点什么？';const note=document.createElement('p');note.textContent='连接 FreeCAD，创建可继续修改的原生多零件设计。';const examples=document.createElement('div');examples.className='examples';for(const text of ['做一个带盖控制盒','做一个小龙门架','生成一个简化飞机']){const button=document.createElement('button');button.className='example';button.textContent=text;button.onclick=()=>{$('draft').value=text;void call('draft',text);$('draft').focus();};examples.append(button);}welcome.append(title,note,examples);container.append(welcome);}
  for(const message of messages){const item=document.createElement('article');item.className='message '+(message.role==='user'?'user':'assistant');const author=document.createElement('div');author.className='message-author';author.textContent=message.role==='user'?'你':'构形';const content=document.createElement('p');content.className='message-text';content.textContent=message.text;item.append(author,content);container.append(item);}
  if(nearBottom)container.scrollTop=container.scrollHeight;
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
  const upgrade=c.connected&&c.protocol!==2;
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
  const nextKey=JSON.stringify(state.attachments);if(nextKey!==attachmentKey){attachmentKey=nextKey;$('attachments').replaceChildren();for(const a of state.attachments){const chip=document.createElement('span');chip.className='attachment';chip.textContent=a.name+' · 未解析';$('attachments').append(chip);}}
  renderDetails(state);
}
async function send(){const text=$('draft').value.trim();if(!text||callBusy)return;clearTimeout(draftTimer);$('error').hidden=true;callBusy=true;$('send').disabled=true;await call('draft',text);const result=await call('send',text);if(result?.ok)$('draft').value='';callBusy=false;if(current)render(current);}
$('send').onclick=send;$('draft').addEventListener('keydown',event=>{if(event.key==='Enter'&&!event.shiftKey&&!event.isComposing){event.preventDefault();void send();}});
$('draft').addEventListener('input',()=>{clearTimeout(draftTimer);const text=$('draft').value;draftTimer=setTimeout(()=>void call('draft',text),200);});
$('draft').addEventListener('blur',()=>{clearTimeout(draftTimer);void call('draft',$('draft').value);});
for(const [id,method] of [['pin','pin'],['minimize','minimize'],['close','close'],['connect','connect'],['compact-connect','connect'],['save','save'],['attach','attach'],['pause','pause'],['cancel','cancel'],['cancel-running','cancel'],['open','open'],['focus-cad','focus-cad']])$(id).onclick=()=>{ $('error').hidden=true;void call(method);};
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
