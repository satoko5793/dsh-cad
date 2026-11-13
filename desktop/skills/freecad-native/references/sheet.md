# sheet interfaces

Derived from pinned MIT mcp-freecad; names below use the local typed contract. Writes are queued for confirmation.

## sheet_create (`sheet.create`)

Create a Spreadsheet object. Pair with sheet_set_cell + sheet_set_alias to expose
cells as named parameters that expr_set can reference.

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

## sheet_set_cell (`sheet.set_cell`)

Set a cell. `cell` is A1-style ('A1', 'B3'). `value` is a string:
number ('12.5'), formula ('=A1*2'), text ('hello').

```json
{
  "sheet": {
    "type": "string",
    "required": true
  },
  "cell": {
    "type": "string",
    "required": true
  },
  "value": {
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

## sheet_get_cell (`sheet.get_cell`)

Get a cell's raw contents and evaluated value.

```json
{
  "sheet": {
    "type": "string",
    "required": true
  },
  "cell": {
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

## sheet_set_alias (`sheet.set_alias`)

Alias a cell so expressions can reference it as `<SheetLabel>.<alias>`.

```json
{
  "sheet": {
    "type": "string",
    "required": true
  },
  "cell": {
    "type": "string",
    "required": true
  },
  "alias": {
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
