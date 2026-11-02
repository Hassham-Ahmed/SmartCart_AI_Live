"""
Tiny key-value layer.

* If UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN are set we use Upstash
  Redis over HTTPS. Upstash is the boring choice on Vercel: no TCP
  connection pooling issues in serverless, its free tier covers a student
  project (~4-5 commands per chat turn), no extra Python dependency (stdlib urllib).
* Otherwise we fall back to a per-process TTL dict. That still works on
  Vercel (warm instances reuse memory) and long-term state is in MySQL
  anyway, so Redis is an optimisation, not a requirement.
"""
import json
import os
import threading
import time
import urllib.request

_URL = os.getenv("UPSTASH_REDIS_REST_URL", "").rstrip("/")
_TOKEN = os.getenv("UPSTASH_REDIS_REST_TOKEN", "")


class _MemoryKV:
    def __init__(self, max_items=5000):
        self._d = {}
        self._lock = threading.Lock()
        self._max = max_items

    def get(self, key):
        with self._lock:
            item = self._d.get(key)
            if not item:
                return None
            value, exp = item
            if exp and exp < time.time():
                self._d.pop(key, None)
                return None
            return value

    def set(self, key, value, ttl=None):
        with self._lock:
            if len(self._d) >= self._max:
                # drop the oldest ~10% (dicts keep insertion order)
                for k in list(self._d)[: self._max // 10]:
                    self._d.pop(k, None)
            self._d[key] = (value, time.time() + ttl if ttl else None)

    def delete(self, key):
        with self._lock:
            self._d.pop(key, None)

    def incr(self, key, ttl):
        with self._lock:
            value, exp = self._d.get(key, (0, None))
            if exp and exp < time.time():
                value, exp = 0, None
            value += 1
            self._d[key] = (value, exp or time.time() + ttl)
            return value


class _UpstashKV:
    def _cmd(self, *args):
        req = urllib.request.Request(
            _URL,
            data=json.dumps([str(a) for a in args]).encode(),
            headers={"Authorization": f"Bearer {_TOKEN}", "Content-Type": "application/json"},
            method="POST",
        )
        with urllib.request.urlopen(req, timeout=3) as res:
            return json.loads(res.read()).get("result")

    def get(self, key):
        return self._cmd("GET", key)

    def set(self, key, value, ttl=None):
        if ttl:
            return self._cmd("SET", key, value, "EX", int(ttl))
        return self._cmd("SET", key, value)

    def delete(self, key):
        return self._cmd("DEL", key)

    def incr(self, key, ttl):
        n = int(self._cmd("INCR", key))
        if n == 1:
            self._cmd("EXPIRE", key, int(ttl))
        return n


class _SafeKV:
    """Never let a cache outage break a chat request."""

    def __init__(self):
        self.remote = _UpstashKV() if (_URL and _TOKEN) else None
        self.local = _MemoryKV()

    @property
    def backend(self):
        return "upstash-redis" if self.remote else "memory"

    def _try(self, op, *args):
        if self.remote:
            try:
                return getattr(self.remote, op)(*args)
            except Exception as e:  # noqa: BLE001
                print(f"KV {op} failed, using memory fallback: {e}")
        return getattr(self.local, op)(*args)

    def get(self, key):
        return self._try("get", key)

    def set(self, key, value, ttl=None):
        return self._try("set", key, value, ttl)

    def delete(self, key):
        return self._try("delete", key)

    def incr(self, key, ttl):
        return self._try("incr", key, ttl)

    def get_json(self, key):
        raw = self.get(key)
        if raw is None:
            return None
        try:
            return json.loads(raw) if isinstance(raw, str) else raw
        except (TypeError, ValueError):
            return None

    def set_json(self, key, value, ttl=None):
        return self.set(key, json.dumps(value, default=str), ttl)


kv = _SafeKV()


def rate_limited(identity, limit=None, window=60):
    """Fixed-window limiter. Returns True if the caller should be throttled."""
    limit = limit or int(os.getenv("AI_RATE_LIMIT_PER_MIN", "20"))
    bucket = int(time.time() // window)
    count = kv.incr(f"rl:{identity}:{bucket}", window + 5)
    return int(count or 0) > limit
