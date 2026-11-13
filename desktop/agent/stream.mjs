// Project real DSH transient frames into a persistent, bounded conversation message.
export const touchMessage=message=>{message.revision=(message.revision||0)+1;};
const updateText=message=>{message.text=message.attempts.filter(a=>a.state!=='abandoned').flatMap(a=>Object.values(a.blocks).filter(b=>b.type==='text').map(b=>b.text)).join('\n\n');touchMessage(message);};
export function applyFrame(message,frame){
  message.attempts??=[];
  let attempt=message.attempts.find(a=>a.id===frame.attemptId);
  if(frame.type==='start'){
    if(!attempt){attempt={id:frame.attemptId,blocks:{},state:'running'};message.attempts.push(attempt);}
    touchMessage(message);return true;
  }
  if(!attempt)return false;
  if(frame.type==='end'){attempt.state=frame.outcome?.kind==='abandoned'?'abandoned':'done';updateText(message);return true;}
  if(frame.type!=='chunk')return false;
  if(frame.index<= (attempt.lastIndex??-1))return false;
  attempt.lastIndex=frame.index;
  const c=frame.chunk;if(!c||!Number.isInteger(c.index))return false;
  const block=attempt.blocks[c.index]??={type:c.blockType||c.type.replace('-delta',''),text:''};
  if(c.type==='text-delta'||c.type==='reasoning-delta'){block.type=c.type==='text-delta'?'text':'reasoning';block.text=(block.text+c.text).slice(0,100000);}
  if(c.type==='tool-call-delta'){Object.assign(block,{type:'tool-call',id:c.id,name:c.name||block.name||'',arguments:((block.arguments||'')+c.argumentsDelta).slice(0,100000)});}
  if(c.type==='block-end')attempt.blocks[c.index]={...c.block};
  updateText(message);
  return true;
}
// Durable assistant/message is authoritative even when some transient frames were missed.
export function commitMessage(message,committed){
  message.attempts??=[];
  let attempt=message.attempts.find(a=>a.messageId===committed.id)||message.attempts.findLast(a=>a.state==='running'&&!a.messageId);
  if(!attempt){attempt={id:'committed-'+committed.id,blocks:{},state:'done'};message.attempts.push(attempt);}
  attempt.messageId=committed.id;
  attempt.blocks=Object.fromEntries((committed.content||[]).map((b,i)=>[i,{...b,...(typeof b.text==='string'?{text:b.text.slice(0,100000)}:{})}]));
  updateText(message);
}
export function finishMessage(message,reason,hasPlan=false){
  message.completionReason=reason||'complete';
  if(reason==='max-tokens')message.notice=hasPlan?'模型达到输出上限，回答未完整结束。已准备的计划仍需检查并确认后执行。':message.text?.trim()?'模型达到输出上限，以上回答可能不完整。本轮未执行 CAD 操作，可继续提问。':'模型达到输出上限，只有思考内容，没有生成正文或操作计划。本轮未修改 CAD，可以重试。';
  else if(!message.text?.trim()&&!hasPlan)message.notice='本轮没有生成正文或操作计划，本轮未修改 CAD。可以重试或换个说法。';
  touchMessage(message);
}
export function settleTools(message,state){for(const tool of message.tools||[])if(tool.state==='running')tool.state=state;}
