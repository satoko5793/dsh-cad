"""GUI-thread FreeCAD bridge. No eval/exec commands or network listener."""
import hashlib
import json
import math
import os
import pathlib
import time
import uuid

import FreeCAD as App
import FreeCADGui as Gui
import Part
import Sketcher
from PySide import QtCore


def atomic_json(filename, value):
    temporary = str(filename) + '.tmp'
    pathlib.Path(temporary).write_text(json.dumps(value, ensure_ascii=False), encoding='utf-8')
    os.replace(temporary, str(filename))


class Bridge:
    def __init__(self, directory):
        self.directory = pathlib.Path(directory)
        self.instance = str(uuid.uuid4())
        self.tokens = {}
        self.last_error = None
        self.timer = QtCore.QTimer()
        self.timer.timeout.connect(self.tick)
        App.addDocumentObserver(self)
        self.timer.start(350)
        self.tick()

    def slotCreatedDocument(self, doc):
        self.tokens[doc.Name] = str(uuid.uuid4())

    def slotDeletedDocument(self, doc):
        self.tokens.pop(doc.Name, None)

    def snapshot(self):
        doc = App.ActiveDocument
        selection = [{'document': s.DocumentName, 'object': s.ObjectName,
                      'subelements': list(s.SubElementNames)} for s in Gui.Selection.getSelectionEx()]
        value = {'instance': self.instance, 'document': None, 'selection': selection, 'units': 'mm'}
        if doc:
            objects = []
            for obj in doc.Objects:
                item = {'name': obj.Name, 'label': obj.Label, 'type': obj.TypeId}
                if 'Shape' in obj.PropertiesList:
                    item['shape'] = hashlib.sha256(obj.Shape.exportBrepToString().encode()).hexdigest()
                if obj.TypeId == 'Sketcher::SketchObject':
                    item['constraints'] = [str(c) for c in obj.Constraints]
                for prop in ('Length', 'Placement'):
                    if prop in obj.PropertiesList:
                        item[prop] = str(getattr(obj, prop))
                objects.append(item)
            value['document'] = {'name': doc.Name, 'label': doc.Label, 'file': doc.FileName,
                                 'token': self.tokens.setdefault(doc.Name, str(uuid.uuid4())),
                                 'objects': objects, 'owned': self.owned(doc)}
            if self.owned(doc):
                holes = doc.getObject('MountingHoles')
                value['document']['diameters'] = [holes.getDatum(i).Value for i in (0, 3, 6, 9)]
                shape = doc.getObject('ThroughHoles').Shape
                bounds = shape.BoundBox
                value['document']['geometry'] = {'valid': shape.isValid(), 'solids': len(shape.Solids),
                    'volume': shape.Volume, 'dimensions': [bounds.XLength, bounds.YLength, bounds.ZLength]}
        value['fingerprint'] = hashlib.sha256(json.dumps(value, sort_keys=True).encode()).hexdigest()
        value['heartbeat'] = time.time()
        value['version'] = App.Version()[:3]
        return value

    def owned(self, doc):
        marker = doc.getObject('HarnessInfo')
        return bool(marker and 'Schema' in marker.PropertiesList and marker.Schema == 'gouxing-plate-v1')

    def validate(self, doc, diameter):
        shape = doc.getObject('ThroughHoles').Shape
        bounds = shape.BoundBox
        expected = 80 * 40 * 5 - 4 * math.pi * (diameter / 2) ** 2 * 5
        if not (shape.isValid() and len(shape.Solids) == 1 and abs(shape.Volume - expected) < .001
                and all(abs(a-b) < 1e-6 for a, b in zip((bounds.XLength, bounds.YLength, bounds.ZLength), (80, 40, 5)))):
            raise ValueError('几何检查未通过，已中止修改')

    def create_plate(self):
        doc = App.newDocument('HarnessPlate')
        doc.Label = '四孔安装板'
        doc.UndoMode = 1
        body = doc.addObject('PartDesign::Body', 'PlateBody')
        sketch = body.newObject('Sketcher::SketchObject', 'BaseSketch')
        corners = [(-40, -20), (40, -20), (40, 20), (-40, 20)]
        for i in range(4):
            a, b = corners[i], corners[(i+1) % 4]
            index = sketch.addGeometry(Part.LineSegment(App.Vector(*a, 0), App.Vector(*b, 0)), False)
            sketch.addConstraint(Sketcher.Constraint('Block', index))
        pad = body.newObject('PartDesign::Pad', 'BasePad')
        pad.Profile, pad.Length = sketch, 5
        doc.recompute()
        holes = body.newObject('Sketcher::SketchObject', 'MountingHoles')
        holes.Placement.Base = App.Vector(0, 0, 5)
        for x, y in [(-32, -12), (32, -12), (-32, 12), (32, 12)]:
            i = holes.addGeometry(Part.Circle(App.Vector(x, y, 0), App.Vector(0, 0, 1), 3), False)
            holes.addConstraint(Sketcher.Constraint('Diameter', i, 6.0))
            holes.addConstraint(Sketcher.Constraint('DistanceX', i, 3, float(x)))
            holes.addConstraint(Sketcher.Constraint('DistanceY', i, 3, float(y)))
        pocket = body.newObject('PartDesign::Pocket', 'ThroughHoles')
        pocket.Profile, pocket.Type = holes, 1
        marker = doc.addObject('App::FeaturePython', 'HarnessInfo')
        marker.addProperty('App::PropertyString', 'Schema')
        marker.Schema = 'gouxing-plate-v1'
        doc.recompute()
        self.validate(doc, 6)
        for obj in doc.Objects:
            obj.ViewObject.Visibility = obj.Name in ('PlateBody', 'ThroughHoles')
        Gui.activeDocument().activeView().viewAxonometric()
        Gui.activeDocument().activeView().fitAll()
        Gui.Selection.clearSelection()
        Gui.Selection.addSelection(doc.Name, 'ThroughHoles')
        return {'message': '已创建 80 × 40 × 5 mm 安装板，四个孔均为 6 mm。原生草图、拉伸与打孔特征已保留。'}

    def execute(self, command):
        # Re-read at the actual GUI-thread write boundary, not the cached heartbeat.
        before = self.snapshot()
        if command.get('expected') != before['fingerprint']:
            raise ValueError('工程、选择或设计已变化，请重新提出需求并确认')
        action = command.get('action')
        if action == 'create_plate':
            return self.create_plate()
        doc = App.ActiveDocument
        if not doc or not self.owned(doc):
            raise ValueError('首版仅能修改本应用创建的四孔板；其他工程只读取上下文')
        if action == 'set_diameter':
            selections = before['selection']
            if (len(selections) != 1 or selections[0]['document'] != doc.Name
                    or selections[0]['object'] not in ('ThroughHoles', 'MountingHoles')
                    or selections[0]['subelements']):
                raise ValueError('请在 FreeCAD 特征树选中整个四孔特征；首版不支持单面或单孔修改')
            diameter = command.get('diameter')
            if isinstance(diameter, bool) or not isinstance(diameter, (int, float)) or not math.isfinite(diameter) or not 0 < diameter < 16:
                raise ValueError('孔径须大于 0 且小于 16 mm，才能保留孔到板边的材料')
            doc.openTransaction('构形：修改四孔直径')
            try:
                holes = doc.getObject('MountingHoles')
                for index in (0, 3, 6, 9):
                    holes.setDatum(index, App.Units.Quantity(str(diameter) + ' mm'))
                doc.recompute()
                self.validate(doc, diameter)
                doc.commitTransaction()
            except Exception:
                doc.abortTransaction()
                doc.recompute()
                raise
            return {'message': '四个孔均改为 ' + str(diameter) + ' mm；已核对单实体、体积、板厚与外形尺寸。'}
        if action in ('undo', 'redo'):
            count = doc.UndoCount if action == 'undo' else doc.RedoCount
            if not count:
                raise ValueError('当前没有可以' + ('撤销' if action == 'undo' else '重做') + '的步骤')
            getattr(doc, action)()
            doc.recompute()
            return {'message': '已' + ('撤销' if action == 'undo' else '重做') + '最近一个 FreeCAD 事务。'}
        if action == 'save_as':
            target = pathlib.Path(command.get('path', ''))
            if not target.is_absolute() or target.suffix.lower() != '.fcstd' or target.exists():
                raise ValueError('请选择一个不存在的 .FCStd 文件，首版不会覆盖已有文件')
            doc.saveAs(str(target))
            return {'message': '原生工程已保存。', 'file': str(target)}
        raise ValueError('不支持的 CAD 操作')

    def tick(self):
        try:
            for filename in sorted((self.directory / 'inbox').glob('*.json')):
                command = json.loads(filename.read_text(encoding='utf-8'))
                result_file = self.directory / 'results' / filename.name
                # Consume before running. A crash can be uncertain, never auto-retry it.
                consumed = self.directory / 'consumed' / filename.name
                filename.rename(consumed)
                if result_file.exists():
                    continue
                try:
                    if time.time() > command.get('deadline', 0):
                        raise ValueError('请求已过期，未执行')
                    value = {'ok': True, **self.execute(command)}
                except Exception as error:
                    value = {'ok': False, 'error': str(error)}
                value['snapshot'] = self.snapshot()
                atomic_json(result_file, value)
            atomic_json(self.directory / 'snapshot.json', self.snapshot())
        except Exception as error:
            App.Console.PrintError('构形桥接：' + str(error) + '\n')


# Keep the timer and document observer alive in the embedded interpreter.
App.__gouxing_bridge = Bridge(os.environ['GOUXING_BRIDGE_DIR'])
