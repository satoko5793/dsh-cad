import cadquery as cq
length = 80.0
width = 40.0
thickness = 8.0
hole_diameter = 8.0
edge_offset = 8.0
points = [(x,y) for x in (-length/2+edge_offset,length/2-edge_offset) for y in (-width/2+edge_offset,width/2-edge_offset)]
result = cq.Workplane('XY').box(length,width,thickness).faces('>Z').workplane().pushPoints(points).hole(hole_diameter)
