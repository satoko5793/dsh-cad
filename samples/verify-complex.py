import json
import math
from pathlib import Path
import cadquery as cq

root = Path(__file__).resolve().parent
results = json.loads((root / 'generation-results.json').read_text(encoding='utf-8'))
reports = []
for item in results:
    if item['status'] != 'built':
        reports.append({'name': item['name'], 'passed': False, 'error': item.get('error')})
        continue
    directory = root / 'projects' / item['key'] / 'revisions' / item['revisionId']
    solid = cq.importers.importStep(str(directory / 'model.step')).val()
    checks = []
    def check(name, actual, expected):
        checks.append({'name': name, 'passed': actual == expected, 'actual': actual, 'expected': expected})
    def probe(name, point, expected):
        check(name, solid.isInside(point), expected)
    box = solid.BoundingBox()
    size = [round(box.xlen, 3), round(box.ylen, 3), round(box.zlen, 3)]
    check('STEP重新导入后为有效实体', solid.isValid(), True)
    check('单一实体', len(solid.Solids()), 1)
    stl = (directory / 'model.stl').read_bytes()
    check('STL三角面与文件长度一致', len(stl) == 84 + 50 * int.from_bytes(stl[80:84], 'little'), True)
    key = item['key']
    if key == 'ribbed-bracket':
        check('外形100×70×78', size, [100, 70, 78])
        probe('底板材料', (0, 0, 4), True)
        probe('电机轴通孔', (0, 31, 45), False)
        probe('电机孔周围的竖板材料', (18, 31, 45), True)
        for x in [-23, 23]:
            for z in [22, 68]:
                probe(f'电机安装通孔{x},{z}', (x, 31, z), False)
        for x in [-36, 36]:
            for y in [-12, 12]:
                for delta in [-8, 0, 8]:
                    probe(f'Y向长槽{x},{y}偏移{delta}', (x, y + delta, 4), False)
        for x in [-43, 43]:
            probe(f'加强筋{x}', (x, 0, 15), True)
        probe('两筋之间保持开放', (0, 0, 20), False)
    elif key == 'vented-enclosure':
        check('外形120×80×36', size, [120, 80, 36])
        probe('底板材料', (0, 0, 2), True)
        probe('顶部开口和内腔', (0, 0, 20), False)
        probe('顶部无盖', (0, 0, 35), False)
        for x in [-49, 49]:
            for y in [-29, 29]:
                probe(f'安装柱材料{x},{y}', (x + 4, y, 18), True)
                probe(f'安装柱盲孔{x},{y}', (x, y, 15), False)
                probe(f'盲孔保留底部{x},{y}', (x, y, 5), True)
                probe(f'安装柱连接筋{x},{y}', (math.copysign(55.5, x), y, 8), True)
        probe('前面接口孔', (0, -39, 17), False)
        probe('接口旁保留壁', (20, -39, 17), True)
        for x in range(-28, 29, 8):
            probe(f'背面散热槽{x}', (x, 39, 21), False)
        probe('散热槽间壁', (-24, 39, 21), True)
    elif key == 'keyed-flange':
        check('外形100×100×53', size, [100, 100, 53])
        for z in [5, 30, 49]:
            probe(f'轴孔贯穿Z{z}', (0, 0, z), False)
            probe(f'键槽贯穿Z{z}', (12, 0, z), False)
            probe(f'键槽底外材料Z{z}', (15, 0, z), True)
        for i in range(6):
            angle = math.radians(i * 60)
            probe(f'法兰螺栓通孔{i + 1}', (38 * math.cos(angle), 38 * math.sin(angle), 5), False)
        probe('环槽挖空', (30.5, 0, 9.5), False)
        probe('环槽底部保留', (30.5, 0, 8.5), True)
        probe('下部轴套外径46', (22, 0, 30), True)
        probe('顶部台阶外径38', (20, 0, 49), False)
        probe('顶部台阶材料', (18, 0, 49), True)
    report = {'name': item['name'], 'projectId': item['projectId'], 'revisionId': item['revisionId'], 'passed': all(c['passed'] for c in checks), 'size': size, 'volume': round(solid.Volume(), 4), 'checks': checks}
    reports.append(report)
    print(json.dumps({'name': item['name'], 'passed': report['passed'], 'checks': len(checks), 'failures': [c for c in checks if not c['passed']]}, ensure_ascii=False))
(root / 'verification-results.json').write_text(json.dumps(reports, indent=2, ensure_ascii=False), encoding='utf-8')
if not all(report['passed'] for report in reports):
    raise SystemExit(1)
