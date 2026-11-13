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
  if(!messages.length){const welcome=document.createElement('div');welcome.className='welcome';const title=document.createElement('h2');title.textContent='你想做点什么？';const note=document.createElement('p');note.textContent='先连接 FreeCAD，试着用一句话做出第一个零件。';const examples=document.createElement('div');examples.className='examples';for(const text of ['做一个四孔安装板','孔径改成8毫米，其他不变']){const button=document.createElement('button');button.className='example';button.textContent=text;button.onclick=()=>{$('draft').value=text;void call('draft',text);$('draft').focus();};examples.append(button);}welcome.append(title,note,examples);container.append(welcome);}
  for(const message of messages){const item=document.createElement('article');item.className='message '+(message.role==='user'?'user':'assistant');const author=document.createElement('div');author.className='message-author';author.textContent=message.role==='user'?'你':'构形';const content=document.createElement('p');content.className='message-text';content.textContent=message.text;item.append(author,content);container.append(item);}
  if(nearBottom)container.scrollTop=container.scrollHeight;
}
function render(state){
  current=state;document.body.classList.toggle('compact',state.window.small);
  $('toggle').textContent=state.window.small?'展开':'缩为小窗';$('toggle').setAttribute('aria-expanded',String(!state.window.small));
  $('pin').hidden=!state.window.small;$('pin').textContent=state.window.pinned?'已置顶':'置顶';$('pin').setAttribute('aria-pressed',String(state.window.pinned));
  showMessages(state.messages);
  // Polling never overwrites a draft under the user's cursor or changes focus.
  if(document.activeElement!==$('draft')&&$('draft').value!==state.draft)$('draft').value=state.draft;
  const c=state.context,doc=c.document,selections=c.selection||[];
  $('sidebar-connection').textContent=c.connected?`已连接 · ${(c.version||[]).join('.')}`:'尚未连接';
  $('connect').disabled=c.connected;$('compact-connect').hidden=c.connected;
  $('connection-dot').classList.toggle('connected',c.connected);
  $('context-document').textContent=c.connected?(doc?.label||'FreeCAD 已连接 · 无活动工程'):'尚未连接 CAD';
  const selectionText=selections.length?selections.map(s=>s.object+(s.subelements.length?' / '+s.subelements.join(', '):'')).join('、'):'未选择对象';
  $('context-selection').textContent=c.connected?selectionText:'连接后会读取活动工程与选择';
  $('inspector-title').textContent=c.connected?(doc?.label||'无活动工程'):'等待连接';
  $('cad-version').textContent='FreeCAD '+(c.version||[]).join('.');$('document-file').textContent=c.connected?(doc?.file||'尚未保存'):'—';
  $('selection-detail').textContent=c.connected?selectionText:'—';$('diameters').textContent=c.connected&&doc?.diameters?doc.diameters.map(v=>Number(v.toFixed(3))).join(' / ')+' mm':'—';
  $('save').disabled=!c.connected||!doc?.owned||['planning','executing','uncertain'].includes(state.phase);
  $('plan').hidden=!state.plan;$('plan-description').textContent=state.plan?.description||'';
  $('confirm').disabled=state.phase!=='ready';$('pause').disabled=!['ready','paused'].includes(state.phase);$('pause').textContent=state.phase==='paused'?'继续':'暂停';$('cancel').disabled=state.phase==='executing';
  $('cancel-running').hidden=state.phase!=='planning';
  $('send').disabled=['planning','executing','uncertain'].includes(state.phase)||callBusy;
  $('status').textContent=state.status;$('shortcut').textContent=state.window.shortcut+' 呼出';
  $('model-name').textContent=state.model.name;
  const nextKey=JSON.stringify(state.attachments);if(nextKey!==attachmentKey){attachmentKey=nextKey;$('attachments').replaceChildren();for(const a of state.attachments){const chip=document.createElement('span');chip.className='attachment';chip.textContent=a.name+' · 未解析';$('attachments').append(chip);}}
}
async function send(){const text=$('draft').value.trim();if(!text||callBusy)return;clearTimeout(draftTimer);$('error').hidden=true;callBusy=true;$('send').disabled=true;await call('draft',text);const result=await call('send',text);if(result?.ok)$('draft').value='';callBusy=false;if(current)render(current);}
$('send').onclick=send;$('draft').addEventListener('keydown',event=>{if(event.key==='Enter'&&!event.shiftKey&&!event.isComposing){event.preventDefault();void send();}});
$('draft').addEventListener('input',()=>{clearTimeout(draftTimer);const text=$('draft').value;draftTimer=setTimeout(()=>void call('draft',text),200);});
$('draft').addEventListener('blur',()=>{clearTimeout(draftTimer);void call('draft',$('draft').value);});
for(const [id,method] of [['pin','pin'],['minimize','minimize'],['close','close'],['connect','connect'],['compact-connect','connect'],['save','save'],['attach','attach'],['pause','pause'],['cancel','cancel'],['cancel-running','cancel']])$(id).onclick=()=>{ $('error').hidden=true;void call(method);};
$('toggle').onclick=async()=>{clearTimeout(draftTimer);await call('draft',$('draft').value);await call('toggle');};
$('confirm').onclick=()=>{const id=current?.plan?.id;if(id){$('confirm').disabled=true;void call('confirm',id);}};
window.harness.onState(render);
void call('state').then(state=>{if(state)render(state);});
