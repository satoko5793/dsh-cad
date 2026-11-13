# Vendored from seansackowitz/mcp-freecad, MIT; see LICENSE and SOURCE.json.
"""Object inspection and basic mutation handlers."""

from __future__ import annotations

from typing import Any

from ._common import (
    get_doc,
    get_obj,
    placement,
    summarize,
)
from .registry import register


def _prop_value(obj: Any, prop: str) -> Any:
    val = getattr(obj, prop)
    # Convert FreeCAD types to JSON-friendly
    if hasattr(val, "x") and hasattr(val, "y") and hasattr(val, "z"):
        return [val.x, val.y, val.z]
    if hasattr(val, "Base") and hasattr(val, "Rotation"):
        return {
            "pos": [val.Base.x, val.Base.y, val.Base.z],
            "rot_q": list(val.Rotation.Q),
        }
    if isinstance(val, (int, float, str, bool)) or val is None:
        return val
    if isinstance(val, (list, tuple)):
        return [_jsonable(v) for v in val]
    return repr(val)


def _jsonable(v: Any) -> Any:
    if isinstance(v, (int, float, str, bool)) or v is None:
        return v
    if hasattr(v, "Name"):
        return v.Name
    return repr(v)


@register("obj.list")
def obj_list(doc: str | None = None) -> list[dict[str, Any]]:
    d = get_doc(doc)
    return [
        {"name": o.Name, "label": o.Label, "type": o.TypeId}
        for o in d.Objects
    ]


@register("obj.get")
def obj_get(name: str, doc: str | None = None) -> dict[str, Any]:
    o = get_obj(doc, name)
    return summarize(o)


@register("obj.get_tree")
def obj_get_tree(doc: str | None = None) -> list[dict[str, Any]]:
    d = get_doc(doc)
    out = []
    for o in d.Objects:
        out.append({
            "name": o.Name,
            "type": o.TypeId,
            "in_list": [p.Name for p in o.InList],
            "out_list": [p.Name for p in o.OutList],
        })
    return out


@register("obj.get_properties")
def obj_get_properties(name: str, doc: str | None = None) -> dict[str, Any]:
    o = get_obj(doc, name)
    props: dict[str, Any] = {}
    for p in o.PropertiesList:
        try:
            props[p] = _prop_value(o, p)
        except Exception as e:
            props[p] = f"<error: {e}>"
    view = o.ViewObject
    style = {p: _prop_value(view, p) for p in ("Visibility", "ShapeColor", "Transparency", "DisplayMode") if view and hasattr(view, p)}
    return {"name": o.Name, "properties": props, "view": style}


@register("obj.set_property")
def obj_set_property(name: str, prop: str, value: Any, doc: str | None = None) -> dict[str, Any]:
    o = get_obj(doc, name)
    target = o
    if prop.startswith("ViewObject."):
        prop = prop[len("ViewObject."):]
        if prop not in ("Visibility", "ShapeColor", "LineColor", "Transparency", "DisplayMode"):
            raise ValueError("Unsupported view property")
        target = o.ViewObject
        if prop == "Visibility" and not isinstance(value, bool):
            raise ValueError("Visibility requires boolean")
        if prop in ("ShapeColor", "LineColor"):
            if not isinstance(value, list) or len(value) != 3 or any(not isinstance(v, (int,float)) or not 0 <= v <= 1 for v in value):
                raise ValueError("Color requires three values between zero and one")
            value = tuple(value)
        if prop == "Transparency" and (not isinstance(value, int) or not 0 <= value <= 100):
            raise ValueError("Transparency requires integer 0..100")
    if prop not in target.PropertiesList and not (target is o.ViewObject and hasattr(target, prop)):
        raise RuntimeError(f"{o.Name} has no property {prop!r}")
    setattr(target, prop, value)
    o.Document.recompute()
    return summarize(o)


@register("obj.delete")
def obj_delete(name: str, doc: str | None = None) -> dict[str, Any]:
    o = get_obj(doc, name)
    d = o.Document
    d.removeObject(o.Name)
    return {"deleted": name, "doc": d.Name}


@register("obj.set_placement")
def obj_set_placement(
    name: str,
    pos: list[float] | None = None,
    rotation: list[float] | None = None,
    doc: str | None = None,
) -> dict[str, Any]:
    o = get_obj(doc, name)
    o.Placement = placement(pos, rotation)
    o.Document.recompute()
    return summarize(o)


@register("obj.set_label")
def obj_set_label(name: str, label: str, doc: str | None = None) -> dict[str, Any]:
    o = get_obj(doc, name)
    o.Label = label
    return summarize(o)
