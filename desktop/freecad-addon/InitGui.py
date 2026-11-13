"""Gouxing local connector. Loaded by FreeCAD's standard user Mod startup."""
def _gouxing_connect_on_startup():
    import json
    import os
    import pathlib
    import sys
    import time
    import uuid
    import FreeCAD as App
    if os.environ.get('GOUXING_DISABLE_AUTO_CONNECT') == '1' or os.environ.get('GOUXING_BRIDGE_DIR'):
        return
    config_file = pathlib.Path(App.getUserAppDataDir()) / 'Mod' / 'GouxingConnect' / 'gouxing.json'
    try:
        config = json.loads(config_file.read_text(encoding='utf-8'))
        if config.get('owner') != 'gouxing-cad' or config.get('enabled') is not True:
            return
        workspace = pathlib.Path(config['workspace'])
        source = pathlib.Path(config['source'])
        if not (source / 'bridge.py').is_file():
            return
        workspace.mkdir(parents=True, exist_ok=True)
        record_file = workspace / 'connection.json'
        try:
            record = json.loads(record_file.read_text(encoding='utf-8'))
            snapshot = json.loads((pathlib.Path(record['directory']) / 'snapshot.json').read_text(encoding='utf-8'))
            if snapshot['pid'] != os.getpid() and time.time() - snapshot['heartbeat'] < 5:
                os.kill(snapshot['pid'], 0)
                return  # An existing managed CAD already owns this workspace.
        except (OSError, ValueError, KeyError):
            pass
        preferred = os.environ.get('GOUXING_CONNECTION_DIR')
        directory = pathlib.Path(preferred) if preferred else workspace / 'freecad' / str(uuid.uuid4())
        if (workspace / 'freecad').resolve() not in directory.resolve().parents:
            raise ValueError('Invalid connector directory')
        for folder in ('inbox', 'results', 'consumed'):
            (directory / folder).mkdir(parents=True, exist_ok=True)
        sys.path.insert(0, str(source))
        os.environ['GOUXING_BRIDGE_DIR'] = str(directory)
        namespace = {'__file__': str(source / 'bridge.py'), '__name__': 'gouxing_runtime'}
        exec(compile((source / 'bridge.py').read_text(encoding='utf-8'), str(source / 'bridge.py'), 'exec'), namespace)
        actual = App.__gouxing_bridge.directory
        temporary = record_file.with_suffix('.'+str(uuid.uuid4())+'.tmp')
        temporary.write_text(json.dumps({'directory': str(actual), 'pid': os.getpid()}), encoding='utf-8')
        temporary.replace(record_file)
    except Exception as error:
        App.Console.PrintError('构形连接组件未启动：'+str(error)+'\n')

from PySide import QtCore as _gouxing_qt
_gouxing_qt.QTimer.singleShot(1200, _gouxing_connect_on_startup)
