const { contextBridge, ipcRenderer }=require('electron');
const allowed=new Set(['state','draft','send','confirm','pause','cancel','toggle','pin','minimize','close','connect','save','attach','open','parameters','select-component','focus-cad']);
contextBridge.exposeInMainWorld('harness',{
  call:(method,payload)=>{if(!allowed.has(method))return Promise.reject(Error('Unsupported action'));return ipcRenderer.invoke('harness:call',method,payload);},
  onState:listener=>{const handler=(_event,state)=>listener(state);ipcRenderer.on('harness:state',handler);return()=>ipcRenderer.removeListener('harness:state',handler);}
});
