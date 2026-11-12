import { buildModel } from './build.mjs';
import { defineTool } from '@deepseek-ai/dsh-tools';
export const name = 'cad-studio-tools';
export const inject = ['tools'];
export function apply(ctx) {
  ctx.tools.register(defineTool({
    name:'cad_build',
    description:'Build or revise a real parametric mechanical CAD solid using CadQuery 2.8. Provide complete Python source assigning a cq.Workplane/cq.Shape to result. cq and math are preloaded. Read ALL editable dimensions from params. No file/network/process access. Only import cadquery as cq or import math if necessary. The worker checks geometry and exports STEP and STL automatically. On failure, correct the geometry/code and retry at most 3 times. Success returns a revision and measured geometry in mm. Never claim a model exists before success.',
    parameters:{projectId:{type:'string',required:true,description:'Exact project ID provided in the application context'},title:{type:'string',required:true,description:'Short Chinese part name without dimensions, e.g. 四孔安装板'},source:{type:'string',required:true,description:'Full CadQuery Python source. Use params dictionary for dimensions. Assign final solid to result.'},parametersJson:{type:'string',required:true,description:'JSON object of numeric dimensions. Lengths in mm, angles in degrees, counts as integers.'},parameterSpecJson:{type:'string',description:'Optional JSON parameter labels, units and steps. Example {"length":{"label":"长度","unit":"mm","step":1},"hole_count":{"label":"孔数量","unit":"个","integer":true}}. Only provide min/max for actual design constraints.'}},
    output:{schema:{type:'string'},render:(_args,value)=>[{type:'text',text:value}]},
    async execute(args, exec) {
      try {const revision=await buildModel({...args,parameters:JSON.parse(args.parametersJson),parameterSpec:args.parameterSpecJson?JSON.parse(args.parameterSpecJson):undefined},exec.signal);return JSON.stringify({ok:true,revision});}
      catch(error) {return JSON.stringify({ok:false,error:error.message});}
    }
  }));
  ctx.on('agent/created', ({agent}) => { agent.ctx.tools.restrict({allow:['cad_build']}); });
}
