import math
flange_d = float(params['flange_diameter'])
flange_t = float(params['flange_thickness'])
sleeve_d = float(params['sleeve_outer_diameter'])
sleeve_h = float(params['sleeve_height'])
step_d = float(params['step_outer_diameter'])
step_h = float(params['step_height'])
bore_d = float(params['bore_diameter'])
keyway_w = float(params['keyway_width'])
keyway_bottom = float(params['keyway_bottom_distance'])
hole_count = int(params['hole_count'])
hole_d = float(params['hole_diameter'])
bolt_circle_d = float(params['bolt_circle_diameter'])
groove_id = float(params['groove_inner_diameter'])
groove_od = float(params['groove_outer_diameter'])
groove_depth = float(params['groove_depth'])
total_h = flange_t + sleeve_h + step_h

def cylinder(diameter, height, z_start=0.0):
    return cq.Workplane('XY').workplane(offset=z_start).circle(diameter / 2.0).extrude(height)
body = cylinder(flange_d, flange_t, 0.0)
body = body.union(cylinder(sleeve_d, sleeve_h, flange_t))
body = body.union(cylinder(step_d, step_h, flange_t + sleeve_h))
body = body.cut(cylinder(bore_d, total_h + 2.0, -1.0))
keyway_tool = cq.Workplane('XY').workplane(offset=-1.0).center(keyway_bottom / 2.0, 0.0).rect(keyway_bottom, keyway_w).extrude(total_h + 2.0)
body = body.cut(keyway_tool)
bolt_r = bolt_circle_d / 2.0
hole_points = []
for i in range(hole_count):
    angle = 2.0 * math.pi * i / hole_count
    hole_points.append((bolt_r * math.cos(angle), bolt_r * math.sin(angle)))
hole_tool = cq.Workplane('XY').workplane(offset=-1.0).pushPoints(hole_points).circle(hole_d / 2.0).extrude(flange_t + 2.0)
body = body.cut(hole_tool)
groove_outer_tool = cylinder(groove_od, groove_depth + 1.0, flange_t - groove_depth)
groove_inner_tool = cylinder(groove_id, groove_depth + 3.0, flange_t - groove_depth - 1.0)
groove_tool = groove_outer_tool.cut(groove_inner_tool)
body = body.cut(groove_tool)
result = body