"""Review/transaction adapter around vendored, typed FreeCAD interfaces."""
import inspect
import json
import math
import pathlib
import re
import FreeCAD as App
import FreeCADGui as Gui
import native_upstream
from native_upstream import registry

CATALOG = {t['method']: t for t in json.loads((pathlib.Path(__file__).parents[1] / 'native-catalog.json').read_text(encoding='utf-8'))}
FILE_TYPES = {'io.import_step': ('.step', '.stp'), 'io.import_iges': ('.iges', '.igs'), 'io.export_step': ('.step', '.stp'), 'io.export_iges': ('.iges', '.igs'), 'io.export_stl': ('.stl',), 'io.export_obj': ('.obj',)}
FORBIDDEN_PROPERTIES = {'Proxy', 'Shape', 'FileName', 'Schema', 'DesignJson', 'NativeSignature', 'LastNativeResults', 'Support', 'AttachmentSupport'}

def validate_call(operation):
    method, args = operation.get('method'), operation.get('args')
    if method not in CATALOG or not isinstance(args, dict):
        raise ValueError('未接入的原生接口或无效参数')
    inspect.signature(registry.METHODS[method]).bind(**args)
    if 'count' in args and (type(args['count']) is not int or not 1 <= args['count'] <= 100):
        raise ValueError('阵列数量需为1至100')
    if len(json.dumps(args)) > 48000:
        raise ValueError('原生接口参数过大')
    if method == 'obj.delete' and args.get('name') == 'HarnessInfo':
        raise ValueError('不能删除工程管理标记')
    if method in ('obj.set_property', 'expr.set', 'expr.clear'):
        prop = args.get('prop', '')
        if prop.split('.')[0] in FORBIDDEN_PROPERTIES or prop.startswith('_'):
            raise ValueError('不能修改工程标记、脚本或文件属性')
    expression = args.get('expression') if method == 'expr.set' else args.get('value', '') if method == 'sheet.set_cell' else ''
    if expression and (method == 'expr.set' or str(expression).startswith('=')):
        if not isinstance(expression, str) or re.search(r'[\[\]{};"\'`]', expression):
            raise ValueError('仅允许原生数值/参数表达式')
        allowed = {'sin','cos','tan','asin','acos','atan','sqrt','abs','min','max','pow','round','floor','ceil'}
        if any(name not in allowed for name in re.findall(r'([A-Za-z_]\w*)\s*\(', expression)):
            raise ValueError('不支持这个表达式函数')
    if method in FILE_TYPES:
        target = pathlib.Path(args.get('path', ''))
        if not target.is_absolute() or target.suffix.lower() not in FILE_TYPES[method]:
            raise ValueError('请选择对应格式的绝对文件路径')
        if method.startswith('io.import_') and not target.is_file():
            raise ValueError('导入文件不存在')
        if method.startswith('io.export_') and (target.exists() or not target.parent.is_dir()):
            raise ValueError('导出目标已存在或目录不存在，不会覆盖')
    return method, dict(args)

def describe(doc):
    components = []
    for obj in doc.Objects:
        if not hasattr(obj, 'Shape') or obj.TypeId.startswith('Sketcher::'):
            continue
        parents = obj.InList
        if obj.TypeId != 'PartDesign::Body' and (any(p.TypeId == 'PartDesign::Body' for p in parents) or not obj.ViewObject.Visibility):
            continue
        shape = obj.Shape
        if shape.isNull():
            continue
        # Display triangulation must not shrink round-solid measurements.
        b = shape.optimalBoundingBox(False, False)
        components.append({'id': obj.Name, 'object': obj.Name, 'name': obj.Label, 'valid': shape.isValid(), 'solids': len(shape.Solids), 'volume': shape.Volume, 'dimensions': [b.XLength,b.YLength,b.ZLength], 'bounds': [b.XMin,b.YMin,b.ZMin,b.XMax,b.YMax,b.ZMax]})
    return components

def read(operation):
    method, args = validate_call(operation)
    if not CATALOG[method]['readOnly']:
        raise ValueError('修改接口必须先生成计划并确认')
    return registry.METHODS[method](**args)

def _normalize(result, doc, method):
    if not isinstance(result, dict) or 'name' not in result:
        return
    obj = doc.getObject(result['name'])
    if not obj or not hasattr(obj, 'Shape') or obj.TypeId.startswith('Sketcher::'):
        return
    bodies = [b for b in obj.InList if b.TypeId == 'PartDesign::Body']
    if bodies:
        body = bodies[0]
        body.Tip = obj
        for child in body.Group:
            if child.ViewObject:
                child.Visibility = child == obj
        body.Visibility = True
    elif not obj.Shape.isNull():
        obj.Visibility = True
        if method != 'part.mirror':
            for dep in obj.OutList:
                if hasattr(dep, 'Shape') and dep.ViewObject:
                    dep.Visibility = False

def execute(operations, progress, owned):
    if not isinstance(operations, list) or not 1 <= len(operations) <= 100:
        raise ValueError('原生计划数量无效')
    calls = [validate_call(o) for o in operations]
    if any(CATALOG[m]['readOnly'] for m, _ in calls):
        raise ValueError('修改计划中不应混入只读接口')
    creates = [i for i, (m, _) in enumerate(calls) if m == 'doc.create']
    exports = [m for m, _ in calls if m.startswith('io.export_')]
    if creates not in ([], [0]) or (exports and len(calls) != 1):
        raise ValueError('每个事务仅能操作一个工程，导出单独执行')
    previous = App.ActiveDocument
    if exports:
        if not previous:
            raise ValueError('没有活动工程')
        registry.TARGET_DOCUMENT = previous.Name
        try:
            result = registry.METHODS[calls[0][0]](**calls[0][1])
            target = pathlib.Path(calls[0][1]['path'])
            if not target.is_file() or target.stat().st_size == 0:
                raise ValueError('导出接口没有生成有效文件')
            return {'message': '已按确认计划导出文件。', 'apiResults': [result]}
        finally:
            registry.TARGET_DOCUMENT = None
    if not creates and (previous is None or not owned(previous)):
        raise ValueError('外来工程只读，请创建一个原生工程')
    if previous and not creates and getattr(previous.getObject('HarnessInfo'), 'Schema', '') == 'gouxing-design-v2':
        import features
        design = features.metadata(previous)
        if features.signatures(previous, design) != previous.getObject('HarnessInfo').NativeSignature:
            raise ValueError('检测到手工修改配方，不会覆盖')
    doc, created, results = previous, False, []
    try:
        if creates:
            name = calls[0][1].get('name')
            if not isinstance(name, str) or not re.fullmatch(r'[A-Za-z][A-Za-z0-9_]{0,35}', name) or name in App.listDocuments():
                raise ValueError('新建工程需使用唯一的英文/数字工程ID')
            result = registry.METHODS['doc.create'](**calls[0][1])
            doc, created = App.ActiveDocument, True
            doc.UndoMode = 1
            marker = doc.addObject('App::FeaturePython', 'HarnessInfo')
            marker.addProperty('App::PropertyString', 'Schema')
            marker.addProperty('App::PropertyString', 'LastNativeResults')
            marker.Schema = 'gouxing-native-v1'
            marker.LastNativeResults = '[]'
            results.append(result)
        registry.TARGET_DOCUMENT = doc.Name
        doc.openTransaction('构形：原生接口计划')
        for index, (method, args) in enumerate(calls):
            progress(index+1, len(calls), method)
            if method == 'doc.create':
                continue
            if args.get('label') and method != 'obj.set_label':
                label = args['label']
                if not re.fullmatch(r'[A-Za-z][A-Za-z0-9_]{0,35}', label) or doc.getObject(label) or any(o.Label == label for o in doc.Objects):
                    raise ValueError('新对象label需使用唯一英文/数字ID，显示名可通过obj_set_label修改')
            if method == 'obj.set_property':
                obj = doc.getObject(args['name'])
                kind = obj.getTypeIdOfProperty(args['prop']) if obj and not args['prop'].startswith('ViewObject.') else ''
                if kind == 'App::PropertyLink':
                    value = doc.getObject(args['value']) if isinstance(args['value'], str) else None
                    if not value:
                        raise ValueError('链接对象不存在')
                    args['value'] = value
                elif kind == 'App::PropertyLinkList':
                    args['value'] = [doc.getObject(n) for n in args['value']]
                    if any(v is None for v in args['value']):
                        raise ValueError('链接对象不存在')
            before_names = {o.Name for o in doc.Objects} if method.startswith('io.import_') else None
            result = registry.METHODS[method](**args)
            if before_names is not None:
                added = [o for o in doc.Objects if o.Name not in before_names]
                if not any(hasattr(o, 'Shape') and not o.Shape.isNull() for o in added):
                    raise ValueError('导入接口没有创建几何对象')
                result['objects'] = [o.Name for o in added]
            if method.startswith(('part.', 'pd.')):
                _normalize(result, doc, method)
            results.append({'method': method, 'result': result})
        doc.recompute()
        invalid = []
        for obj in doc.Objects:
            if obj.Name == 'HarnessInfo':
                continue
            if any(s in ('Invalid','Error') for s in obj.State):
                invalid.append(obj.Name)
            if hasattr(obj, 'Shape') and not obj.Shape.isNull() and not obj.Shape.isValid():
                invalid.append(obj.Name)
            if obj.TypeId.startswith(('PartDesign::Pad','PartDesign::Pocket','PartDesign::Fillet','PartDesign::Chamfer','Part::Loft','Part::Cut','Part::Fuse')) and hasattr(obj,'Shape') and obj.Shape.isNull():
                invalid.append(obj.Name)
        if invalid:
            raise ValueError('原生几何检查失败：'+', '.join(sorted(set(invalid))))
        marker = doc.getObject('HarnessInfo') or doc.addObject('App::FeaturePython', 'HarnessInfo')
        if 'Schema' not in marker.PropertiesList:
            marker.addProperty('App::PropertyString', 'Schema')
        if 'LastNativeResults' not in marker.PropertiesList:
            marker.addProperty('App::PropertyString', 'LastNativeResults')
        marker.Schema = 'gouxing-native-v1'
        marker.LastNativeResults = json.dumps(results[-20:], ensure_ascii=False)
        doc.commitTransaction()
        if created:
            Gui.activeDocument().activeView().viewAxonometric()
            Gui.activeDocument().activeView().fitAll()
        return {'message': '已执行'+str(len(calls))+'项原生接口操作；已重算并检查几何。工程保留原生特征，可继续局部修改。', 'apiResults': results}
    except Exception:
        if doc:
            doc.abortTransaction()
            doc.recompute()
        if created:
            App.closeDocument(doc.Name)
            if previous and previous.Name in App.listDocuments():
                App.setActiveDocument(previous.Name)
        raise
    finally:
        registry.TARGET_DOCUMENT = None
