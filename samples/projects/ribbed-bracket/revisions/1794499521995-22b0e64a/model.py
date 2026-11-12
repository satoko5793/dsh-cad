import cadquery as cq
bw = float(params['base_width'])
bd = float(params['base_depth'])
bt = float(params['base_thickness'])
pt = float(params['plate_thickness'])
ph = float(params['plate_height'])
motor_d = float(params['motor_hole_diameter'])
motor_z = float(params['motor_hole_center_z'])
mount_d = float(params['mount_hole_diameter'])
mount_dx = float(params['mount_hole_offset_x'])
mount_dz = float(params['mount_hole_offset_z'])
slot_len = float(params['slot_length'])
slot_w = float(params['slot_width'])
slot_x = float(params['slot_offset_x'])
slot_y = float(params['slot_offset_y'])
rib_t = float(params['rib_thickness'])
rib_x = float(params['rib_offset_x'])
rib_y0 = float(params['rib_start_y'])
rib_z1 = float(params['rib_top_z'])
ov = float(params['fuse_overlap'])
half_d = bd / 2.0
plate_front_y = half_d - pt
plate_center_y = half_d - pt / 2.0
base = cq.Workplane('XY').box(bw, bd, bt, centered=(True, True, False))
plate = cq.Workplane('XY').box(bw, pt, ph, centered=(True, True, False)).translate((0, plate_center_y, bt))
body = base.union(plate)

def make_rib():
    pts = [(rib_y0, bt), (rib_y0, bt - ov), (plate_front_y + ov, bt - ov), (plate_front_y + ov, rib_z1), (plate_front_y, rib_z1), (plate_front_y, bt)]
    return cq.Workplane('YZ').polyline(pts).close().extrude(rib_t / 2.0, both=True)
for sx in (-1.0, 1.0):
    body = body.union(make_rib().translate((sx * rib_x, 0, 0)))
slot_centers = [(sx * slot_x, sy * slot_y) for sx in (-1.0, 1.0) for sy in (-1.0, 1.0)]
slot_cut = cq.Workplane('XY').workplane(offset=-ov).pushPoints(slot_centers).slot2D(slot_len, slot_w, 90).extrude(bt + 2.0 * ov)
body = body.cut(slot_cut)
hole_len = pt + 2.0 * ov
motor_cut = cq.Workplane('XZ').center(0, motor_z).circle(motor_d / 2.0).extrude(hole_len / 2.0, both=True).translate((0, plate_center_y, 0))
body = body.cut(motor_cut)
mount_points = [(sx * mount_dx, motor_z + sz * mount_dz) for sx in (-1.0, 1.0) for sz in (-1.0, 1.0)]
mount_cut = cq.Workplane('XZ').pushPoints(mount_points).circle(mount_d / 2.0).extrude(hole_len / 2.0, both=True).translate((0, plate_center_y, 0))
body = body.cut(mount_cut)
result = body