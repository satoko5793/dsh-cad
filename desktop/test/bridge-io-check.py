"""Windows file-lock and bridge-publication regressions, no FreeCAD or user data."""
import ast
import ctypes
import importlib.util
import json
import os
import pathlib
import tempfile
import threading
import time
import types
import unittest

ROOT = pathlib.Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('bridge_io', ROOT / 'freecad' / 'bridge_io.py')
io = importlib.util.module_from_spec(spec)
spec.loader.exec_module(io)


class PublicationTests(unittest.TestCase):
    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory(prefix='gouxing-io-')
        self.addCleanup(self.temporary.cleanup)
        self.directory = pathlib.Path(self.temporary.name)

    def locked(self, file):
        from ctypes import wintypes
        kernel = ctypes.WinDLL('kernel32', use_last_error=True)
        create = kernel.CreateFileW
        create.argtypes = [wintypes.LPCWSTR, wintypes.DWORD, wintypes.DWORD, ctypes.c_void_p,
                           wintypes.DWORD, wintypes.DWORD, wintypes.HANDLE]
        create.restype = wintypes.HANDLE
        close = kernel.CloseHandle
        close.argtypes, close.restype = [wintypes.HANDLE], wintypes.BOOL
        # Allow reading/writing but deliberately omit FILE_SHARE_DELETE.
        handle = create(str(file), 0x80000000, 3, None, 3, 0x80, None)
        if handle == ctypes.c_void_p(-1).value:
            raise ctypes.WinError(ctypes.get_last_error())
        return lambda: close(handle)

    @unittest.skipUnless(os.name == 'nt', 'Windows handle semantics')
    def test_real_short_windows_lock_recovers_without_losing_existing_json(self):
        target = self.directory / 'progress.json'
        io.atomic_json(target, {'old': True})
        release = self.locked(target)
        timer = threading.Timer(.06, release)
        timer.start()
        try:
            io.atomic_json(target, {'new': True})
        finally:
            timer.join()
        self.assertEqual(json.loads(target.read_text()), {'new': True})
        self.assertFalse(list(self.directory.glob('*.tmp')))

    @unittest.skipUnless(os.name == 'nt', 'Windows handle semantics')
    def test_persistent_lock_is_bounded_and_leaves_old_json_and_no_temporary(self):
        target = self.directory / 'progress.json'
        io.atomic_json(target, {'old': True})
        release = self.locked(target)
        start = time.monotonic()
        try:
            with self.assertRaises(OSError) as raised:
                io.atomic_json(target, {'new': True}, retry_delays=(.01, .02))
            self.assertIn(raised.exception.winerror, (5, 32, 33))
        finally:
            release()
        self.assertLess(time.monotonic() - start, 1)
        self.assertEqual(json.loads(target.read_text()), {'old': True})
        self.assertFalse(list(self.directory.glob('*.tmp')))

    def bridge(self, writer):
        node = next(n for n in ast.parse((ROOT / 'freecad' / 'bridge.py').read_text(encoding='utf-8')).body
                    if isinstance(n, ast.ClassDef) and n.name == 'Bridge')
        window = types.SimpleNamespace(windowTitle=lambda: 'FreeCAD · 构形工作区')
        namespace = {'atomic_json': writer, 'time': time, 'json': json,
                     'App': types.SimpleNamespace(Console=types.SimpleNamespace(PrintError=lambda _: None, PrintWarning=lambda _: None)),
                     'Gui': types.SimpleNamespace(getMainWindow=lambda: window)}
        exec(compile(ast.Module(body=[node], type_ignores=[]), 'bridge.py', 'exec'), namespace)
        bridge = object.__new__(namespace['Bridge'])
        bridge.directory, bridge.command_id = self.directory, None
        bridge.pending_publications, bridge.io_warnings, bridge.progress_retry_at = {}, [], 0
        bridge.snapshot = lambda: {'fingerprint': 'same', 'heartbeat': time.time(), 'document': None}
        for folder in ('inbox', 'consumed', 'results'):
            (self.directory / folder).mkdir()
        (self.directory / 'inbox' / 'request.json').write_text(json.dumps({'id': 'request', 'deadline': time.time()+12}))
        return bridge

    def test_progress_failures_do_not_abort_execute_or_hide_a_successful_result(self):
        def writer(file, value, **kwargs):
            if pathlib.Path(file).name == 'progress.json':
                raise PermissionError('simulated file lock')
            io.atomic_json(file, value, **kwargs)
        bridge = self.bridge(writer)
        executed = []
        def execute(_):
            executed.append(1)
            for i in range(64):
                bridge.progress(i+1, 64, 'typed operation')
            return {'message': 'transaction committed'}
        bridge.execute = execute
        bridge.tick()
        result = json.loads((self.directory / 'results' / 'request.json').read_text())
        self.assertTrue(result['ok'])
        self.assertEqual(result['message'], 'transaction committed')
        self.assertTrue(result['warnings'])
        self.assertEqual(executed, [1])

    def test_snapshot_and_result_retries_never_reexecute_consumed_cad_commands(self):
        failures = {'snapshot.json': 1, 'request.json': 1}
        def writer(file, value, **kwargs):
            name = pathlib.Path(file).name
            if failures.get(name, 0):
                failures[name] -= 1
                raise PermissionError('simulated critical publication lock')
            io.atomic_json(file, value, **kwargs)
        bridge = self.bridge(writer)
        executed = []
        bridge.execute = lambda _: (executed.append(1) or {'message': 'committed once'})
        bridge.tick()
        self.assertTrue(bridge.pending_publications)
        self.assertFalse((self.directory / 'results' / 'request.json').exists())
        bridge.tick()
        self.assertTrue(bridge.pending_publications)
        bridge.tick()
        self.assertFalse(bridge.pending_publications)
        self.assertEqual(executed, [1])
        self.assertTrue(json.loads((self.directory / 'results' / 'request.json').read_text())['ok'])


if __name__ == '__main__':
    unittest.main(verbosity=2)
