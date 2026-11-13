# obj interfaces

Derived from pinned MIT mcp-freecad; names below use the local typed contract. Writes are queued for confirmation.

Local adapter: obj_get_properties also returns view visibility/color/transparency/display mode. obj_set_property additionally accepts ViewObject.Visibility (boolean), ViewObject.ShapeColor/LineColor (three 0..1 values), ViewObject.Transparency (integer 0..100), ViewObject.DisplayMode (native enum, e.g. Shaded or Flat Lines). These changes require confirmation too.

## obj_list (`obj.list`)

List objects in a document (active doc if `doc` omitted). Returns name/label/type only.

```json
{
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

## obj_get (`obj.get`)

Return a compact summary of one object (name, label, type, placement, shape validity).

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

## obj_get_tree (`obj.get_tree`)

Return the dependency tree (each object's InList/OutList) for the document.

```json
{
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

## obj_get_properties (`obj.get_properties`)

Return all properties of an object as a flat dict. Use sparingly — payload can be large.

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

## obj_set_property (`obj.set_property`)

Set a single property on an object and recompute.

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
  "value": {
    "type": "json",
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

## obj_delete (`obj.delete`)

Delete an object from its document.

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

## obj_set_placement (`obj.set_placement`)

Set placement. `pos` is [x,y,z]; `rotation` is [yaw,pitch,roll] degrees or [ax,ay,az,deg].

```json
{
  "name": {
    "type": "string",
    "required": true
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

## obj_set_label (`obj.set_label`)

Change an object's display label.

```json
{
  "name": {
    "type": "string",
    "required": true
  },
  "label": {
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
