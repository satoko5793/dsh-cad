// Explicit installed FreeCAD integration: native interfaces, not LLM-written Python.
import {randomUUID} from 'node:crypto';
import {stat,mkdir} from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import {FreeCADBridge,ROOT,atomicJson} from '../bridge.mjs';
import {validateProposal} from '../session.mjs';
process.env.GOUXING_CAD_WORKSPACE ||= path.join(ROOT,'.data','cad-workspace');
const directory=process.env.GOUXING_NATIVE_TEST_DIR||path.join(ROOT,'.data','native-interfaces',randomUUID()),bridge=new FreeCADBridge(directory);
assert.ok(path.resolve(directory).startsWith(path.join(ROOT,'.data','native-interfaces')+path.sep));
await mkdir(directory,{recursive:true});await bridge.restore();if(!(await bridge.snapshot()).connected)await bridge.connect(process.env.FREECAD_EXE);console.log('NATIVE_TEST_DIR='+directory);const checks=[],used=new Set(),runId=randomUUID().slice(0,6);
const op=(method,args={})=>({method,args});
async function run(name,ops,verify=()=>{}){
  for(const o of ops)if(o.method==='doc.create')o.args.name+='_'+runId;
  try{const context=await bridge.snapshot(),plan=validateProposal({action:'native_operations',operations:ops},context);const result=await bridge.execute(plan);for(const o of ops)used.add(o.method);await verify(result.snapshot,result);checks.push({name,passed:true});console.log('PASS '+name);return result;}
  catch(error){await atomicJson(path.join(directory,'failure.json'),{name,message:error.message,checks});throw Error(name+': '+error.message);}
}
async function read(method,args={}){const c=await bridge.snapshot(),r=await bridge.execute({action:'native_read',operation:op(method,args),expected:c.fingerprint});used.add(method);return r.value;}
const component=(c,name)=>c.document.components.find(p=>p.object===name);
await run('primitive solids and native document',[
  op('doc.create',{name:'NativePrimitives'}),op('part.box',{length:20,width:20,height:10,label:'Box'}),
  op('part.cylinder',{radius:3,height:15,pos:[10,10,-2],label:'Bore'}),op('part.sphere',{radius:4,pos:[18,10,10],label:'Ball'}),
  op('part.cone',{radius1:4,radius2:1,height:15,pos:[35,0,0],label:'Cone'}),op('part.torus',{radius1:8,radius2:2,pos:[60,0,0],label:'Torus'}),op('part.plane',{length:10,width:10,pos:[80,0,0],label:'Surface'})
],c=>{assert.ok(Math.abs(component(c,'Box').volume-4000)<1e-6);assert.ok(Math.abs(component(c,'Bore').dimensions[0]-6)<1e-6);assert.ok(Math.abs(component(c,'Ball').dimensions[2]-8)<1e-6);});
for(const [method,args] of [['doc.list',{}],['obj.list',{}],['obj.get_tree',{}],['obj.get',{name:'Box'}],['obj.get_properties',{name:'Box'}],['view.set_view',{direction:'iso'}],['view.fit_all',{}]])await read(method,args);
await run('boolean, fillet, chamfer, mirror and Part arrays',[
  op('part.cut',{base:'Box',tool:'Bore',label:'Cut'}),op('part.fuse',{base:'Box',tool:'Ball',label:'Fuse'}),op('part.common',{base:'Box',tool:'Bore',label:'Common'}),
  op('part.fillet',{base:'Box',edges:[1],radius:1,label:'Rounded'}),op('part.chamfer',{base:'Box',edges:[1],size:.5,label:'Beveled'}),
  op('part.mirror',{source:'Cone',normal:[0,1,0],base_point:[0,20,0],label:'MirrorCone'}),
  op('part.pattern_linear',{source:'Cone',direction:[1,0,0],count:3,interval:15,label:'LineArray'}),
  op('part.pattern_polar',{source:'Cone',axis:[0,0,1],count:3,angle:360,label:'PolarArray'})
],c=>assert.ok(component(c,'Cut').volume<4000));
await run('mirror copy retains source; bounded native view properties',[
  op('part.box',{label:'MirrorSource',pos:[0,80,0]}),op('part.mirror',{source:'MirrorSource',normal:[1,0,0],label:'MirrorCopy'}),
  op('obj.set_property',{name:'MirrorSource',prop:'ViewObject.ShapeColor',value:[.4,.6,.8]}),op('obj.set_property',{name:'MirrorSource',prop:'ViewObject.DisplayMode',value:'Flat Lines'}),op('obj.set_property',{name:'MirrorCopy',prop:'ViewObject.Transparency',value:20})
],c=>{assert.ok(component(c,'MirrorSource'));assert.ok(component(c,'MirrorCopy'));assert.ok(c.document.objects.find(o=>o.name==='MirrorSource').visible);});
const style=await read('obj.get_properties',{name:'MirrorSource'});assert.ok(style.view.Visibility);assert.ok(Math.abs(style.view.ShapeColor[0]-.4)<1e-5);
await run('sketch planes, solid extrusion, revolution, loft and sweep',[
  op('doc.create',{name:'NativeProfiles'}),
  op('sketch.create',{plane:'xy',label:'Outline'}),op('sketch.add_polyline',{sketch:'Outline',points:[[0,0],[20,0],[20,10],[0,10]],closed:true}),op('part.extrude',{profile:'Outline',direction:[0,0,1],length:8,label:'Extruded'}),
  op('sketch.create',{plane:'xz',pos:[40,0,0],label:'RevProfile'}),op('sketch.add_polyline',{sketch:'RevProfile',points:[[0,0],[5,0],[5,20],[0,20]],closed:true}),op('part.revolve',{profile:'RevProfile',axis:[0,0,1],base_point:[40,0,0],angle:360,label:'Revolved'}),
  op('sketch.create',{plane:'yz',pos:[0,35,0],label:'Section1'}),op('sketch.add_circle',{sketch:'Section1',center:[0,0],radius:4}),
  op('sketch.create',{plane:'yz',pos:[30,35,0],label:'Section2'}),op('sketch.add_circle',{sketch:'Section2',center:[0,0],radius:7}),op('part.loft',{sections:['Section1','Section2'],solid:true,label:'Lofted'}),
  op('sketch.create',{plane:'xy',pos:[70,0,0],label:'SweepCircle'}),op('sketch.add_circle',{sketch:'SweepCircle',center:[0,0],radius:2}),
  op('sketch.create',{plane:'xz',pos:[70,0,0],label:'SweepPath'}),op('sketch.add_line',{sketch:'SweepPath',start:[0,0],end:[0,20]}),op('part.sweep',{profile:'SweepCircle',path:'SweepPath',label:'Swept'})
],c=>{assert.ok(Math.abs(component(c,'Extruded').volume-1600)<1e-6);assert.ok(Math.abs(component(c,'Revolved').volume-Math.PI*25*20)<.001);assert.ok(Math.abs(component(c,'Lofted').dimensions[0]-30)<1e-6);});
await run('PartDesign body, pad, pocket and edge treatments',[
  op('doc.create',{name:'NativeBodies'}),op('pd.create_body',{label:'PlateBody'}),op('sketch.create',{plane:'xy',label:'PlateOutline'}),
  op('sketch.add_polyline',{sketch:'PlateOutline',points:[[0,0],[30,0],[30,20],[0,20]],closed:true}),op('pd.pad',{body:'PlateBody',profile:'PlateOutline',length:8,label:'Pad'}),
  op('sketch.create',{plane:'xy',pos:[0,0,8],label:'HoleOutline'}),op('sketch.add_circle',{sketch:'HoleOutline',center:[15,10],radius:3}),op('pd.pocket',{body:'PlateBody',profile:'HoleOutline',length:8,label:'Pocket'}),
  op('pd.fillet',{body:'PlateBody',base_feature:'Pocket',edges:['Edge1'],radius:.5,label:'Fillet'}),op('pd.chamfer',{body:'PlateBody',base_feature:'Fillet',edges:['Edge1'],size:.2,label:'Chamfer'})
],c=>assert.ok(component(c,'PlateBody').valid));
await run('PartDesign revolution and groove',[
  op('pd.create_body',{label:'TurnedBody'}),op('sketch.create',{plane:'xz',label:'TurnProfile'}),op('sketch.add_polyline',{sketch:'TurnProfile',points:[[0,0],[5,0],[5,20],[0,20]],closed:true}),op('pd.revolution',{body:'TurnedBody',profile:'TurnProfile',axis:[0,0,1],label:'Revolution'}),
  op('sketch.create',{plane:'xz',label:'GrooveProfile'}),op('sketch.add_polyline',{sketch:'GrooveProfile',points:[[2,5],[4,5],[4,12],[2,12]],closed:true}),op('pd.groove',{body:'TurnedBody',profile:'GrooveProfile',axis:[0,0,1],label:'Groove'})
],c=>assert.ok(component(c,'TurnedBody').volume<Math.PI*25*20));
await run('PartDesign linear/polar patterns and mirror',[
  op('pd.create_body',{label:'PatternBody'}),op('sketch.create',{plane:'xy',label:'PatternBase'}),op('sketch.add_polyline',{sketch:'PatternBase',points:[[-20,-20],[20,-20],[20,20],[-20,20]],closed:true}),op('pd.pad',{body:'PatternBody',profile:'PatternBase',length:5,label:'PatternPad'}),
  op('sketch.create',{plane:'xy',pos:[0,0,5],label:'BossProfile'}),op('sketch.add_circle',{sketch:'BossProfile',center:[5,5],radius:2}),op('pd.pad',{body:'PatternBody',profile:'BossProfile',length:3,label:'Boss'}),
  op('pd.pattern_linear',{body:'PatternBody',originals:['Boss'],direction:[1,0,0],count:2,length:8,label:'LinearPattern'}),op('pd.pattern_polar',{body:'PatternBody',originals:['Boss'],axis:[0,0,1],count:4,angle:360,label:'PolarPattern'}),op('pd.mirrored',{body:'PatternBody',originals:['Boss'],normal:[1,0,0],label:'Mirrored'})
],c=>assert.ok(component(c,'PatternBody').valid));
await run('spreadsheet parameters and expression-driven property editing',[
  op('doc.create',{name:'NativeParameters'}),op('part.box',{length:10,width:10,height:5,label:'ParamBox'}),op('sheet.create',{label:'Params'}),op('sheet.set_cell',{sheet:'Params',cell:'A1',value:'20'}),op('sheet.set_alias',{sheet:'Params',cell:'A1',alias:'length'}),op('expr.set',{name:'ParamBox',prop:'Length',expression:'Params.length'}),op('sheet.set_cell',{sheet:'Params',cell:'A1',value:'30'}),op('doc.recompute',{})
],c=>assert.equal(component(c,'ParamBox').dimensions[0],30));
assert.equal((await read('sheet.get_cell',{sheet:'Params',cell:'A1'})).contents,'30');await read('expr.get',{name:'ParamBox'});
await run('property, placement, label and expression removal',[
  op('expr.clear',{name:'ParamBox',prop:'Length'}),op('obj.set_property',{name:'ParamBox',prop:'Length',value:35}),op('obj.set_placement',{name:'ParamBox',pos:[5,0,0]}),op('obj.set_label',{name:'ParamBox',label:'参数方块'})
],c=>{assert.equal(component(c,'ParamBox').dimensions[0],35);assert.equal(component(c,'ParamBox').bounds[0],5);});
await run('sketch editing and constraints',[
  op('sketch.create',{plane:'xy',label:'EditSketch'}),op('sketch.add_line',{sketch:'EditSketch',start:[0,0],end:[10,0]}),op('sketch.add_circle',{sketch:'EditSketch',center:[10,10],radius:3}),op('sketch.add_arc',{sketch:'EditSketch',center:[20,20],radius:3,start_angle:0,end_angle:90}),op('sketch.add_point',{sketch:'EditSketch',point:[2,2]}),op('sketch.add_constraint',{sketch:'EditSketch',kind:'Distance',refs:[0],value:10}),op('sketch.set_constraint_value',{sketch:'EditSketch',constraint_index:0,value:12})
]);await read('sketch.list_geometry',{sketch:'EditSketch'});await read('sketch.list_constraints',{sketch:'EditSketch'});
await run('delete sketch geometry, constraint and object',[
  op('sketch.delete_constraint',{sketch:'EditSketch',indices:[0]}),op('sketch.delete_geometry',{sketch:'EditSketch',indices:[3,2,1]}),op('obj.delete',{name:'EditSketch'})
]);
for(const format of ['step','iges','stl','obj']){
  const file=path.join(directory,'native-'+runId+'.'+format);await run('export '+format,[op('io.export_'+format,{path:file,names:['ParamBox']})]);assert.ok((await stat(file)).size>0);
}
await run('import STEP',[
  op('doc.create',{name:'NativeImportedStep'}),op('io.import_step',{path:path.join(directory,'native-'+runId+'.step')})
],c=>assert.ok(c.document.objects.some(o=>o.type.startsWith('Part::'))));
await run('import IGES',[
  op('doc.create',{name:'NativeImportedIges'}),op('io.import_iges',{path:path.join(directory,'native-'+runId+'.iges')})
],c=>assert.ok(c.document.objects.some(o=>o.type.startsWith('Part::'))));
const before=await bridge.snapshot();await assert.rejects(bridge.execute({action:'native_operations',expected:before.fingerprint,operations:[op('part.box',{label:'RollbackBox'}),op('part.loft',{sections:['missing1','missing2'],label:'BadLoft'})]}));assert.equal((await bridge.snapshot()).fingerprint,before.fingerprint);checkExtra('invalid batch rolls back all native changes');
await assert.rejects(bridge.execute({action:'native_operations',expected:before.fingerprint,operations:[op('obj.set_property',{name:'ParamBox',doc:'NativeParameters',prop:'Length',value:99})]}));checkExtra('cross-document writes rejected');
function checkExtra(name){checks.push({name,passed:true});console.log('PASS '+name);}
await run('native lifecycle document',[op('doc.create',{name:'NativeLifecycle'}),op('part.box',{label:'LifeBox',length:12,width:9,height:4})]);
let lifecycle=await bridge.snapshot();
await bridge.execute({action:'undo',expected:lifecycle.fingerprint});lifecycle=await bridge.snapshot();assert.ok(lifecycle.document.owned&&lifecycle.document.native);assert.equal(lifecycle.document.components.length,0);
await bridge.execute({action:'redo',expected:lifecycle.fingerprint});lifecycle=await bridge.snapshot();assert.equal(component(lifecycle,'LifeBox').dimensions[0],12);checkExtra('initial transaction undo/redo retains native ownership');
const saved=path.join(directory,'native-'+runId+'.FCStd');await bridge.execute({action:'save_as',path:saved,expected:lifecycle.fingerprint});
await bridge.execute({action:'open_native',path:saved,expected:(await bridge.snapshot()).fingerprint});lifecycle=await bridge.snapshot();assert.ok(lifecycle.document.owned&&lifecycle.document.native);assert.equal(component(lifecycle,'LifeBox').dimensions[0],12);
await run('native save/reopen remains locally editable',[op('obj.set_property',{name:'LifeBox',prop:'Length',value:17})],c=>assert.equal(component(c,'LifeBox').dimensions[0],17));
await atomicJson(path.join(ROOT,'validation','native-interfaces-results.json'),{date:new Date().toISOString(),passed:true,checks,methods:[...used].sort(),methodCount:used.size,note:'Real isolated FreeCAD 1.1.4 native handler execution; no model request. Source methods reuse MIT mcp-freecad with documented adapter fixes.'});
console.log('NATIVE_INTERFACES_PASSED '+directory+' '+used.size+' methods');
