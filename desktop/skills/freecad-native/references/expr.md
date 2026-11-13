# expr interfaces

Derived from pinned MIT mcp-freecad; names below use the local typed contract. Writes are queued for confirmation.

## expr_set (`expr.set`)

Bind a property to a FreeCAD expression.

Examples:
  expr_set("Pad", "Length", "Spreadsheet.wall_thickness * 2")
  expr_set("Box", "Width", "Box.Length / 2")

```json
{
  "name": {
    "type": "string",
    "required": true
  },
  "prop": {
    "type": "string",
    "required": true
  },
  "expression": {
    "type": "string",
    "required": true
  },
  "doc": {
    "oneOf": [
      {
        "type": "string"
      },
      {
        "type": "null"
      }
    ],
    "default": null
  }
}
```

## expr_get (`expr.get`)

Return all expression bindings on an object.

```json
{
  "name": {
    "type": "string",
    "required": true
  },
  "doc": {
    "oneOf": [
      {
        "type": "string"
      },
      {
        "type": "null"
      }
    ],
    "default": null
  }
}
```

## expr_clear (`expr.clear`)

Remove the expression binding on a property.

```json
{
  "name": {
    "type": "string",
    "required": true
  },
  "prop": {
    "type": "string",
    "required": true
  },
  "doc": {
    "oneOf": [
      {
        "type": "string"
      },
      {
        "type": "null"
      }
    ],
    "default": null
  }
}
```
