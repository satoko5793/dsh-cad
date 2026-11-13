# Vendored from seansackowitz/mcp-freecad, MIT; see LICENSE and SOURCE.json.
"""Spreadsheet handlers — central parameter tables referenced via aliases."""

from __future__ import annotations

from typing import Any

from ._common import get_doc, get_obj, summarize
from .registry import register


@register("sheet.create")
def sheet_create(label: str | None = None, doc: str | None = None) -> dict[str, Any]:
    d = get_doc(doc)
    s = d.addObject("Spreadsheet::Sheet", label or "Spreadsheet")
    d.recompute()
    return summarize(s)


def _sheet(doc: str | None, name: str) -> Any:
    s = get_obj(doc, name)
    if s.TypeId != "Spreadsheet::Sheet":
        raise RuntimeError(f"{name} is not a Spreadsheet")
    return s


@register("sheet.set_cell")
def sheet_set_cell(sheet: str, cell: str, value: str, doc: str | None = None) -> dict[str, Any]:
    """Set a cell. `value` is a string — numbers as '12.5', formulas as '=A1*2', text as 'foo'."""
    s = _sheet(doc, sheet)
    s.set(cell, value)
    s.Document.recompute()
    return {"sheet": s.Name, "cell": cell, "value": value}


@register("sheet.get_cell")
def sheet_get_cell(sheet: str, cell: str, doc: str | None = None) -> dict[str, Any]:
    s = _sheet(doc, sheet)
    contents = s.getContents(cell)
    try:
        evaluated = s.get(cell)
        evaluated = repr(evaluated)
    except Exception:
        evaluated = None
    return {"sheet": s.Name, "cell": cell, "contents": contents, "evaluated": evaluated}


@register("sheet.set_alias")
def sheet_set_alias(sheet: str, cell: str, alias: str, doc: str | None = None) -> dict[str, Any]:
    """Give a cell an alias so expressions can reference it as `Spreadsheet.<alias>`."""
    s = _sheet(doc, sheet)
    s.setAlias(cell, alias)
    s.Document.recompute()
    return {"sheet": s.Name, "cell": cell, "alias": alias}
