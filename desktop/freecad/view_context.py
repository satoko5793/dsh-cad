"""Displayed-view guard reused from neka-nat/freecad-mcp (MIT).

Upstream commit: 5014bd9d538b8d09e11201e219cfe291ebca7b4e
Source: addon/FreeCADMCP/rpc_server/view_manager.py, get_displayed_3d_view
Copyright (c) 2025 Shirokuma (k tanaka).
Full license: third_party/freecad-mcp-LICENSE.txt
The upstream function is retained; capture/confirmation remain in our adapter.
"""

from typing import Any
import FreeCADGui


def get_displayed_3d_view() -> Any:
    """Return the 3D view currently displayed in the main window, or None.

    ``FreeCADGui.ActiveDocument.ActiveView`` can still return a document's 3D
    view while another tab (TechDraw page, Start page, spreadsheet...) is in
    front. Capturing that hidden view, and sending ``ViewSelection`` to an
    active MDI view that is not the one being captured, can crash FreeCAD a
    few seconds later. Only the view actually shown is safe to capture.
    """
    try:
        view = FreeCADGui.activeView()
    except Exception:
        return None
    if view is None or not hasattr(view, "saveImage"):
        return None
    return view
