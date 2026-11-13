# Vendored from seansackowitz/mcp-freecad, MIT; see LICENSE and SOURCE.json.
"""Expression handlers — bind object properties to parametric expressions."""

from __future__ import annotations

from typing import Any

from ._common import get_obj
from .registry import register


@register("expr.set")
def expr_set(name: str, prop: str, expression: str, doc: str | None = None) -> dict[str, Any]:
    """Bind `obj.prop` to `expression`. e.g. expr.set("Pad", "Length", "Spreadsheet.height * 2").

    `prop` may be a dotted sub-property path that FreeCAD's expression engine
    understands, e.g. "Placement.Base.x" or "Constraints.width" — only the root
    segment is validated against PropertiesList.
    """
    o = get_obj(doc, name)
    root = prop.split(".", 1)[0]
    if root not in o.PropertiesList:
        raise RuntimeError(f"{o.Name} has no property {root!r}")
    o.setExpression(prop, expression)
    o.Document.recompute()
    return {"name": o.Name, "prop": prop, "expression": expression}


@register("expr.get")
def expr_get(name: str, doc: str | None = None) -> dict[str, Any]:
    """Return all expression bindings on this object."""
    o = get_obj(doc, name)
    return {
        "name": o.Name,
        "expressions": {prop: expr for prop, expr in o.ExpressionEngine},
    }


@register("expr.clear")
def expr_clear(name: str, prop: str, doc: str | None = None) -> dict[str, Any]:
    """Remove the expression binding on `obj.prop`. The property keeps its last computed value."""
    o = get_obj(doc, name)
    o.setExpression(prop, None)
    o.Document.recompute()
    return {"name": o.Name, "prop": prop, "cleared": True}
