# Vendored from seansackowitz/mcp-freecad, MIT; see LICENSE and SOURCE.json.
"""Sketcher handlers — create sketch, add geometry, add/edit constraints."""

from __future__ import annotations

import math
from typing import Any

import FreeCAD
import Part
import Sketcher

from ._common import get_doc, get_obj, placement, summarize, vec
from .registry import register


_PLANE_PRESETS = {
    "xy": ([0, 0, 0], [0, 0, 0]),
    "xz": ([0, 0, 0], [1, 0, 0, 90]),
    "yz": ([0, 0, 0], [1, 1, 1, 120]),
}


@register("sketch.create")
def sketch_create(plane: str | None = "xy", support: str | None = None,
                  pos: list[float] | None = None, rotation: list[float] | None = None,
                  label: str | None = None, doc: str | None = None) -> dict:
    """Create a sketch. Either pass a `plane` preset (xy/xz/yz) plus optional pos/rot,
    or `support` to attach to an existing object.

    `support` accepts either a bare object name (attaches to that object's local
    XY plane, MapMode=ObjectXY) or an "Owner.Sub" reference like "Box.Face6" or
    "Body.Edge3" — a face attaches FlatFace, an edge NormalToEdge. Without a valid
    attachment the sketch would otherwise stay at the origin.
    """
    d = get_doc(doc)
    sk = d.addObject("Sketcher::SketchObject", label or "Sketch")
    if support:
        owner_name, _, sub = support.partition(".")
        owner = get_obj(doc, owner_name)
        sk.AttachmentSupport = [(owner, sub)] if sub else [(owner, "")]
        if sub.startswith("Face"):
            sk.MapMode = "FlatFace"
        elif sub.startswith("Edge"):
            sk.MapMode = "NormalToEdge"
        else:
            sk.MapMode = "ObjectXY"
    elif plane:
        if plane not in _PLANE_PRESETS:
            raise ValueError(f"unknown plane preset {plane!r}; use xy/xz/yz")
        default_pos, default_rot = _PLANE_PRESETS[plane]
        sk.Placement = placement(pos or default_pos, rotation or default_rot)
    else:
        sk.Placement = placement(pos, rotation)
    d.recompute()
    return summarize(sk)


def _sketch(doc: str | None, name: str) -> Any:
    sk = get_obj(doc, name)
    if not sk.TypeId.startswith("Sketcher::"):
        raise RuntimeError(f"{name} is not a sketch")
    return sk


@register("sketch.add_line")
def sketch_add_line(sketch: str, start: list[float], end: list[float],
                    construction: bool = False, doc: str | None = None) -> dict:
    sk = _sketch(doc, sketch)
    geo = Part.LineSegment(vec([start[0], start[1], 0]), vec([end[0], end[1], 0]))
    idx = sk.addGeometry(geo, construction)
    sk.Document.recompute()
    return {"sketch": sk.Name, "geo_index": idx, "type": "line"}


@register("sketch.add_circle")
def sketch_add_circle(sketch: str, center: list[float], radius: float,
                      construction: bool = False, doc: str | None = None) -> dict:
    sk = _sketch(doc, sketch)
    geo = Part.Circle(vec([center[0], center[1], 0]), FreeCAD.Vector(0, 0, 1), radius)
    idx = sk.addGeometry(geo, construction)
    sk.Document.recompute()
    return {"sketch": sk.Name, "geo_index": idx, "type": "circle"}


@register("sketch.add_arc")
def sketch_add_arc(sketch: str, center: list[float], radius: float,
                   start_angle: float, end_angle: float,
                   construction: bool = False, doc: str | None = None) -> dict:
    """Angles in degrees, measured from +X CCW."""
    sk = _sketch(doc, sketch)
    circ = Part.Circle(vec([center[0], center[1], 0]), FreeCAD.Vector(0, 0, 1), radius)
    arc = Part.ArcOfCircle(circ, math.radians(start_angle), math.radians(end_angle))
    idx = sk.addGeometry(arc, construction)
    sk.Document.recompute()
    return {"sketch": sk.Name, "geo_index": idx, "type": "arc"}


@register("sketch.add_point")
def sketch_add_point(sketch: str, point: list[float], doc: str | None = None) -> dict:
    sk = _sketch(doc, sketch)
    pt = Part.Point(vec([point[0], point[1], 0]))
    idx = sk.addGeometry(pt, False)
    sk.Document.recompute()
    return {"sketch": sk.Name, "geo_index": idx, "type": "point"}


@register("sketch.add_polyline")
def sketch_add_polyline(sketch: str, points: list[list[float]], closed: bool = False,
                        construction: bool = False, doc: str | None = None) -> dict:
    sk = _sketch(doc, sketch)
    indices: list[int] = []
    pts = [vec([p[0], p[1], 0]) for p in points]
    if closed:
        pts.append(pts[0])
    for a, b in zip(pts[:-1], pts[1:]):
        idx = sk.addGeometry(Part.LineSegment(a, b), construction)
        indices.append(idx)
    # Coincident constraints between consecutive segments
    for a, b in zip(indices[:-1], indices[1:]):
        sk.addConstraint(Sketcher.Constraint("Coincident", a, 2, b, 1))
    if closed and indices:
        sk.addConstraint(Sketcher.Constraint("Coincident", indices[-1], 2, indices[0], 1))
    sk.Document.recompute()
    return {"sketch": sk.Name, "geo_indices": indices, "type": "polyline"}


# ----- Constraints --------------------------------------------------------

# (name) -> (min_args, takes_value)
_CONSTRAINTS = {
    "Coincident": (2, False),  # (g1, p1, g2, p2)
    "Horizontal": (1, False),  # (g) or (g1,p1,g2,p2)
    "Vertical": (1, False),
    "Parallel": (2, False),
    "Perpendicular": (2, False),
    "Tangent": (2, False),
    "Equal": (2, False),
    "Symmetric": (3, False),  # (g1,p1,g2,p2,g3) typically
    "Block": (1, False),
    "Distance": (1, True),
    "DistanceX": (1, True),
    "DistanceY": (1, True),
    "Radius": (1, True),
    "Diameter": (1, True),
    "Angle": (1, True),
    "PointOnObject": (2, False),
}


@register("sketch.add_constraint")
def sketch_add_constraint(sketch: str, kind: str, refs: list[int],
                          value: float | None = None,
                          doc: str | None = None) -> dict:
    """Add a constraint of `kind` to `sketch`.

    `refs` is a flat list of integers using FreeCAD's (geo_index, point_index)
    convention. Pairs are flattened: e.g. for Coincident between point2 of geo3
    and point1 of geo5, pass refs=[3, 2, 5, 1]. Use point_index 0 for "the curve
    itself" (Horizontal/Vertical on a line, Distance on a line, etc.).

    `value` is required for dimensional constraints (Distance/Radius/Angle/...).
    Distances/lengths are mm; angles are degrees.
    """
    if kind not in _CONSTRAINTS:
        raise ValueError(f"unknown constraint kind {kind!r}; choose from {sorted(_CONSTRAINTS)}")
    sk = _sketch(doc, sketch)
    args: list[Any] = [kind, *refs]
    if _CONSTRAINTS[kind][1]:
        if value is None:
            raise ValueError(f"{kind} requires `value`")
        # Angles are stored in radians inside Sketcher
        if kind == "Angle":
            args.append(math.radians(value))
        else:
            args.append(value)
    idx = sk.addConstraint(Sketcher.Constraint(*args))
    sk.Document.recompute()
    return {"sketch": sk.Name, "constraint_index": idx, "kind": kind}


@register("sketch.set_constraint_value")
def sketch_set_constraint_value(sketch: str, constraint_index: int, value: float,
                                doc: str | None = None) -> dict:
    sk = _sketch(doc, sketch)
    c = sk.Constraints[constraint_index]
    if c.Type == "Angle":
        sk.setDatum(constraint_index, FreeCAD.Units.Quantity(value, FreeCAD.Units.Angle))
    else:
        sk.setDatum(constraint_index, FreeCAD.Units.Quantity(value, FreeCAD.Units.Length))
    sk.Document.recompute()
    return {"sketch": sk.Name, "constraint_index": constraint_index, "value": value}


@register("sketch.list_geometry")
def sketch_list_geometry(sketch: str, doc: str | None = None) -> list[dict]:
    sk = _sketch(doc, sketch)
    out: list[dict] = []
    for i, g in enumerate(sk.Geometry):
        cls = type(g).__name__
        item: dict[str, Any] = {"index": i, "type": cls,
                                "construction": getattr(g, "Construction", False)}
        if cls == "LineSegment":
            item["start"] = [g.StartPoint.x, g.StartPoint.y]
            item["end"] = [g.EndPoint.x, g.EndPoint.y]
        elif cls == "Circle":
            item["center"] = [g.Center.x, g.Center.y]
            item["radius"] = g.Radius
        elif cls == "ArcOfCircle":
            item["center"] = [g.Center.x, g.Center.y]
            item["radius"] = g.Radius
            item["start_angle_deg"] = math.degrees(g.FirstParameter)
            item["end_angle_deg"] = math.degrees(g.LastParameter)
        elif cls == "Point":
            item["point"] = [g.X, g.Y]
        out.append(item)
    return out


@register("sketch.list_constraints")
def sketch_list_constraints(sketch: str, doc: str | None = None) -> list[dict]:
    sk = _sketch(doc, sketch)
    out: list[dict] = []
    for i, c in enumerate(sk.Constraints):
        item: dict[str, Any] = {
            "index": i, "type": c.Type, "name": c.Name or None,
            "first": c.First, "first_pos": c.FirstPos,
            "second": c.Second, "second_pos": c.SecondPos,
            "third": c.Third, "third_pos": c.ThirdPos,
        }
        if c.Type in ("Distance", "DistanceX", "DistanceY", "Radius", "Diameter"):
            item["value"] = c.Value
        elif c.Type == "Angle":
            item["value_deg"] = math.degrees(c.Value)
        out.append(item)
    return out


@register("sketch.delete_geometry")
def sketch_delete_geometry(sketch: str, indices: list[int], doc: str | None = None) -> dict:
    sk = _sketch(doc, sketch)
    for idx in sorted(indices, reverse=True):
        sk.delGeometry(idx)
    sk.Document.recompute()
    return {"sketch": sk.Name, "deleted": indices}


@register("sketch.delete_constraint")
def sketch_delete_constraint(sketch: str, indices: list[int], doc: str | None = None) -> dict:
    sk = _sketch(doc, sketch)
    for idx in sorted(indices, reverse=True):
        sk.delConstraint(idx)
    sk.Document.recompute()
    return {"sketch": sk.Name, "deleted": indices}
