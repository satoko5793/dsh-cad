"""Vendor MIT FreeCAD handlers and derive the tool contract without importing them."""
import ast
import hashlib
import json
import pathlib
import shutil
import subprocess

ROOT = pathlib.Path(__file__).resolve().parents[1]
SOURCE = ROOT / 'research/cad-tools/sources/seansackowitz-mcp-freecad'
TARGET = ROOT / 'desktop/freecad/native_upstream'
COMMIT = '685341437f26f2a62e0122cdb893d09ae30b5034'
if subprocess.check_output(['git', '-C', str(SOURCE), 'rev-parse', 'HEAD'], text=True).strip() != COMMIT:
    raise RuntimeError('Source checkout does not match the pinned revision')
SKIP = {'doc.open', 'doc.save', 'doc.close', 'doc.set_active', 'view.screenshot', 'script.execute_python'}
READ = {'doc.list', 'obj.list', 'obj.get', 'obj.get_tree', 'obj.get_properties', 'expr.get', 'sheet.get_cell', 'sketch.list_geometry', 'sketch.list_constraints', 'view.set_view', 'view.fit_all'}

def schema(node):
    if isinstance(node, ast.BinOp) and isinstance(node.op, ast.BitOr):
        return {'oneOf': [schema(node.left), schema(node.right)]}
    if isinstance(node, ast.Constant) and node.value is None:
        return {'type': 'null'}
    if isinstance(node, ast.Subscript):
        if ast.unparse(node.value) == 'list':
            return {'type': 'array', 'items': schema(node.slice)}
        return {'type': 'json'}
    return {'type': {'str': 'string', 'float': 'number', 'int': 'integer', 'bool': 'boolean'}.get(ast.unparse(node) if node else '', 'json')}

TARGET.mkdir(parents=True, exist_ok=True)
catalog, files = [], []
for file in sorted((SOURCE / 'addon/FreeCADMCP/handlers').glob('*.py')):
    if file.name in ('script.py', '__init__.py'):
        continue
    original = file.read_text(encoding='utf-8')
    text = original.replace('from handlers._common import ', 'from ._common import ').replace('from server import register', 'from .registry import register')
    if file.name == '_common.py':
        text = text.replace('    return doc\n\n\ndef get_obj', '    from .registry import check_document\n    check_document(doc)\n    return doc\n\n\ndef get_obj')
        text = text.replace('    if name is None:\n        return active_doc()', '    if name is None:\n        doc = active_doc()\n        from .registry import check_document\n        check_document(doc)\n        return doc')
        text = text.replace('    obj = doc.getObject(obj_name)\n    if obj is None:', '    obj = doc.getObject(obj_name)\n    if obj is None:\n        matches = [o for o in doc.Objects if o.Label == obj_name]\n        obj = matches[0] if len(matches) == 1 else None\n    if obj is None:')
    if file.name == 'sketch.py':
        text = text.replace('"xz": ([0, 0, 0], [-90, 0, 0])', '"xz": ([0, 0, 0], [1, 0, 0, 90])').replace('"yz": ([0, 0, 0], [0, 90, 0])', '"yz": ([0, 0, 0], [1, 1, 1, 120])')
    if file.name == 'partdesign.py':
        text = text.replace(',\n                                   "ReferenceAxis": (None, [""])', '')
        text = text.replace('    profile = get_obj(doc, profile_name)\n', '    profile = get_obj(doc, profile_name)\n    if any(p.TypeId == "PartDesign::Body" and p != body for p in profile.InList):\n        raise ValueError("Profile belongs to a different Body")\n    if profile not in body.Group:\n        body.addObject(profile)\n')
        text = text.replace('    f.Base = vec(base_point or [0, 0, 0])\n    f.Axis = vec(axis)', '    b = _body(doc, body)\n    ref, rev = _axis_reference(b, axis)\n    if base_point and any(abs(v) > 1e-9 for v in base_point):\n        datum = f.Document.addObject("PartDesign::Line", "RevolutionAxis")\n        b.addObject(datum)\n        datum.Placement = FreeCAD.Placement(vec(base_point), FreeCAD.Rotation(FreeCAD.Vector(0,0,1), vec(axis)))\n        ref = (datum, [""])\n        rev = False\n    f.ReferenceAxis = ref\n    f.Reversed = reversed != rev')
    if file.name == 'part.py':
        text = text.replace('totalangle=angle,', 'angle=angle,')
    if file.name == 'view.py':
        text = text.replace('    view = FreeCADGui.ActiveDocument.ActiveView if FreeCADGui.ActiveDocument else None', '    from view_context import get_displayed_3d_view\n    view = get_displayed_3d_view()')
    if file.name == 'io.py':
        text = text.replace('def io_import_iges(path: str, doc: str | None = None) -> dict[str, Any]:\n    import Import\n    d = get_doc(doc)\n    Import.insert(path, d.Name)', 'def io_import_iges(path: str, doc: str | None = None) -> dict[str, Any]:\n    import Part\n    d = get_doc(doc)\n    Part.insert(path, d.Name)')
        text = text.replace('        return list(d.Objects)', '        return [o for o in d.Objects if hasattr(o, "Shape") and not o.Shape.isNull() and not o.TypeId.startswith("Sketcher::") and o.ViewObject.Visibility]')
    if file.name == '_common.py':
        text = text.replace('    if hasattr(obj, "Placement"):', '    if obj.ViewObject:\n        out["visible"] = obj.ViewObject.Visibility\n    if hasattr(obj, "Placement"):')
        text = text.replace('out["shape_valid"] = not obj.Shape.isNull()', 'out["shape_valid"] = not obj.Shape.isNull() and obj.Shape.isValid()')
    if file.name == 'obj.py':
        text = text.replace('    return {"name": o.Name, "properties": props}', '    view = o.ViewObject\n    style = {p: _prop_value(view, p) for p in ("Visibility", "ShapeColor", "Transparency", "DisplayMode") if view and hasattr(view, p)}\n    return {"name": o.Name, "properties": props, "view": style}')
        text = text.replace('    if prop not in o.PropertiesList:', '    target = o\n    if prop.startswith("ViewObject."):\n        prop = prop[len("ViewObject."):]\n        if prop not in ("Visibility", "ShapeColor", "LineColor", "Transparency", "DisplayMode"):\n            raise ValueError("Unsupported view property")\n        target = o.ViewObject\n        if prop == "Visibility" and not isinstance(value, bool):\n            raise ValueError("Visibility requires boolean")\n        if prop in ("ShapeColor", "LineColor"):\n            if not isinstance(value, list) or len(value) != 3 or any(not isinstance(v, (int,float)) or not 0 <= v <= 1 for v in value):\n                raise ValueError("Color requires three values between zero and one")\n            value = tuple(value)\n        if prop == "Transparency" and (not isinstance(value, int) or not 0 <= value <= 100):\n            raise ValueError("Transparency requires integer 0..100")\n    if prop not in target.PropertiesList:')
        text = text.replace('    setattr(o, prop, value)', '    setattr(target, prop, value)')
        text = text.replace('    if prop not in target.PropertiesList:', '    if prop not in target.PropertiesList and not (target is o.ViewObject and hasattr(target, prop)):')
    (TARGET / file.name).write_text('# Vendored from seansackowitz/mcp-freecad, MIT; see LICENSE and SOURCE.json.\n' + text, encoding='utf-8')
    files.append({'file': file.name, 'upstreamSha256': hashlib.sha256(original.encode()).hexdigest()})
    for fn in ast.parse(original).body:
        if not isinstance(fn, ast.FunctionDef):
            continue
        register = next((d for d in fn.decorator_list if isinstance(d, ast.Call) and isinstance(d.func, ast.Name) and d.func.id == 'register'), None)
        if register is None or register.args[0].value in SKIP:
            continue
        method = register.args[0].value
        parameters = {}
        first_default = len(fn.args.args) - len(fn.args.defaults)
        for index, arg in enumerate(fn.args.args):
            item = schema(arg.annotation)
            if index < first_default:
                item['required'] = True
            else:
                item['default'] = ast.literal_eval(fn.args.defaults[index-first_default])
            parameters[arg.arg] = item
        if 'label' in parameters and method not in ('obj.set_label','doc.create'):
            parameters['label'] = {'type': 'string', 'required': True, 'description': 'Unique ASCII object ID; use obj_set_label for human display labels.'}
        if method == 'doc.create':
            parameters['name'] = {'type': 'string', 'required': True, 'description': 'Unique ASCII document ID.'}
        # Tool docs carry user-facing descriptions absent in low-level handlers.
        toolfile = SOURCE / 'src/mcp_freecad/tools' / file.name
        description = ast.get_docstring(fn) or method
        if toolfile.exists():
            public = next((n for n in ast.parse(toolfile.read_text(encoding='utf-8')).body if isinstance(n, ast.FunctionDef) and n.name == fn.name), None)
            if public:
                description = ast.get_docstring(public) or description
        catalog.append({'name': fn.name, 'method': method, 'readOnly': method in READ, 'description': description, 'parameters': parameters})
shutil.copyfile(SOURCE / 'LICENSE', TARGET / 'LICENSE')
(TARGET / '__init__.py').write_text('from . import document, obj, part, sketch, partdesign, expr, sheet, io, view\n', encoding='utf-8')
(TARGET / 'SOURCE.json').write_text(json.dumps({'repository': 'https://github.com/seansackowitz/mcp-freecad', 'commit': COMMIT, 'license': 'MIT', 'files': files, 'patches': ['package-relative imports; no RPC server or script executor', 'scope get_doc to the reviewed document during writes; unambiguous label fallback', 'correct XZ/YZ sketch plane rotations for FreeCAD axis-angle convention', 'PartDesign profiles join target Body; revolutions use datum/origin ReferenceAxis', 'Draft polar array uses angle for FreeCAD 1.1.4', 'view operations target the displayed 3D tab', 'IGES import uses Part.insert as registered by FreeCAD Mod/Part/Init.py; default export includes visible geometry only', 'object summaries include real shape validity and visibility; get_properties includes bounded view metadata; set_property permits a limited ViewObject style allowlist', 'catalog requires stable names for planned objects; geometry/transaction validation in native_api.py; mirror retains source visibility'], 'excluded': sorted(SKIP)}, indent=2), encoding='utf-8')
(ROOT / 'desktop/native-catalog.json').write_text(json.dumps(catalog, ensure_ascii=False, indent=2), encoding='utf-8')
skill = ROOT / 'desktop/skills/freecad-native'
(skill / 'references').mkdir(parents=True, exist_ok=True)
shutil.copyfile(SOURCE / 'README.md', skill / 'references/upstream.md')
shutil.copyfile(SOURCE / 'LICENSE', skill / 'LICENSE')
for group in sorted({t['method'].split('.')[0] for t in catalog}):
    content = '# '+group+' interfaces\n\nDerived from pinned MIT mcp-freecad; names below use the local typed contract. Writes are queued for confirmation.\n'
    if group == 'obj':
        content += '\nLocal adapter: obj_get_properties also returns view visibility/color/transparency/display mode. obj_set_property additionally accepts ViewObject.Visibility (boolean), ViewObject.ShapeColor/LineColor (three 0..1 values), ViewObject.Transparency (integer 0..100), ViewObject.DisplayMode (native enum, e.g. Shaded or Flat Lines). These changes require confirmation too.\n'
    for tool in (t for t in catalog if t['method'].startswith(group+'.')):
        content += '\n## '+tool['name']+' (`'+tool['method']+'`)\n\n'+tool['description']+'\n\n```json\n'+json.dumps(tool['parameters'], ensure_ascii=False, indent=2)+'\n```\n'
    (skill / 'references' / (group+'.md')).write_text(content, encoding='utf-8')
print(f'Vendored {len(files)} handler files; {len(catalog)} native interfaces')
