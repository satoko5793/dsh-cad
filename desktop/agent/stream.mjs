// Project real DSH transient frames into a persistent, bounded conversation message.
export function applyFrame(message,frame){
  message.attempts??=[];
  let attempt=message.attempts.find(a=>a.id===frame.attemptId);
  if(frame.type==='start'){
    if(!attempt){attempt={id:frame.attemptId,blocks:{},state:'running'};message.attempts.push(attempt);}
    return true;
  }
  if(!attempt)return false;
  if(frame.type==='end'){attempt.state=frame.outcome?.kind==='abandoned'?'abandoned':'done';if(attempt.state==='abandoned')message.text=message.attempts.filter(a=>a.state!=='abandoned').flatMap(a=>Object.values(a.blocks).filter(b=>b.type==='text').map(b=>b.text)).join('\n\n');return true;}
  if(frame.type!=='chunk')return false;
  if(frame.index<= (attempt.lastIndex??-1))return false;
  attempt.lastIndex=frame.index;
  const c=frame.chunk;if(!c||!Number.isInteger(c.index))return false;
  const block=attempt.blocks[c.index]??={type:c.blockType||c.type.replace('-delta',''),text:''};
  if(c.type==='text-delta'||c.type==='reasoning-delta'){block.type=c.type==='text-delta'?'text':'reasoning';block.text=(block.text+c.text).slice(0,100000);}
  if(c.type==='tool-call-delta'){Object.assign(block,{type:'tool-call',id:c.id,name:c.name||block.name||'',arguments:((block.arguments||'')+c.argumentsDelta).slice(0,100000)});}
  if(c.type==='block-end')attempt.blocks[c.index]={...c.block};
  message.text=message.attempts.filter(a=>a.state!=='abandoned').flatMap(a=>Object.values(a.blocks).filter(b=>b.type==='text').map(b=>b.text)).join('\n\n');
  return true;
}
export function settleTools(message,state){for(const tool of message.tools||[])if(tool.state==='running')tool.state=state;}
