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
