import os
import sys
import types

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, BASE)

# Allow running the pure-logic tests without a MySQL driver installed.
try:
    import mysql.connector  # noqa: F401
except ImportError:
    mysql = types.ModuleType("mysql")
    mysql.connector = types.ModuleType("mysql.connector")
    mysql.connector.connect = lambda **kw: (_ for _ in ()).throw(RuntimeError("no db in tests"))
    sys.modules["mysql"] = mysql
    sys.modules["mysql.connector"] = mysql.connector
