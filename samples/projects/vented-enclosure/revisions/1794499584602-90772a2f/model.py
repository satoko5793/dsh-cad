import cadquery as cq
p = params
L = float(p['outer_length'])
W = float(p['outer_width'])
H = float(p['outer_height'])
t = float(p['wall_thickness'])
tb = float(p['bottom_thickness'])
px = float(p['post_x_offset'])
py = float(p['post_y_offset'])
post_d = float(p['post_outer_dia'])
post_top = float(p['post_top_z'])
hole_d = float(p['post_hole_dia'])
hole_bottom = float(p['post_hole_bottom_z'])
rib_w = float(p['rib_width'])
rib_top = float(p['rib_top_z'])
port_w = float(p['port_width'])
port_h = float(p['port_height'])
port_z = float(p['port_center_z'])
slot_n = int(p['slot_count'])
slot_w = float(p['slot_width'])
slot_h = float(p['slot_height'])
slot_z = float(p['slot_center_z'])
slot_span = float(p['slot_span'])
overlap = 2.0
cut_margin = 2.0
body = cq.Workplane('XY').box(L, W, H, centered=(True, True, False))
inner_len = L - 2.0 * t
inner_wid = W - 2.0 * t
inner_h = H - tb + 1.0
inner_sol = cq.Workplane('XY').box(inner_len, inner_wid, inner_h, centered=(True, True, False)).translate((0.0, 0.0, tb))
body = body.cut(inner_sol)
post_pts = [(sx * px, sy * py) for sx in (1.0, -1.0) for sy in (1.0, -1.0)]
r_post = post_d / 2.0
posts = cq.Workplane('XY').workplane(offset=tb - overlap).pushPoints(post_pts).circle(r_post).extrude(post_top - (tb - overlap))
body = body.union(posts)
rib_len = L / 2.0 - px
for cx, cy in post_pts:
    sx = 1.0 if cx > 0 else -1.0
    rib = cq.Workplane('XY').box(rib_len, rib_w, rib_top - (tb - overlap), centered=(True, True, False)).translate((sx * (px + rib_len / 2.0), cy, tb - overlap))
    body = body.union(rib)
r_hole = hole_d / 2.0
holes = cq.Workplane('XY').workplane(offset=hole_bottom).pushPoints(post_pts).circle(r_hole).extrude(post_top - hole_bottom + 1.0)
body = body.cut(holes)
port_cut = cq.Workplane('XY').box(port_w, t + 2.0 * cut_margin, port_h).translate((0.0, -(W / 2.0 - t / 2.0), port_z))
body = body.cut(port_cut)
if slot_n > 1:
    step = slot_span / (slot_n - 1)
else:
    step = 0.0
for i in range(slot_n):
    sx_pos = -slot_span / 2.0 + i * step
    slot_cut = cq.Workplane('XY').box(slot_w, t + 2.0 * cut_margin, slot_h).translate((sx_pos, W / 2.0 - t / 2.0, slot_z))
    body = body.cut(slot_cut)
result = body