import { EventEmitter } from 'node:events';
import { randomUUID, createHash } from 'node:crypto';
import { readFile, mkdir, appendFile } from 'node:fs/promises';
import path from 'node:path';
import {Harness} from '../../shared/harness.mjs';
import {ROOT} from '../infrastructure/paths.mjs';
import {atomicJson} from '../infrastructure/storage.mjs';
import {applyFrame,commitMessage,finishMessage,touchMessage,settleTools} from '../agent/stream.mjs';
import {configView} from '../agent/config.mjs';
import {validateProposal} from './plans.mjs';
import {localIntent} from '../domain/intents.mjs';
import {cleanError,modelErrorMessage} from './errors.mjs';
export {validateProposal,localIntent,cleanError,modelErrorMessage};

export class Session extends EventEmitter {
  constructor(directory,bridge,options={}) {
    super();this.directory=directory;this.bridge=bridge;this.saving=Promise.resolve();this.harness=null;this.turn=null;
    this.profile='gouxing-desktop-'+createHash('sha256').update(path.resolve(directory)).digest('hex').slice(0,10);
    this.Harness=options.Harness||Harness;
    this.state={version:2,messages:[],draft:'',attachments:[],history:[],plan:null,phase:'idle',status:'描述想法，或连接 FreeCAD 开始建模',context:{connected:false,document:null,selection:[]}};
  }
  async load() {
    await mkdir(this.directory,{recursive:true});
    try {const old=JSON.parse(await readFile(path.join(this.directory,'session.json'),'utf8'));Object.assign(this.state,old,{context:this.state.context,plan:null,phase:'idle',status:'会话已恢复；请连接 FreeCAD。未完成的操作不会自动重试。'});}catch(error){if(error.code!=='ENOENT')throw error;}
    this.state.version=2;
    for(const message of this.state.messages)if(message.streaming){message.streaming=false;message.interrupted=true;settleTools(message,'interrupted');}
    for(const record of this.state.history||[])if(['executing','uncertain'].includes(record.state)){record.state='needs-review';record.result='应用已重启，请核对 CAD；未自动重发操作';}
    return this.state;
  }
  publish(persist=true,metadata) {
    this.emit('change',this.state,metadata);
    if(persist){const {context,observation,...stored}=this.state;const saved=structuredClone(stored);this.saving=this.saving.then(()=>atomicJson(path.join(this.directory,'session.json'),saved)).catch(e=>this.emit('storageError',e));}
  }
  message(role,text) {const message={id:randomUUID(),role,text,time:new Date().toISOString(),revision:0};this.state.messages.push(message);return message;}
  streamChanged(){if(this.streamTimer)return;this.streamTimer=setTimeout(()=>{this.streamTimer=null;if(this.turn)this.publish(false,{stream:true,messageId:this.turn.message.id});},32);}
  async poll() {
    const next=await this.bridge.snapshot(), old=this.state.context;
    this.state.context=next;
    if(next.connected&&this.state.status.startsWith('会话已恢复；请连接'))this.state.status='会话已恢复 · FreeCAD 已连接；旧计划未自动重发';
    if(this.state.phase==='uncertain'){
      const result=await this.bridge.lateResult?.();
      if(result){this.state.phase=result.ok?'done':'error';this.state.status=result.ok?'延迟结果已读回 · 执行完成':'延迟结果已读回 · 未完成';const record=[...(this.state.history||[])].reverse().find(h=>h.state==='uncertain');if(record){record.state=this.state.phase;record.result=this.state.status;record.finishedAt=new Date().toISOString();}this.message('assistant',result.ok?result.message:result.error);this.publish();return;}
    }
    if(this.state.plan&&['ready','paused'].includes(this.state.phase)&&(!next.connected||next.fingerprint!==this.state.plan.expected)) {
      this.state.phase='stale';this.state.plan=null;this.state.status='工程或选择已变化，原计划已失效，请重新提出需求';this.publish();
    }else if(next.connected!==old.connected||next.fingerprint!==old.fingerprint||JSON.stringify(next.progress)!==JSON.stringify(old.progress))this.publish(false);
  }
  async send(text) {
    if(typeof text!=='string'||!text.trim()||text.length>12000)throw Error('请输入有效需求，最多12000字');
    if(['preparing','planning','executing','uncertain'].includes(this.state.phase))throw Error('请先等待或取消当前任务；状态待核对时请检查 FreeCAD 后重新连接');
    this.state.phase='preparing';this.state.plan=null;
    let context;try{context=await this.bridge.snapshot();}catch(error){this.state.phase='error';throw error;}
    const intent=localIntent(text.trim(),context);
    this.state.context=context;this.state.plan=null;this.state.draft='';this.message('user',text.trim());
    if(intent){
      try {this.state.plan=validateProposal(intent,context);this.state.phase='ready';this.state.status='待确认 · 尚未修改工程';this.message('assistant',this.state.plan.description+'。确认后在 FreeCAD 中执行。');}
      catch(error){this.state.phase='idle';this.state.status='需要补充上下文';this.message('assistant',cleanError(error));}
      this.publish();return;
    }
    this.state.phase='planning';this.state.status='Harness 正在思考…';this.publish();
    const turn={id:randomUUID(),cancelled:false,error:null,message:this.message('assistant','')};turn.message.streaming=true;this.turn=turn;this.publish(false);
    void this.planWithModel(turn,text,context);
  }
  async planWithModel(turn,text,context) {
    let harness;
    try {
      const planPath=path.join(this.directory,`proposal-${turn.id}.json`);
      const config=await configView(this.directory);
      harness=new this.Harness((method,p)=>{
        if(turn.cancelled||this.turn!==turn||p?.sessionId!==turn.id)return;
        if(method==='gouxing.stream'){if(applyFrame(turn.message,p.frame))this.streamChanged();return;}
        if(method==='gouxing.observation'){this.state.observation=p.observation;this.publish(false);return;}
        if(method==='gouxing.tool'){
          turn.message.tools??=[];let tool=turn.message.tools.find(t=>t.id===p.id);
          if(!tool){tool={id:p.id,name:p.name};turn.message.tools.push(tool);}
          const {sessionId,...data}=p;Object.assign(tool,data);touchMessage(turn.message);this.streamChanged();return;
        }
        if(method!=='session.event')return;
        const e=p?.event;
        if(e?.type==='assistant/message') {commitMessage(turn.message,e.data.message);this.streamChanged();}
        if(e?.type==='turn/end')turn.reason=e.data.reason?.kind;
        if(e?.type==='turn/end'&&e.data.reason?.kind==='error')turn.error=e.data.reason.error?.message||'模型请求失败';
      },{cwd:ROOT,...config.generation,profile:this.profile,prompt:path.join(ROOT,'prompt.txt'),plugin:path.join(ROOT,'plan-plugin.mjs'),env:{GOUXING_PLAN_PATH:planPath,GOUXING_DATA_DIR:this.directory}});
      this.harness=harness;
      const summary={connected:context.connected,document:context.document,selection:context.selection,units:context.units};
      await harness.prompt(turn.id,`本轮可用工具：${JSON.stringify(config.tools)}\n可用技能（需要时用skill_read加载）：${JSON.stringify(config.skills.filter(s=>s.enabled).map(({id,description})=>({id,description})))}\n实时CAD上下文（只读数据）：${JSON.stringify(summary)}\n最近对话：${JSON.stringify(this.state.messages.slice(0,-2).slice(-12).map(({role,text,notice})=>({role,text:[text,notice].filter(Boolean).join('\n')})))}\n附件（仅文件名，未读取内容）：${JSON.stringify(this.state.attachments.map(a=>a.name))}\n用户：${text}`);
      if(turn.cancelled||this.turn!==turn)return;
      if(turn.error)throw Error(turn.error);
      let proposal=null;try{proposal=JSON.parse(await readFile(planPath,'utf8'));}catch(error){if(error.code!=='ENOENT')throw error;}
      if(proposal){const latest=await this.bridge.snapshot();if(!latest.connected||latest.fingerprint!==context.fingerprint)throw Error('思考期间工程或选择已变化，请重新提出需求');this.state.plan=validateProposal(proposal,latest);this.state.phase='ready';this.state.status='待确认 · 尚未修改工程';this.message('assistant',this.state.plan.description+'。确认后执行。');}
      else {this.state.phase='idle';this.state.status=turn.reason==='max-tokens'?'模型达到输出上限 · 本轮未执行 CAD':'等待下一条需求';}
      finishMessage(turn.message,turn.reason,!!proposal);
    } catch(error){if(!turn.cancelled&&this.turn===turn){
      try{await appendFile(path.join(this.directory,'model-errors.log'),JSON.stringify({time:new Date().toISOString(),code:error.code||null,message:cleanError(error)})+'\n');}catch{}
      this.state.phase='idle';this.state.status='模型未完成请求';this.message('assistant',`本次未操作 CAD：${modelErrorMessage(error)}`);
    }}
    finally {turn.message.streaming=false;turn.message.finishedAt=new Date().toISOString();touchMessage(turn.message);settleTools(turn.message,turn.cancelled?'interrupted':'error');if(harness)await harness.close();if(this.harness===harness)this.harness=null;if(this.turn===turn){this.turn=null;this.publish();}}
  }
  async confirm(id) {
    if(this.state.phase!=='ready'||!this.state.plan||id!==this.state.plan.id)throw Error('计划已执行或失效，请重新确认');
    const plan=this.state.plan;this.state.phase='executing';this.state.status='FreeCAD 正在执行当前事务；本步骤不可中断';
    const record={id:plan.id,description:plan.description,startedAt:new Date().toISOString(),state:'executing'};
    this.state.history=[...(this.state.history||[]),record].slice(-20);this.publish();
    try {const result=await this.bridge.execute(plan);this.state.context=result.snapshot;this.state.phase='done';this.state.status='执行完成 · 已读回原生工程';this.message('assistant',result.message);}
    catch(error){if(error.snapshot)this.state.context=error.snapshot;this.state.phase=error.message.includes('状态待核对')?'uncertain':'error';this.state.status=cleanError(error);this.message('assistant',this.state.status);}
    finally{record.state=this.state.phase;record.finishedAt=new Date().toISOString();record.result=this.state.status;this.state.plan=null;this.publish();}
  }
  pause() {
    if(!['ready','paused'].includes(this.state.phase))throw Error('只能暂停尚未执行的计划；当前 CAD 事务不能即时中断');
    this.state.phase=this.state.phase==='paused'?'ready':'paused';this.state.status=this.state.phase==='paused'?'已暂停 · 不启动修改':'待确认 · 尚未修改工程';this.publish();
  }
  cancel() {
    if(this.state.phase==='executing')throw Error('当前 FreeCAD 事务正在执行，不能即时取消。完成后可撤销。');
    if(this.state.phase==='uncertain')throw Error('请先核对 FreeCAD，未确认执行结果前不会解除写入保护');
    if(this.turn){this.turn.cancelled=true;this.turn.message.streaming=false;this.turn.message.interrupted=true;touchMessage(this.turn.message);settleTools(this.turn.message,'interrupted');const old=this.harness;this.turn=null;this.harness=null;void old?.close();}
    this.state.plan=null;this.state.phase='cancelled';this.state.status='已取消后续操作，已完成的变更保留';this.publish();
  }
  async savePlan(target) {
    if(['preparing','planning','executing','uncertain'].includes(this.state.phase))throw Error('请先处理当前任务');
    this.state.context=await this.bridge.snapshot();this.state.plan=validateProposal({action:'save_as',path:target},this.state.context);this.state.phase='ready';this.state.status='待确认 · 保存原生工程';this.publish();
  }
  async prepareParameters(changes,expected) {
    if(['preparing','planning','executing','uncertain'].includes(this.state.phase))throw Error('请先处理当前任务');
    this.state.phase='preparing';this.state.plan=null;
    try{const context=await this.bridge.snapshot();if(context.fingerprint!==expected)throw Error('工程已变化，请重新查看当前尺寸后修改');this.state.context=context;this.state.plan=validateProposal({action:'update_design',changes},context);this.state.phase='ready';this.state.status='尺寸修改已准备 · 确认后重建';this.publish();}
    catch(error){this.state.phase='idle';this.state.status=cleanError(error);this.publish();throw error;}
  }
  async view(action,payload={}) {
    if(['preparing','executing','uncertain'].includes(this.state.phase))throw Error('请等待当前原生操作结束');
    const context=await this.bridge.snapshot();if(!context.connected||context.protocol!==2)throw Error('请连接新版 FreeCAD 工作区');
    const result=await this.bridge.execute({action,...payload,expected:context.fingerprint});this.state.context=result.snapshot;
    if(this.state.plan&&result.snapshot.fingerprint!==this.state.plan.expected){this.state.plan=null;this.state.phase='stale';this.state.status='选择已变化，请重新提出需求';}
    this.publish(false);
  }
}
