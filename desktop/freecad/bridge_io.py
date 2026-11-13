"""Local JSON publications: tolerate short Windows sharing conflicts, never replay CAD."""
import json
import os
import pathlib
import time
import uuid


def atomic_json(filename, value, retry_delays=(.01, .02, .04, .08, .16)):
    target = pathlib.Path(filename)
    temporary = target.with_name(target.name + '.' + uuid.uuid4().hex + '.tmp')
    try:
        # Distinct writer-owned files avoid collisions with another publication.
        with temporary.open('x', encoding='utf-8') as stream:
            json.dump(value, stream, ensure_ascii=False)
        for attempt in range(len(retry_delays) + 1):
            try:
                os.replace(temporary, target)
                return
            except OSError as error:
                if getattr(error, 'winerror', None) not in (5, 32, 33) or attempt == len(retry_delays):
                    raise
                # No processEvents: yielding the GUI here could re-enter CAD work.
                time.sleep(retry_delays[attempt])
    finally:
        try:
            temporary.unlink(missing_ok=True)
        except OSError:
            pass  # Never mask the actual publication error with cleanup failure.
