# Vendored from seansackowitz/mcp-freecad, MIT; see LICENSE and SOURCE.json.
"""Part workbench handlers — primitives, booleans, sweeps, fillets, patterns."""

from __future__ import annotations

from typing import Any

import FreeCAD
import Part

from ._common import (
    get_doc,
    get_obj,
    placement,
    summarize,
    vec,
)
from .registry import register

# ----- Primitives ---------------------------------------------------------


def _add_primitive(doc_name: str | None, ftype: str, label: str | None,
                   pos: list[float] | None, rotation: list[float] | None,
                   props: dict[str, Any]) -> Any:
    d = get_doc(doc_name)
    obj = d.addObject(ftype, label or ftype.split("::")[-1])
    for k, v in props.items():
        setattr(obj, k, v)
    obj.Placement = placement(pos, rotation)
    d.recompute()
    return obj


@register("part.box")
def part_box(length: float = 10, width: float = 10, height: float = 10,
             pos: list[float] | None = None, rotation: list[float] | None = None,
             label: str | None = None, doc: str | None = None) -> dict:
    o = _add_primitive(doc, "Part::Box", label, pos, rotation,
                       {"Length": length, "Width": width, "Height": height})
    return summarize(o)


@register("part.cylinder")
def part_cylinder(radius: float = 5, height: float = 10, angle: float = 360,
                  pos: list[float] | None = None, rotation: list[float] | None = None,
                  label: str | None = None, doc: str | None = None) -> dict:
    o = _add_primitive(doc, "Part::Cylinder", label, pos, rotation,
                       {"Radius": radius, "Height": height, "Angle": angle})
    return summarize(o)


@register("part.sphere")
def part_sphere(radius: float = 5, angle1: float = -90, angle2: float = 90,
                angle3: float = 360,
                pos: list[float] | None = None, rotation: list[float] | None = None,
                label: str | None = None, doc: str | None = None) -> dict:
    o = _add_primitive(doc, "Part::Sphere", label, pos, rotation,
                       {"Radius": radius, "Angle1": angle1, "Angle2": angle2, "Angle3": angle3})
    return summarize(o)


@register("part.cone")
def part_cone(radius1: float = 2, radius2: float = 4, height: float = 10, angle: float = 360,
              pos: list[float] | None = None, rotation: list[float] | None = None,
              label: str | None = None, doc: str | None = None) -> dict:
    o = _add_primitive(doc, "Part::Cone", label, pos, rotation,
                       {"Radius1": radius1, "Radius2": radius2, "Height": height, "Angle": angle})
    return summarize(o)


@register("part.torus")
def part_torus(radius1: float = 10, radius2: float = 2,
               angle1: float = -180, angle2: float = 180, angle3: float = 360,
               pos: list[float] | None = None, rotation: list[float] | None = None,
               label: str | None = None, doc: str | None = None) -> dict:
    o = _add_primitive(doc, "Part::Torus", label, pos, rotation,
                       {"Radius1": radius1, "Radius2": radius2,
                        "Angle1": angle1, "Angle2": angle2, "Angle3": angle3})
    return summarize(o)


@register("part.plane")
def part_plane(length: float = 10, width: float = 10,
               pos: list[float] | None = None, rotation: list[float] | None = None,
               label: str | None = None, doc: str | None = None) -> dict:
    o = _add_primitive(doc, "Part::Plane", label, pos, rotation,
                       {"Length": length, "Width": width})
    return summarize(o)


# ----- Sweeps & extrusions ------------------------------------------------


@register("part.extrude")
def part_extrude(profile: str, direction: list[float], length: float = 10,
                 solid: bool = True, label: str | None = None,
                 doc: str | None = None) -> dict:
    d = get_doc(doc)
    base = get_obj(doc, profile)
    obj = d.addObject("Part::Extrusion", label or "Extrude")
    obj.Base = base
    obj.Dir = vec(direction)
    obj.LengthFwd = length
    obj.Solid = solid
    d.recompute()
    return summarize(obj)


@register("part.revolve")
def part_revolve(profile: str, axis: list[float], base_point: list[float] | None = None,
                 angle: float = 360, solid: bool = True,
                 label: str | None = None, doc: str | None = None) -> dict:
    d = get_doc(doc)
    src = get_obj(doc, profile)
    obj = d.addObject("Part::Revolution", label or "Revolve")
    obj.Source = src
    obj.Axis = vec(axis)
    obj.Base = vec(base_point or [0, 0, 0])
    obj.Angle = angle
    obj.Solid = solid
    d.recompute()
    return summarize(obj)


@register("part.loft")
def part_loft(sections: list[str], solid: bool = True, ruled: bool = False,
              closed: bool = False, label: str | None = None,
              doc: str | None = None) -> dict:
    d = get_doc(doc)
    obj = d.addObject("Part::Loft", label or "Loft")
    obj.Sections = [get_obj(doc, n) for n in sections]
    obj.Solid = solid
    obj.Ruled = ruled
    obj.Closed = closed
    d.recompute()
    return summarize(obj)


@register("part.sweep")
def part_sweep(profile: str, path: str, solid: bool = True, frenet: bool = False,
               label: str | None = None, doc: str | None = None) -> dict:
    d = get_doc(doc)
    obj = d.addObject("Part::Sweep", label or "Sweep")
    obj.Sections = [get_obj(doc, profile)]
    obj.Spine = (get_obj(doc, path), ["Edge1"])
    obj.Solid = solid
    obj.Frenet = frenet
    d.recompute()
    return summarize(obj)


# ----- Booleans -----------------------------------------------------------


def _boolean(d: Any, ftype: str, base_name: str, tool_name: str,
             label: str | None, doc: str | None) -> Any:
    base = get_obj(doc, base_name)
    tool = get_obj(doc, tool_name)
    obj = d.addObject(ftype, label or ftype.split("::")[-1])
    obj.Base = base
    obj.Tool = tool
    d.recompute()
    return obj


@register("part.fuse")
def part_fuse(base: str, tool: str, label: str | None = None, doc: str | None = None) -> dict:
    d = get_doc(doc)
    return summarize(_boolean(d, "Part::Fuse", base, tool, label, doc))


@register("part.cut")
def part_cut(base: str, tool: str, label: str | None = None, doc: str | None = None) -> dict:
    d = get_doc(doc)
    return summarize(_boolean(d, "Part::Cut", base, tool, label, doc))


@register("part.common")
def part_common(base: str, tool: str, label: str | None = None, doc: str | None = None) -> dict:
    d = get_doc(doc)
    return summarize(_boolean(d, "Part::Common", base, tool, label, doc))


# ----- Edge ops -----------------------------------------------------------


@register("part.fillet")
def part_fillet(base: str, edges: list[int], radius: float = 1.0,
                label: str | None = None, doc: str | None = None) -> dict:
    d = get_doc(doc)
    src = get_obj(doc, base)
    obj = d.addObject("Part::Fillet", label or "Fillet")
    obj.Base = src
    obj.Edges = [(e, radius, radius) for e in edges]
    d.recompute()
    return summarize(obj)


@register("part.chamfer")
def part_chamfer(base: str, edges: list[int], size: float = 1.0,
                 label: str | None = None, doc: str | None = None) -> dict:
    d = get_doc(doc)
    src = get_obj(doc, base)
    obj = d.addObject("Part::Chamfer", label or "Chamfer")
    obj.Base = src
    obj.Edges = [(e, size, size) for e in edges]
    d.recompute()
    return summarize(obj)


# ----- Transforms / patterns ---------------------------------------------


@register("part.mirror")
def part_mirror(source: str, normal: list[float], base_point: list[float] | None = None,
                label: str | None = None, doc: str | None = None) -> dict:
    d = get_doc(doc)
    src = get_obj(doc, source)
    obj = d.addObject("Part::Mirroring", label or "Mirror")
    obj.Source = src
    obj.Normal = vec(normal)
    obj.Base = vec(base_point or [0, 0, 0])
    d.recompute()
    return summarize(obj)


@register("part.pattern_linear")
def part_pattern_linear(source: str, direction: list[float], count: int = 2,
                        interval: float = 10.0,
                        label: str | None = None, doc: str | None = None) -> dict:
    """Generic Part-level linear pattern via Draft Array (works without Body)."""
    d = get_doc(doc)
    src = get_obj(doc, source)
    import Draft  # FreeCAD-bundled
    arr = Draft.make_ortho_array(
        src,
        v_x=vec(direction).multiply(interval),
        v_y=FreeCAD.Vector(0, 0, 0),
        v_z=FreeCAD.Vector(0, 0, 0),
        n_x=count, n_y=1, n_z=1,
    )
    if label:
        arr.Label = label
    d.recompute()
    return summarize(arr)


@register("part.pattern_polar")
def part_pattern_polar(source: str, axis: list[float], count: int = 4,
                       angle: float = 360.0, center: list[float] | None = None,
                       label: str | None = None, doc: str | None = None) -> dict:
    d = get_doc(doc)
    src = get_obj(doc, source)
    import Draft
    arr = Draft.make_polar_array(
        src,
        number=count,
        angle=angle,
        center=vec(center or [0, 0, 0]),
    )
    arr.Axis = vec(axis)
    if label:
        arr.Label = label
    d.recompute()
    return summarize(arr)
