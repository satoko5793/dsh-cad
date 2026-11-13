import { writeFile } from 'node:fs/promises';
import { defineTool } from '@deepseek-ai/dsh-tools';
import {admitEncodedImages} from '@deepseek-ai/dsh-attachment';
import {FreeCADBridge} from './bridge.mjs';
import {loadConfig,listSkills} from './agent-config.mjs';
import {DESIGN_GUIDE} from './design.mjs';
export const name='freecad-plan-tools';
export const inject=['tools','attachments','llm'];
const notify=(method,params)=>process.stdout.write(JSON.stringify({jsonrpc:'2.0',method,params})+'\n');
export async function apply(ctx) {
  const directory=process.env.GOUXING_DATA_DIR;
  const config=await loadConfig(directory),skills=(await listSkills(directory)).filter(s=>!config.disabledSkills.includes(s.id));
  const bridge=new FreeCADBridge(directory);await bridge.restore();
  const output={schema:{type:'string'},render:(_args,value)=>[{type:'text',text:value}]};
  ctx.on('agent/assistant-stream',({agent,frame})=>notify('gouxing.stream',{sessionId:agent.session.id,frame}));
  ctx.on('tools/execute',async(exec,next)=>{notify('gouxing.tool',{sessionId:exec.agent?.session.id,id:exec.callId,name:exec.name,arguments:exec.arguments,state:'running'});return next();});
  ctx.on('tools/result',(exec,result)=>{notify('gouxing.tool',{sessionId:exec.agent?.session.id,id:exec.callId,name:exec.name,state:result.isError?'error':'done',result:result.content.filter(b=>b.type==='text').map(b=>b.text).join('\n').slice(0,14000)});});
  ctx.tools.register(defineTool({name:'freecad_inspect',description:'Read the latest actual CAD document, selection, native components and geometric checks. Does not modify CAD.',parameters:{},output,async execute(){return JSON.stringify(await bridge.snapshot());}}));
  ctx.tools.register(defineTool({name:'skill_read',description:'Load an enabled skill when relevant. Available: '+JSON.stringify(skills.map(({id,description})=>({id,description}))),parameters:{id:{type:'string',required:true}},output,async execute({id}){const skill=skills.find(s=>s.id===id);if(!skill)throw Error('技能不存在或未启用');return skill.text;}}));
  ctx.tools.register(defineTool({
    name:'freecad_capture',description:'Observe the actual FreeCAD model viewport. view: current, isometric, front, top, right. Temporarily changes camera then restores it. Returns a real image only for a vision-capable model; combine visible evidence with geometry, do not assume manufacturability.',
    parameters:{view:{type:'string',required:true}},
    output:{schema:{type:'string'},render:(_args,value)=>{const v=JSON.parse(value);return [{type:'text',text:JSON.stringify(v.observation)},...(v.attachment?[{type:'image',attachment:v.attachment}]:[])];}},
    async execute({view},exec){
      exec.signal.throwIfAborted();
      const image=await bridge.capture(view);exec.signal.throwIfAborted();
      const selection=exec.agent.model.current()||exec.agent.options;
      const info=await ctx.llm.resolveModelInfo(selection.provider,selection.model,exec.signal);
      const vision=info.inputModalities?.includes('image')===true;
      const {data,...observation}=image;
      const attachment=vision?(await admitEncodedImages(ctx.attachments,[{data,mediaType:'image/png',name:'FreeCAD-'+view+'.png'}]))[0]:null;
      notify('gouxing.observation',{sessionId:exec.agent.session.id,observation:{...observation,vision,dataUrl:`data:image/png;base64,${data}`}});
      return JSON.stringify({observation:{...observation,vision,message:vision?'实际 CAD 图片随此工具结果提供，请根据可见证据检查。':'当前模型未声明图片输入能力；仅截图成功，不能声称已看图。'},attachment});
    }
  }));
  ctx.tools.register(defineTool({
    name:'freecad_propose',
    description:'Propose one supported FreeCAD action for user review. This NEVER executes CAD. Actions: create_design, update_design, create_plate, set_diameter (legacy fixed plate only), undo, redo. create_design also accepts {"example":"enclosure"|"gantry"|"airplane","changes":{parameterId:value}} to start from tested examples. enclosure parameter IDs: length,width,height,wall,lidThickness,postDiameter,screwDiameter,lidHoleDiameter,inset,lipDepth,clearance,gap. gantry: length,width,baseThickness,postWidth,postDepth,postHeight,edge,beamHeight,carriageLength,carriageWidth,carriageThickness,carriageX. airplane: length,bodyWidth,bodyHeight,span,wingThickness,tailSpan. '+DESIGN_GUIDE,
    parameters:{action:{type:'string',required:true},parametersJson:{type:'string',required:true},explanation:{type:'string',required:true}},
    output:{schema:{type:'string'},render:(_args,value)=>[{type:'text',text:value}]},
    async execute(args) {
      try {
        const params=JSON.parse(args.parametersJson);
        if(!['create_plate','set_diameter','create_design','update_design','undo','redo'].includes(args.action))throw Error('Unsupported operation');
        await writeFile(process.env.GOUXING_PLAN_PATH,JSON.stringify({action:args.action,diameter:params.diameter,design:params.design,example:params.example,changes:params.changes,explanation:args.explanation}),{flag:'wx'});
        return JSON.stringify({ok:true,proposed:true,executed:false,message:'仅生成待确认计划，CAD 尚未修改。'});
      } catch(error){return JSON.stringify({ok:false,error:error.message});}
    }
  }));
  ctx.on('agent/created',({agent})=>agent.ctx.tools.restrict({allow:config.tools}));
}
