import json,pathlib
ROOT=pathlib.Path(__file__).resolve().parent
OUT=ROOT/'evidence'; OUT.mkdir(exist_ok=True)
COMMON='''import cadquery as cq
length = 80.0
width = 40.0
thickness = 5.0
hole_diameter = 6.0
edge_offset = 8.0
points = [(x,y) for x in (-length/2+edge_offset,length/2-edge_offset) for y in (-width/2+edge_offset,width/2-edge_offset)]
result = cq.Workplane('XY').box(length,width,thickness).faces('>Z').workplane().pushPoints(points).hole(hole_diameter)
'''
(OUT/'plate-cadquery.py').write_text(COMMON,encoding='utf8')
for name,t,d in [('chamfer-v1',5,6),('chamfer-v2',8,8)]:
    out=OUT/name;out.mkdir(exist_ok=True)
    (out/'user_code.py').write_text(COMMON.replace('thickness = 5.0',f'thickness = {t}.0').replace('hole_diameter = 6.0',f'hole_diameter = {d}.0'),encoding='utf8')
    (out/'config.json').write_text(json.dumps({'render_snapshots':True,'render_png':True,'render_dim_views':True}),encoding='utf8')
soma=OUT/'soma-project';soma.mkdir(exist_ok=True)
source='''import cadquery as cq
from soma import add_part, param
LENGTH = param(80.0,'Length',min=20,max=200,unit='mm')
WIDTH = param(40.0,'Width',min=20,max=120,unit='mm')
THICKNESS = param(5.0,'Thickness',min=1,max=20,unit='mm')
HOLE = param(6.0,'Hole diameter',min=2,max=12,unit='mm')
EDGE = param(8.0,'Edge offset',min=5,max=15,unit='mm')
points=[(x,y) for x in (-LENGTH/2+EDGE,LENGTH/2-EDGE) for y in (-WIDTH/2+EDGE,WIDTH/2-EDGE)]
plate=cq.Workplane('XY').box(LENGTH,WIDTH,THICKNESS).faces('>Z').workplane().pushPoints(points).hole(HOLE)
add_part('Four-hole plate',plate,color=(0.3,0.65,0.5))
'''
(soma/'model.py').write_text(source,encoding='utf8')
