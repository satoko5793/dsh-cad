"""Trusted local bridge lifecycle; never exposed as an agent tool."""
import hashlib
import importlib
import pathlib
import FreeCAD as App
import FreeCADGui as Gui

ROOT = pathlib.Path(__file__).parent

def revision():
    files = sorted(ROOT.rglob('*.py')) + [ROOT.parent / 'native-catalog.json', ROOT.parent / 'freecad-addon' / 'InitGui.py']
    h = hashlib.sha256()
    for file in files:
        h.update(file.read_bytes())
    return h.hexdigest()

def reload_bridge():
    old = getattr(App, '__gouxing_bridge', None)
    if not old or getattr(old, 'processing', False):
        raise ValueError('CAD仍在处理请求，请完成后再升级')
    # Load the known local application code, preserving CAD documents and camera.
    import native_upstream
    from native_upstream import registry
    import native_api
    import features
    import view_context
    importlib.reload(registry)
    for module in ('_common','document','obj','part','sketch','partdesign','expr','sheet','io','view'):
        importlib.reload(importlib.import_module('native_upstream.'+module))
    for module in (features, view_context, native_api):
        importlib.reload(module)
    namespace = {'__file__': str(ROOT / 'bridge.py'), '__name__': 'gouxing_runtime'}
    exec(compile((ROOT / 'bridge.py').read_text(encoding='utf-8'), str(ROOT / 'bridge.py'), 'exec'), namespace)
