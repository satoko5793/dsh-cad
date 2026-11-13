// Precise common commands work offline. Everything else goes through the real Harness.
export function localIntent(text,context) {
  if(/^(做|创建|新建|生成)(一个)?(带盖|带上盖的?)?(控制盒|电子盒|电路板盒)[。！!\s]*$/.test(text))return {action:'create_design',example:'enclosure'};
  if(/^(做|创建|新建|生成)(一个)?(五零件)?(小|桌面)?龙门架[。！!\s]*$/.test(text))return {action:'create_design',example:'gantry'};
  if(/^(做|创建|新建|生成)(一个)?简化的?飞机[。！!\s]*$/.test(text))return {action:'create_design',example:'airplane'};
  if(/^(做|创建|新建|生成)(一个)?(四孔)?安装板[。！!\s]*$/.test(text))return {action:'create_plate'};
  const diameter=/^(?:把)?(?:这个孔|这些孔|四个孔|四孔|孔径)(?:直径|的直径|孔径)?(?:改成|改为|设为|变成|改到)(\d+(?:\.\d+)?)\s*(?:毫米|mm)?(?:[，,]?其他不变)?[。！!\s]*$/i.exec(text);
  if(diameter&&!context?.document?.design)return {action:'set_diameter',diameter:Number(diameter[1])};
  if(/^(撤销|撤回)(上一步|一次)?[。！!\s]*$/.test(text))return {action:'undo'};
  if(/^(重做|恢复上一步)[。！!\s]*$/.test(text))return {action:'redo'};
  return null;
}
