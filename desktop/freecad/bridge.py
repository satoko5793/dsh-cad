"""GUI-thread FreeCAD bridge. No eval/exec commands or network listener."""
import hashlib
import json
import math
import os
import pathlib
import re
import time
import uuid

import FreeCAD as App
import FreeCADGui as Gui
import Part
import Sketcher
from PySide import QtCore, QtGui
import features
from view_context import get_displayed_3d_view


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
        self.command_id = None
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
        value = {'protocol': 2, 'capabilities': ['capture_view', 'displayed_view'], 'pid': os.getpid(), 'instance': self.instance, 'document': None, 'selection': selection, 'units': 'mm'}
        if doc:
            objects = []
            for obj in doc.Objects:
                item = {'name': obj.Name, 'label': obj.Label, 'type': obj.TypeId}
                if 'Shape' in obj.PropertiesList and (obj.TypeId == 'PartDesign::Body' or obj.TypeId == 'Part::Feature'):
                    item['shape'] = hashlib.sha256(obj.Shape.exportBrepToString().encode()).hexdigest()
                if obj.TypeId == 'Sketcher::SketchObject':
                    item['constraints'] = [str(c) for c in obj.Constraints]
                    item['geometry'] = [str(g) for g in obj.Geometry]
                for prop in ('Length', 'Placement'):
                    if prop in obj.PropertiesList:
                        item[prop] = str(getattr(obj, prop))
                objects.append(item)
            value['document'] = {'name': doc.Name, 'label': doc.Label, 'file': doc.FileName,
                                 'token': self.tokens.setdefault(doc.Name, str(uuid.uuid4())),
                                 'objects': objects, 'owned': self.owned(doc)}
            if self.schema(doc) == 'gouxing-design-v2':
                try:
                    design = features.metadata(doc)
                    value['document']['design'] = design
                    value['document']['components'] = [features.shape_summary(doc.getObject(features.name(c))) for c in design['components']]
                    value['document']['editable'] = features.signatures(doc, design) == doc.getObject('HarnessInfo').NativeSignature
                except Exception as error:
                    value['document']['editable'] = False
                    value['document']['error'] = str(error)
            elif self.owned(doc):
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

    def schema(self, doc):
        marker = doc.getObject('HarnessInfo')
        return marker.Schema if marker and 'Schema' in marker.PropertiesList else None

    def owned(self, doc):
        return self.schema(doc) in ('gouxing-plate-v1', 'gouxing-design-v2')

    def progress(self, current, total, label):
        atomic_json(self.directory / 'progress.json', {'id': self.command_id, 'active': True,
                    'current': current, 'total': total, 'label': label, 'heartbeat': time.time()})

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
        if action == 'capture_view':
            if not App.ActiveDocument or not Gui.activeDocument():
                raise ValueError('没有活动工程，无法截取模型视口')
            view_name = command.get('view', 'current')
            views = {'isometric': 'viewAxonometric', 'front': 'viewFront', 'top': 'viewTop', 'right': 'viewRight'}
            if view_name not in ('current', *views.keys()):
                raise ValueError('不支持的观察视角')
            view = get_displayed_3d_view()
            if view is None:
                raise ValueError('当前前台标签不是三维视图，请先切回模型；不会把后台视口当成当前画面')
            camera = view.getCamera()
            animation = view.isAnimationEnabled()
            observation_id = str(uuid.uuid4())
            destination = self.directory / 'observations'
            destination.mkdir(exist_ok=True)
            filename = destination / (observation_id + '.png')
            try:
                # Standard view commands animate by default; an immediate fit/save
                # can otherwise capture an intermediate empty frame.
                view.setAnimationEnabled(False)
                if view_name != 'current':
                    getattr(view, views[view_name])()
                    view.fitAll()
                view.redraw()
                Gui.updateGui()
                view.saveImage(str(filename), 1200, 900, 'Current')
                if not filename.is_file() or filename.stat().st_size < 100:
                    raise ValueError('CAD 视口没有返回有效图片')
                sample = QtGui.QImage(str(filename)).scaled(48, 36)
                colors = set(sample.pixel(x, y) for x in range(sample.width()) for y in range(sample.height()))
                if len(colors) < 2:
                    raise ValueError('CAD 返回了近似空白视口，请检查零件是否可见后重试；不能据此评价模型')
                observation = {'id': observation_id, 'view': view_name, 'time': time.time(),
                    'document': App.ActiveDocument.Label, 'fingerprint': before['fingerprint'],
                    'camera': view.getCamera(), 'sampledColors': len(colors), 'visible': [o.Name for o in App.ActiveDocument.Objects if o.ViewObject and o.ViewObject.Visibility]}
            finally:
                view.setCamera(camera)
                view.setAnimationEnabled(animation)
                view.redraw()
                Gui.updateGui()
            restored = view.getCamera()
            atomic_json(destination / (observation_id + '.json'), {'beforeCamera': camera, 'afterCamera': restored, 'observation': observation})
            numbers = lambda text: [float(n) for n in re.findall(r'[-+]?(?:\d*\.\d+|\d+)(?:[eE][-+]?\d+)?', text)]
            original_values, restored_values = numbers(camera), numbers(restored)
            observation['cameraRestored'] = len(original_values) == len(restored_values) and all(math.isclose(a, b, rel_tol=1e-5, abs_tol=1e-4) for a, b in zip(original_values, restored_values))
            if not observation['cameraRestored']:
                raise ValueError('无法核对 CAD 原视角恢复，请检查工作区')
            return {'message': '已读取 CAD 视口，原观察视角已保留。', 'observation': observation}
        if action == 'focus_cad':
            window = Gui.getMainWindow()
            if window.isMinimized():
                window.showNormal()
            window.raise_()
            window.activateWindow()
            return {'message': '已切换到连接的 CAD 工作区。'}
        if action == 'create_plate':
            return self.create_plate()
        if action == 'create_design':
            return features.create(command.get('design'), self.progress)
        if action == 'open_native':
            target = pathlib.Path(command.get('path', ''))
            if not target.is_absolute() or target.suffix.lower() != '.fcstd' or not target.is_file():
                raise ValueError('请选择存在的 FreeCAD 原生工程')
            doc = App.openDocument(str(target))
            App.setActiveDocument(doc.Name)
            Gui.activeDocument().activeView().viewAxonometric()
            Gui.activeDocument().activeView().fitAll()
            return {'message': '已打开原生工程「' + doc.Label + '」。原先打开的工程保留。'}
        doc = App.ActiveDocument
        if not doc or not self.owned(doc):
            raise ValueError('仅能修改本应用创建的工程；其他工程只读取上下文')
        if action == 'update_design':
            return features.update(doc, command.get('changes'), self.progress)
        if action == 'select_component':
            design = features.metadata(doc)
            component = next((c for c in (design or {}).get('components', []) if c['id'] == command.get('componentId')), None)
            if not component:
                raise ValueError('零件不存在，请重新读取工程')
            Gui.Selection.clearSelection()
            Gui.Selection.addSelection(doc.Name, features.name(component))
            return {'message': '已在 CAD 选中「' + component['name'] + '」。'}
        if action == 'set_diameter':
            if self.schema(doc) != 'gouxing-plate-v1':
                raise ValueError('该指令用于旧版四孔板；当前设计请修改对应参数')
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
                    self.command_id = command.get('id')
                    self.progress(0, 1, '核对工程并准备执行')
                    value = {'ok': True, **self.execute(command)}
                except Exception as error:
                    value = {'ok': False, 'error': str(error)}
                finally:
                    atomic_json(self.directory / 'progress.json', {'id': self.command_id, 'active': False, 'heartbeat': time.time()})
                value['snapshot'] = self.snapshot()
                # Publish context before acknowledging, so an immediate next command
                # cannot read the pre-transaction heartbeat/context from disk.
                atomic_json(self.directory / 'snapshot.json', value['snapshot'])
                atomic_json(result_file, value)
            snapshot = self.snapshot()
            title = 'FreeCAD · 构形工作区 [' + self.instance[:6] + '] · ' + ((snapshot.get('document') or {}).get('label', '无活动工程'))
            if Gui.getMainWindow().windowTitle() != title:
                Gui.getMainWindow().setWindowTitle(title)
            atomic_json(self.directory / 'snapshot.json', snapshot)
        except Exception as error:
            App.Console.PrintError('构形桥接：' + str(error) + '\n')


# Keep the timer and document observer alive in the embedded interpreter.
App.__gouxing_bridge = Bridge(os.environ['GOUXING_BRIDGE_DIR'])
