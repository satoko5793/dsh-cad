const colors=['#8eb79b','#89a9c8','#d3a679','#b19dc7','#8ebfc0','#d0ba7c','#bd929c','#a3b881'];
export function componentColor(name){let hash=0;for(const c of name)hash=(hash*31+c.codePointAt(0))>>>0;return colors[hash%colors.length];}
export function explodedOffsets(components,amount){
  if(components.length<2||amount<=0)return components.map(()=>[0,0,0]);
  const lower=[0,1,2].map(axis=>Math.min(...components.map(c=>c.bounds[axis])));
  const upper=[0,1,2].map(axis=>Math.max(...components.map(c=>c.bounds[axis+3])));
  const center=lower.map((v,i)=>(v+upper[i])/2),distance=Math.max(...upper.map((v,i)=>v-lower[i]))*.65*Math.max(0,Math.min(1,amount));
  return components.map((c,index)=>{
    let direction=center.map((v,i)=>(c.bounds[i]+c.bounds[i+3])/2-v);
    let length=Math.hypot(...direction);
    if(length<1e-6){const angle=index*2.399963;direction=[Math.cos(angle),Math.sin(angle),.4];length=Math.hypot(...direction);}
    return direction.map(v=>v/length*distance);
  });
}
