# mcp-freecad

A Model Context Protocol server for FreeCAD. ~70 single-purpose tools across `doc/obj/part/sketch/pd/expr/sheet/io/view`, with screenshots returned only when explicitly requested. Designed for parametric modeling at low token cost.

## Why this server

- **Screenshots are a tool, not a side effect.** `view_screenshot` is the only tool that returns an image. Every other tool returns small, structured text — typically a few hundred bytes per call instead of an embedded PNG.
- **One operation per tool, ~70 small tools** organized by namespace (`doc_*`, `obj_*`, `part_*`, `sketch_*`, `pd_*`, `expr_*`, `sheet_*`, `io_*`, `view_*`, `script_*`). The model only pays the schema cost for what it uses, and per-call payloads stay tiny.
- **Parametric-first.** First-class tools for sketches, constraints, PartDesign features, expression bindings, and spreadsheet-driven parameters.
- **Escape hatch.** `script_execute_python` runs arbitrary Python in FreeCAD's interpreter for anything not covered by a dedicated tool — so you're never blocked on missing surface area.

## Architecture

```
┌──────────────────┐     stdio MCP      ┌──────────────────┐    XML-RPC     ┌────────────────────┐
│  MCP client      │ ─────────────────▶ │  mcp-freecad     │ ─────────────▶ │ FreeCAD            │
│  (Claude Desktop,│                    │  Python server   │  127.0.0.1:    │ + FreeCADMCP addon │
│   Claude Code…)  │ ◀───────────────── │  (this package)  │  9876          │ (RPC server)       │
└──────────────────┘                    └──────────────────┘                └────────────────────┘
```

Two pieces:

1. **`addon/FreeCADMCP/`** — a FreeCAD workbench that runs an XML-RPC server inside FreeCAD. Pure stdlib, no pip install into FreeCAD's Python.
2. **`src/mcp_freecad/`** — the MCP server, runs in your normal Python env, proxies tool calls to the addon over XML-RPC.

## Requirements

- **FreeCAD 1.1 or later**, running with the GUI (the addon needs Qt's event loop for thread marshaling).
- **Python 3.11+** for the MCP server side.
- **[uv](https://docs.astral.sh/uv/)** is recommended. Install with: `curl -LsSf https://astral.sh/uv/install.sh | sh`

## Installation

There are three steps: install the addon into FreeCAD, install the MCP server, and configure your MCP client.

### 1. Install the FreeCAD addon

Copy (or symlink) `addon/FreeCADMCP` into your FreeCAD Mod directory.

> **FreeCAD 1.1+ uses versioned user-data directories** (`v1-1`, `v1-2`, …). Use the row matching your FreeCAD version. To verify the path your FreeCAD reports, open the Python console and run:
> ```python
> import FreeCAD
> print(FreeCAD.ApplicationDirectories.getUserModDirectory())
> ```

| OS      | Mod directory (FreeCAD 1.1)                                          |
|---------|----------------------------------------------------------------------|
| macOS   | `~/Library/Application Support/FreeCAD/v1-1/Mod/`                    |
| Linux   | `~/.local/share/FreeCAD/v1-1/Mod/`                                   |
| Windows | `%APPDATA%\FreeCAD\v1-1\Mod\`                                        |

For FreeCAD 1.2 swap `v1-1` → `v1-2`, and so on.

```bash
# macOS — symlink so updates to this repo are picked up automatically
ln -s "$PWD/addon/FreeCADMCP" \
  "$HOME/Library/Application Support/FreeCAD/v1-1/Mod/FreeCADMCP"

# Linux
ln -s "$PWD/addon/FreeCADMCP" "$HOME/.local/share/FreeCAD/v1-1/Mod/FreeCADMCP"

# Windows (PowerShell, run as Administrator for symlink)
New-Item -ItemType SymbolicLink `
  -Path  "$env:APPDATA\FreeCAD\v1-1\Mod\FreeCADMCP" `
  -Value "$PWD\addon\FreeCADMCP"
```

> **Note:** if a directory named `FreeCADMCP` already exists at that path (from a previously installed FreeCAD MCP addon), rename or delete it before symlinking — otherwise `ln -s` will refuse or clobber. Rename example:
> ```bash
> mv "$HOME/Library/Application Support/FreeCAD/v1-1/Mod/FreeCADMCP" \
>    "$HOME/Library/Application Support/FreeCAD/v1-1/Mod/FreeCADMCP.bak"
> ```

Then **restart FreeCAD**. You should see this in FreeCAD's Report View:

```
[FreeCADMCP] RPC server listening on 127.0.0.1:9876
```

If you don't see the workbench list a "MCP" entry, open *Tools → Customize… → Workbenches* and confirm `FreeCADMCPWorkbench` is enabled.

### 2. Install the MCP server

From the repo root:

```bash
# Install as a CLI tool (recommended)
uv tool install .

# This puts a `mcp-freecad` executable on your PATH.
which mcp-freecad
```

Alternatively, run directly without installing:

```bash
uv run --from . mcp-freecad
```

### 3. Configure your MCP client

The server speaks MCP over stdio.

#### Claude Desktop

Edit `~/Library/Application Support/Claude/claude_desktop_config.json` (macOS) / `%APPDATA%\Claude\claude_desktop_config.json` (Windows):

```json
{
  "mcpServers": {
    "freecad": {
      "command": "mcp-freecad"
    }
  }
}
```

If `mcp-freecad` isn't on Claude Desktop's PATH, use the absolute path that `which mcp-freecad` printed.

#### Claude Code

```bash
claude mcp add freecad mcp-freecad
```

Or edit `~/.claude.json` directly:

```json
{
  "mcpServers": {
    "freecad": { "command": "mcp-freecad" }
  }
}
```

#### Other MCP clients

Any client that can launch a stdio-based MCP server. Command: `mcp-freecad`. No arguments.

### 4. Verify

Start FreeCAD (with the addon installed). Then in your MCP client, ask the assistant to call `doc_list` — it should return an empty array (no documents open). Create one:

> Create a FreeCAD document called "test", then make a 20×20×20 box.

You should see `doc_create` and `part_box` calls return small JSON blobs. No image bytes anywhere.

## Configuration

Environment variables (read by both the addon and the MCP server):

| Variable                    | Default                       | Used by    | Purpose                          |
|-----------------------------|-------------------------------|------------|----------------------------------|
| `FREECAD_MCP_HOST`          | `127.0.0.1`                   | addon      | RPC server bind address          |
| `FREECAD_MCP_PORT`          | `9876`                        | addon      | RPC server port                  |
| `FREECAD_MCP_CALL_TIMEOUT`  | `60` (seconds)                | addon      | Per-call main-thread timeout     |
| `FREECAD_MCP_RPC_URL`       | `http://127.0.0.1:9876/RPC2`  | MCP server | Where to find the addon's RPC    |

To set them for the addon, launch FreeCAD from a shell that has them exported. To set them for the MCP server, configure them in your MCP client config (most clients support an `env` map alongside `command`).

## Tool catalog

All tool names use underscores (MCP convention). The original namespace is preserved in the prefix.

### `doc_*` — document lifecycle (7)
`doc_list`, `doc_create`, `doc_open`, `doc_save`, `doc_close`, `doc_set_active`, `doc_recompute`

### `obj_*` — inspection and basic mutation (8)
`obj_list`, `obj_get`, `obj_get_tree`, `obj_get_properties`, `obj_set_property`, `obj_delete`, `obj_set_placement`, `obj_set_label`

### `part_*` — Part workbench (18)
Primitives: `part_box`, `part_cylinder`, `part_sphere`, `part_cone`, `part_torus`, `part_plane`
Sweeps: `part_extrude`, `part_revolve`, `part_loft`, `part_sweep`
Booleans: `part_fuse`, `part_cut`, `part_common`
Edge ops: `part_fillet`, `part_chamfer`
Transforms: `part_mirror`, `part_pattern_linear`, `part_pattern_polar`

### `sketch_*` — Sketcher (12)
`sketch_create`, `sketch_add_line`, `sketch_add_circle`, `sketch_add_arc`, `sketch_add_point`, `sketch_add_polyline`, `sketch_add_constraint`, `sketch_set_constraint_value`, `sketch_list_geometry`, `sketch_list_constraints`, `sketch_delete_geometry`, `sketch_delete_constraint`

### `pd_*` — PartDesign (10)
`pd_create_body`, `pd_pad`, `pd_pocket`, `pd_revolution`, `pd_groove`, `pd_fillet`, `pd_chamfer`, `pd_pattern_linear`, `pd_pattern_polar`, `pd_mirrored`

### `expr_*` — expression bindings (3)
`expr_set`, `expr_get`, `expr_clear`

### `sheet_*` — Spreadsheet (4)
`sheet_create`, `sheet_set_cell`, `sheet_get_cell`, `sheet_set_alias`

### `io_*` — import/export (6)
`io_import_step`, `io_import_iges`, `io_export_step`, `io_export_iges`, `io_export_stl`, `io_export_obj`

### `view_*` — view & screenshot (3)
`view_screenshot` (the *only* tool that returns image data), `view_set_view`, `view_fit_all`

### `script_*` — escape hatch (1)
`script_execute_python` — run arbitrary Python in FreeCAD's interpreter when no dedicated tool fits.

## Usage notes

- **Sketches on a face.** `sketch_create` attaches to an existing object when you
  pass `support`. Use an `"Owner.Sub"` reference for a real attachment —
  `support="Box.Face6"` maps `FlatFace`, `support="Body.Edge3"` maps
  `NormalToEdge`. A bare object name (`support="Box"`) attaches to that object's
  local XY plane (`ObjectXY`). Without `support`, pass a `plane` preset
  (`xy`/`xz`/`yz`).

- **PartDesign patterns & mirror take vectors.** `pd_pattern_linear(direction=…)`,
  `pd_pattern_polar(axis=…)`, and `pd_mirrored(normal=…, base_point=…)` accept an
  `[x, y, z]` vector. Axis-aligned vectors resolve to the body's Origin
  axis/plane; any other vector creates a datum line/plane oriented along it. A
  negative axis-aligned vector sets the feature's `Reversed` flag. (Mirror a base
  feature, not another pattern — PartDesign can't mirror a transform result into a
  single solid.)

- **Expression bindings accept sub-property paths.** `expr_set` forwards `prop`
  straight to FreeCAD's expression engine, so dotted paths work:
  `expr_set("Box", "Placement.Base.x", "Params.offset_x")` or
  `expr_set("Sketch", "Constraints.width", "Params.width")`, not just top-level
  properties like `Length`.

## Parametric example

A 100×60 plate parameterized through a spreadsheet:

```
sheet_create(label="Params")
sheet_set_cell("Params", "A1", "100");  sheet_set_alias("Params", "A1", "length")
sheet_set_cell("Params", "A2", "60");   sheet_set_alias("Params", "A2", "width")
sheet_set_cell("Params", "A3", "5");    sheet_set_alias("Params", "A3", "thickness")

pd_create_body(label="Plate")
sketch_create(plane="xy", label="Outline")
sketch_add_polyline("Outline", [[0,0],[100,0],[100,60],[0,60]], closed=True)

pd_pad(body="Plate", profile="Outline", length=5, label="Body")

expr_set("Body",    "Length", "Params.thickness")
expr_set("Outline", # later refine sketch dims through expressions on constraint values
         "Constraints.length", "Params.length")
```

Now changing `Params.length` re-drives the whole model.

## Troubleshooting

**"Could not reach FreeCAD addon at http://127.0.0.1:9876/RPC2"**
The MCP server can't talk to FreeCAD. Check:
1. Is FreeCAD running with the GUI?
2. Did the addon load? Look in *View → Panels → Report view* for `[FreeCADMCP] RPC server listening`.
3. If you set a non-default `FREECAD_MCP_PORT`, make sure both the addon and the MCP server see the same value.

**The workbench loads but the server doesn't start**
The error appears in FreeCAD's Report view. Most common cause is a port conflict — set `FREECAD_MCP_PORT` to something free.

**"main-thread call exceeded 60s"**
A FreeCAD operation is taking longer than the per-call timeout. Increase `FREECAD_MCP_CALL_TIMEOUT` (e.g. `120`).

**Tool returns `shape_valid: false`**
The geometry op produced an invalid shape (common with degenerate booleans, self-intersecting profiles, or zero-thickness extrusions). Inspect with `obj_get_properties` and `doc_recompute` to see the failure mode.

**I need to do X and there's no tool for it**
Use `script_execute_python`. The namespace has `App` (FreeCAD), `Gui`, `Part`, `Sketcher` pre-imported. If you find yourself reaching for it for something common, consider opening an issue or adding a dedicated tool.

## Development

```bash
# Run the MCP server against a running FreeCAD instance
uv run -m mcp_freecad

# After changing the addon, restart FreeCAD (or call `from FreeCADMCP import server; server.stop(); server.start()` from FreeCAD's Python console).
```

## License

MIT.
