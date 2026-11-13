# part interfaces

Derived from pinned MIT mcp-freecad; names below use the local typed contract. Writes are queued for confirmation.

## part_box (`part.box`)

Create a Part::Box. Dimensions in document units (mm by default).

```json
{
  "length": {
    "type": "number",
    "default": 10
  },
  "width": {
    "type": "number",
    "default": 10
  },
  "height": {
    "type": "number",
    "default": 10
  },
  "pos": {
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
  "rotation": {
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

## part_cylinder (`part.cylinder`)

Create a Part::Cylinder. Use `angle` < 360 for a wedge.

```json
{
  "radius": {
    "type": "number",
    "default": 5
  },
  "height": {
    "type": "number",
    "default": 10
  },
  "angle": {
    "type": "number",
    "default": 360
  },
  "pos": {
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
  "rotation": {
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

## part_sphere (`part.sphere`)

Create a Part::Sphere. angle1/angle2 cap latitude; angle3 sweeps longitude.

```json
{
  "radius": {
    "type": "number",
    "default": 5
  },
  "angle1": {
    "type": "number",
    "default": -90
  },
  "angle2": {
    "type": "number",
    "default": 90
  },
  "angle3": {
    "type": "number",
    "default": 360
  },
  "pos": {
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
  "rotation": {
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

## part_cone (`part.cone`)

Create a Part::Cone (truncated if radius1 != radius2).

```json
{
  "radius1": {
    "type": "number",
    "default": 2
  },
  "radius2": {
    "type": "number",
    "default": 4
  },
  "height": {
    "type": "number",
    "default": 10
  },
  "angle": {
    "type": "number",
    "default": 360
  },
  "pos": {
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
  "rotation": {
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

## part_torus (`part.torus`)

Create a Part::Torus. radius1 = ring radius; radius2 = tube radius.

```json
{
  "radius1": {
    "type": "number",
    "default": 10
  },
  "radius2": {
    "type": "number",
    "default": 2
  },
  "angle1": {
    "type": "number",
    "default": -180
  },
  "angle2": {
    "type": "number",
    "default": 180
  },
  "angle3": {
    "type": "number",
    "default": 360
  },
  "pos": {
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
  "rotation": {
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

## part_plane (`part.plane`)

Create a flat Part::Plane face.

```json
{
  "length": {
    "type": "number",
    "default": 10
  },
  "width": {
    "type": "number",
    "default": 10
  },
  "pos": {
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
  "rotation": {
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

## part_extrude (`part.extrude`)

Extrude a 2D profile (sketch/wire/face) along `direction` for `length`.

```json
{
  "profile": {
    "type": "string",
    "required": true
  },
  "direction": {
    "type": "array",
    "items": {
      "type": "number"
    },
    "required": true
  },
  "length": {
    "type": "number",
    "default": 10
  },
  "solid": {
    "type": "boolean",
    "default": true
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

## part_revolve (`part.revolve`)

Revolve a profile around `axis` through `base_point` for `angle` degrees.

```json
{
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
    "default": 360
  },
  "solid": {
    "type": "boolean",
    "default": true
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

## part_loft (`part.loft`)

Loft through a list of section profiles (by name).

```json
{
  "sections": {
    "type": "array",
    "items": {
      "type": "string"
    },
    "required": true
  },
  "solid": {
    "type": "boolean",
    "default": true
  },
  "ruled": {
    "type": "boolean",
    "default": false
  },
  "closed": {
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

## part_sweep (`part.sweep`)

Sweep a profile along a path.

```json
{
  "profile": {
    "type": "string",
    "required": true
  },
  "path": {
    "type": "string",
    "required": true
  },
  "solid": {
    "type": "boolean",
    "default": true
  },
  "frenet": {
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

## part_fuse (`part.fuse`)

Boolean union: base ∪ tool.

```json
{
  "base": {
    "type": "string",
    "required": true
  },
  "tool": {
    "type": "string",
    "required": true
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

## part_cut (`part.cut`)

Boolean difference: base − tool.

```json
{
  "base": {
    "type": "string",
    "required": true
  },
  "tool": {
    "type": "string",
    "required": true
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

## part_common (`part.common`)

Boolean intersection: base ∩ tool.

```json
{
  "base": {
    "type": "string",
    "required": true
  },
  "tool": {
    "type": "string",
    "required": true
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

## part_fillet (`part.fillet`)

Fillet (round) selected edges of `base`. `edges` are 1-based edge indices.

```json
{
  "base": {
    "type": "string",
    "required": true
  },
  "edges": {
    "type": "array",
    "items": {
      "type": "integer"
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

## part_chamfer (`part.chamfer`)

Chamfer selected edges of `base`. `edges` are 1-based edge indices.

```json
{
  "base": {
    "type": "string",
    "required": true
  },
  "edges": {
    "type": "array",
    "items": {
      "type": "integer"
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

## part_mirror (`part.mirror`)

Mirror an object across a plane defined by `normal` through `base_point`.

```json
{
  "source": {
    "type": "string",
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

## part_pattern_linear (`part.pattern_linear`)

Linear array of `source` along `direction` with `count` copies spaced `interval` apart.

```json
{
  "source": {
    "type": "string",
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
  "interval": {
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

## part_pattern_polar (`part.pattern_polar`)

Polar array of `source` around `axis` through `center` for total `angle` degrees.

```json
{
  "source": {
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
  "count": {
    "type": "integer",
    "default": 4
  },
  "angle": {
    "type": "number",
    "default": 360.0
  },
  "center": {
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
