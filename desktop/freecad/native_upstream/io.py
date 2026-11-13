# Vendored from seansackowitz/mcp-freecad, MIT; see LICENSE and SOURCE.json.
"""Import/export handlers — STEP, STL, IGES, OBJ."""

from __future__ import annotations

from typing import Any

import FreeCAD

from ._common import get_doc, get_obj
from .registry import register


def _resolve_objects(doc: str | None, names: list[str] | None) -> list[Any]:
    d = get_doc(doc)
    if not names:
        return [o for o in d.Objects if hasattr(o, "Shape") and not o.Shape.isNull() and not o.TypeId.startswith("Sketcher::") and o.ViewObject.Visibility]
    return [get_obj(doc, n) for n in names]


@register("io.import_step")
def io_import_step(path: str, doc: str | None = None) -> dict[str, Any]:
    import Import
    d = get_doc(doc)
    Import.insert(path, d.Name)
    d.recompute()
    return {"doc": d.Name, "imported": path}


@register("io.import_iges")
def io_import_iges(path: str, doc: str | None = None) -> dict[str, Any]:
    import Part
    d = get_doc(doc)
    Part.insert(path, d.Name)
    d.recompute()
    return {"doc": d.Name, "imported": path}


@register("io.export_step")
def io_export_step(path: str, names: list[str] | None = None,
                   doc: str | None = None) -> dict[str, Any]:
    import Import
    objs = _resolve_objects(doc, names)
    Import.export(objs, path)
    return {"path": path, "exported": [o.Name for o in objs]}


@register("io.export_iges")
def io_export_iges(path: str, names: list[str] | None = None,
                   doc: str | None = None) -> dict[str, Any]:
    import Import
    objs = _resolve_objects(doc, names)
    Import.export(objs, path)
    return {"path": path, "exported": [o.Name for o in objs]}


@register("io.export_stl")
def io_export_stl(path: str, names: list[str] | None = None,
                  doc: str | None = None) -> dict[str, Any]:
    import Mesh
    objs = _resolve_objects(doc, names)
    Mesh.export(objs, path)
    return {"path": path, "exported": [o.Name for o in objs]}


@register("io.export_obj")
def io_export_obj(path: str, names: list[str] | None = None,
                  doc: str | None = None) -> dict[str, Any]:
    import Mesh
    objs = _resolve_objects(doc, names)
    Mesh.export(objs, path)
    return {"path": path, "exported": [o.Name for o in objs]}
