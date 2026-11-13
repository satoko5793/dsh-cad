import { app, BrowserWindow, ipcMain, dialog, globalShortcut, screen, Menu } from 'electron';
import { readFile, mkdir, copyFile, access } from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { FreeCADBridge, ROOT, atomicJson } from './bridge.mjs';
import { Session, cleanError } from './session.mjs';

const data=process.env.GOUXING_DATA_DIR||path.join(ROOT,'.data');
app.setName('构形');app.setPath('userData',path.join(data,'electron'));
if(!app.requestSingleInstanceLock()){app.quit();}else{void start().catch(error=>{console.error(cleanError(error));app.exit(1);});}
async function start(){
  await app.whenReady();
  const appVersion=JSON.parse(await readFile(path.join(ROOT,'..','package.json'),'utf8')).version;
  await mkdir(data,{recursive:true});
  const bridge=new FreeCADBridge(data);await bridge.restore();
  const session=new Session(data,bridge);await session.load();await session.poll();
  let preferences={small:false,pinned:true,full:{width:1120,height:800},compact:{width:390,height:590},freecad:''};
  try{preferences={...preferences,...JSON.parse(await readFile(path.join(data,'window.json'),'utf8'))};}catch(error){if(error.code!=='ENOENT')throw error;}
  let exiting=false,changing=false,closeDialog=false;
  const visibleBounds=b=>{const area=screen.getDisplayMatching({x:0,y:0,...b}).workArea;const width=Math.min(Math.max(b.width||390,360),area.width),height=Math.min(Math.max(b.height||590,460),area.height);return {width,height,x:Math.max(area.x,Math.min(b.x??area.x+60,area.x+area.width-width)),y:Math.max(area.y,Math.min(b.y??area.y+60,area.y+area.height-height))};};
  const window=new BrowserWindow({...visibleBounds(preferences.small?preferences.compact:preferences.full),minWidth:preferences.small?360:760,minHeight:460,frame:false,show:false,title:'构形 · CAD 助手',backgroundColor:'#f5f6f8',
    webPreferences:{preload:path.join(ROOT,'preload.cjs'),contextIsolation:true,nodeIntegration:false,sandbox:true,backgroundThrottling:false}});
  Menu.setApplicationMenu(null);
  const entry=pathToFileURL(path.join(ROOT,'ui','index.html')).href;
  window.webContents.setWindowOpenHandler(()=>({action:'deny'}));
  window.webContents.on('will-navigate',(event,url)=>{if(url!==entry)event.preventDefault();});
  window.webContents.session.setPermissionRequestHandler((_wc,_permission,callback)=>callback(false));
  window.setAlwaysOnTop(preferences.small&&preferences.pinned);
  const snapshot=()=>({...session.state,app:{version:appVersion},window:{small:preferences.small,pinned:preferences.pinned,shortcut:shortcutOk?'Ctrl + Alt + Space':'快捷键注册失败，可从任务栏恢复'},model:{provider:process.env.CAD_LLM_PROVIDER||'deepseek-official',name:process.env.CAD_LLM_MODEL||'deepseek-flash'}});
  const broadcast=()=>{if(!window.isDestroyed())window.webContents.send('harness:state',snapshot());};
  const persistPreferences=()=>atomicJson(path.join(data,'window.json'),preferences).catch(error=>{session.state.status=`窗口设置保存失败：${cleanError(error)}`;broadcast();});
  session.on('change',broadcast);session.on('storageError',error=>{session.state.status=`会话保存失败：${cleanError(error)}`;broadcast();});
  const toggle=()=>{changing=true;preferences[preferences.small?'compact':'full']=window.getBounds();preferences.small=!preferences.small;window.setMinimumSize(preferences.small?360:760,460);window.setBounds(visibleBounds(preferences.small?preferences.compact:preferences.full));window.setAlwaysOnTop(preferences.small&&preferences.pinned);changing=false;void persistPreferences();broadcast();};
  let boundsTimer;
  for(const event of ['move','resize'])window.on(event,()=>{if(changing)return;clearTimeout(boundsTimer);boundsTimer=setTimeout(()=>{preferences[preferences.small?'compact':'full']=window.getBounds();void persistPreferences();},250);});
  screen.on('display-removed',()=>window.setBounds(visibleBounds(window.getBounds())));
  const show=()=>{if(window.isMinimized())window.restore();window.show();window.focus();};
  app.on('second-instance',show);
  const shortcutOk=globalShortcut.register('CommandOrControl+Alt+Space',()=>{if(window.isFocused()&&!window.isMinimized())window.minimize();else show();});
  globalShortcut.register('CommandOrControl+Alt+M',()=>{toggle();show();});
  ipcMain.handle('harness:call',async(event,method,payload)=>{
    if(event.sender!==window.webContents||event.senderFrame!==window.webContents.mainFrame||event.senderFrame.url!==entry)throw Error('Invalid IPC sender');
    try{
      switch(method){
        case 'state':return snapshot();
        case 'draft':if(typeof payload!=='string'||payload.length>12000)throw Error('草稿最多12000字');session.state.draft=payload;session.publish();break;
        case 'send':await session.send(payload);break;
        case 'confirm':await session.confirm(payload);break;
        case 'pause':session.pause();break;
        case 'cancel':session.cancel();break;
        case 'parameters':await session.prepareParameters(payload?.changes,payload?.expected);break;
        case 'select-component':if(typeof payload!=='string')throw Error('请选择零件');await session.view('select_component',{componentId:payload});break;
        case 'focus-cad':await session.view('focus_cad');break;
        case 'toggle':toggle();break;
        case 'pin':preferences.pinned=!preferences.pinned;window.setAlwaysOnTop(preferences.small&&preferences.pinned);await persistPreferences();broadcast();break;
        case 'minimize':window.minimize();break;
        case 'close':window.close();break;
        case 'connect':{
          const current=await bridge.snapshot();if(current.connected&&current.protocol===2)break;
          let executable=process.env.FREECAD_EXE||preferences.freecad;
          if(executable){try{await access(executable);}catch{executable='';}}
          if(!executable){const selected=await dialog.showOpenDialog(window,{title:'选择 FreeCAD.exe',properties:['openFile'],filters:[{name:'FreeCAD',extensions:['exe']}]});if(selected.canceled)break;executable=selected.filePaths[0];}
          if(path.basename(executable).toLowerCase()!=='freecad.exe')throw Error('请选择 FreeCAD.exe');
          session.state.status='正在启动专用 FreeCAD 实例…';session.publish(false);
          await bridge.connect(executable);preferences.freecad=executable;await persistPreferences();
          session.state.status='FreeCAD 已连接 · 可创建多零件设计';await session.poll();session.publish();break;
        }
        case 'save':{
          if(!session.state.context.document?.owned)throw Error('请先创建本应用支持的工程');
          const selected=await dialog.showSaveDialog(window,{title:'另存 FreeCAD 原生工程（不覆盖已有文件）',defaultPath:(session.state.context.document.label||'设计')+'.FCStd',filters:[{name:'FreeCAD 原生工程',extensions:['FCStd']}]});
          if(!selected.canceled&&selected.filePath)await session.savePlan(selected.filePath);break;
        }
        case 'open':{
          if(['preparing','planning','executing','uncertain'].includes(session.state.phase))throw Error('请先处理当前任务');
          const selected=await dialog.showOpenDialog(window,{title:'打开 FreeCAD 原生工程',properties:['openFile'],filters:[{name:'FreeCAD 原生工程',extensions:['FCStd']}]});
          if(!selected.canceled&&selected.filePaths[0]){const {validateProposal}=await import('./session.mjs');const context=await bridge.snapshot();session.state.context=context;session.state.plan=validateProposal({action:'open_native',path:selected.filePaths[0]},context);session.state.phase='ready';session.state.status='待确认 · 打开原生工程';session.publish();}break;
        }
        case 'attach':{
          const selected=await dialog.showOpenDialog(window,{title:'附加本地参考文件（首版仅保留附件，不解析内容）',properties:['openFile','multiSelections']});
          if(selected.canceled)break;
          if(session.state.attachments.length+selected.filePaths.length>12)throw Error('每个会话最多12个附件');
          const destination=path.join(data,'attachments');await mkdir(destination,{recursive:true});
          for(const file of selected.filePaths){const id=randomUUID(),name=path.basename(file),stored=path.join(destination,id+path.extname(name));await copyFile(file,stored);session.state.attachments.push({id,name});}
          session.publish();break;
        }
        default:throw Error('Unsupported action');
      }
      return {ok:true};
    }catch(error){return {ok:false,error:cleanError(error)};}
  });
  window.on('close',event=>{
    if(exiting)return;event.preventDefault();if(closeDialog)return;closeDialog=true;
    void (async()=>{
      const running=['planning','executing','uncertain'].includes(session.state.phase);
      const answer=await dialog.showMessageBox(window,{type:'question',title:'退出构形',message:running?'当前任务尚未结束，退出将停止后续操作。':'退出构形？',detail:'会话和草稿会保留。FreeCAD 将保持打开，未保存的工程由你继续处理。已开始的 CAD 事务不会被强行终止。',buttons:['继续使用','退出应用'],defaultId:0,cancelId:0});
      if(answer.response===1){exiting=true;if(session.turn)session.turn.cancelled=true;await session.harness?.close();await session.saving;clearInterval(pollTimer);globalShortcut.unregisterAll();window.destroy();app.quit();}closeDialog=false;
    })();
  });
  const pollTimer=setInterval(()=>void session.poll().catch(error=>{session.state.status=cleanError(error);broadcast();}),650);
  app.on('will-quit',()=>globalShortcut.unregisterAll());
  await window.loadFile(path.join(ROOT,'ui','index.html'));window.setTitle(`构形 · CAD 助手 v${appVersion}`);window.show();
}
