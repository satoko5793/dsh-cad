# io interfaces

Derived from pinned MIT mcp-freecad; names below use the local typed contract. Writes are queued for confirmation.

## io_import_step (`io.import_step`)

Import a STEP file into the active (or named) document.

```json
{
  "path": {
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

## io_import_iges (`io.import_iges`)

Import an IGES file into the active (or named) document.

```json
{
  "path": {
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

## io_export_step (`io.export_step`)

Export objects to STEP. If `names` is omitted, exports the whole document.

```json
{
  "path": {
    "type": "string",
    "required": true
  },
  "names": {
    "oneOf": [
      {
        "type": "array",
        "items": {
          "type": "string"
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

## io_export_iges (`io.export_iges`)

Export objects to IGES.

```json
{
  "path": {
    "type": "string",
    "required": true
  },
  "names": {
    "oneOf": [
      {
        "type": "array",
        "items": {
          "type": "string"
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

## io_export_stl (`io.export_stl`)

Export objects to STL (mesh). Use for 3D printing pipelines.

```json
{
  "path": {
    "type": "string",
    "required": true
  },
  "names": {
    "oneOf": [
      {
        "type": "array",
        "items": {
          "type": "string"
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

## io_export_obj (`io.export_obj`)

Export objects to OBJ (mesh).

```json
{
  "path": {
    "type": "string",
    "required": true
  },
  "names": {
    "oneOf": [
      {
        "type": "array",
        "items": {
          "type": "string"
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
