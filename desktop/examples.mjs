import {validateDesign} from './design.mjs';
const p=(label,value)=>({label,value,unit:'mm'});
const rect=(width,height,x=0,y=0)=>({kind:'rectangles',items:[{x,y,width,height}]});
const circles=(diameter,centers)=>({kind:'circles',diameter,centers});
const feature=(id,kind,profile,offset,depth,extra={})=>({id,kind,profile,offset,depth,...extra});
export const enclosure=validateDesign({title:'带定位唇和固定柱的控制盒',parameters:{length:p('盒体长度',90),width:p('盒体宽度',64),height:p('盒体高度',30),wall:p('壁厚',2.5),lidThickness:p('盖子厚度',3),postDiameter:p('固定柱外径',8),screwDiameter:p('螺丝孔径',3),lidHoleDiameter:p('盖子孔径',3.5),inset:p('固定柱中心边距',8),lipDepth:p('盖子定位唇深度',2),clearance:p('定位唇单边间隙',.3),gap:p('盖子与盒体间距',.2)},components:[
  {id:'box',name:'盒体',position:[0,0,0],features:[
    feature('outer','pad',rect('length','width'),0,'height'),
    feature('cavity','pocket',rect('length-2*wall','width-2*wall','wall','wall'),'height','height-wall'),
    feature('posts','pad',circles('postDiameter',[['inset','inset'],['length-inset','inset'],['length-inset','width-inset'],['inset','width-inset']]),'wall','height-wall-3'),
    feature('screwHoles','pocket',circles('screwDiameter',[['inset','inset'],['length-inset','inset'],['length-inset','width-inset'],['inset','width-inset']]),'height-3','height-wall-3')
  ]},
  {id:'lid',name:'上盖',position:[0,0,'height+gap'],features:[
    feature('plate','pad',rect('length','width'),0,'lidThickness'),
    feature('lip','pad',{kind:'rectangles',items:[{x:'wall+clearance',y:'wall+clearance',width:'length-2*wall-2*clearance',height:'width-2*wall-2*clearance'},{x:'2*wall+clearance',y:'2*wall+clearance',width:'length-4*wall-2*clearance',height:'width-4*wall-2*clearance'}]},'-lipDepth','lipDepth'),
    feature('holes','pocket',circles('lidHoleDiameter',[['inset','inset'],['length-inset','inset'],['length-inset','width-inset'],['inset','width-inset']]),'lidThickness',1,{throughAll:true})
  ]}
]});
export const gantry=validateDesign({title:'五零件小龙门架',parameters:{length:p('底座长度',120),width:p('底座宽度',70),baseThickness:p('底座厚度',6),postWidth:p('立柱宽度',10),postDepth:p('立柱深度',18),postHeight:p('立柱高度',65),edge:p('立柱边距',12),beamHeight:p('横梁高度',12),carriageLength:p('滑台长度',24),carriageWidth:p('滑台宽度',26),carriageThickness:p('滑台厚度',8),carriageX:p('滑台X位置',48)},components:[
  {id:'base',name:'底座',features:[feature('pad','pad',rect('length','width'),0,'baseThickness'),feature('mounts','pocket',circles(5,[[8,8],['length-8',8],[8,'width-8'],['length-8','width-8']]),'baseThickness',1,{throughAll:true})]},
  {id:'leftPost',name:'左立柱',position:['edge','(width-postDepth)/2','baseThickness'],features:[feature('pad','pad',rect('postWidth','postDepth'),0,'postHeight')]},
  {id:'rightPost',name:'右立柱',position:['length-edge-postWidth','(width-postDepth)/2','baseThickness'],features:[feature('pad','pad',rect('postWidth','postDepth'),0,'postHeight')]},
  {id:'beam',name:'横梁',position:['edge','(width-postDepth)/2','baseThickness+postHeight'],features:[feature('pad','pad',rect('length-2*edge','postDepth'),0,'beamHeight')]},
  {id:'carriage',name:'滑台',position:['carriageX','(width-carriageWidth)/2','baseThickness+postHeight+beamHeight'],features:[feature('pad','pad',rect('carriageLength','carriageWidth'),0,'carriageThickness'),feature('hole','pocket',circles(6,[['carriageLength/2','carriageWidth/2']]),'carriageThickness',1,{throughAll:true})]}
]});
export const airplane=validateDesign({title:'三零件简化小飞机',parameters:{length:p('机身长度',100),bodyWidth:p('机身宽度',12),bodyHeight:p('机身高度',10),span:p('机翼展长',100),wingThickness:p('机翼厚度',3),tailSpan:p('尾翼展长',38)},components:[
  {id:'fuselage',name:'机身',features:[feature('pad','pad',{kind:'polygon',points:[[0,'bodyWidth/2'],[15,0],['length-8',0],['length','bodyWidth/2'],['length-8','bodyWidth'],[15,'bodyWidth']]},0,'bodyHeight')]},
  {id:'wing',name:'主翼',position:[0,0,'bodyHeight/2'],features:[feature('pad','pad',{kind:'polygon',points:[[35,'bodyWidth/2-span/2'],[53,'bodyWidth/2-span/2'],[65,'bodyWidth/2'],[53,'bodyWidth/2+span/2'],[35,'bodyWidth/2+span/2'],[43,'bodyWidth/2']]},0,'wingThickness')]},
  {id:'tail',name:'尾翼',position:[0,0,'bodyHeight/2'],features:[feature('pad','pad',{kind:'polygon',points:[['length-24','bodyWidth/2-tailSpan/2'],['length-12','bodyWidth/2-tailSpan/2'],['length-4','bodyWidth/2'],['length-12','bodyWidth/2+tailSpan/2'],['length-24','bodyWidth/2+tailSpan/2'],['length-18','bodyWidth/2']]},0,'wingThickness')]}
]});
export const examples={enclosure,gantry,airplane};
