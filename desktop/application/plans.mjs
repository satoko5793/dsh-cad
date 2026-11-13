import {randomUUID} from 'node:crypto';
import {validateDesign,changeParameters} from '../domain/design.mjs';
import {instantiateExample} from '../domain/examples.mjs';
import {validateNativeOperations} from '../cad/freecad/contracts.mjs';

export function validateProposal(raw, snapshot) {
  if(!snapshot.connected)throw Error('请先连接 FreeCAD，再准备操作');
  if(raw.action==='native_operations'){
    const operations=validateNativeOperations(raw.operations,snapshot);
    const explanation=typeof raw.explanation==='string'?raw.explanation.slice(0,1500):'使用原生 CAD 接口创建或修改特征';
    return {id:randomUUID(),action:'native_operations',expected:snapshot.fingerprint,operations,description:`${explanation}（${operations.length} 项原生操作）${snapshot.document?.design&&!operations.some(o=>o.method==='doc.create')?'。本工程将转为原生特征编辑，参数配方面板不再自动重建':''}`,details:operations.map((o,i)=>({label:`${i+1}. ${o.method}`,after:JSON.stringify(o.args),unit:''}))};
  }
  if(!['create_plate','create_design','update_design','set_diameter','undo','redo','save_as','open_native'].includes(raw.action))throw Error('不支持这项 CAD 操作');
  if(!['create_plate','create_design','open_native'].includes(raw.action)&&!snapshot.document?.owned)throw Error('仅能修改本应用创建的工程，其他工程只读取上下文');
  if(['create_design','update_design','open_native'].includes(raw.action)&&snapshot.protocol!==2)throw Error('CAD 连接需要升级，请点击“升级连接”。原来的 CAD 工程会保持打开。');
  const base={id:randomUUID(),action:raw.action,expected:snapshot.fingerprint};
  if(raw.action==='create_design'){
    let source=raw.design;
    if(raw.example)source=instantiateExample(raw.example,raw.changes);
    const design=validateDesign(source);
    return {...base,design,description:`新建「${design.title}」，${design.components.length}个零件：${design.components.map(c=>c.name).join('、')}`,details:Object.entries(design.parameters).map(([key,p])=>({key,label:p.label,after:p.value,unit:p.unit??'mm'}))};
  }
  if(raw.action==='update_design'){
    if(!snapshot.document?.design)throw Error('当前工程不支持多零件参数修改');
    if(snapshot.document.editable===false)throw Error('检测到手动修改原生特征，请先核对工程；不会用旧参数覆盖你的修改');
    const {diff}=changeParameters(snapshot.document.design,raw.changes);
    const affected=snapshot.document.design.components.filter(c=>diff.some(p=>new RegExp(`\\b${p.key}\\b`).test(JSON.stringify([c.position,c.features])))).map(c=>c.name);
    return {...base,changes:Object.fromEntries(diff.map(p=>[p.key,p.after])),details:diff,affected,description:diff.map(p=>`${p.label} ${p.before} → ${p.after}${p.unit}`).join('；')+`。涉及${affected.join('、')||'设计参数'}，其他参数保持不变`};
  }
  if(raw.action==='set_diameter') {
    if(typeof raw.diameter!=='number'||!Number.isFinite(raw.diameter)||raw.diameter<=0||raw.diameter>=16)throw Error('孔径须大于0且小于16mm');
    const s=snapshot.selection;
    if(s.length!==1||s[0].document!==snapshot.document.name||!['ThroughHoles','MountingHoles'].includes(s[0].object)||s[0].subelements.length)throw Error('请在 FreeCAD 特征树选中整个四孔特征；首版不支持单孔或单面修改');
  }
  return {...base,...(raw.action==='set_diameter'?{diameter:raw.diameter}:{}),...(['save_as','open_native'].includes(raw.action)?{path:raw.path}:{}),
    description:raw.action==='create_plate'?'新建 80 × 40 × 5 mm 四孔安装板，四孔直径 6 mm':raw.action==='set_diameter'?`四个孔一同改为 ${raw.diameter} mm，保持板厚、外形和孔位`:raw.action==='save_as'?`另存原生工程：${raw.path}`:raw.action==='open_native'?`打开原生工程：${raw.path}（其他已打开工程保留）`:raw.action==='undo'?'撤销 FreeCAD 最近一个事务':'重做 FreeCAD 最近一个事务'};
}
