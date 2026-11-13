import { writeFile } from 'node:fs/promises';
import { defineTool } from '@deepseek-ai/dsh-tools';
export const name='freecad-plan-tools';
export const inject=['tools'];
export function apply(ctx) {
  ctx.tools.register(defineTool({
    name:'freecad_propose',
    description:'Propose one supported FreeCAD action for user review. This NEVER executes CAD. Allowed actions: create_plate (only the fixed 80x40x5mm, 4 holes diameter6 plate), set_diameter (all FOUR holes on an owned plate, not one face), undo, redo. ParametersJson is {} or {"diameter":8}. Do not invent arbitrary modeling or save-path capabilities.',
    parameters:{action:{type:'string',required:true},parametersJson:{type:'string',required:true},explanation:{type:'string',required:true}},
    output:{schema:{type:'string'},render:(_args,value)=>[{type:'text',text:value}]},
    async execute(args) {
      try {
        const params=JSON.parse(args.parametersJson);
        if(!['create_plate','set_diameter','undo','redo'].includes(args.action))throw Error('Unsupported operation');
        await writeFile(process.env.GOUXING_PLAN_PATH,JSON.stringify({action:args.action,diameter:params.diameter,explanation:args.explanation}),{flag:'wx'});
        return JSON.stringify({ok:true,proposed:true,executed:false,message:'仅生成待确认计划，CAD 尚未修改。'});
      } catch(error){return JSON.stringify({ok:false,error:error.message});}
    }
  }));
  ctx.on('agent/created',({agent})=>agent.ctx.tools.restrict({allow:['freecad_propose']}));
}
