// Keep message/block/details nodes alive while their text grows. Never replace a
// summary between pointerdown and click, or a pre while the user is reading it.
export function formattedText(text){
  const fragment=document.createDocumentFragment();
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
function plain(node,text){
  if(node._text===text&&node._plain)return;
  if(node._plain&&text.startsWith(node._text))node.firstChild.appendData(text.slice(node._text.length));
  else node.replaceChildren(document.createTextNode(text));
  node._text=text;node._plain=true;
}
function rich(node,text){if(node._text===text&&!node._plain)return;node.replaceChildren(formattedText(text));node._text=text;node._plain=false;}
const toolLabels={freecad_inspect:'读取工程',freecad_capture:'观察 CAD',freecad_propose:'准备操作计划',skill_read:'加载技能'};
const toolStates={running:'执行中',done:'已返回',error:'失败',interrupted:'已中断'};

export class MessageList {
  constructor(container,{changed=()=>{},userAdded=()=>{},welcome=()=>{}}={}){this.container=container;this.rows=new Map();this.changed=changed;this.userAdded=userAdded;this.welcome=welcome;}
  update(messages){
    const ids=new Set(messages.map(m=>m.id));
    for(const [id,row] of this.rows)if(!ids.has(id)){row.item.remove();this.rows.delete(id);}
    if(messages.length)this.container.querySelector('.welcome')?.remove();
    else if(!this.container.querySelector('.welcome'))this.welcome();
    for(const message of messages)this.updateMessage(message);
  }
  updateMessage(message){
    let row=this.rows.get(message.id);
    if(!row){const item=document.createElement('article'),author=document.createElement('div'),content=document.createElement('div');item.className='message '+(message.role==='user'?'user':'assistant');item.dataset.messageId=message.id;author.className='message-author';author.textContent=message.role==='user'?'你':'构形';item.append(author,content);row={item,content,nodes:new Map()};this.rows.set(message.id,row);this.container.append(item);if(message.role==='user')this.userAdded();}
    // Revisioned messages are immutable between revisions on the renderer side.
    if(message.revision!==undefined&&row.revision===message.revision&&row.streaming===message.streaming)return;
    row.revision=message.revision;row.streaming=message.streaming;
    const wanted=[];
    const node=(key,kind)=>{let entry=row.nodes.get(key);if(!entry){const element=document.createElement(kind==='text'?'p':kind==='status'?'div':'details');entry={element};if(element.tagName==='DETAILS'){entry.summary=document.createElement('summary');entry.body=document.createElement('pre');element.dataset.key=key;element.append(entry.summary,entry.body);element.addEventListener('toggle',()=>this.changed());}row.nodes.set(key,entry);}wanted.push(entry.element);return entry;};
    const text=(key,value,{notice=false}={})=>{const {element}=node(key,'text');element.className=notice?'message-text completion-notice':'message-text';if(message.streaming||message.role==='user'||notice)plain(element,value);else rich(element,value);};
    const details=(key,title,value,kind,state='')=>{const entry=node(key,'details');entry.element.className=kind;entry.element.dataset.state=state;if(entry.summary.textContent!==title)entry.summary.textContent=title;plain(entry.body,value);};
    const toolsShown=new Set();
    const tool=(id,block={})=>{const t=message.tools?.find(t=>t.id===id)||{},name=t.name||block.name||'工具';details('tool-'+id,`${toolStates[t.state]||(message.streaming?'准备中':'已结束')} · ${toolLabels[name]||name}`,`${name}\n输入\n${typeof t.arguments==='object'?JSON.stringify(t.arguments,null,2):t.arguments||block.arguments||''}\n\n结果\n${t.result||'等待工具返回'}`,'tool-card',t.state);toolsShown.add(id);};
    let bodyCount=0;
    for(const a of message.attempts||[]){
      if(a.state==='abandoned'){details(a.id,'已中断的输出',Object.values(a.blocks).filter(b=>b.type==='text').map(b=>b.text).join('\n'),'attempt-abandoned');continue;}
      for(const [index,b] of Object.entries(a.blocks)){
        if(b.type==='text'&&b.text){text(a.id+'-text-'+index,b.text);bodyCount++;}
        if(b.type==='reasoning'&&b.text)details(a.id+'-'+index,message.streaming&&a.state==='running'?'思考中 · 点击展开':'思考 · 模型提供的内容',b.text,'reasoning');
        if(b.type==='tool-call')tool(b.id,b);
      }
    }
    // Final notices and recovered durable text must remain visible alongside thinking.
    if(!bodyCount&&message.text)text('fallback',message.text);
    for(const t of message.tools||[])if(!toolsShown.has(t.id))tool(t.id);
    if(message.notice)text('notice',message.notice,{notice:true});
    if(message.streaming){const {element}=node('status','status');element.className='stream-status';plain(element,message.tools?.some(t=>t.state==='running')?'正在使用工具…':message.attempts?.some(a=>Object.values(a.blocks).some(b=>b.type==='text'&&b.text))?'正在生成回复…':message.attempts?.length?'正在思考…':'正在连接模型…');}
    if(message.interrupted)text('interrupted','本轮已中断，已生成内容保留。',{notice:true});
    const keep=new Set(wanted);for(const [key,entry] of row.nodes)if(!keep.has(entry.element)){entry.element.remove();row.nodes.delete(key);}
    for(const [i,element] of wanted.entries())if(row.content.children[i]!==element)row.content.insertBefore(element,row.content.children[i]||null);
    this.changed();
  }
}
