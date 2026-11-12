import cadquery as cq
from soma import add_part, param
LENGTH = param(80.0,'Length',min=20,max=200,unit='mm')
WIDTH = param(40.0,'Width',min=20,max=120,unit='mm')
THICKNESS = param(5.0,'Thickness',min=1,max=20,unit='mm')
HOLE = param(6.0,'Hole diameter',min=2,max=12,unit='mm')
EDGE = param(8.0,'Edge offset',min=5,max=15,unit='mm')
points=[(x,y) for x in (-LENGTH/2+EDGE,LENGTH/2-EDGE) for y in (-WIDTH/2+EDGE,WIDTH/2-EDGE)]
plate=cq.Workplane('XY').box(LENGTH,WIDTH,THICKNESS).faces('>Z').workplane().pushPoints(points).hole(HOLE)
add_part('Four-hole plate',plate,color=(0.3,0.65,0.5))
