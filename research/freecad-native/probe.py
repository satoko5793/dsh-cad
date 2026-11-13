"""Isolated native FreeCAD smoke test; run with FreeCADCmd or as a GUI macro."""
import json
import math
import os
import pathlib
import traceback

import FreeCAD as App
import Part
import Sketcher

gui = bool(App.GuiUp)
output = pathlib.Path(os.environ.get('FC_NATIVE_OUTPUT', 'E:/dsh/freecad-native-validation-20261113')) / ('gui' if gui else 'headless')
output.mkdir(parents=True, exist_ok=True)
checks = []

def check(name, condition):
    checks.append({'name': name, 'passed': bool(condition)})
    if not condition:
        raise AssertionError(name)

def verify_shape(doc, diameter):
    shape = doc.getObject('ThroughHoles').Shape
    b = shape.BoundBox
    check('valid solid at diameter ' + str(diameter), shape.isValid() and len(shape.Solids) == 1)
    check('plate dimensions preserved', all(abs(a-b) < 1e-6 for a,b in zip((b.XLength,b.YLength,b.ZLength),(80,40,5))))
    check('four holes analytic volume', abs(shape.Volume - (80*40*5 - 4*math.pi*(diameter/2)**2*5)) < .001)

report = {'gui': gui, 'version': App.Version(), 'checks': checks, 'passed': False}
try:
    doc = App.newDocument('HarnessNativeProbe')
    doc.UndoMode = 1
    body = doc.addObject('PartDesign::Body', 'PlateBody')
    sketch = body.newObject('Sketcher::SketchObject', 'BaseSketch')
    corners = [(-40,-20),(40,-20),(40,20),(-40,20)]
    for i in range(4):
        a,b = corners[i],corners[(i+1)%4]
        index = sketch.addGeometry(Part.LineSegment(App.Vector(*a,0),App.Vector(*b,0)),False)
        sketch.addConstraint(Sketcher.Constraint('Block',index))
    pad = body.newObject('PartDesign::Pad','BasePad')
    pad.Profile = sketch
    pad.Length = 5
    doc.recompute()
    holes = body.newObject('Sketcher::SketchObject','MountingHoles')
    holes.Placement.Base = App.Vector(0,0,5)
    diameters = []
    for x,y in [(-32,-12),(32,-12),(-32,12),(32,12)]:
        index = holes.addGeometry(Part.Circle(App.Vector(x,y,0),App.Vector(0,0,1),3),False)
        diameters.append(holes.addConstraint(Sketcher.Constraint('Diameter',index,6.0)))
        holes.addConstraint(Sketcher.Constraint('DistanceX',index,3,float(x)))
        holes.addConstraint(Sketcher.Constraint('DistanceY',index,3,float(y)))
    pocket = body.newObject('PartDesign::Pocket','ThroughHoles')
    pocket.Profile = holes
    pocket.Type = 1
    doc.recompute()
    check('native sketch pad pocket tree', pad.TypeId=='PartDesign::Pad' and pocket.TypeId=='PartDesign::Pocket' and pocket.Profile[0].Name=='MountingHoles')
    check('hole sketch fully constrained', holes.FullyConstrained)
    verify_shape(doc,6)
    doc.saveAs(str(output/'plate-6mm.FCStd'))
    doc.openTransaction('Change four hole diameters to 8mm')
    for index in diameters:
        holes.setDatum(index,App.Units.Quantity('8 mm'))
    doc.recompute()
    doc.commitTransaction()
    verify_shape(doc,8)
    doc.undo()
    doc.recompute()
    verify_shape(doc,6)
    doc.redo()
    doc.recompute()
    verify_shape(doc,8)
    filename = str(output/'plate-8mm.FCStd')
    doc.saveAs(filename)
    App.closeDocument(doc.Name)
    doc = App.openDocument(filename)
    doc.UndoMode = 1
    holes = doc.getObject('MountingHoles')
    verify_shape(doc,8)
    check('native constraints survive reopen', all(abs(holes.getDatum(i).Value-8)<1e-6 for i in diameters))
    doc.openTransaction('Edit reopened sketch')
    for index in diameters:
        holes.setDatum(index,App.Units.Quantity('10 mm'))
    doc.recompute()
    doc.commitTransaction()
    verify_shape(doc,10)
    doc.undo()
    doc.recompute()
    verify_shape(doc,8)
    if gui:
        import FreeCADGui as Gui
        for obj in doc.Objects:
            if hasattr(obj,'ViewObject'):
                obj.ViewObject.Visibility = obj.Name in ('PlateBody','ThroughHoles')
        Gui.activeDocument().activeView().viewAxonometric()
        Gui.activeDocument().activeView().fitAll()
        Gui.Selection.clearSelection()
        Gui.Selection.addSelection(doc.Name,'ThroughHoles')
        selected = Gui.Selection.getSelectionEx()
        check('read active GUI document', Gui.activeDocument().Document.Name == doc.Name)
        check('read selected native feature', len(selected)==1 and selected[0].ObjectName=='ThroughHoles')
        report['selection'] = [{'document':s.DocumentName,'object':s.ObjectName,'subelements':list(s.SubElementNames)} for s in selected]
    report['objects'] = [{'name':o.Name,'type':o.TypeId} for o in doc.Objects]
    report['file'] = filename
    report['passed'] = True
except Exception:
    report['error'] = traceback.format_exc()
finally:
    (output/'results.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8')
    print(json.dumps({'passed':report['passed'],'gui':gui,'checks':len(checks),'output':str(output),'error':report.get('error')},ensure_ascii=True),flush=True)

if not report['passed'] and not gui:
    raise SystemExit(1)
