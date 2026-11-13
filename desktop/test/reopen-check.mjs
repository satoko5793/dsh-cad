import {spawn} from 'node:child_process';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
import {ROOT,atomicJson} from '../bridge.mjs';
import {examples} from '../examples.mjs';
if(process.env.GOUXING_ALLOW_ISOLATED_CAD!=='1')throw Error('历史独立进程探针默认停用。日常测试复用同一CAD；确需隔离时显式设置GOUXING_ALLOW_ISOLATED_CAD=1。');
process.env.GOUXING_DISABLE_AUTO_CONNECT='1';
const output=path.join(ROOT,'.data','reopen-validation',randomUUID());await mkdir(output,{recursive:true});
if(!process.env.FREECAD_EXE)throw Error('Set FREECAD_EXE');
const axes={title:'三个方向草图切除验证',parameters:{length:{label:'长度',value:40},width:{label:'宽度',value:30},height:{label:'高度',value:20},crossDiameter:{label:'X轴孔径',value:6}},components:[{id:'block',name:'交叉孔试块',features:[
  {id:'base',kind:'pad',offset:0,depth:'height',profile:{kind:'rectangles',items:[{x:0,y:0,width:'length',height:'width'}]}},
  {id:'xHole',kind:'pocket',plane:'yz',offset:'length',depth:1,throughAll:true,profile:{kind:'circles',diameter:'crossDiameter',centers:[['width/2','height/2']]}},
  {id:'yHole',kind:'pocket',plane:'xz',offset:0,depth:1,throughAll:true,profile:{kind:'circles',diameter:4,centers:[[10,'height/2']]}}
]}]};
await atomicJson(path.join(output,'cases.json'),{...examples,axes});
const macro=path.join(output,'probe.FCMacro');
await writeFile(macro,`exec(compile(open(${JSON.stringify(path.join(ROOT,'test','reopen-check.py').replaceAll('\\','/'))}, encoding='utf-8').read(), 'reopen-check', 'exec'))\n`);
const child=spawn(process.env.FREECAD_EXE,['--user-cfg',path.join(output,'user.cfg'),'--system-cfg',path.join(output,'system.cfg'),macro],{stdio:'ignore',windowsHide:false,env:{...process.env,GOUXING_REOPEN_DIR:output,GOUXING_FEATURES_DIR:path.join(ROOT,'freecad')}});
let failure;child.on('error',e=>failure=e);
const end=Date.now()+120000;let report;
while(Date.now()<end){if(failure)throw failure;try{report=JSON.parse(await readFile(path.join(output,'results.json'),'utf8'));break;}catch(error){if(error.code!=='ENOENT')throw error;}await new Promise(r=>setTimeout(r,250));}
if(!report)throw Error('Native reopen probe timed out');
if(!report.passed)throw Error(report.error);
await mkdir(path.join(ROOT,'validation'),{recursive:true});await atomicJson(path.join(ROOT,'validation','reopen-results.json'),{date:new Date().toISOString(),...report});
console.log('Native reopen checks passed:',report.checks.length);
