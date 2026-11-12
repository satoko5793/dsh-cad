
params = {
    "length": 80.0,
    "width": 40.0,
    "thickness": 8.0,
    "hole_diameter": 8.0,
    "edge_offset": 8.0,
}

L = params["length"]
W = params["width"]
T = params["thickness"]
D = params["hole_diameter"]
E = params["edge_offset"]

x = L / 2.0 - E
y = W / 2.0 - E
centers = [(-x, -y), (x, -y), (-x, y), (x, y)]

plate = cq.Workplane("XY").box(L, W, T, centered=(True, True, True))
plate = (
    plate.faces(">Z")
    .workplane()
    .pushPoints(centers)
    .hole(D)
)

result = plate
