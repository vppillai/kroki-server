"""Pytest fixtures for server.py tests.

The server module reads configuration from the environment at import time and
tries to fetch a model list from the AI proxy, so the environment must be
staged before the first import. AI_PROXY_URL points at a closed local port so
the startup fetch fails instantly and the server falls back to ai-models.json.
"""

import os
import sys

DEMO_SITE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, DEMO_SITE_DIR)

os.environ.setdefault('STATIC_ROOT', DEMO_SITE_DIR)
os.environ.setdefault('AI_PROXY_URL', 'http://127.0.0.1:9')
os.environ.setdefault('AI_PROXY_API_KEY', 'test-proxy-key')
os.environ.setdefault('AI_MODEL', 'openai/gpt-5-mini')
os.environ.setdefault('SESSION_SECRET', 'test-session-secret')
os.environ.pop('AI_ACCESS_TOKEN', None)
# Ensure new AI-posture vars don't bleed in from the shell environment
os.environ.pop('AI_MODEL_ALLOWLIST', None)
os.environ.pop('AI_MODEL_FALLBACKS', None)
os.environ.pop('AI_DAILY_LIMIT_PER_IP', None)

import pytest

import server as server_module


@pytest.fixture
def app():
    server_module.app.config['TESTING'] = True
    server_module.app.config['RATELIMIT_ENABLED'] = False
    server_module.limiter.enabled = False
    return server_module.app


@pytest.fixture
def client(app):
    return app.test_client()


@pytest.fixture
def server():
    return server_module


class FakeUpstreamResponse:
    """Stand-in for requests.Response covering the json/stream paths used."""

    def __init__(self, status_code=200, json_body=None, lines=None):
        self.status_code = status_code
        self._json_body = json_body if json_body is not None else {
            'choices': [{'message': {'content': '{"diagramCode":"","explanation":"ok"}'}}]
        }
        self._lines = lines or [b'data: {"choices":[{"delta":{"content":"hi"}}]}', b'data: [DONE]']
        self.closed = False
        self.text = ''

    def json(self):
        return self._json_body

    def iter_lines(self):
        yield from self._lines

    def close(self):
        self.closed = True


@pytest.fixture
def upstream(server, monkeypatch):
    """Capture the upstream AI call; returns a recorder with .calls and .response."""

    class Recorder:
        def __init__(self):
            self.calls = []
            self.response = FakeUpstreamResponse()

    rec = Recorder()

    def fake_post(url, **kwargs):
        rec.calls.append({'url': url, **kwargs})
        return rec.response

    monkeypatch.setattr(server.requests, 'post', fake_post)
    return rec
