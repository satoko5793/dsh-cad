const names={length:'长度',width:'宽度',height:'高度',depth:'深度',thickness:'厚度',wall:'壁厚',wall_thickness:'壁厚',base_thickness:'底厚',hole_diameter:'孔径',hole_dia:'孔径',hole_radius:'孔半径',hole_spacing:'孔中心距',hole_offset:'孔中心边距',edge_distance:'孔中心边距',edge_offset:'孔中心边距',hole_edge_offset:'孔中心边距',fillet_radius:'圆角半径',chamfer:'倒角',radius:'半径',diameter:'直径',offset:'偏移',base_length:'底板长度',base_width:'底板宽度',base_height:'底板高度',vertical_height:'竖板高度',plate_length:'板长',plate_width:'板宽',plate_thickness:'板厚',wall_height:'侧壁高度',base_depth:'底板深度',angle:'角度',hole_count:'孔数量',count:'数量',teeth:'齿数'};
export function parameterSpecs(parameters,supplied={}) {
  return Object.fromEntries(Object.entries(parameters).map(([key,value])=>{
    const raw=supplied?.[key] || {};
    const count=/(?:^|_)(?:count|num|teeth)(?:$|_)/i.test(key)||/数量|齿数/.test(key);
    const angle=/angle|角度/i.test(key);
    const positive=/length|width|height|thickness|diameter|depth|长度|宽度|高度|厚度|孔径/.test(key);
    const spec={label:typeof raw.label==='string'&&raw.label.trim()?raw.label.trim().slice(0,40):names[key]||key.replaceAll('_',' '),unit:count?'个':angle?'°':'mm',step:count?1:.1};
    if(['mm','°','个',''].includes(raw.unit))spec.unit=raw.unit;
    if(count)spec.integer=true;
    if(positive&&value>0)spec.positive=true;
    if(Number.isFinite(raw.min))spec.min=raw.min;
    if(Number.isFinite(raw.max))spec.max=raw.max;
    if(Number.isFinite(raw.step)&&raw.step>0)spec.step=raw.step;
    if(raw.integer===true)spec.integer=true;
    if(spec.integer)spec.step=1;
    if(spec.min!==undefined&&spec.max!==undefined&&spec.min>spec.max)throw new Error(`${spec.label}的范围无效`);
    return [key,spec];
  }));
}
export function validateParameters(parameters,specs={}) {
  if(!parameters||typeof parameters!=='object'||Array.isArray(parameters)||Object.keys(parameters).length>60||Object.values(parameters).some(v=>typeof v!=='number'||!Number.isFinite(v)))throw new Error('Parameters must be a numeric dictionary');
  for(const [key,value] of Object.entries(parameters)){
    const spec=specs[key]||{},label=spec.label||names[key]||key;
    if(spec.integer&&!Number.isInteger(value))throw new Error(`${label}需要填写整数`);
    if(spec.positive&&value<=0)throw new Error(`${label}需要大于 0${spec.unit||''}`);
    if(spec.min!==undefined&&value<spec.min)throw new Error(`${label}不能小于 ${spec.min}${spec.unit||''}`);
    if(spec.max!==undefined&&value>spec.max)throw new Error(`${label}不能大于 ${spec.max}${spec.unit||''}`);
  }
  return parameters;
}
