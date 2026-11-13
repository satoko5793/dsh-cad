import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {ROOT} from './bridge.mjs';
export const NATIVE_TOOLS=JSON.parse(await readFile(path.join(ROOT,'native-catalog.json'),'utf8'));
export const nativeTool=name=>NATIVE_TOOLS.find(t=>t.name===name||t.method===name);
function matches(schema,value){if(schema.oneOf)return schema.oneOf.filter(s=>matches(s,value)).length===1;switch(schema.type){case 'json':return true;case 'null':return value===null;case 'string':return typeof value==='string';case 'number':return typeof value==='number'&&Number.isFinite(value);case 'integer':return Number.isInteger(value);case 'boolean':return typeof value==='boolean';case 'array':return Array.isArray(value)&&(!schema.items||value.every(v=>matches(schema.items,v)));default:return false;}}
function bounded(value,depth=0){
  if(depth>12)throw Error('接口参数嵌套过深');
  if(typeof value==='number'&&(!Number.isFinite(value)||Math.abs(value)>1000000))throw Error('接口数值无效');
  if(typeof value==='string'&&value.length>6000)throw Error('接口字符串过长');
  if(Array.isArray(value)&&value.length>1000)throw Error('接口数组过长');
  if(value&&typeof value==='object')for(const [key,child] of Object.entries(value)){if(['__proto__','prototype','constructor'].includes(key))throw Error('无效的接口字段');bounded(child,depth+1);}
}
export function validateNativeCall(method,args){
  const tool=nativeTool(method);if(!tool)throw Error('未接入这项原生接口');
  if(!args||typeof args!=='object'||Array.isArray(args)||JSON.stringify(args).length>24000)throw Error('接口参数无效或过大');bounded(args);
  for(const key of Object.keys(args))if(!Object.hasOwn(tool.parameters,key))throw Error(`未知接口参数：${key}`);
  for(const [key,p] of Object.entries(tool.parameters))if(p.required&&args[key]===undefined)throw Error(`缺少接口参数：${key}`);
  for(const [key,value] of Object.entries(args))if(!matches(tool.parameters[key],value))throw Error(`接口参数类型不匹配：${key}`);
  if(args.count!==undefined&&(!Number.isInteger(args.count)||args.count<1||args.count>100))throw Error('阵列数量需为1至100');
  return {method:tool.method,args:structuredClone(args)};
}
export function validateNativeOperations(operations,context){
  if(!context.connected||!context.capabilities?.includes('native_interfaces'))throw Error('请升级 FreeCAD 连接后使用原生接口；原工程保持打开');
  if(!Array.isArray(operations)||!operations.length||operations.length>100||JSON.stringify(operations).length>160000)throw Error('原生计划需包含1至100项操作');
  const ops=operations.map(o=>validateNativeCall(o.method,o.args));
  if(ops.some(o=>nativeTool(o.method).readOnly))throw Error('只读接口不应进入修改计划');
  const creates=ops.filter(o=>o.method==='doc.create'),exports=ops.filter(o=>o.method.startsWith('io.export_'));
  if(creates.length>1||(creates.length&&ops[0].method!=='doc.create'))throw Error('新建工程必须是首项，且每个计划仅操作一个工程');
  if(exports.length&&(ops.length!==1))throw Error('文件导出请单独提出计划，不能混在几何事务中');
  if(!creates.length&&!exports.length&&!context.document?.owned)throw Error('当前外来工程只读，请先创建本应用的原生工程');
  if(!creates.length&&context.document?.editable===false)throw Error('检测到手工修改配方，请先核对，不能覆盖');
  const target=creates[0]?.args.name||context.document?.name;
  for(const op of ops){if(op.args.doc&&op.args.doc!==target)throw Error('接口目标不是本次工程');if(op.method==='doc.recompute'&&op.args.name&&op.args.name!==target)throw Error('重算目标不是本次工程');}
  return ops;
}
