"""Explicit isolated GUI integration probe. Only creates/closes its own test documents."""
import json
import os
import pathlib
import sys
import traceback
import FreeCAD as App
import FreeCADGui as Gui

sys.path.insert(0, os.environ['GOUXING_FEATURES_DIR'])
import features

output = pathlib.Path(os.environ['GOUXING_REOPEN_DIR'])
cases = json.loads((output / 'cases.json').read_text(encoding='utf-8'))
checks, documents = [], []
report = {'passed': False, 'checks': checks, 'version': App.Version()[:3]}


def check(name, condition):
    checks.append({'name': name, 'passed': bool(condition)})
    if not condition:
        raise AssertionError(name)


try:
    for key, design in cases.items():
        features.create(design, lambda *args: None)
        doc = App.ActiveDocument
        documents.append(doc.Name)
        if key == 'axes':
            shape = doc.getObject('GX_block').Shape
            check('YZ sketch cuts the intended X-axis bore', not shape.isInside(App.Vector(30, 15, 10), 1e-6, True))
            check('XZ sketch cuts the intended Y-axis bore', not shape.isInside(App.Vector(10, 25, 10), 1e-6, True))
            check('cross-hole model retains unrelated material', shape.isInside(App.Vector(30, 25, 10), 1e-6, True))
        filename = str(output / (key + '.FCStd'))
        doc.saveAs(filename)
        App.closeDocument(doc.Name)
        doc = App.openDocument(filename)
        doc.UndoMode = 1
        documents.append(doc.Name)
        check(key + ': native metadata survives close/reopen', features.metadata(doc) == design)
        check(key + ': native edit signature survives reopen', features.signatures(doc, design) == doc.getObject('HarnessInfo').NativeSignature)
        changed = 'lidThickness' if key == 'enclosure' else 'carriageX' if key == 'gantry' else 'crossDiameter' if key == 'axes' else 'span'
        value = design['parameters'][changed]['value'] + 1
        features.update(doc, {changed: value}, lambda *args: None)
        check(key + ': reopened feature tree remains parameter editable', features.metadata(doc)['parameters'][changed]['value'] == value)
        doc.undo()
        doc.recompute()
        check(key + ': undo after reopen restores parameters and signature', features.metadata(doc) == design and features.signatures(doc, design) == doc.getObject('HarnessInfo').NativeSignature)
        component = design['components'][0]
        body = doc.getObject(features.name(component))
        last = doc.getObject(features.name(component, component['features'][-1]))
        extra = body.newObject('PartDesign::Feature', 'UserExtraFeature')
        extra.Shape = last.Shape.copy()
        body.Tip = extra
        doc.recompute()
        rejected = False
        try:
            features.update(doc, {changed: value}, lambda *args: None)
        except ValueError as error:
            rejected = '手动修改' in str(error)
        check(key + ': same-geometry user feature is not silently bypassed', rejected and body.Tip.Name == extra.Name)
        doc.removeObject(extra.Name)
        body.Tip = last
        doc.recompute()
        obj = doc.getObject(features.name(component, component['features'][0]))
        obj.Length = obj.Length.Value + .5
        doc.recompute()
        rejected = False
        try:
            features.update(doc, {changed: value}, lambda *args: None)
        except ValueError as error:
            rejected = '手动修改' in str(error)
        check(key + ': manual native edits are protected from recipe overwrite', rejected)
        App.closeDocument(doc.Name)
    report['passed'] = True
except Exception:
    report['error'] = traceback.format_exc()
finally:
    (output / 'results.json').write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding='utf-8')
    # All documents here belong to this isolated test instance; do not touch others.
    for name in documents:
        if name in App.listDocuments():
            App.closeDocument(name)
    if not App.listDocuments():
        Gui.getMainWindow().close()
