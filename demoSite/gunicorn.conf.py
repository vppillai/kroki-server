"""Gunicorn config for the DocCode app container.

Tunables (set in .env; compose forwards it via env_file):
  GUNICORN_WORKERS, GUNICORN_THREADS, GUNICORN_TIMEOUT,
  GUNICORN_GRACEFUL_TIMEOUT, GUNICORN_KEEPALIVE, GUNICORN_LOG_LEVEL
"""
import os


def _env(name, default):
    """Return env var value, falling back to default on missing or empty string.

    An uncommented-but-empty var in .env (e.g. GUNICORN_WORKERS=) is forwarded
    as an empty string by compose env_file; `or default` catches that case so
    the container never crash-loops with a ValueError from int('').
    """
    return os.environ.get(name) or default


bind = f"0.0.0.0:{_env('PORT', '8006')}"

worker_class = "gthread"
workers = int(_env("GUNICORN_WORKERS", "2"))
threads = int(_env("GUNICORN_THREADS", "8"))

# Liveness heartbeat, NOT a per-request limit: gthread workers keep notifying
# the master while threads stream SSE, so 300s AI streams survive this.
timeout = int(_env("GUNICORN_TIMEOUT", "30"))

# Drain window after SIGTERM; in-flight AI streams longer than this are cut on
# deploy. Must stay below stop_grace_period in docker-compose.yml (35s).
graceful_timeout = int(_env("GUNICORN_GRACEFUL_TIMEOUT", "30"))

# Behind nginx keepalive upstream connections are cheap; gunicorn default is 2s.
keepalive = int(_env("GUNICORN_KEEPALIVE", "5"))

# Import server.py once in the master, then fork: every worker shares the same
# per-boot SESSION_SECRET (server.py:86), so session cookies validate on any
# worker even when SESSION_SECRET is unset (the closed-network default).
# Without preload each worker would mint its own secret -> intermittent 401s.
# Reproduced empirically with gunicorn 26.0.0: without preload, 2 workers
# served 2 different secrets; with preload, both workers shared one secret.
preload_app = True

# Heartbeat tempfiles on tmpfs so a slow disk can never stall a worker.
worker_tmp_dir = "/dev/shm"

accesslog = "-"
errorlog = "-"
loglevel = _env("GUNICORN_LOG_LEVEL", "info")
# Apache-style + request duration: %(L)s = request time in decimal seconds.
access_log_format = '%(h)s %(l)s %(u)s %(t)s "%(r)s" %(s)s %(b)s "%(f)s" "%(a)s" %(L)ss'
