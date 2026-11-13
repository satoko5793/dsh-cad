import { writeFile } from 'node:fs/promises';
import { defineTool } from '@deepseek-ai/dsh-tools';
import {DESIGN_GUIDE} from './design.mjs';
export const name='freecad-plan-tools';
export const inject=['tools'];
export function apply(ctx) {
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
  ctx.on('agent/created',({agent})=>agent.ctx.tools.restrict({allow:['freecad_propose']}));
}
