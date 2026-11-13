# Vendored from seansackowitz/mcp-freecad, MIT; see LICENSE and SOURCE.json.
"""Shared helpers for handler modules.

Imported as `handlers._common` because FreeCAD puts Mod/FreeCADMCP/ on sys.path
(not Mod/ itself), making `handlers/` an importable package via __init__.py.
"""

from __future__ import annotations

from typing import Any

import FreeCAD


def active_doc() -> "FreeCAD.Document":
    doc = FreeCAD.ActiveDocument
    if doc is None:
        raise RuntimeError("no active document — call doc.create or doc.open first")
    return doc


def get_doc(name: str | None) -> "FreeCAD.Document":
    if name is None:
        doc = active_doc()
        from .registry import check_document
        check_document(doc)
        return doc
    doc = FreeCAD.getDocument(name)
    if doc is None:
        raise RuntimeError(f"no document named {name!r}")
    from .registry import check_document
    check_document(doc)
    return doc


def get_obj(doc_name: str | None, obj_name: str) -> Any:
    doc = get_doc(doc_name)
    obj = doc.getObject(obj_name)
    if obj is None:
        matches = [o for o in doc.Objects if o.Label == obj_name]
        obj = matches[0] if len(matches) == 1 else None
    if obj is None:
        raise RuntimeError(f"no object named {obj_name!r} in document {doc.Name!r}")
    return obj


def vec(xyz: list[float] | tuple[float, float, float]) -> "FreeCAD.Vector":
    if len(xyz) != 3:
        raise ValueError(f"expected [x, y, z], got {xyz!r}")
    return FreeCAD.Vector(*xyz)


def rot(axis_angle: list[float] | None) -> "FreeCAD.Rotation":
    """Accept None (identity), [yaw,pitch,roll] degrees, or [ax,ay,az,deg]."""
    if axis_angle is None:
        return FreeCAD.Rotation()
    if len(axis_angle) == 3:
        yaw, pitch, roll = axis_angle
        return FreeCAD.Rotation(yaw, pitch, roll)
    if len(axis_angle) == 4:
        ax, ay, az, deg = axis_angle
        return FreeCAD.Rotation(FreeCAD.Vector(ax, ay, az), deg)
    raise ValueError("rotation must be [yaw,pitch,roll] or [ax,ay,az,deg]")


def placement(pos: list[float] | None, rotation: list[float] | None) -> "FreeCAD.Placement":
    return FreeCAD.Placement(vec(pos or [0, 0, 0]), rot(rotation))


def summarize(obj: Any) -> dict[str, Any]:
    """Compact, image-free summary used in every mutation response."""
    out: dict[str, Any] = {
        "name": obj.Name,
        "label": obj.Label,
        "type": obj.TypeId,
        "doc": obj.Document.Name,
    }
    if obj.ViewObject:
        out["visible"] = obj.ViewObject.Visibility
    if hasattr(obj, "Placement"):
        p = obj.Placement
        out["placement"] = {
            "pos": [p.Base.x, p.Base.y, p.Base.z],
            "rot_q": [p.Rotation.Q[0], p.Rotation.Q[1], p.Rotation.Q[2], p.Rotation.Q[3]],
        }
    if hasattr(obj, "Shape"):
        try:
            out["shape_valid"] = not obj.Shape.isNull() and obj.Shape.isValid()
            out["shape_type"] = obj.Shape.ShapeType if not obj.Shape.isNull() else None
        except Exception:
            out["shape_valid"] = False
    return out


def recompute_and_check(doc: Any, obj: Any | None = None) -> list[str]:
    """Recompute and return the list of errors as strings."""
    doc.recompute()
    errors: list[str] = []
    if hasattr(doc, "RecomputesFrozen") and doc.RecomputesFrozen:
        return errors
    for o in doc.Objects:
        if hasattr(o, "isValid") and not o.isValid():
            errors.append(f"{o.Name}: invalid")
    return errors
