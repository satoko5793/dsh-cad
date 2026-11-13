# Vendored from seansackowitz/mcp-freecad, MIT; see LICENSE and SOURCE.json.
"""View/screenshot handlers. The screenshot is the ONLY tool that returns image data."""

from __future__ import annotations

import base64
import os
import tempfile
from typing import Any

import FreeCAD

from .registry import register


def _gui_view():
    try:
        import FreeCADGui
    except ImportError as e:
        raise RuntimeError("FreeCAD GUI is not available — screenshots require GUI mode") from e
    from view_context import get_displayed_3d_view
    view = get_displayed_3d_view()
    if view is None:
        raise RuntimeError("no active 3D view")
    return view


@register("view.screenshot")
def view_screenshot(
    width: int = 800,
    height: int = 600,
    fit_all: bool = True,
) -> dict[str, Any]:
    view = _gui_view()
    if fit_all:
        view.fitAll()
    fd, path = tempfile.mkstemp(suffix=".png", prefix="mcp-freecad-")
    os.close(fd)
    try:
        view.saveImage(path, width, height, "Current")
        with open(path, "rb") as f:
            data = f.read()
        return {
            "format": "png",
            "width": width,
            "height": height,
            "base64": base64.b64encode(data).decode("ascii"),
        }
    finally:
        try:
            os.remove(path)
        except OSError:
            pass


@register("view.set_view")
def view_set_view(direction: str = "iso") -> dict[str, Any]:
    view = _gui_view()
    table = {
        "iso": "viewIsometric",
        "top": "viewTop",
        "bottom": "viewBottom",
        "front": "viewFront",
        "rear": "viewRear",
        "left": "viewLeft",
        "right": "viewRight",
    }
    method = table.get(direction.lower())
    if method is None:
        raise ValueError(f"unknown direction {direction!r}; use one of {list(table)}")
    getattr(view, method)()
    return {"direction": direction}


@register("view.fit_all")
def view_fit_all() -> dict[str, Any]:
    view = _gui_view()
    view.fitAll()
    return {"ok": True}
