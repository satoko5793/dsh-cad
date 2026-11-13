# Vendored from seansackowitz/mcp-freecad, MIT; see LICENSE and SOURCE.json.
"""PartDesign handlers — Body + parametric features (pad/pocket/revolution/etc)."""

from __future__ import annotations

from typing import Any

import FreeCAD

from ._common import get_doc, get_obj, summarize, vec
from .registry import register


def _body(doc: str | None, name: str) -> Any:
    b = get_obj(doc, name)
    if b.TypeId != "PartDesign::Body":
        raise RuntimeError(f"{name} is not a PartDesign::Body")
    return b


# PartDesign pattern/mirror features take a *reference* (edge/datum/plane), not a
# raw vector. We resolve a caller's vector to the body's Origin axis/plane when it
# is axis-aligned (the common case), and otherwise build a datum line/plane
# oriented along the vector. (Local +Z of a PartDesign::Line/Plane is its axis/normal.)

_AXIS_ROLE = {0: "X_Axis", 1: "Y_Axis", 2: "Z_Axis"}
# plane whose normal points along the given principal axis
_PLANE_ROLE_BY_NORMAL = {0: "YZ_Plane", 1: "XZ_Plane", 2: "XY_Plane"}


def _origin_feature(body: Any, role: str) -> Any:
    for f in body.Origin.OriginFeatures:
        if getattr(f, "Role", None) == role:
            return f
    raise RuntimeError(f"body {body.Name!r} has no origin feature {role!r}")


def _principal_axis(v: Any) -> Any:
    """If v is parallel to a principal axis return (axis_index, negative?), else None."""
    comps = [v.x, v.y, v.z]
    nz = [i for i, c in enumerate(comps) if abs(c) > 1e-9]
    if len(nz) == 1:
        i = nz[0]
        return (i, comps[i] < 0)
    return None


def _axis_reference(body: Any, vector: list[float]) -> tuple:
    """Resolve a direction/axis vector to ((ref, ['']), reversed)."""
    v = vec(vector)
    pa = _principal_axis(v)
    if pa is not None:
        i, rev = pa
        return (_origin_feature(body, _AXIS_ROLE[i]), [""]), rev
    nv = FreeCAD.Vector(v)
    nv.normalize()
    datum = body.Document.addObject("PartDesign::Line", "PatternAxis")
    body.addObject(datum)
    datum.Placement = FreeCAD.Placement(
        FreeCAD.Vector(0, 0, 0), FreeCAD.Rotation(FreeCAD.Vector(0, 0, 1), nv)
    )
    body.Document.recompute()
    return (datum, [""]), False


def _plane_reference(body: Any, normal: list[float], base_point: list[float] | None) -> tuple:
    """Resolve a mirror plane from a normal (+ optional base) to (ref, ['])."""
    v = vec(normal)
    base = base_point or [0, 0, 0]
    pa = _principal_axis(v)
    if pa is not None and not any(abs(c) > 1e-9 for c in base):
        i, _ = pa
        return (_origin_feature(body, _PLANE_ROLE_BY_NORMAL[i]), [""])
    nv = FreeCAD.Vector(v)
    nv.normalize()
    datum = body.Document.addObject("PartDesign::Plane", "MirrorPlane")
    body.addObject(datum)
    datum.Placement = FreeCAD.Placement(
        vec(base), FreeCAD.Rotation(FreeCAD.Vector(0, 0, 1), nv)
    )
    body.Document.recompute()
    return (datum, [""])


@register("pd.create_body")
def pd_create_body(label: str | None = None, doc: str | None = None) -> dict:
    d = get_doc(doc)
    body = d.addObject("PartDesign::Body", label or "Body")
    d.recompute()
    return summarize(body)


def _add_feature_with_profile(doc: str | None, body_name: str, ftype: str,
                              profile_name: str, label: str | None,
                              props: dict[str, Any]) -> Any:
    d = get_doc(doc)
    body = _body(doc, body_name)
    profile = get_obj(doc, profile_name)
    if any(p.TypeId == "PartDesign::Body" and p != body for p in profile.InList):
        raise ValueError("Profile belongs to a different Body")
    if profile not in body.Group:
        body.addObject(profile)
    feat = d.addObject(ftype, label or ftype.split("::")[-1])
    feat.Profile = profile
    for k, v in props.items():
        setattr(feat, k, v)
    body.addObject(feat)
    d.recompute()
    return feat


@register("pd.pad")
def pd_pad(body: str, profile: str, length: float = 10.0, reversed: bool = False,
           midplane: bool = False, label: str | None = None, doc: str | None = None) -> dict:
    f = _add_feature_with_profile(doc, body, "PartDesign::Pad", profile, label,
                                  {"Length": length, "Reversed": reversed, "Midplane": midplane})
    return summarize(f)


@register("pd.pocket")
def pd_pocket(body: str, profile: str, length: float = 10.0, reversed: bool = False,
              midplane: bool = False, label: str | None = None, doc: str | None = None) -> dict:
    f = _add_feature_with_profile(doc, body, "PartDesign::Pocket", profile, label,
                                  {"Length": length, "Reversed": reversed, "Midplane": midplane})
    return summarize(f)


@register("pd.revolution")
def pd_revolution(body: str, profile: str, axis: list[float],
                  base_point: list[float] | None = None, angle: float = 360.0,
                  reversed: bool = False, label: str | None = None,
                  doc: str | None = None) -> dict:
    f = _add_feature_with_profile(doc, body, "PartDesign::Revolution", profile, label,
                                  {"Angle": angle, "Reversed": reversed})
    b = _body(doc, body)
    ref, rev = _axis_reference(b, axis)
    if base_point and any(abs(v) > 1e-9 for v in base_point):
        datum = f.Document.addObject("PartDesign::Line", "RevolutionAxis")
        b.addObject(datum)
        datum.Placement = FreeCAD.Placement(vec(base_point), FreeCAD.Rotation(FreeCAD.Vector(0,0,1), vec(axis)))
        ref = (datum, [""])
        rev = False
    f.ReferenceAxis = ref
    f.Reversed = reversed != rev
    f.Document.recompute()
    return summarize(f)


@register("pd.groove")
def pd_groove(body: str, profile: str, axis: list[float],
              base_point: list[float] | None = None, angle: float = 360.0,
              reversed: bool = False, label: str | None = None,
              doc: str | None = None) -> dict:
    f = _add_feature_with_profile(doc, body, "PartDesign::Groove", profile, label,
                                  {"Angle": angle, "Reversed": reversed})
    b = _body(doc, body)
    ref, rev = _axis_reference(b, axis)
    if base_point and any(abs(v) > 1e-9 for v in base_point):
        datum = f.Document.addObject("PartDesign::Line", "RevolutionAxis")
        b.addObject(datum)
        datum.Placement = FreeCAD.Placement(vec(base_point), FreeCAD.Rotation(FreeCAD.Vector(0,0,1), vec(axis)))
        ref = (datum, [""])
        rev = False
    f.ReferenceAxis = ref
    f.Reversed = reversed != rev
    f.Document.recompute()
    return summarize(f)


@register("pd.fillet")
def pd_fillet(body: str, base_feature: str, edges: list[str], radius: float = 1.0,
              label: str | None = None, doc: str | None = None) -> dict:
    """`edges` are FreeCAD edge sub-names like ['Edge1', 'Edge3']."""
    d = get_doc(doc)
    b = _body(doc, body)
    base = get_obj(doc, base_feature)
    f = d.addObject("PartDesign::Fillet", label or "Fillet")
    f.Base = (base, edges)
    f.Radius = radius
    b.addObject(f)
    d.recompute()
    return summarize(f)


@register("pd.chamfer")
def pd_chamfer(body: str, base_feature: str, edges: list[str], size: float = 1.0,
               label: str | None = None, doc: str | None = None) -> dict:
    d = get_doc(doc)
    b = _body(doc, body)
    base = get_obj(doc, base_feature)
    f = d.addObject("PartDesign::Chamfer", label or "Chamfer")
    f.Base = (base, edges)
    f.Size = size
    b.addObject(f)
    d.recompute()
    return summarize(f)


@register("pd.pattern_linear")
def pd_pattern_linear(body: str, originals: list[str], direction: list[float],
                      count: int = 2, length: float = 10.0,
                      label: str | None = None, doc: str | None = None) -> dict:
    d = get_doc(doc)
    b = _body(doc, body)
    ref, rev = _axis_reference(b, direction)
    f = d.addObject("PartDesign::LinearPattern", label or "LinearPattern")
    f.Originals = [get_obj(doc, n) for n in originals]
    f.Direction = ref
    f.Reversed = rev
    f.Length = length
    f.Occurrences = count
    b.addObject(f)
    d.recompute()
    return summarize(f)


@register("pd.pattern_polar")
def pd_pattern_polar(body: str, originals: list[str], axis: list[float],
                     count: int = 4, angle: float = 360.0,
                     label: str | None = None, doc: str | None = None) -> dict:
    d = get_doc(doc)
    b = _body(doc, body)
    ref, rev = _axis_reference(b, axis)
    f = d.addObject("PartDesign::PolarPattern", label or "PolarPattern")
    f.Originals = [get_obj(doc, n) for n in originals]
    f.Axis = ref
    f.Reversed = rev
    f.Angle = angle
    f.Occurrences = count
    b.addObject(f)
    d.recompute()
    return summarize(f)


@register("pd.mirrored")
def pd_mirrored(body: str, originals: list[str], normal: list[float],
                base_point: list[float] | None = None,
                label: str | None = None, doc: str | None = None) -> dict:
    d = get_doc(doc)
    b = _body(doc, body)
    ref = _plane_reference(b, normal, base_point)
    f = d.addObject("PartDesign::Mirrored", label or "Mirrored")
    f.Originals = [get_obj(doc, n) for n in originals]
    f.MirrorPlane = ref
    b.addObject(f)
    d.recompute()
    return summarize(f)
