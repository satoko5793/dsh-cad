"""Local registration adapter: deliberately does not start an RPC listener."""
METHODS = {}
TARGET_DOCUMENT = None

def register(name):
    def decorate(fn):
        METHODS[name] = fn
        return fn
    return decorate

def check_document(doc):
    if TARGET_DOCUMENT is not None and doc.Name != TARGET_DOCUMENT:
        raise ValueError('接口目标与已确认工程不同，未执行')
