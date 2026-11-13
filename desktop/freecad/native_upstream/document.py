# Vendored from seansackowitz/mcp-freecad, MIT; see LICENSE and SOURCE.json.
"""Document lifecycle handlers."""

from __future__ import annotations

from typing import Any

import FreeCAD

from ._common import get_doc, recompute_and_check
from .registry import register


def _summarize_doc(doc: Any) -> dict[str, Any]:
    return {
        "name": doc.Name,
        "label": doc.Label,
        "file": doc.FileName or None,
        "modified": doc.isModified() if hasattr(doc, "isModified") else None,
        "object_count": len(doc.Objects),
        "active": doc is FreeCAD.ActiveDocument,
    }


@register("doc.list")
def doc_list() -> list[dict[str, Any]]:
    return [_summarize_doc(d) for d in FreeCAD.listDocuments().values()]


@register("doc.create")
def doc_create(name: str | None = None, label: str | None = None) -> dict[str, Any]:
    doc = FreeCAD.newDocument(name) if name else FreeCAD.newDocument()
    if label:
        doc.Label = label
    return _summarize_doc(doc)


@register("doc.open")
def doc_open(path: str) -> dict[str, Any]:
    doc = FreeCAD.openDocument(path)
    return _summarize_doc(doc)


@register("doc.save")
def doc_save(name: str | None = None, path: str | None = None) -> dict[str, Any]:
    doc = get_doc(name)
    if path:
        doc.saveAs(path)
    else:
        if not doc.FileName:
            raise RuntimeError("document has no file path; pass `path` to save")
        doc.save()
    return _summarize_doc(doc)


@register("doc.close")
def doc_close(name: str | None = None) -> dict[str, Any]:
    doc = get_doc(name)
    closed_name = doc.Name
    FreeCAD.closeDocument(closed_name)
    return {"closed": closed_name}


@register("doc.set_active")
def doc_set_active(name: str) -> dict[str, Any]:
    doc = get_doc(name)
    FreeCAD.setActiveDocument(doc.Name)
    return _summarize_doc(doc)


@register("doc.recompute")
def doc_recompute(name: str | None = None) -> dict[str, Any]:
    doc = get_doc(name)
    errors = recompute_and_check(doc)
    return {"doc": doc.Name, "errors": errors}
