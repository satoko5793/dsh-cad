// Real FreeCAD GUI check for the reused upstream active-view guard.
import {mkdir,writeFile,readFile} from 'node:fs/promises';
import {spawn} from 'node:child_process';
import {randomUUID} from 'node:crypto';
import path from 'node:path';
import assert from 'node:assert/strict';
import {ROOT,atomicJson} from '../bridge.mjs';
if(process.env.GOUXING_ALLOW_ISOLATED_CAD!=='1')throw Error('历史独立进程探针默认停用。日常测试复用同一CAD；确需隔离时显式设置GOUXING_ALLOW_ISOLATED_CAD=1。');
process.env.GOUXING_DISABLE_AUTO_CONNECT='1';
const directory=path.join(ROOT,'.data','view-context-check',randomUUID());await mkdir(directory,{recursive:true});
const output=path.join(directory,'results.json'),macro=path.join(directory,'probe.FCMacro');
const literal=value=>JSON.stringify(value.replaceAll('\\','/'));
await writeFile(macro,`import sys, json, pathlib\nimport FreeCAD as App\nimport FreeCADGui as Gui\nfrom PySide import QtCore\nsys.path.insert(0, ${literal(path.join(ROOT,'freecad'))})\nfrom view_context import get_displayed_3d_view\n\ndef probe():\n    checks = []\n    try:\n        doc = App.newDocument('ViewContextProbe')\n        box = doc.addObject('Part::Box', 'Box')\n        doc.recompute()\n        Gui.activeDocument().activeView().viewAxonometric()\n        Gui.activeDocument().activeView().fitAll()\n        Gui.updateGui()\n        assert get_displayed_3d_view() is not None, 'Visible 3D view missing'\n        checks.append('visible 3D model accepted')\n        sheet = doc.addObject('Spreadsheet::Sheet', 'ProbeSheet')\n        sheet.set('A1', 'read-only screenshot target test')\n        doc.recompute()\n        sheet.ViewObject.doubleClicked()\n        Gui.updateGui()\n        assert get_displayed_3d_view() is None, 'Hidden 3D view must not be captured while spreadsheet is displayed'\n        checks.append('spreadsheet foreground rejected; hidden 3D view not misreported')\n        doc.saveAs(${literal(path.join(directory,'view-probe.FCStd'))})\n        value = {'passed': True, 'checks': checks}\n    except Exception as error:\n        value = {'passed': False, 'checks': checks, 'error': str(error)}\n    pathlib.Path(${literal(output)}).write_text(json.dumps(value), encoding='utf-8')\n\nApp.__gouxing_view_probe = QtCore.QTimer()\nApp.__gouxing_view_probe.setSingleShot(True)\nApp.__gouxing_view_probe.timeout.connect(probe)\nApp.__gouxing_view_probe.start(1000)\n`);
const child=spawn(process.env.FREECAD_EXE,['--user-cfg',path.join(directory,'user.cfg'),'--system-cfg',path.join(directory,'system.cfg'),macro],{stdio:'ignore',detached:true,windowsHide:false});child.unref();let launchError;child.on('error',e=>launchError=e);
const deadline=Date.now()+60000;let result;
while(Date.now()<deadline){if(launchError)throw launchError;try{result=JSON.parse(await readFile(output,'utf8'));break;}catch(e){if(e.code!=='ENOENT')throw e;}await new Promise(r=>setTimeout(r,200));}
assert.ok(result,'FreeCAD view probe timed out');assert.equal(result.passed,true,result.error);console.log(JSON.stringify(result));
await atomicJson(path.join(ROOT,'validation','view-context-results.json'),{date:new Date().toISOString(),...result,source:'neka-nat/freecad-mcp',commit:'5014bd9d538b8d09e11201e219cfe291ebca7b4e',note:'Real isolated FreeCAD 1.1.4 GUI; no external MCP server installed or arbitrary-code tool exposed.'});
