"""Native multi-body feature recipes. Input is data, expressions are arithmetic only."""
import ast
import copy
import hashlib
import json
import math
import operator

import FreeCAD as App
import FreeCADGui as Gui
import Part
import Sketcher


def evaluate(value, parameters):
    if isinstance(value, bool):
        raise ValueError('尺寸不能为布尔值')
    if isinstance(value, (int, float)):
        result = value
    elif isinstance(value, str) and len(value) <= 160:
        operations = {ast.Add: operator.add, ast.Sub: operator.sub,
                      ast.Mult: operator.mul, ast.Div: operator.truediv}

        def visit(node):
            if isinstance(node, ast.Constant) and type(node.value) in (int, float):
                number = node.value
            elif isinstance(node, ast.Name) and node.id in parameters:
                number = parameters[node.id]
            elif isinstance(node, ast.UnaryOp) and isinstance(node.op, (ast.UAdd, ast.USub)):
                number = visit(node.operand) * (-1 if isinstance(node.op, ast.USub) else 1)
            elif isinstance(node, ast.BinOp) and type(node.op) in operations:
                number = operations[type(node.op)](visit(node.left), visit(node.right))
            else:
                raise ValueError('尺寸只支持参数与四则算式')
            if not math.isfinite(number) or abs(number) > 100000:
                raise ValueError('尺寸计算结果无效')
            return number
        result = visit(ast.parse(value.strip(), mode='eval').body)
    else:
        raise ValueError('尺寸数据无效')
    if not math.isfinite(result) or abs(result) > 100000:
        raise ValueError('尺寸计算结果无效')
    return float(result)


def identity(value):
    import re
    return isinstance(value, str) and re.fullmatch(r'[A-Za-z][A-Za-z0-9_]{0,35}', value)


def validate(design):
    if not isinstance(design, dict) or len(json.dumps(design)) > 96000:
        raise ValueError('设计数据过大或无效')
    parameters = design.get('parameters', {})
    if not isinstance(parameters, dict) or not 1 <= len(parameters) <= 48:
        raise ValueError('参数数量无效')
    values = {}
    for key, parameter in parameters.items():
        if not identity(key) or not isinstance(parameter, dict) or not isinstance(parameter.get('label'), str):
            raise ValueError('参数名称无效')
        value = parameter.get('value')
        if type(value) not in (int, float) or not math.isfinite(value) or abs(value) > 10000:
            raise ValueError('参数值无效')
        if value < parameter.get('min', -math.inf) or value > parameter.get('max', math.inf):
            raise ValueError('参数超出设计限制')
        values[key] = value
    components = design.get('components', [])
    if not isinstance(components, list) or not 1 <= len(components) <= 12:
        raise ValueError('零件数量无效')
    names, count = set(), 0
    for component in components:
        if not identity(component.get('id')) or component['id'] in names:
            raise ValueError('零件ID无效或重复')
        names.add(component['id'])
        position = component.get('position', [0, 0, 0])
        if len(position) != 3:
            raise ValueError('零件位置无效')
        for v in position:
            evaluate(v, values)
        features = component.get('features', [])
        if not 1 <= len(features) <= 12:
            raise ValueError('特征数量无效')
        feature_ids = set()
        for index, feature in enumerate(features):
            count += 1
            if (not identity(feature.get('id')) or feature['id'] in feature_ids
                    or feature.get('kind') not in ('pad', 'pocket')
                    or (index == 0 and feature['kind'] != 'pad')):
                raise ValueError('原生特征无效')
            feature_ids.add(feature['id'])
            if feature.get('plane', 'xy') not in ('xy', 'xz', 'yz'):
                raise ValueError('草图平面无效')
            if not 0 < evaluate(feature.get('depth', 1), values) <= 10000:
                raise ValueError('特征深度必须大于0')
            evaluate(feature.get('offset', 0), values)
            profile_geometry(feature['profile'], values)  # validates before modifying any document
    if count > 72:
        raise ValueError('单次设计最多72个特征')
    return values


def profile_geometry(profile, values):
    result = []

    def polygon(points):
        for index, a in enumerate(points):
            b = points[(index+1) % len(points)]
            if math.dist(a, b) < 1e-7:
                raise ValueError('草图包含零长度线段')
            result.append(Part.LineSegment(App.Vector(*a, 0), App.Vector(*b, 0)))

    kind = profile.get('kind')
    if kind == 'rectangles':
        items = profile.get('items', [])
        if not 1 <= len(items) <= 8:
            raise ValueError('矩形轮廓数量无效')
        for item in items:
            x, y, w, h = [evaluate(item.get(key, 0), values) for key in ('x', 'y', 'width', 'height')]
            if not 0 < w <= 10000 or not 0 < h <= 10000:
                raise ValueError('矩形宽高必须大于0')
            polygon([(x, y), (x+w, y), (x+w, y+h), (x, y+h)])
    elif kind == 'circles':
        diameter = evaluate(profile.get('diameter'), values)
        centers = profile.get('centers', [])
        if not 0 < diameter <= 10000 or not 1 <= len(centers) <= 24:
            raise ValueError('圆轮廓参数无效')
        for center in centers:
            if len(center) != 2:
                raise ValueError('圆心坐标无效')
            x, y = [evaluate(n, values) for n in center]
            result.append(Part.Circle(App.Vector(x, y, 0), App.Vector(0, 0, 1), diameter/2))
    elif kind == 'polygon':
        points = profile.get('points', [])
        if not 3 <= len(points) <= 32 or any(len(p) != 2 for p in points):
            raise ValueError('多边形轮廓无效')
        polygon([tuple(evaluate(v, values) for v in p) for p in points])
    else:
        raise ValueError('不支持的草图类型')
    return result


def name(component, feature=None):
    return 'GX_' + component['id'] + ('__' + feature['id'] if feature else '')


def shape_summary(body):
    shape = body.Shape
    if shape.isNull() or not shape.isValid() or len(shape.Solids) != 1 or shape.Volume <= 0:
        raise ValueError(body.Label + '不是单个有效实体')
    box = shape.BoundBox
    # Translate the local body shape into document coordinates for display/measurement.
    return {'id': body.Name[3:], 'object': body.Name, 'name': body.Label,
            'volume': shape.Volume, 'solids': len(shape.Solids), 'valid': True,
            'dimensions': [box.XLength, box.YLength, box.ZLength],
            'bounds': [box.XMin, box.YMin, box.ZMin, box.XMax, box.YMax, box.ZMax],
            'digest': hashlib.sha256(shape.exportBrepToString().encode()).hexdigest()}


def signatures(doc, design):
    # Also protect managed sketches/properties from silently replacing manual native edits.
    # BRep byte order changes when FreeCAD saves/reopens; use stable geometric/native data.
    def numeric(value):
        n = round(float(value), 8)
        return 0.0 if n == 0 else n

    def vector(value):
        return [numeric(value.x), numeric(value.y), numeric(value.z)]

    def placement(value):
        q = value.Rotation.Q
        if q[3] < 0:
            q = [-n for n in q]
        return [vector(value.Base), [numeric(n) for n in q]]

    def geometry(value):
        if isinstance(value, Part.LineSegment):
            return ['line', vector(value.StartPoint), vector(value.EndPoint)]
        if isinstance(value, Part.Circle):
            return ['circle', vector(value.Center), vector(value.Axis), numeric(value.Radius)]
        return [type(value).__name__, str(value)]

    result = []
    for component in design['components']:
        body = doc.getObject(name(component))
        if body is None:
            raise ValueError('原生零件已删除，请先核对工程')
        summary = shape_summary(body)
        summary.pop('digest')
        summary['volume'] = round(summary['volume'], 6)
        summary['dimensions'] = [numeric(n) for n in summary['dimensions']]
        summary['bounds'] = [numeric(n) for n in summary['bounds']]
        summary['area'] = round(body.Shape.Area, 6)
        summary['faces'] = len(body.Shape.Faces)
        summary['edges'] = len(body.Shape.Edges)
        item = {'body': summary, 'tip': body.Tip.Name if body.Tip else None,
                'placement': placement(body.Placement), 'features': []}
        for feature in component['features']:
            obj = doc.getObject(name(component, feature))
            sketch = doc.getObject(name(component, feature) + '_Sketch')
            if obj is None or sketch is None:
                raise ValueError('原生特征已删除，请先核对工程')
            item['features'].append({'name': obj.Name, 'length': numeric(obj.Length.Value), 'type': str(obj.Type),
                                     'placement': placement(sketch.Placement),
                                     'geometry': [geometry(g) for g in sketch.Geometry],
                                     'constraints': [[c.Type, c.First, c.FirstPos, c.Second, c.SecondPos, numeric(c.Value)] for c in sketch.Constraints]})
        result.append(item)
    expected = {name(c) for c in design['components']}
    for c in design['components']:
        for f in c['features']:
            expected.update((name(c, f), name(c, f) + '_Sketch'))
    unexpected = sorted(o.Name for o in doc.Objects if o.Name not in expected
                        and ('Shape' in o.PropertiesList or o.TypeId in ('PartDesign::Body', 'App::Link')))
    return hashlib.sha256(json.dumps({'components': result, 'additionalObjects': unexpected}, sort_keys=True).encode()).hexdigest()


def build(doc, design, progress):
    values = validate(design)
    total = sum(len(c['features']) for c in design['components'])
    current = 0
    for ci, component in enumerate(design['components']):
        body = doc.getObject(name(component)) or doc.addObject('PartDesign::Body', name(component))
        body.Label = component['name']
        position = [evaluate(v, values) for v in component.get('position', [0, 0, 0])]
        body.Placement = App.Placement(App.Vector(*position), App.Rotation())
        last = None
        for feature in component['features']:
            current += 1
            progress(current, total, component['name'] + ' · ' + feature['id'])
            identifier = name(component, feature)
            sketch = doc.getObject(identifier + '_Sketch') or body.newObject('Sketcher::SketchObject', identifier + '_Sketch')
            # Keep the native sketch/feature objects stable when regenerating parameters.
            for index in reversed(range(sketch.ConstraintCount)):
                sketch.delConstraint(index)
            for index in reversed(range(sketch.GeometryCount)):
                sketch.delGeometry(index)
            plane, offset = feature.get('plane', 'xy'), evaluate(feature.get('offset', 0), values)
            rotation = App.Rotation()
            position = App.Vector(0, 0, offset)
            if plane == 'xz':
                rotation, position = App.Rotation(App.Vector(1, 0, 0), 90), App.Vector(0, offset, 0)
            elif plane == 'yz':
                rotation, position = App.Rotation(App.Vector(1, 1, 1), 120), App.Vector(offset, 0, 0)
            sketch.Placement = App.Placement(position, rotation)
            for geometry in profile_geometry(feature['profile'], values):
                index = sketch.addGeometry(geometry, False)
                sketch.addConstraint(Sketcher.Constraint('Block', index))
            obj = doc.getObject(identifier) or body.newObject('PartDesign::Pad' if feature['kind'] == 'pad' else 'PartDesign::Pocket', identifier)
            obj.Profile = sketch
            obj.Type = 1 if feature['kind'] == 'pocket' and feature.get('throughAll', False) else 0
            obj.Length = evaluate(feature.get('depth', 1), values)
            body.Tip = obj
            doc.recompute()
            if obj.Shape.isNull() or not obj.Shape.isValid() or len(obj.Shape.Solids) != 1 or obj.getStatusString() not in ('Valid', ''):
                raise ValueError(component['name'] + ' / ' + feature['id'] + ' 重建失败：' + obj.getStatusString())
            sketch.Visibility = False
            if last:
                last.Visibility = False
            last = obj
        body.Visibility = True
        last.Visibility = True
        colors = [(0.65, 0.73, 0.85), (0.82, 0.69, 0.48), (0.55, 0.74, 0.65)]
        last.ViewObject.ShapeColor = colors[ci % len(colors)]
        shape_summary(body)
    doc.recompute()


def metadata(doc):
    marker = doc.getObject('HarnessInfo')
    return json.loads(marker.DesignJson) if marker and marker.Schema == 'gouxing-design-v2' else None


def create(design, progress):
    validate(design)
    doc = App.newDocument('HarnessDesign')
    doc.Label, doc.UndoMode = design['title'], 1
    marker = doc.addObject('App::FeaturePython', 'HarnessInfo')
    for key in ('Schema', 'DesignJson', 'NativeSignature'):
        marker.addProperty('App::PropertyString', key)
    marker.Schema = 'gouxing-design-v2'
    doc.openTransaction('构形：创建多零件设计')
    try:
        build(doc, design, progress)
        marker.DesignJson = json.dumps(design, ensure_ascii=False)
        marker.NativeSignature = signatures(doc, design)
        doc.commitTransaction()
    except Exception:
        doc.abortTransaction()
        doc.recompute()
        raise
    Gui.Selection.clearSelection()
    Gui.activeDocument().activeView().viewAxonometric()
    Gui.activeDocument().activeView().fitAll()
    return {'message': '已创建「' + design['title'] + '」，共' + str(len(design['components'])) + '个原生零件；实体有效性检查通过。尚未验证加工、装配或强度。'}


def update(doc, changes, progress):
    design = metadata(doc)
    if not design:
        raise ValueError('当前工程不是可参数修改的多零件设计')
    marker = doc.getObject('HarnessInfo')
    if signatures(doc, design) != marker.NativeSignature:
        raise ValueError('检测到手动修改原生特征，请先核对；不会用旧参数覆盖你的修改')
    if not isinstance(changes, dict) or not changes:
        raise ValueError('未指定参数修改')
    updated = copy.deepcopy(design)
    descriptions = []
    for key, value in changes.items():
        if key not in updated['parameters'] or type(value) not in (int, float) or not math.isfinite(value):
            raise ValueError('未知参数或无效数值')
        parameter = updated['parameters'][key]
        if parameter['value'] != value:
            descriptions.append(parameter['label'] + ' ' + str(parameter['value']) + ' → ' + str(value))
            parameter['value'] = value
    if not descriptions:
        raise ValueError('尺寸没有变化，无需重新建模')
    validate(updated)
    selection = [(s.DocumentName, s.ObjectName, list(s.SubElementNames)) for s in Gui.Selection.getSelectionEx()]
    doc.openTransaction('构形：修改设计参数')
    try:
        build(doc, updated, progress)
        marker.DesignJson = json.dumps(updated, ensure_ascii=False)
        marker.NativeSignature = signatures(doc, updated)
        doc.commitTransaction()
    except Exception:
        doc.abortTransaction()
        doc.recompute()
        raise
    return {'message': '已修改：' + '；'.join(descriptions) + '。原生零件已重新检查，未指定的参数保持不变。'}
