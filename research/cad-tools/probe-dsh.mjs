import {createModelClient} from './sources/dsh-cad/lib/modeling/client.js';
import {mkdir,writeFile} from 'node:fs/promises';
import path from 'node:path';
const out=path.join(import.meta.dirname,'evidence','dsh-cad');await mkdir(out,{recursive:true});
const client=createModelClient();
const results={};
try{
 for(const [name,thickness,diameter] of [['initial',5,6],['modified',8,8]]){
  await client.run({kind:'reset'});
  await client.run({kind:'create_prim',bodyId:'plate',prim:'box',params:{dx:80,dy:40,dz:thickness}});
  for(const [i,[x,y]] of [[8,8],[72,8],[8,32],[72,32]].entries())await client.run({kind:'create_prim',bodyId:`hole${i}`,prim:'cylinder',params:{radius:diameter/2,height:thickness+2,at:[x,y,-1]}});
  await client.run({kind:'boolean',op:'cut',target:'plate',tools:['hole0','hole1','hole2','hole3']});
  const volume=await client.run({kind:'volume',target:'plate'});
  const step=await client.run({kind:'export',target:'plate',format:'step'});
  const stl=await client.run({kind:'export',target:'plate',format:'stl'});
  await writeFile(path.join(out,`${name}.step`),Buffer.from(step.bytes));await writeFile(path.join(out,`${name}.stl`),Buffer.from(stl.bytes));
  const expected=80*40*thickness-4*Math.PI*(diameter/2)**2*thickness;
  if(Math.abs(volume.volume-expected)>.01)throw new Error(`Volume mismatch ${volume.volume} / ${expected}`);
  results[name]={volume:volume.volume,expected,stepBytes:step.bytes.length,stlBytes:stl.bytes.length,operationCount:7};
 }
 await writeFile(path.join(out,'results.json'),JSON.stringify(results,null,2));console.log(JSON.stringify(results,null,2));
}finally{client.dispose();}
