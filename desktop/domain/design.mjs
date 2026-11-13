// Data-only feature recipes. Expressions allow arithmetic and parameter names, never code.
export function evaluate(value, parameters) {
  if(typeof value==='number'){if(!Number.isFinite(value)||Math.abs(value)>100000)throw Error('尺寸超出计算范围');return value;}
  if(typeof value!=='string'||value.length>160)throw Error('尺寸必须是数值或简单算式');
  const tokens=value.match(/[A-Za-z][A-Za-z0-9_]*|(?:\d+\.?\d*|\.\d+)|[()+*/-]|\S/g)||[];
  let index=0;
  const atom=()=>{
    const token=tokens[index++];let result;
    if(token==='+'||token==='-')result=(token==='-'?-1:1)*atom();
    else if(token==='('){result=sum();if(tokens[index++]!==')')throw Error('尺寸算式括号不匹配');}
    else if(token&&/^(?:\d+\.?\d*|\.\d+)$/.test(token))result=Number(token);
    else if(token&&Object.hasOwn(parameters,token))result=parameters[token];
    else throw Error(`未知尺寸或非法算式：${token||value}`);
    if(!Number.isFinite(result)||Math.abs(result)>100000)throw Error('尺寸算式结果无效');return result;
  };
  const product=()=>{let n=atom();while(tokens[index]==='*'||tokens[index]==='/'){const op=tokens[index++],rhs=atom();n=op==='*'?n*rhs:n/rhs;if(!Number.isFinite(n)||Math.abs(n)>100000)throw Error('尺寸算式结果无效');}return n;};
  const sum=()=>{let n=product();while(tokens[index]==='+'||tokens[index]==='-'){const op=tokens[index++],rhs=product();n=op==='+'?n+rhs:n-rhs;if(!Number.isFinite(n)||Math.abs(n)>100000)throw Error('尺寸算式结果无效');}return n;};
  const result=sum();if(index!==tokens.length)throw Error('尺寸算式包含不支持的内容');return result;
}
const id=value=>typeof value==='string'&&/^[A-Za-z][A-Za-z0-9_]{0,35}$/.test(value);
const label=value=>typeof value==='string'&&value.trim().length>0&&value.length<=80;
export function validateDesign(input) {
  if(!input||typeof input!=='object'||JSON.stringify(input).length>48000)throw Error('设计数据无效或过大');
  const design=structuredClone(input);
  if(!label(design.title)||!design.parameters||Array.isArray(design.parameters))throw Error('设计缺少名称或参数');
  const entries=Object.entries(design.parameters);if(!entries.length||entries.length>48)throw Error('设计需包含1至48个参数');
  const values={};
  for(const [key,p] of entries){
    if(!id(key)||!p||!label(p.label)||typeof p.value!=='number'||!Number.isFinite(p.value)||Math.abs(p.value)>10000)throw Error(`参数无效：${key}`);
    for(const bound of ['min','max'])if(p[bound]!==undefined&&(typeof p[bound]!=='number'||!Number.isFinite(p[bound])))throw Error('参数范围必须是有限数值');
    if((p.min!==undefined&&p.value<p.min)||(p.max!==undefined&&p.value>p.max))throw Error(`${p.label}超出本设计的约束`);
    if(p.unit!==undefined&&!['mm','°','个',''].includes(p.unit))throw Error('不支持的参数单位');
    values[key]=p.value;
  }
  if(!Array.isArray(design.components)||!design.components.length||design.components.length>12)throw Error('设计需包含1至12个零件');
  const componentIds=new Set();let features=0;
  const dimension=value=>evaluate(value,values);
  const positive=value=>{const n=dimension(value);if(n<=0||n>10000)throw Error('轮廓及拉伸尺寸必须大于0且不超过10000mm');return n;};
  const point=p=>{if(!Array.isArray(p)||p.length!==2)throw Error('轮廓坐标应为二维点');p.forEach(dimension);};
  for(const component of design.components){
    if(!id(component.id)||componentIds.has(component.id)||!label(component.name))throw Error('零件ID需唯一，且必须有名称');componentIds.add(component.id);
    component.position??=[0,0,0];if(!Array.isArray(component.position)||component.position.length!==3)throw Error('零件位置需包含XYZ');component.position.forEach(dimension);
    if(!Array.isArray(component.features)||!component.features.length||component.features.length>12)throw Error('每个零件需包含1至12个特征');
    const names=new Set();
    for(const [i,f] of component.features.entries()){
      features++;
      if(!id(f.id)||names.has(f.id)||!['pad','pocket'].includes(f.kind)||(i===0&&f.kind!=='pad'))throw Error('特征ID需唯一，首个特征须为拉伸');names.add(f.id);
      if(!['xy','xz','yz'].includes(f.plane||'xy'))throw Error('不支持的草图平面');
      dimension(f.offset??0);positive(f.depth??1);
      if(f.throughAll!==undefined&&typeof f.throughAll!=='boolean')throw Error('throughAll必须是布尔值');
      const p=f.profile;if(!p||!['rectangles','circles','polygon'].includes(p.kind))throw Error('支持矩形、圆和多边形草图');
      if(p.kind==='rectangles'){
        if(!Array.isArray(p.items)||!p.items.length||p.items.length>8)throw Error('矩形轮廓数量无效');
        for(const item of p.items){dimension(item.x??0);dimension(item.y??0);positive(item.width);positive(item.height);}
      }else if(p.kind==='circles'){
        positive(p.diameter);if(!Array.isArray(p.centers)||!p.centers.length||p.centers.length>24)throw Error('圆轮廓数量无效');p.centers.forEach(point);
      }else{
        if(!Array.isArray(p.points)||p.points.length<3||p.points.length>32)throw Error('多边形需3至32个顶点');p.points.forEach(point);
      }
    }
  }
  if(features>72)throw Error('单次设计最多72个特征');
  return design;
}
export function changeParameters(design,changes) {
  if(!changes||typeof changes!=='object'||Array.isArray(changes)||!Object.keys(changes).length)throw Error('请指定要修改的参数');
  const next=structuredClone(design),diff=[];
  for(const [key,value] of Object.entries(changes)){
    if(!Object.hasOwn(next.parameters,key)||typeof value!=='number'||!Number.isFinite(value))throw Error(`未知参数或无效数值：${key}`);
    const parameter=next.parameters[key];if(parameter.value!==value){diff.push({key,label:parameter.label,before:parameter.value,after:value,unit:parameter.unit??'mm'});parameter.value=value;}
  }
  if(!diff.length)throw Error('参数没有变化，无需重复建模');
  return {design:validateDesign(next),diff};
}
export const DESIGN_GUIDE=`create_design 的 parametersJson 为 {"design":设计}。设计格式：
{"title":"零件名称","parameters":{"length":{"label":"长度","value":80,"unit":"mm"},"width":{"label":"宽度","value":40},"thickness":{"label":"厚度","value":5}},"components":[{"id":"base","name":"底座","position":[0,0,0],"features":[{"id":"basepad","kind":"pad","plane":"xy","offset":0,"depth":"thickness","profile":{"kind":"rectangles","items":[{"x":0,"y":0,"width":"length","height":"width"}]}}]}]}
尺寸字段可为数值或仅含参数名、数字、+ - * / 括号的算式。参数值必须为有限数值，参数只能存独立值。组件position为XYZ，可用算式；同一组件特征按序形成单个有效实体，各组件是独立Body。
每个特征kind为pad/pocket，plane为xy(法向+Z)、xz(法向-Y，草图XY映射世界XZ)、yz(法向+X，草图XY映射世界YZ)；offset是平面沿其法向轴的坐标（xz为世界Y），depth正数。Pad沿法向生长，Pocket向法向反方向切入，pocket可throughAll:true。
profile支持rectangles/items数组（x,y,width,height，多矩形可构成嵌套环），circles/centers二维坐标数组和diameter，polygon/points二维顶点数组。轮廓坐标相对零件本地原点。所有可改设计尺寸放在parameters，用算式关联；保留组件id和特征id稳定。不要添加源码、表达式函数或其他字段来执行代码。
update_design 的parametersJson为 {"changes":{"参数ID":新数值}}，只改指定参数，保留其余设计结构。无需先在CAD选中对象；若用户说“这个”，依据选择的组件、参数中文标签解析，歧义先问。不支持任意新特征追加、圆角、曲面、运动约束或现有陌生工程编辑。`;
