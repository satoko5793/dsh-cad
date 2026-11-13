import * as THREE from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {STLLoader} from 'three/addons/loaders/STLLoader.js';
import {componentColor,explodedOffsets} from './viewer-math.js';

export function createViewer({canvas,viewport,onChange,onError}){
  const renderer=new THREE.WebGLRenderer({canvas,antialias:true,alpha:true});
  renderer.setPixelRatio(Math.min(devicePixelRatio,2));renderer.setClearColor(0,0);renderer.outputColorSpace=THREE.SRGBColorSpace;
  const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(35,1,.1,10000),root=new THREE.Group();
  camera.up.set(0,0,1);camera.position.set(120,-150,110);scene.add(root);
  const controls=new OrbitControls(camera,canvas);controls.enableDamping=true;controls.dampingFactor=.08;
  scene.add(new THREE.HemisphereLight(0xffffff,0x879977,2.7));
  const key=new THREE.DirectionalLight(0xfffcf1,4);key.position.set(90,-100,180);scene.add(key);
  const fill=new THREE.DirectionalLight(0xd4e4ff,2);fill.position.set(-100,80,30);scene.add(fill);
  let grid=null,items=[],selected=-1,hovered=-1,explode=0,isolated=false,wire=false,loading=false,warning='',generation=0,abort=null,down=null;
  const raycaster=new THREE.Raycaster(),pointer=new THREE.Vector2();
  const state=()=>({parts:items.filter(i=>i.interactive).map(i=>i.meta),selected,hovered,explode,isolated,loading,warning});
  const notify=()=>onChange(state());
  function disposeItems(){for(const item of items){root.remove(item.group);item.mesh.geometry.dispose();item.mesh.material.dispose();item.edges.geometry.dispose();item.edges.material.dispose();}items=[];if(grid){scene.remove(grid);grid.geometry.dispose();grid.material.dispose();grid=null;}}
  function appearance(){
    const active=hovered>=0?hovered:selected;
    items.forEach((item,i)=>{
      item.group.visible=!isolated||selected<0||i===selected;
      const focused=i===active;
      item.mesh.material.color.set(focused?'#e5ba70':item.color);
      item.mesh.material.emissive.set(focused?'#6b3e08':'#000000');item.mesh.material.emissiveIntensity=focused?.3:0;
      item.mesh.material.wireframe=wire;
      item.edges.visible=!wire||focused;
      item.edges.material.color.set(focused?'#bc6516':item.color);
      item.edges.material.opacity=focused?1:.42;
      item.edges.material.depthTest=!focused;
      item.edges.renderOrder=focused?10:0;
    });
    canvas.style.cursor=hovered>=0?'pointer':'grab';
  }
  function hover(index){const next=items[index]?.interactive&&items[index].group.visible?index:-1;if(next===hovered)return;hovered=next;appearance();notify();}
  function select(index){const wasIsolated=isolated;selected=items[index]?.interactive?index:-1;hovered=-1;if(selected<0)isolated=false;appearance();if(wasIsolated)fit();notify();}
  function pick(event){
    const rect=canvas.getBoundingClientRect();if(!rect.width||!rect.height)return -1;
    pointer.set((event.clientX-rect.left)/rect.width*2-1,-(event.clientY-rect.top)/rect.height*2+1);
    scene.updateMatrixWorld(true);camera.updateMatrixWorld(true);raycaster.setFromCamera(pointer,camera);
    const hit=raycaster.intersectObjects(items.filter(i=>i.group.visible).map(i=>i.mesh),false)[0];
    return hit&&items[hit.object.userData.index]?.interactive?hit.object.userData.index:-1;
  }
  canvas.addEventListener('pointerdown',e=>{if(e.button===0)down={x:e.clientX,y:e.clientY,id:e.pointerId};hover(-1);});
  canvas.addEventListener('pointermove',e=>{if(!e.buttons)hover(pick(e));});
  canvas.addEventListener('pointerleave',()=>hover(-1));
  canvas.addEventListener('pointercancel',()=>{down=null;hover(-1);});
  canvas.addEventListener('pointerup',e=>{if(down?.id===e.pointerId&&Math.hypot(e.clientX-down.x,e.clientY-down.y)<5)select(pick(e));down=null;});
  canvas.addEventListener('keydown',e=>{if(e.key==='Escape')select(-1);});
  function fit(){
    if(!items.length)return;
    root.updateMatrixWorld(true);const box=new THREE.Box3();
    for(const item of items)if(item.group.visible)box.expandByObject(item.group);
    if(box.isEmpty())return;
    const size=box.getSize(new THREE.Vector3()),center=box.getCenter(new THREE.Vector3()),max=Math.max(size.x,size.y,size.z);
    const halfV=THREE.MathUtils.degToRad(camera.fov/2),halfH=Math.atan(Math.tan(halfV)*camera.aspect),distance=size.length()/2/Math.sin(Math.min(halfV,halfH))*1.14;
    const direction=camera.position.clone().sub(controls.target).normalize();
    controls.target.copy(center);camera.position.copy(center).addScaledVector(direction,distance);
    camera.near=Math.max(max/1000,.001);camera.far=Math.max(max*100,distance*3);camera.updateProjectionMatrix();
    controls.minDistance=max*.12;controls.maxDistance=Math.max(max*20,distance*2);controls.update();
  }
  function setExplode(value){
    explode=Math.max(0,Math.min(1,value));
    const offsets=explodedOffsets(items.map(i=>i.meta),explode);
    items.forEach((item,i)=>item.group.position.set(...offsets[i]));hovered=-1;appearance();notify();
  }
  function isolate(value){isolated=!!value&&selected>=0;hovered=-1;appearance();notify();fit();}
  function setWire(value){wire=value;appearance();}
  async function load(viewerURL,modelURL){
    const token=++generation;abort?.abort();abort=new AbortController();const signal=abort.signal;
    disposeItems();selected=hovered=-1;explode=0;isolated=false;warning='';loading=!!modelURL;notify();
    if(!modelURL)return;
    const loader=new STLLoader();let parsed=[];
    async function geometry(url){const r=await fetch(url,{signal});if(!r.ok)throw Error('模型文件读取失败');return loader.parse(await r.arrayBuffer());}
    try{
      let manifest;
      try{const r=await fetch(viewerURL,{signal});if(!r.ok)throw Error('组件视图准备失败');manifest=await r.json();}
      catch(error){if(signal.aborted)throw error;warning='组件视图暂不可用，当前显示整体模型。';manifest={components:[]};}
      const records=manifest.components;
      if(records.length){
        // allSettled keeps every fulfilled geometry reachable for cleanup on partial failure.
        const results=await Promise.allSettled(records.map(async meta=>({geometry:await geometry(meta.url),meta,interactive:true})));
        parsed=results.filter(r=>r.status==='fulfilled').map(r=>r.value);
        const failed=results.find(r=>r.status==='rejected');if(failed)throw failed.reason;
      }else parsed=[{geometry:await geometry(modelURL),meta:{name:'整体模型'},interactive:false}];
      if(token!==generation){for(const p of parsed)p.geometry.dispose();return;}
      const allBounds=new THREE.Box3();
      for(const p of parsed){p.geometry.computeBoundingBox();allBounds.union(p.geometry.boundingBox);}
      const center=allBounds.getCenter(new THREE.Vector3()),size=allBounds.getSize(new THREE.Vector3());
      parsed.forEach((p,index)=>{
        p.geometry.computeVertexNormals();const b=p.geometry.boundingBox;
        const meta={...p.meta,bounds:p.meta.bounds||[b.min.x,b.min.y,b.min.z,b.max.x,b.max.y,b.max.z]};
        p.geometry.translate(-center.x,-center.y,-center.z);
        const color=p.interactive?componentColor(meta.name):'#92b78c';
        const mesh=new THREE.Mesh(p.geometry,new THREE.MeshStandardMaterial({color,metalness:.16,roughness:.45}));mesh.userData.index=index;
        const edges=new THREE.LineSegments(new THREE.EdgesGeometry(p.geometry,30),new THREE.LineBasicMaterial({color,transparent:true,opacity:.42}));
        const group=new THREE.Group();group.add(mesh,edges);root.add(group);items.push({meta,color,mesh,edges,group,interactive:p.interactive});
      });
      parsed=[];
      grid=new THREE.GridHelper(Math.max(size.x,size.y,size.z)*3,30,0xb8c9a9,0xd5dfc9);grid.rotation.x=Math.PI/2;grid.position.z=-size.z/2-.05;grid.material.transparent=true;grid.material.opacity=.5;scene.add(grid);
      loading=false;appearance();notify();fit();
    }catch(error){
      for(const p of parsed)p.geometry.dispose();
      if(token!==generation)return;
      disposeItems();loading=false;warning='模型未加载，请重选版本或刷新页面。';notify();if(!signal.aborted)onError(error.message);
    }
  }
  const observer=new ResizeObserver(()=>{const {width,height}=viewport.getBoundingClientRect();if(!width||!height)return;renderer.setSize(width,height,false);camera.aspect=width/height;camera.updateProjectionMatrix();});observer.observe(viewport);
  renderer.setAnimationLoop(()=>{controls.update();renderer.render(scene,camera);});
  return {load,hover,select,setExplode,isolate,setWire,fit,getState:state};
}
