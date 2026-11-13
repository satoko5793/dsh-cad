# sketch interfaces

Derived from pinned MIT mcp-freecad; names below use the local typed contract. Writes are queued for confirmation.

## sketch_create (`sketch.create`)

Create a sketch on a base plane preset (xy/xz/yz) or attached to an existing face.

For a face attachment pass `support`=face-owner-name (a generic attachment is created;
for fine control use script.execute_python).

```json
{
  "plane": {
    "oneOf": [
      {
        "type": "string"
      },
      {
        "type": "null"
      }
    ],
    "default": "xy"
  },
  "support": {
    "oneOf": [
      {
        "type": "string"
      },
      {
        "type": "null"
      }
    ],
    "default": null
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

## sketch_add_line (`sketch.add_line`)

Add a line segment to a sketch. Points are 2D [x, y] in sketch coordinates.

```json
{
  "sketch": {
    "type": "string",
    "required": true
  },
  "start": {
    "type": "array",
    "items": {
      "type": "number"
    },
    "required": true
  },
  "end": {
    "type": "array",
    "items": {
      "type": "number"
    },
    "required": true
  },
  "construction": {
    "type": "boolean",
    "default": false
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

## sketch_add_circle (`sketch.add_circle`)

Add a circle to a sketch.

```json
{
  "sketch": {
    "type": "string",
    "required": true
  },
  "center": {
    "type": "array",
    "items": {
      "type": "number"
    },
    "required": true
  },
  "radius": {
    "type": "number",
    "required": true
  },
  "construction": {
    "type": "boolean",
    "default": false
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

## sketch_add_arc (`sketch.add_arc`)

Add a circular arc to a sketch. Angles in degrees from +X axis, CCW.

```json
{
  "sketch": {
    "type": "string",
    "required": true
  },
  "center": {
    "type": "array",
    "items": {
      "type": "number"
    },
    "required": true
  },
  "radius": {
    "type": "number",
    "required": true
  },
  "start_angle": {
    "type": "number",
    "required": true
  },
  "end_angle": {
    "type": "number",
    "required": true
  },
  "construction": {
    "type": "boolean",
    "default": false
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

## sketch_add_point (`sketch.add_point`)

Add an isolated point to a sketch.

```json
{
  "sketch": {
    "type": "string",
    "required": true
  },
  "point": {
    "type": "array",
    "items": {
      "type": "number"
    },
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

## sketch_add_polyline (`sketch.add_polyline`)

Add a chain of connected line segments. Auto-adds Coincident constraints between
consecutive endpoints. If `closed`, closes the polyline back to the first point.

```json
{
  "sketch": {
    "type": "string",
    "required": true
  },
  "points": {
    "type": "array",
    "items": {
      "type": "array",
      "items": {
        "type": "number"
      }
    },
    "required": true
  },
  "closed": {
    "type": "boolean",
    "default": false
  },
  "construction": {
    "type": "boolean",
    "default": false
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

## sketch_add_constraint (`sketch.add_constraint`)

Add a constraint to a sketch.

`kind` is one of: Coincident, Horizontal, Vertical, Parallel, Perpendicular,
Tangent, Equal, Symmetric, Block, Distance, DistanceX, DistanceY, Radius,
Diameter, Angle, PointOnObject.

`refs` flattens (geo_index, point_index) pairs:
  - For "the curve itself", point_index = 0
  - Endpoints: 1 = start, 2 = end (for line/arc); 3 = center (arc/circle)
  - Coincident([3, 2, 5, 1]) = end of geo3 coincident with start of geo5

`value` required for dimensional constraints (Distance*, Radius, Diameter, Angle).
Lengths in mm, angles in degrees.

```json
{
  "sketch": {
    "type": "string",
    "required": true
  },
  "kind": {
    "type": "string",
    "required": true
  },
  "refs": {
    "type": "array",
    "items": {
      "type": "integer"
    },
    "required": true
  },
  "value": {
    "oneOf": [
      {
        "type": "number"
      },
      {
        "type": "null"
      }
    ],
    "default": null
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

## sketch_set_constraint_value (`sketch.set_constraint_value`)

Change the driving value of an existing dimensional constraint. Lengths in mm,
angles in degrees.

```json
{
  "sketch": {
    "type": "string",
    "required": true
  },
  "constraint_index": {
    "type": "integer",
    "required": true
  },
  "value": {
    "type": "number",
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

## sketch_list_geometry (`sketch.list_geometry`)

List all geometry in a sketch with index, type, and key parameters.

```json
{
  "sketch": {
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

## sketch_list_constraints (`sketch.list_constraints`)

List all constraints in a sketch with index, type, refs, and value (if dimensional).

```json
{
  "sketch": {
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

## sketch_delete_geometry (`sketch.delete_geometry`)

Delete geometry elements by index.

```json
{
  "sketch": {
    "type": "string",
    "required": true
  },
  "indices": {
    "type": "array",
    "items": {
      "type": "integer"
    },
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

## sketch_delete_constraint (`sketch.delete_constraint`)

Delete constraints by index.

```json
{
  "sketch": {
    "type": "string",
    "required": true
  },
  "indices": {
    "type": "array",
    "items": {
      "type": "integer"
    },
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
