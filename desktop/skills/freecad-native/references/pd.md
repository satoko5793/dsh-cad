# pd interfaces

Derived from pinned MIT mcp-freecad; names below use the local typed contract. Writes are queued for confirmation.

## pd_create_body (`pd.create_body`)

Create a new PartDesign Body. Features are added to one Body at a time.

```json
{
  "label": {
    "type": "string",
    "required": true,
    "description": "Unique ASCII object ID; use obj_set_label for human display labels."
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

## pd_pad (`pd.pad`)

Pad (extrude) a sketch profile inside a Body. `midplane` extrudes symmetrically.

```json
{
  "body": {
    "type": "string",
    "required": true
  },
  "profile": {
    "type": "string",
    "required": true
  },
  "length": {
    "type": "number",
    "default": 10.0
  },
  "reversed": {
    "type": "boolean",
    "default": false
  },
  "midplane": {
    "type": "boolean",
    "default": false
  },
  "label": {
    "type": "string",
    "required": true,
    "description": "Unique ASCII object ID; use obj_set_label for human display labels."
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

## pd_pocket (`pd.pocket`)

Pocket (subtract by extruding) a sketch profile inside a Body.

```json
{
  "body": {
    "type": "string",
    "required": true
  },
  "profile": {
    "type": "string",
    "required": true
  },
  "length": {
    "type": "number",
    "default": 10.0
  },
  "reversed": {
    "type": "boolean",
    "default": false
  },
  "midplane": {
    "type": "boolean",
    "default": false
  },
  "label": {
    "type": "string",
    "required": true,
    "description": "Unique ASCII object ID; use obj_set_label for human display labels."
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

## pd_revolution (`pd.revolution`)

Revolve a profile around an axis to create a solid feature on a Body.

```json
{
  "body": {
    "type": "string",
    "required": true
  },
  "profile": {
    "type": "string",
    "required": true
  },
  "axis": {
    "type": "array",
    "items": {
      "type": "number"
    },
    "required": true
  },
  "base_point": {
    "oneOf": [
      {
        "type": "array",
        "items": {
          "type": "number"
        }
      },
      {
        "type": "null"
      }
    ],
    "default": null
  },
  "angle": {
    "type": "number",
    "default": 360.0
  },
  "reversed": {
    "type": "boolean",
    "default": false
  },
  "label": {
    "type": "string",
    "required": true,
    "description": "Unique ASCII object ID; use obj_set_label for human display labels."
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

## pd_groove (`pd.groove`)

Groove (subtractive revolution) a profile around an axis.

```json
{
  "body": {
    "type": "string",
    "required": true
  },
  "profile": {
    "type": "string",
    "required": true
  },
  "axis": {
    "type": "array",
    "items": {
      "type": "number"
    },
    "required": true
  },
  "base_point": {
    "oneOf": [
      {
        "type": "array",
        "items": {
          "type": "number"
        }
      },
      {
        "type": "null"
      }
    ],
    "default": null
  },
  "angle": {
    "type": "number",
    "default": 360.0
  },
  "reversed": {
    "type": "boolean",
    "default": false
  },
  "label": {
    "type": "string",
    "required": true,
    "description": "Unique ASCII object ID; use obj_set_label for human display labels."
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

## pd_fillet (`pd.fillet`)

Fillet edges on a Body feature. `edges` are sub-names like ['Edge1', 'Edge3'].

```json
{
  "body": {
    "type": "string",
    "required": true
  },
  "base_feature": {
    "type": "string",
    "required": true
  },
  "edges": {
    "type": "array",
    "items": {
      "type": "string"
    },
    "required": true
  },
  "radius": {
    "type": "number",
    "default": 1.0
  },
  "label": {
    "type": "string",
    "required": true,
    "description": "Unique ASCII object ID; use obj_set_label for human display labels."
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

## pd_chamfer (`pd.chamfer`)

Chamfer edges on a Body feature. `edges` are sub-names like ['Edge1', 'Edge3'].

```json
{
  "body": {
    "type": "string",
    "required": true
  },
  "base_feature": {
    "type": "string",
    "required": true
  },
  "edges": {
    "type": "array",
    "items": {
      "type": "string"
    },
    "required": true
  },
  "size": {
    "type": "number",
    "default": 1.0
  },
  "label": {
    "type": "string",
    "required": true,
    "description": "Unique ASCII object ID; use obj_set_label for human display labels."
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

## pd_pattern_linear (`pd.pattern_linear`)

Linear pattern of features on a Body.

```json
{
  "body": {
    "type": "string",
    "required": true
  },
  "originals": {
    "type": "array",
    "items": {
      "type": "string"
    },
    "required": true
  },
  "direction": {
    "type": "array",
    "items": {
      "type": "number"
    },
    "required": true
  },
  "count": {
    "type": "integer",
    "default": 2
  },
  "length": {
    "type": "number",
    "default": 10.0
  },
  "label": {
    "type": "string",
    "required": true,
    "description": "Unique ASCII object ID; use obj_set_label for human display labels."
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

## pd_pattern_polar (`pd.pattern_polar`)

Polar pattern of features on a Body.

```json
{
  "body": {
    "type": "string",
    "required": true
  },
  "originals": {
    "type": "array",
    "items": {
      "type": "string"
    },
    "required": true
  },
  "axis": {
    "type": "array",
    "items": {
      "type": "number"
    },
    "required": true
  },
  "count": {
    "type": "integer",
    "default": 4
  },
  "angle": {
    "type": "number",
    "default": 360.0
  },
  "label": {
    "type": "string",
    "required": true,
    "description": "Unique ASCII object ID; use obj_set_label for human display labels."
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

## pd_mirrored (`pd.mirrored`)

Mirror features across a plane (normal + base point) on a Body.

```json
{
  "body": {
    "type": "string",
    "required": true
  },
  "originals": {
    "type": "array",
    "items": {
      "type": "string"
    },
    "required": true
  },
  "normal": {
    "type": "array",
    "items": {
      "type": "number"
    },
    "required": true
  },
  "base_point": {
    "oneOf": [
      {
        "type": "array",
        "items": {
          "type": "number"
        }
      },
      {
        "type": "null"
      }
    ],
    "default": null
  },
  "label": {
    "type": "string",
    "required": true,
    "description": "Unique ASCII object ID; use obj_set_label for human display labels."
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
