"""Local CAD worker. The AST checks are guardrails, not an OS sandbox."""
import ast
import contextlib
import io
import json
import math
import pathlib
import sys
import traceback

import cadquery as cq


def run(payload):
    source = payload['source']
    tree = ast.parse(source, filename='model.py')
    # Some models repeat a literal params dictionary in their source. The
    # tool's explicit parameter payload must remain authoritative for edits.
    normalized = []
    for statement in tree.body:
        if isinstance(statement, ast.Assign) and any(isinstance(t, ast.Name) and t.id == 'params' for t in statement.targets):
            if len(statement.targets) != 1 or not isinstance(statement.value, ast.Dict):
                raise ValueError('Do not reassign params; read dimensions from the provided params dictionary')
            literal = ast.literal_eval(statement.value)
            if not isinstance(literal, dict) or any(not isinstance(k, str) or not isinstance(v, (int, float)) for k, v in literal.items()):
                raise ValueError('params must contain only numeric dimensions')
            continue
        normalized.append(statement)
    tree.body = normalized
    source = ast.unparse(tree)
    forbidden = {'open', 'exec', 'eval', 'compile', '__import__', 'getattr', 'setattr', 'globals', 'locals', 'input', 'breakpoint'}
    for node in ast.walk(tree):
        if isinstance(node, ast.Import) and any(n.name not in {'cadquery', 'math'} for n in node.names):
            raise ValueError('Only cadquery and math imports are allowed')
        if isinstance(node, ast.ImportFrom):
            raise ValueError('Use import cadquery as cq or import math')
        if isinstance(node, ast.Name) and (node.id.startswith('_') or node.id in forbidden):
            raise ValueError('Unsupported name in modeling script')
        if isinstance(node, ast.Name) and node.id == 'params' and isinstance(node.ctx, ast.Store):
            raise ValueError('Do not reassign params')
        if isinstance(node, ast.Subscript) and isinstance(node.value, ast.Name) and node.value.id == 'params' and isinstance(node.ctx, ast.Store):
            raise ValueError('Do not mutate params')
        if isinstance(node, ast.Attribute) and (node.attr.startswith('_') or node.attr in {'export', 'exportStep', 'exportStl', 'importStep', 'importBrep', 'importBin', 'exporters', 'importers'}):
            raise ValueError('File access belongs to the CAD worker')
    allowed = {k: __builtins__[k] for k in ['range', 'min', 'max', 'abs', 'float', 'int', 'len', 'dict', 'list', 'tuple', 'enumerate', 'zip', 'sum', 'round', 'bool', 'str', 'Exception', 'ValueError', 'print', '__import__']} if isinstance(__builtins__, dict) else {k: getattr(__builtins__, k) for k in ['range', 'min', 'max', 'abs', 'float', 'int', 'len', 'dict', 'list', 'tuple', 'enumerate', 'zip', 'sum', 'round', 'bool', 'str', 'Exception', 'ValueError', 'print', '__import__']}
    scope = {'__builtins__': allowed, 'cq': cq, 'math': math, 'params': payload['parameters']}
    with contextlib.redirect_stdout(io.StringIO()):
        exec(compile(tree, 'model.py', 'exec'), scope)
    model = scope.get('result')
    if isinstance(model, cq.Workplane):
        shapes = model.vals()
        shape = cq.Compound.makeCompound(shapes) if len(shapes) > 1 else model.val()
    elif isinstance(model, cq.Shape):
        shape = model
    else:
        raise ValueError('Script must assign a cq.Workplane or cq.Shape to result')
    if not shape.isValid() or not shape.Solids() or shape.Volume() <= 0:
        raise ValueError('Result must contain valid, non-empty CAD solids')
    bounds = shape.BoundingBox()
    size = [bounds.xlen, bounds.ylen, bounds.zlen]
    if not all(math.isfinite(x) and 0 < x <= 100000 for x in size):
        raise ValueError('Invalid model dimensions (allowed: 0–100000 mm)')
    output = pathlib.Path(payload['output'])
    with contextlib.redirect_stdout(io.StringIO()):
        cq.exporters.export(shape, str(output / 'model.step'))
        cq.exporters.export(shape, str(output / 'model.stl'), tolerance=0.05, angularTolerance=0.1)
    cylinders = []
    for face in shape.Faces():
        if face.geomType() == 'CYLINDER':
            surface = face._geomAdaptor().Cylinder()
            cylinders.append({'diameter': round(surface.Radius() * 2, 4), 'center': [round(v, 4) for v in face.Center().toTuple()], 'axis': [round(v, 4) for v in (surface.Axis().Direction().X(), surface.Axis().Direction().Y(), surface.Axis().Direction().Z())]})
    return {'geometry': {'size': [round(x, 4) for x in size], 'volume': round(shape.Volume(), 4), 'area': round(shape.Area(), 4), 'solids': len(shape.Solids()), 'faces': len(shape.Faces()), 'cylindricalSurfaces': cylinders[:100], 'valid': True, 'units': 'mm'}, 'source': source}


if __name__ == '__main__':
    try:
        print(json.dumps({'ok': True, **run(json.load(sys.stdin))}))
    except Exception:
        print(json.dumps({'ok': False, 'error': traceback.format_exc(limit=5)}))
        sys.exit(1)
