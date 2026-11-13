# doc interfaces

Derived from pinned MIT mcp-freecad; names below use the local typed contract. Writes are queued for confirmation.

## doc_list (`doc.list`)

List all open FreeCAD documents.

```json
{}
```

## doc_create (`doc.create`)

Create a new empty document. `name` is the internal id, `label` is the display name.

```json
{
  "name": {
    "type": "string",
    "required": true,
    "description": "Unique ASCII document ID."
  },
  "label": {
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

## doc_recompute (`doc.recompute`)

Recompute the document and return any errors found.

```json
{
  "name": {
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
