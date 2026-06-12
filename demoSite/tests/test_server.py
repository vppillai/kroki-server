"""Security and validation tests for the AI proxy endpoint and static serving."""

import json

GOOD_ORIGIN = 'https://localhost:8443'
MODEL = 'openai/gpt-5-mini'


def ai_body(**overrides):
    body = {
        'messages': [{'role': 'user', 'content': 'draw a cat'}],
        'model': MODEL,
    }
    body.update(overrides)
    return body


def session_cookie(client):
    """Load the index page and return the issued session cookie value."""
    client.get('/')
    cookie = client.get_cookie('doccode_session')
    assert cookie is not None, 'index page must set a doccode_session cookie'
    return cookie.value


def post_ai(client, body=None, origin=GOOD_ORIGIN, with_session=True, headers=None):
    if with_session:
        session_cookie(client)
    hdrs = {'Content-Type': 'application/json'}
    if origin is not None:
        hdrs['Origin'] = origin
    if headers:
        hdrs.update(headers)
    return client.post('/api/ai-assist', data=json.dumps(body or ai_body()), headers=hdrs)


# --- session cookie -----------------------------------------------------------


def test_index_sets_signed_session_cookie(client, server):
    resp = client.get('/')
    assert resp.status_code == 200
    cookie = client.get_cookie('doccode_session')
    assert cookie is not None
    assert server.validate_session_token(cookie.value)


def test_index_html_path_sets_session_cookie(client, server):
    """nginx proxies / to /index.html, so the catch-all route must issue the
    cookie too — otherwise production browsers never get a session."""
    resp = client.get('/index.html')
    assert resp.status_code == 200
    cookie = client.get_cookie('doccode_session')
    assert cookie is not None
    assert server.validate_session_token(cookie.value)


def test_session_cookie_attributes(client):
    resp = client.get('/')
    set_cookie = resp.headers.get('Set-Cookie', '')
    assert 'doccode_session=' in set_cookie
    assert 'HttpOnly' in set_cookie
    assert 'SameSite=Strict' in set_cookie


def test_tampered_session_token_is_rejected(server):
    token = server.issue_session_token()
    nonce, sig = token.rsplit('.', 1)
    assert not server.validate_session_token(f'{nonce}x.{sig}')
    assert not server.validate_session_token('')
    assert not server.validate_session_token('no-dot-here')


# --- origin enforcement -------------------------------------------------------


def test_ai_assist_requires_origin_header(client, upstream):
    resp = post_ai(client, origin=None)
    assert resp.status_code == 403
    assert upstream.calls == []


def test_ai_assist_rejects_disallowed_origin(client, upstream):
    resp = post_ai(client, origin='https://evil.example')
    assert resp.status_code == 403
    assert upstream.calls == []


# --- session enforcement ------------------------------------------------------


def test_ai_assist_without_session_cookie_is_unauthorized(client, upstream):
    resp = post_ai(client, with_session=False)
    assert resp.status_code == 401
    assert upstream.calls == []


def test_ai_assist_with_session_and_origin_succeeds(client, upstream):
    resp = post_ai(client)
    assert resp.status_code == 200
    assert len(upstream.calls) == 1


# --- optional access token ----------------------------------------------------


def test_access_token_required_when_configured(client, server, upstream, monkeypatch):
    monkeypatch.setattr(server, 'AI_ACCESS_TOKEN', 'sekrit')
    resp = post_ai(client)  # valid session, but no token
    assert resp.status_code == 401
    assert upstream.calls == []


def test_access_token_bearer_grants_access_without_session(client, server, upstream, monkeypatch):
    monkeypatch.setattr(server, 'AI_ACCESS_TOKEN', 'sekrit')
    resp = post_ai(client, with_session=False,
                   headers={'Authorization': 'Bearer sekrit'})
    assert resp.status_code == 200
    assert len(upstream.calls) == 1


def test_wrong_access_token_rejected(client, server, upstream, monkeypatch):
    monkeypatch.setattr(server, 'AI_ACCESS_TOKEN', 'sekrit')
    resp = post_ai(client, headers={'Authorization': 'Bearer wrong'})
    assert resp.status_code == 401
    assert upstream.calls == []


# --- parameter clamping -------------------------------------------------------


def test_max_tokens_clamped_to_server_limit(client, server, upstream):
    resp = post_ai(client, body=ai_body(max_tokens=999999))
    assert resp.status_code == 200
    payload = upstream.calls[0]['json']
    token_param = 'max_completion_tokens'  # openai/* models use this key
    assert payload[token_param] <= server.AI_MAX_TOKENS


def test_timeout_clamped_to_server_maximum(client, server, upstream):
    resp = post_ai(client, body=ai_body(config={'timeout': 999999}))
    assert resp.status_code == 200
    assert upstream.calls[0]['timeout'] <= server.AI_TIMEOUT_MAX


def test_non_numeric_timeout_rejected(client, upstream):
    resp = post_ai(client, body=ai_body(config={'timeout': 'forever'}))
    assert resp.status_code == 400
    assert upstream.calls == []


def test_temperature_clamped(client, upstream):
    resp = post_ai(client, body=ai_body(model='google/gemini-2.5-flash', temperature=99))
    assert resp.status_code == 200
    assert 0 <= upstream.calls[0]['json']['temperature'] <= 2


def test_build_ai_payload_clamps_max_tokens(server):
    payload = server.build_ai_payload(MODEL, [], {'max_tokens': 10 ** 9})
    assert payload['max_completion_tokens'] <= server.AI_MAX_TOKENS


# --- request size -------------------------------------------------------------


def test_flask_enforces_max_content_length(app, server):
    assert app.config['MAX_CONTENT_LENGTH'] == server.MAX_REQUEST_SIZE


# --- streaming cleanup --------------------------------------------------------


def test_streaming_upstream_connection_closed_after_stream(client, upstream):
    resp = post_ai(client, body=ai_body(stream=True))
    assert resp.status_code == 200
    resp.get_data()  # drain the SSE stream
    assert upstream.response.closed


# --- static file hygiene ------------------------------------------------------


def test_server_source_not_served(client):
    assert client.get('/server.py').status_code == 404


def test_requirements_not_served(client):
    assert client.get('/requirements.txt').status_code == 404


def test_regular_static_files_still_served(client):
    resp = client.get('/js/main.js')
    assert resp.status_code == 200


# --- AI mode: compute_ai_mode matrix -------------------------------------------


def test_compute_ai_mode_relay(server):
    assert server.compute_ai_mode(True, True) == 'relay'


def test_compute_ai_mode_byok_no_key(server):
    assert server.compute_ai_mode(True, False) == 'byok'


def test_compute_ai_mode_off(server):
    assert server.compute_ai_mode(False, True) == 'off'
    assert server.compute_ai_mode(False, False) == 'off'


# --- mode gate (byok/off → 503 before auth) ------------------------------------


def test_byok_mode_returns_503_before_auth(client, server, upstream, monkeypatch):
    """Mode gate must fire BEFORE authorize_ai_request (503 beats 401)."""
    monkeypatch.setattr(server, 'AI_MODE', 'byok')
    resp = post_ai(client, with_session=False)
    assert resp.status_code == 503
    data = resp.get_json()
    assert data['mode'] == 'byok'
    assert upstream.calls == []


def test_off_mode_returns_503(client, server, upstream, monkeypatch):
    monkeypatch.setattr(server, 'AI_MODE', 'off')
    resp = post_ai(client)
    assert resp.status_code == 503
    assert upstream.calls == []


def test_relay_mode_still_proxies(client, server, upstream, monkeypatch):
    monkeypatch.setattr(server, 'AI_MODE', 'relay')
    resp = post_ai(client)
    assert resp.status_code == 200
    assert len(upstream.calls) == 1


# --- /api/config advertises mode -----------------------------------------------


def test_config_advertises_relay_mode(client, server, monkeypatch):
    monkeypatch.setattr(server, 'AI_MODE', 'relay')
    ai = client.get('/api/config').get_json()['ai']
    assert ai['mode'] == 'relay'
    assert ai['enabled'] is True


def test_config_advertises_byok_mode(client, server, monkeypatch):
    monkeypatch.setattr(server, 'AI_MODE', 'byok')
    ai = client.get('/api/config').get_json()['ai']
    assert ai['mode'] == 'byok'
    assert ai['enabled'] is False
    assert ai['model'] is None


def test_config_advertises_off_mode(client, server, monkeypatch):
    monkeypatch.setattr(server, 'AI_MODE', 'off')
    ai = client.get('/api/config').get_json()['ai']
    assert ai['mode'] == 'off'
    assert ai['enabled'] is False


# --- /api/available-models hides proxy in non-relay modes ----------------------


def test_available_models_relay_returns_models(client, server, monkeypatch):
    monkeypatch.setattr(server, 'AI_MODE', 'relay')
    data = client.get('/api/available-models', headers={'Origin': GOOD_ORIGIN}).get_json()
    assert data['mode'] == 'relay'
    assert data['proxy_url'] is not None


def test_available_models_byok_hides_proxy(client, server, monkeypatch):
    monkeypatch.setattr(server, 'AI_MODE', 'byok')
    data = client.get('/api/available-models', headers={'Origin': GOOD_ORIGIN}).get_json()
    assert data['models'] == {}
    assert data['proxy_url'] is None
    assert data['proxy_name'] is None


def test_available_models_off_hides_proxy(client, server, monkeypatch):
    monkeypatch.setattr(server, 'AI_MODE', 'off')
    data = client.get('/api/available-models', headers={'Origin': GOOD_ORIGIN}).get_json()
    assert data['models'] == {}
    assert data['proxy_url'] is None


# --- /api/health and /api/version expose ai_mode -------------------------------


def test_health_exposes_ai_mode(client, server, monkeypatch):
    monkeypatch.setattr(server, 'AI_MODE', 'byok')
    data = client.get('/api/health').get_json()
    assert data['ai_mode'] == 'byok'
    assert data['ai_enabled'] is False


def test_version_exposes_ai_mode(client, server, monkeypatch):
    monkeypatch.setattr(server, 'AI_MODE', 'relay')
    data = client.get('/api/version', headers={'Origin': GOOD_ORIGIN}).get_json()
    assert data['server_info']['ai_mode'] == 'relay'
    assert data['server_info']['ai_enabled'] is True


# --- allowlist filter ----------------------------------------------------------


def test_apply_model_allowlist_empty_allows_all(server):
    original = server.AI_MODEL_ALLOWLIST
    try:
        server.AI_MODEL_ALLOWLIST = []
        grouped = {'openai': {'openai/gpt-4o': {}, 'openai/gpt-4o-mini': {}}}
        result = server.apply_model_allowlist(grouped)
        assert 'openai' in result
        assert len(result['openai']) == 2
    finally:
        server.AI_MODEL_ALLOWLIST = original


def test_apply_model_allowlist_glob_filters(server):
    original = server.AI_MODEL_ALLOWLIST
    try:
        server.AI_MODEL_ALLOWLIST = ['*:free']
        grouped = {
            'openai': {'openai/gpt-4o': {}, 'openai/gpt-4o:free': {}},
            'meta': {'meta-llama/llama-3.3-70b:free': {}},
        }
        result = server.apply_model_allowlist(grouped)
        # paid model must be filtered out
        assert 'openai/gpt-4o' not in result.get('openai', {})
        assert 'openai/gpt-4o:free' in result['openai']
        assert 'meta-llama/llama-3.3-70b:free' in result['meta']
    finally:
        server.AI_MODEL_ALLOWLIST = original


def test_allowlist_enforced_on_relay_request(client, server, upstream, monkeypatch):
    """A non-allowlisted model POST must 400 before reaching upstream."""
    monkeypatch.setattr(server, 'AI_MODE', 'relay')
    monkeypatch.setattr(server, 'AVAILABLE_MODELS', {'openai': {MODEL: {}}})
    # allowed model succeeds
    resp = post_ai(client, body=ai_body(model=MODEL))
    assert resp.status_code == 200
    assert len(upstream.calls) == 1
    # disallowed model is rejected before upstream
    resp2 = post_ai(client, body=ai_body(model='openai/gpt-4o'))
    assert resp2.status_code == 400
    assert len(upstream.calls) == 1  # no new upstream call


# --- /api/ai-prompts is ungated in byok mode -----------------------------------


def test_ai_prompts_returns_200_in_byok_mode(client, server, monkeypatch):
    monkeypatch.setattr(server, 'AI_MODE', 'byok')
    resp = client.get('/api/ai-prompts', headers={'Origin': GOOD_ORIGIN})
    assert resp.status_code == 200
    data = resp.get_json()
    assert 'system' in data


def test_ai_prompts_returns_200_in_relay_mode(client, server, monkeypatch):
    monkeypatch.setattr(server, 'AI_MODE', 'relay')
    resp = client.get('/api/ai-prompts', headers={'Origin': GOOD_ORIGIN})
    assert resp.status_code == 200


# --- upstream quota mapping (429/402 → free_quota_exhausted) ------------------


def test_upstream_429_maps_to_free_quota_exhausted(client, server, upstream, monkeypatch):
    monkeypatch.setattr(server, 'AI_MODE', 'relay')
    upstream.response = server.tests_conftest_FakeUpstreamResponse_429() if hasattr(server, 'tests_conftest_FakeUpstreamResponse_429') else None
    # Use the fixture's response object directly
    from conftest import FakeUpstreamResponse
    upstream.response = FakeUpstreamResponse(
        status_code=429,
        json_body={'error': {'message': 'Rate limit exceeded', 'code': 429, 'metadata': {'headers': {}}}},
    )
    resp = post_ai(client)
    assert resp.status_code == 429
    data = resp.get_json()
    assert data['code'] == 'free_quota_exhausted'


def test_upstream_402_maps_to_free_quota_exhausted(client, server, upstream, monkeypatch):
    monkeypatch.setattr(server, 'AI_MODE', 'relay')
    from conftest import FakeUpstreamResponse
    upstream.response = FakeUpstreamResponse(
        status_code=402,
        json_body={'error': {'message': 'Insufficient credits', 'code': 402}},
    )
    resp = post_ai(client)
    assert resp.status_code == 429
    data = resp.get_json()
    assert data['code'] == 'free_quota_exhausted'


# --- H6: server pops client-supplied api_key/endpoint before any logging -------


def test_server_ignores_client_api_key_and_uses_server_key(client, server, upstream, monkeypatch):
    """Client-supplied key must never reach the upstream call (server forces its own)."""
    monkeypatch.setattr(server, 'AI_MODE', 'relay')
    body = ai_body()
    body['config'] = {'api_key': 'sk-CLIENT', 'endpoint': 'https://evil.example/', 'timeout': 30}
    resp = post_ai(client, body=body)
    assert resp.status_code == 200
    call = upstream.calls[0]
    # Server must use its own key, not the client's
    auth_header = call['headers']['Authorization']
    assert 'sk-CLIENT' not in auth_header
    assert 'evil.example' not in call['url']


def test_server_does_not_log_canary_key(client, server, upstream, monkeypatch, caplog):
    """sk-CANARY must not appear in any log record (H6 + never-logged guarantee)."""
    import logging
    monkeypatch.setattr(server, 'AI_MODE', 'relay')
    body = ai_body()
    body['config'] = {'api_key': 'sk-CANARY', 'timeout': 30}
    with caplog.at_level(logging.DEBUG):
        post_ai(client, body=body)
    for record in caplog.records:
        assert 'sk-CANARY' not in record.getMessage()
