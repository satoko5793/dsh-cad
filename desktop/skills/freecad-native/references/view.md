# view interfaces

Derived from pinned MIT mcp-freecad; names below use the local typed contract. Writes are queued for confirmation.

## view_set_view (`view.set_view`)

Switch the active 3D view direction. `direction` ∈ iso, top, bottom, front, rear, left, right.

```json
{
  "direction": {
    "type": "string",
    "default": "iso"
  }
}
```

## view_fit_all (`view.fit_all`)

Zoom-fit all visible objects in the active 3D view.

```json
{}
```
