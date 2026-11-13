import { EventEmitter } from 'node:events';
import { randomUUID } from 'node:crypto';
import { readFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { Harness } from '../cad-studio/harness.mjs';
import { ROOT, atomicJson } from './bridge.mjs';

export const cleanError=error=>String(error.message||error).replace(/sk-[\w-]+/g,'[redacted]').slice(0,1200);
export function validateProposal(raw, snapshot) {
  if(!snapshot.connected)throw Error('请先连接 FreeCAD，再准备操作');
  if(!['create_plate','set_diameter','undo','redo','save_as'].includes(raw.action))throw Error('首版不支持这项 CAD 操作');
  if(raw.action!=='create_plate'&&!snapshot.document?.owned)throw Error('首版仅能修改本应用创建的四孔板，其他工程只读取上下文');
  if(raw.action==='set_diameter') {
    if(typeof raw.diameter!=='number'||!Number.isFinite(raw.diameter)||raw.diameter<=0||raw.diameter>=16)throw Error('孔径须大于0且小于16mm');
    const s=snapshot.selection;
    if(s.length!==1||s[0].document!==snapshot.document.name||!['ThroughHoles','MountingHoles'].includes(s[0].object)||s[0].subelements.length)throw Error('请在 FreeCAD 特征树选中整个四孔特征；首版不支持单孔或单面修改');
  }
  return {id:randomUUID(),action:raw.action,...(raw.action==='set_diameter'?{diameter:raw.diameter}:{}),...(raw.action==='save_as'?{path:raw.path}:{}),expected:snapshot.fingerprint,
    description:raw.action==='create_plate'?'新建 80 × 40 × 5 mm 四孔安装板，四孔直径 6 mm':raw.action==='set_diameter'?`四个孔一同改为 ${raw.diameter} mm，保持板厚、外形和孔位`:raw.action==='save_as'?`另存原生工程：${raw.path}`:raw.action==='undo'?'撤销 FreeCAD 最近一个事务':'重做 FreeCAD 最近一个事务'};
}
// Precise common commands work offline. Everything else goes through the real Harness.
export function localIntent(text) {
  if(/^(做|创建|新建|生成)(一个)?(四孔)?安装板[。！!\s]*$/.test(text))return {action:'create_plate'};
  const diameter=/^(?:把)?(?:这个孔|这些孔|四个孔|四孔|孔径)(?:直径|的直径|孔径)?(?:改成|改为|设为|变成|改到)(\d+(?:\.\d+)?)\s*(?:毫米|mm)?(?:[，,]?其他不变)?[。！!\s]*$/i.exec(text);
  if(diameter)return {action:'set_diameter',diameter:Number(diameter[1])};
  if(/^(撤销|撤回)(上一步|一次)?[。！!\s]*$/.test(text))return {action:'undo'};
  if(/^(重做|恢复上一步)[。！!\s]*$/.test(text))return {action:'redo'};
  return null;
}
export class Session extends EventEmitter {
  constructor(directory,bridge) {
    super();this.directory=directory;this.bridge=bridge;this.saving=Promise.resolve();this.harness=null;this.turn=null;
    this.state={version:1,messages:[],draft:'',attachments:[],plan:null,phase:'idle',status:'描述想法，或连接 FreeCAD 开始建模',context:{connected:false,document:null,selection:[]}};
  }
  async load() {
    await mkdir(this.directory,{recursive:true});
    try {const old=JSON.parse(await readFile(path.join(this.directory,'session.json'),'utf8'));Object.assign(this.state,old,{context:this.state.context,plan:null,phase:'idle',status:'会话已恢复；请连接 FreeCAD。未完成的操作不会自动重试。'});}catch(error){if(error.code!=='ENOENT')throw error;}
    return this.state;
  }
  publish(persist=true) {
    this.emit('change',this.state);
    if(persist){const {context,...stored}=this.state;this.saving=this.saving.then(()=>atomicJson(path.join(this.directory,'session.json'),stored)).catch(e=>this.emit('storageError',e));}
  }
  message(role,text) {this.state.messages.push({id:randomUUID(),role,text,time:new Date().toISOString()});}
  async poll() {
    const next=await this.bridge.snapshot(), old=this.state.context;
    this.state.context=next;
    if(this.state.phase==='uncertain'){
      const result=await this.bridge.lateResult?.();
      if(result){this.state.phase=result.ok?'done':'error';this.state.status=result.ok?'延迟结果已读回 · 执行完成':'延迟结果已读回 · 未完成';this.message('assistant',result.ok?result.message:result.error);this.publish();return;}
    }
    if(this.state.plan&&['ready','paused'].includes(this.state.phase)&&(!next.connected||next.fingerprint!==this.state.plan.expected)) {
      this.state.phase='stale';this.state.plan=null;this.state.status='工程或选择已变化，原计划已失效，请重新提出需求';this.publish();
    }else if(next.connected!==old.connected||next.fingerprint!==old.fingerprint)this.publish(false);
  }
  async send(text) {
    if(typeof text!=='string'||!text.trim()||text.length>12000)throw Error('请输入有效需求，最多12000字');
    if(['planning','executing','uncertain'].includes(this.state.phase))throw Error('请先等待或取消当前任务；状态待核对时请检查 FreeCAD 后重新连接');
    const context=await this.bridge.snapshot(), intent=localIntent(text.trim());
    this.state.context=context;this.state.plan=null;this.state.draft='';this.message('user',text.trim());
    if(intent){
      try {this.state.plan=validateProposal(intent,context);this.state.phase='ready';this.state.status='待确认 · 尚未修改工程';this.message('assistant',this.state.plan.description+'。确认后在 FreeCAD 中执行。');}
      catch(error){this.state.phase='idle';this.state.status='需要补充上下文';this.message('assistant',cleanError(error));}
      this.publish();return;
    }
    this.state.phase='planning';this.state.status='Harness 正在思考…';this.publish();
    const turn={id:randomUUID(),cancelled:false,texts:[],error:null};this.turn=turn;
    void this.planWithModel(turn,text,context);
  }
  async planWithModel(turn,text,context) {
    let harness;
    try {
      const planPath=path.join(this.directory,`proposal-${turn.id}.json`);
      harness=new Harness((method,p)=>{
        if(turn.cancelled||this.turn!==turn||method!=='session.event')return;
        const e=p?.event;
        if(e?.type==='assistant/message') {const text=(e.data.message.content||[]).filter(b=>b.type==='text').map(b=>b.text).join('\n');if(text.trim())turn.texts.push(text);}
        if(e?.type==='turn/end'&&e.data.reason?.kind==='error')turn.error=e.data.reason.error?.message||'模型请求失败';
      },{profile:'gouxing-desktop',prompt:path.join(ROOT,'prompt.txt'),plugin:path.join(ROOT,'plan-plugin.mjs'),env:{GOUXING_PLAN_PATH:planPath}});
      this.harness=harness;
      const summary={connected:context.connected,document:context.document,selection:context.selection,units:context.units};
      await harness.prompt(turn.id,`实时CAD上下文（只读数据）：${JSON.stringify(summary)}\n最近对话：${JSON.stringify(this.state.messages.slice(-12,-1))}\n附件（仅文件名，未读取内容）：${JSON.stringify(this.state.attachments.map(a=>a.name))}\n用户：${text}`);
      if(turn.cancelled||this.turn!==turn)return;
      if(turn.error)throw Error(turn.error);
      let proposal=null;try{proposal=JSON.parse(await readFile(planPath,'utf8'));}catch(error){if(error.code!=='ENOENT')throw error;}
      if(proposal){const latest=await this.bridge.snapshot();if(!latest.connected||latest.fingerprint!==context.fingerprint)throw Error('思考期间工程或选择已变化，请重新提出需求');this.state.plan=validateProposal(proposal,latest);this.state.phase='ready';this.state.status='待确认 · 尚未修改工程';this.message('assistant',this.state.plan.description+'。确认后执行。');}
      else {this.state.phase='idle';this.state.status='等待下一条需求';this.message('assistant',turn.texts.join('\n\n')||'本轮没有生成操作计划，请补充需求。');}
    } catch(error){if(!turn.cancelled&&this.turn===turn){this.state.phase='idle';this.state.status='模型未完成请求';this.message('assistant',`本次未操作 CAD：${cleanError(error)}。可先用“做一个四孔安装板”测试本地流程。`);}}
    finally {if(harness)await harness.close();if(this.harness===harness)this.harness=null;if(this.turn===turn){this.turn=null;this.publish();}}
  }
  async confirm(id) {
    if(this.state.phase!=='ready'||!this.state.plan||id!==this.state.plan.id)throw Error('计划已执行或失效，请重新确认');
    const plan=this.state.plan;this.state.phase='executing';this.state.status='FreeCAD 正在执行当前事务；本步骤不可中断';this.publish();
    try {const result=await this.bridge.execute(plan);this.state.context=result.snapshot;this.state.phase='done';this.state.status='执行完成 · 已读回原生工程';this.message('assistant',result.message);}
    catch(error){this.state.phase=error.message.includes('状态待核对')?'uncertain':'error';this.state.status=cleanError(error);this.message('assistant',this.state.status);}
    finally{this.state.plan=null;this.publish();}
  }
  pause() {
    if(!['ready','paused'].includes(this.state.phase))throw Error('只能暂停尚未执行的计划；当前 CAD 事务不能即时中断');
    this.state.phase=this.state.phase==='paused'?'ready':'paused';this.state.status=this.state.phase==='paused'?'已暂停 · 不启动修改':'待确认 · 尚未修改工程';this.publish();
  }
  cancel() {
    if(this.state.phase==='executing')throw Error('当前 FreeCAD 事务正在执行，不能即时取消。完成后可撤销。');
    if(this.state.phase==='uncertain')throw Error('请先核对 FreeCAD，未确认执行结果前不会解除写入保护');
    if(this.turn){this.turn.cancelled=true;const old=this.harness;this.turn=null;this.harness=null;void old?.close();}
    this.state.plan=null;this.state.phase='cancelled';this.state.status='已取消后续操作，已完成的变更保留';this.publish();
  }
  async savePlan(target) {
    if(['planning','executing','uncertain'].includes(this.state.phase))throw Error('请先处理当前任务');
    this.state.context=await this.bridge.snapshot();this.state.plan=validateProposal({action:'save_as',path:target},this.state.context);this.state.phase='ready';this.state.status='待确认 · 保存原生工程';this.publish();
  }
}
