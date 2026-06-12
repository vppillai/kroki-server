# DocCode / kroki-server — Deep Code Analysis

**Date:** 2026-06-12  ·  **Method:** 7 parallel review agents (security ×2, bugs ×2, architecture, testing, DevOps), every high-severity finding adversarially verified by an independent skeptic agent. 76 findings confirmed, 0 refuted.

**Totals:** 13 high · 38 medium · 25 low

## Backend & Infrastructure Security

### [HIGH] Unauthenticated AI relay: /api/ai-assist usable by any network client with the server's API key
`demoSite/server.py:359-370, 376-383, 437-443`

The only access control on /api/ai-assist is validate_origin(), which explicitly returns True when the Origin header is absent (line 367: 'if origin and origin not in ALLOWED_ORIGINS'). Any non-browser client (curl, scripts) simply omits Origin and gets full access to an OpenAI-compatible chat-completions relay authenticated with the server-side AI_PROXY_API_KEY (lines 429-439). The 'messages' array is forwarded verbatim, so this is a general-purpose LLM proxy, not limited to diagram prompts. The only brake is a 10/minute Flask-Limiter rule keyed on client IP with default in-memory storage — trivially bypassed by IP rotation and reset on restart. On any deployment reachable beyond localhost (port 8443 is published on 0.0.0.0), this allows unbounded third-party spend on the operator's OpenRouter/LiteLLM account and use of the key for arbitrary content.

**Recommendation:** Origin checking is not authentication. Add a real auth mechanism (session token issued to the served frontend, or at minimum a shared bearer token / signed nonce), or restrict the endpoint at nginx to authenticated users. Also consider a server-side allowlist of system prompts or per-key spend limits on the upstream proxy.

### [MEDIUM] Client-controlled 'timeout' and uncapped 'max_tokens' forwarded to the upstream AI call
`demoSite/server.py:150, 405, 451-457, 487-492`

timeout = config.get('timeout', ...) (line 405) is taken from the request body with no type or range validation and passed directly to requests.post (lines 456, 491). A client can send a huge value (e.g. 999999) and, combined with stream=True, pin Werkzeug dev-server threads on long-lived upstream connections; a non-numeric value raises inside requests and surfaces as a 500. Similarly, build_ai_payload uses data.get('max_tokens', AI_MAX_TOKENS) (line 150) with no upper bound — the AI_MAX_TOKENS=16000 'limit' is only a default, so clients can request arbitrarily large completions on the server's API key. data.get('temperature') is likewise unvalidated.

**Recommendation:** Clamp timeout to a sane numeric range (e.g. 1-120s, server-side max), enforce max_tokens <= AI_MAX_TOKENS regardless of client input, and validate temperature as a float in [0, 2]. Reject non-conforming values with 400.

### [MEDIUM] Flask/Werkzeug development server used as the production container entrypoint
`demoSite/server.py:614-620 (and demoSite/Dockerfile CMD)`

The container runs `python server.py`, which calls app.run(host='0.0.0.0', threaded=True). This is the Werkzeug development server, which the Werkzeug/Flask projects explicitly document as not designed for production: no worker management, weak slow-client/connection-exhaustion resilience (relevant given the long client-controlled AI streaming requests above), and a history of dev-server-specific CVEs. Debug is off, but the deployment still depends on a non-production HTTP server for an internet-facing app behind nginx.

**Recommendation:** Serve the app with a production WSGI server (gunicorn with gevent/threads, or uwsgi/waitress) in the Dockerfile CMD, with bounded workers and timeouts. Keep app.run only for local development.

### [MEDIUM] Pinned dependencies are outdated with published CVEs
`demoSite/requirements.txt:1-6`

requirements.txt pins Werkzeug==3.0.1 (CVE-2024-49766 / CVE-2024-49767 multipart resource exhaustion, fixed in 3.0.6; CVE-2024-34069 debugger issue), requests==2.31.0 (CVE-2024-35195 cert-verification bypass on Session reuse, fixed 2.32.0; CVE-2024-47081 .netrc credential leak, fixed 2.32.4 — note server.py uses requests for all upstream AI calls), and Flask-CORS==4.0.0 (CVE-2024-1681 log injection plus later path-matching advisories fixed in 4.0.2+/6.x). The exact versions are also disclosed to attackers because requirements-adjacent files like /server.py are fetchable (see static catch-all finding).

**Recommendation:** Bump to current patched releases (Werkzeug>=3.0.6, requests>=2.32.4, Flask-CORS>=4.0.2 or 6.x, Flask 3.0.x latest) and ensure dependabot.yml covers the demoSite pip ecosystem so pins do not rot again.

### [MEDIUM] Unauthenticated Kroki render endpoints with 300s proxy timeouts and 10MB bodies — rendering DoS surface
`setup-kroki-server.sh:174, 246-270 (mirrored in nginx.conf:15, 81-105)`

nginx proxies any GET/POST matching /<type>/<format>[/<encoded>] straight to the Kroki core with client_max_body_size 10M and proxy_read_timeout 300, with no limit_req/limit_conn zones anywhere in the config. Diagram renderers (PlantUML/Graphviz/Mermaid) are CPU- and memory-heavy, so anonymous clients can cheaply exhaust the core and companion containers (which also have no docker-compose resource limits). Additionally, docker-compose.yml does not set KROKI_SAFE_MODE for the core service — it relies on the image default ('secure'); since this stack runs a custom-built core image (ghcr.io/vppillai/kroki-core:goat), the safe default is assumed rather than enforced.

**Recommendation:** Add nginx limit_req/limit_conn zones for the render locations, reduce proxy timeouts for anonymous traffic, set explicit KROKI_SAFE_MODE=secure in docker-compose.yml, and add memory/cpu limits to the renderer services.

### [LOW] MAX_REQUEST_SIZE check skipped when Content-Length is absent; Flask MAX_CONTENT_LENGTH unset
`demoSite/server.py:389-390`

The 1MB limit is enforced only 'if request.content_length' — a chunked-encoded request (no Content-Length) bypasses the check, and request.get_json(force=True) then buffers the full body. The app never sets app.config['MAX_CONTENT_LENGTH']. In the composed deployment nginx caps bodies at 10M, but the demosite container itself accepts arbitrarily large bodies from anything on kroki_network, and the gap reappears if the service is ever exposed directly.

**Recommendation:** Set app.config['MAX_CONTENT_LENGTH'] = MAX_REQUEST_SIZE so Werkzeug enforces the limit regardless of Transfer-Encoding, instead of the manual content_length check.

### [LOW] Static catch-all serves server source and dependency manifest (/server.py, /requirements.txt, /ai-models.json)
`demoSite/server.py:598-605`

The '/<path:filename>' route uses send_from_directory(STATIC_ROOT=/app, ...) over the entire app directory, and the nginx fallback 'location /' forwards unmatched single-segment paths to demosite. The Docker image copies server.py, requirements.txt is installed from /app, and ai-models.json sits alongside, so https://host:8443/server.py and /requirements.txt return the backend source and exact dependency versions to anyone. send_from_directory blocks path traversal, so exposure is limited to files baked into the image (no .env is copied), but it hands attackers the implementation and CVE-relevant version pins.

**Recommendation:** Serve only the intended asset directories (css/, js/, examples/, index.html, favicon.ico) — e.g. move static assets under a dedicated /app/static root, or reject filenames not under an allowlist of prefixes/extensions.

### [LOW] Upstream AI proxy error bodies and proxy URL disclosed to clients
`demoSite/server.py:306, 460-468, 502-511`

On upstream non-200 responses, error handling falls back to error_msg = resp.text (lines 466, 508) and returns it verbatim, which can leak internal LiteLLM/OpenRouter diagnostics (internal hostnames, key identifiers, routing details). /api/available-models additionally returns 'proxy_url' (line 306) — the internal AI proxy endpoint — to any caller that omits the Origin header.

**Recommendation:** Return a generic error message to clients and log the upstream body server-side only; drop proxy_url from the /api/available-models response (the frontend only needs proxy_name/default_model).

### [LOW] TLS/header hardening gaps: no HSTS, no CSP, deprecated X-XSS-Protection, perpetual self-signed cert workflow
`setup-kroki-server.sh:88-104, 176-185 (mirrored in nginx.conf:17-27)`

The generated nginx config sends no Strict-Transport-Security and no Content-Security-Policy header (notable since the app renders AI-generated diagram output), and still emits the deprecated X-XSS-Protection header. The cert workflow generates a 365-day self-signed cert and all health checks use curl -k (lines 294, 322), institutionalizing certificate-warning click-through/MITM acceptance for non-localhost deployments. Cipher config is otherwise reasonable (TLS1.2/1.3, ECDHE-ECDSA AEAD suites matching the ECDSA key).

**Recommendation:** Add HSTS (when a real cert is used) and a baseline CSP; drop X-XSS-Protection. For non-localhost hostnames, document/automate obtaining a CA-issued cert (the --cert/--key flags already exist) instead of defaulting to self-signed.

### [LOW] Stale local nginx.conf drops security headers on static-asset locations (config drift vs. generator)
`nginx.conf:46-69`

The working-tree nginx.conf (untracked; mounted by docker-compose.yml line 69) contains 'add_header Cache-Control "public"' inside the /css|js|examples and root-static locations. Because nginx add_header directives in a location cancel inheritance of all http-level add_header directives, those locations are served WITHOUT X-Content-Type-Options/X-Frame-Options. The generator in setup-kroki-server.sh (lines 204-234) has since switched to 'expires -1' (which does not cancel inheritance), so this file is stale output of an older script version — but it is exactly what runs if anyone starts the stack with `docker-compose up` directly instead of via setup-kroki-server.sh.

**Recommendation:** Regenerate/delete the stale nginx.conf, and in the template prefer repeating the security headers (or using a shared include) in any location that adds its own add_header so future edits cannot silently drop them.

### [LOW] Secret-handling verification: nginx.key is NOT committed; historic .env commits contained only a placeholder key prefix
`nginx-certs/nginx.key`

Verified the suspicion that nginx.key was committed: it is not. `git ls-files` and `git log --all -- nginx-certs/` return nothing across the full history; nginx-certs/ is gitignored, the key is mode 600, and it is an ECDSA P-256 key generated locally by setup-kroki-server.sh (line 98) with chmod 600. However, the .env file itself WAS git-tracked for much of the project's history (removed in commit c19b29f 'feat: security hardening'); inspection of every historic .env blob shows AI_PROXY_API_KEY only ever held the placeholder prefix 'sk-or-v1-' (no real key), and a history-wide scan for sk-or-v1-/sk-ant-/sk-proj- patterns found no real credentials. Residual notes: setup-kroki-server.sh `source`s .env with set -a (lines 26-30), so shell metacharacters in .env values execute as code, and docker-compose env_file injects the entire .env (including the API key) into the demosite container — acceptable here but worth keeping minimal.

**Recommendation:** No remediation required for nginx.key. If there is any chance a real key ever existed in a non-pushed local .env commit, rotate it. Consider parsing .env instead of sourcing it in the setup script, and keep .env limited to variables the demosite container actually needs.

## Frontend Security

### [HIGH] Stored/self XSS: user-controlled ai.customModel injected into innerHTML via rawHtml=true
`demoSite/js/ai-assistant.js:523, 537`

In sendToAI(), selectedModel is derived from the user-controlled config value ai.customModel (ai-assistant.js:523 `aiConfig.model === 'custom' ? aiConfig.customModel : aiConfig.model`). When model validation fails, line 537 builds a message string `Model "${selectedModel}" is not available...` and calls addMessage(type, text, true) with rawHtml=true. In AIAssistantUI.addMessage (ai-assistant-ui.js:132-134) rawHtml=true performs `contentElement.innerHTML = text` with NO escaping. customModel originates from configManager.get('ai') (ai-assistant.js:842-858), i.e. localStorage key 'kroki-user-config', which is also writable via the config import feature (config.js:442 import()). The only sanitizer applied on set() is inputValidation.sanitizeString (modules/validation.js:82-87), which merely truncates length and does NOT HTML-escape. Setting customModel to e.g. `<img src=x onerror=alert(document.cookie)>` and selecting the 'custom' model causes script execution in the page origin when the not-available message renders. Because config can be exported/imported as JSON, a crafted config file shared with a victim turns this into a delivery vector beyond pure self-XSS.

**Recommendation:** Never pass dynamic/user-derived strings with rawHtml=true. Render the model name with textContent (or escapeHtml() from modules/dom.js) and build the 'settings' button as a real DOM node with addEventListener instead of an interpolated innerHTML string. More broadly, make addMessage's rawHtml path accept only a fixed allowlist of static templates, never interpolated values.

*Verifier note: independently confirmed; severity adjusted to **medium**.*

### [MEDIUM] postMessage handler accepts messages from any origin (no event.origin validation)
`demoSite/js/modules/drawioIntegration.js:64-90`

setupEventHandlers() registers a global `window.addEventListener('message', e => this.handleDrawioMessage(e.data))` with the inline comment "Very permissive for now" and performs no check on event.origin or event.source. handleDrawioMessage() (lines 82-90) acts on any string containing `<mxfile`/`<mxGraphModel`, or any object with `event:'save'|'export'` and an xml field, writing the payload straight into the code editor via updateCodeEditor() (codeTextarea.value = xml + dispatch input, lines 317-326). This listener is always active (registered in the constructor), not only while the drawio modal is open. Any frame with a handle to this window (a parent if the page is framed, a window.opener, or any embedded iframe) can inject/overwrite the user's diagram source, enabling content tampering and phishing-style spoofing of the editor state.

**Recommendation:** Validate event.origin against new URL(this.drawioServerUrl).origin and ignore messages whose source is not the drawio iframe's contentWindow. Only process messages while the modal is open. Drop the 'very permissive' fallback string-sniffing path.

### [MEDIUM] AI API key persisted in plaintext localStorage
`demoSite/js/config.js:99-110, 205`

The user's custom-provider API key (ai.apiKey, config.js:104) is stored as part of the whole config object written to localStorage under 'kroki-user-config' (save(), line 205) in plaintext. localStorage is readable by any JavaScript executing on the origin, so any XSS (e.g. the customModel sink above) immediately exfiltrates the API key; the key is also sent in an Authorization: Bearer header to a user-supplied endpoint (ai-assistant-api.js:41) and forwarded to the backend proxy as config.api_key (ai-assistant-api.js:100). export() correctly scrubs the key (config.js:427-430), showing awareness, but at-rest storage remains plaintext and durable.

**Recommendation:** Avoid persisting the API key at all where possible (keep it in memory for the session, or rely solely on the backend proxy). If persistence is required, store it in sessionStorage at minimum, clearly warn the user, and ensure all XSS sinks are closed so the key cannot be read by injected script.

### [MEDIUM] No Content-Security-Policy (defense-in-depth absent for multiple innerHTML sinks and inline handlers)
`nginx.conf:18-20`

nginx.conf sets X-Content-Type-Options, X-XSS-Protection and X-Frame-Options but no Content-Security-Policy header, and demoSite/index.html contains no CSP <meta http-equiv> tag. The frontend relies on numerous innerHTML assignments (ai-assistant-ui.js:22/50/134/174, code-history.js:70, config-ui.js:39, fullscreen.js:70/105, drawioIntegration.js:269, errors.js:100) and inline event-handler attributes injected via innerHTML (e.g. ai-assistant.js:525/530/537 `onclick="window.aiAssistant?.openSettings()"`). With no CSP, the customModel XSS executes unhindered and there is no script-src/connect-src/frame-src restriction limiting injected script, data exfiltration, or which drawio/iframe origins may be embedded.

**Recommendation:** Add a strict Content-Security-Policy (e.g. default-src 'self'; script-src 'self'; object-src 'none'; frame-ancestors 'self'; connect-src 'self' plus required AI/drawio origins; frame-src limited to the configured drawio origin). Remove inline onclick handlers (convert to addEventListener) so 'unsafe-inline' is not required for scripts.

### [LOW] rawHtml=true messages built with string interpolation and inline event handlers
`demoSite/js/ai-assistant.js:525, 530, 537`

Three addMessage(..., true) calls render HTML strings containing inline `onclick="window.aiAssistant?.openSettings()"` handlers through the unescaped innerHTML path (ai-assistant-ui.js:134). Lines 525 and 530 are currently static, but the pattern of interpolating into rawHtml strings is what makes line 537 (which interpolates selectedModel) exploitable. Even the static cases require CSP 'unsafe-inline' to function, undermining any future CSP and normalizing an unsafe rendering convention.

**Recommendation:** Replace these with DOM-constructed nodes: create the message text with textContent and append a <button> wired via addEventListener for the 'settings' action, eliminating both the innerHTML usage and the inline event handlers.

## Frontend Correctness Bugs

### [HIGH] Stale render race: superseded image render can overwrite the newest diagram and corrupt blob-URL bookkeeping
`demoSite/js/modules/diagramRenderer.js:144-263`

renderImageDiagram aborts the previous render's listeners via imageListenerAbort (line 145), but the abort only suppresses the load/error listeners added at lines 257-258. The stale render's tempImg.onload callback (line 200) is NOT guarded: when a slow older fetch completes after a newer render has started, tempImg.onload still executes line 261 `diagramImg.src = imageUrl`, overwriting the newer diagram with stale content. Worse, the newer render's still-active load handler then fires for the stale image and sets `displayedBlobUrl` to ITS OWN imageUrl (line 218) while the element actually displays the old render's blob — so the next render revokes the wrong URL, the stale blob URL leaks permanently, and the zoom reset / diagramRendered event are dispatched with the wrong code/format payload. Additionally, when a render is aborted before its load handler runs, its blob URL (created at line 195) is never revoked and the 'loading' class added at line 141 is never removed.

**Recommendation:** Capture `const mySignal = imageListenerAbort.signal` at render start and check `if (mySignal.aborted) { revokeBlobUrl(imageUrl); return; }` at the top of tempImg.onload (and tempImg.onerror) before touching diagramImg.src. Also revoke the render's blob URL whenever its signal is aborted, e.g. via `mySignal.addEventListener('abort', () => revokeBlobUrl(imageUrl))`.

*Verifier note: independently confirmed; severity adjusted to **medium**.*

### [HIGH] AI auto-validation always inspects the PREVIOUS render: 500ms wait is shorter than the 1000ms render debounce
`demoSite/js/ai-assistant.js:672-720`

validateAndApplyDiagramCode applies the AI's candidate code via updateDiagramCode (which dispatches an 'input' event, line 804) and then waits a fixed 500ms (line 677) before calling checkDiagramValidation. But the 'input' event only schedules a render through debounceUpdateDiagram with state.DEBOUNCE_DELAY, which defaults to 1000ms (DEFAULT_DEBOUNCE_DELAY, /home/vpillai/temp/kroki-server/demoSite/js/modules/constants.js:113) plus network/render time. So checkDiagramValidation always examines the DOM state (error banners, #diagram naturalWidth) left over from the PREVIOUS diagram, not the candidate code: a bad candidate after a good render passes validation, and a good candidate after a failed render is rejected, triggering pointless retry loops (line 611-625). With autoRefresh disabled, no render ever happens and validation is pure noise. Secondary hazard: while the candidate is temporarily in the editor it dispatches 'input' → markFileAsModified, so a running auto-save interval (modules/autoSave.js:35-39) can write unvalidated, later-reverted AI code to the user's file during the validation window.

**Recommendation:** Make validation event-driven instead of timer-driven: render the candidate explicitly (call updateDiagram() directly, or await a one-shot 'diagramRendered'/error-banner event with a timeout) and only then evaluate success. At minimum, wait `state.DEBOUNCE_DELAY + renderMargin` instead of a hard-coded 500ms, and suspend auto-save while a candidate is being validated.

*Verifier note: independently confirmed; severity adjusted to **medium**.*

### [MEDIUM] AI conversation history drops all successful assistant turns — model loses its own prior answers
`demoSite/js/ai-assistant.js:399-406, 467-474`

Successful/warning AI replies are stored with chatHistory types 'assistant-success' / 'assistant-warning' (displayMessage typeMap, lines 400-405), but getConversationHistory (line 468) and mapHistory (/home/vpillai/temp/kroki-server/demoSite/js/modules/aiMessages.js:26) only keep entries whose type is exactly 'user' or 'assistant'. Since nearly every diagram-producing reply goes through displayMessage with 'ai success'/'ai warning', the messages array sent on follow-up requests contains the user's prior prompts but almost never the assistant's responses. Multi-turn refinement ('now add a database to it') silently loses the assistant side of the conversation, defeating the purpose of buildMessages' history support.

**Recommendation:** Include assistant variants in the history filter (e.g. `m.type === 'assistant' || m.type.startsWith('assistant-')`) in both getConversationHistory and mapHistory, mapping them all to role 'assistant'.

### [MEDIUM] After a timeout abort, retries reuse the already-aborted AbortController so every retry fails instantly
`demoSite/js/ai-assistant.js:488, 650-656`

sendMessage creates one AbortController per user message (line 488). callCustomAPI/callProxyAPI arm a timeout that calls `controller.abort()` on that shared controller (/home/vpillai/temp/kroki-server/demoSite/js/ai-assistant-api.js:26, 82). When the timeout fires, the AbortError propagates to makeAIRequest's catch; isRequestInProgress is still true (only user cancel clears it), so the retry path at lines 650-656 recursively calls makeAIRequest — which passes the SAME, permanently-aborted this.currentAbortController back into fetch. Every retry therefore rejects immediately with AbortError, the backoff loop burns through maxRetryAttempts in milliseconds, and the user finally sees a misleading abort/timeout message ('Request timed out...') without any real retry having occurred.

**Recommendation:** Create a fresh AbortController for each attempt (e.g. in makeAIRequest before the API call, keeping a reference so cancelRequest can abort the current one), or distinguish timeout aborts from user cancels and re-create the controller before retrying.

### [MEDIUM] beforeunload cleanup runs even when the user cancels leaving: file monitoring permanently stopped and blob URLs revoked
`demoSite/js/modules/eventBindings.js:203-219`

The beforeunload handler unconditionally calls stopFileMonitoring(), revokeAllBlobUrls(), and aiAssistant.destroy() BEFORE deciding whether to show the 'unsaved changes' prompt (lines 204-212). If the user has unsaved changes and clicks 'Stay on page', the page keeps running but: auto-reload file monitoring is silently dead (isWatching=false, timer cleared) until the user toggles it; all tracked blob URLs are revoked, breaking the pending PDF placeholder download link and any not-yet-painted blob image; and the AI assistant's document-level drag/resize/escape listeners are removed, breaking chat-window dragging and Escape-to-minimize for the rest of the session.

**Recommendation:** Only perform destructive cleanup when the unload actually proceeds (e.g. move it to 'pagehide'/'unload'), keeping the beforeunload handler limited to setting e.returnValue when there are unsaved changes.

### [MEDIUM] updateUrl never persists the URL when the editor is empty, leaving a stale 'im' parameter in the address bar
`demoSite/js/modules/urlHandler.js:157-177`

updateUrl builds a URL object and sets diag/fmt (lines 164-165), but history.replaceState is only invoked inside the non-empty-code branch's dynamic-import callback (line 174). In the empty-code branch (lines 167-168) `url.searchParams.delete('im')` mutates only the local URL object and the function returns without ever calling replaceState — the diag/fmt updates are also dropped. Result: after the user clears the editor (or content becomes empty), the address bar still carries the previous encoded diagram, so copying the link or reloading restores deleted content, contradicting the just-rendered empty state.

**Recommendation:** Call `window.history.replaceState({}, '', url)` in the empty-code branch too (after deleting 'im'), so diag/fmt updates and the 'im' removal are actually written to the browser URL.

### [MEDIUM] Programmatic content updates set userHasEditedContent=true, causing spurious 'unsaved changes' prompts and broken example loading
`demoSite/js/modules/eventBindings.js:35-37`

The CM6 shim dispatches a real 'input' event on the hidden textarea for EVERY document change, including programmatic ones (editorBridge.js:293-298, value setter at 394-399). The input handler then sets userHasEditedContent(true) for any non-empty content (eventBindings.js:36-37). Consequences: (1) openFile (fileOperations.js:63-64) sets the textarea value, so merely opening a file marks userHasEditedContent=true; clicking New then triggers the 'You have unsaved changes' confirm (fileOperations.js:280-285) even though the user never typed. (2) On diagram-type change, `codeTextarea.value = example` (eventBindings.js:80-81) also flags the flag; the rescue check `isCurrentCodeAnExample` (line 76) fails whenever loadExampleForDiagramType fell back to the uncached placeholder string 'Enter your <type> diagram code here...' (diagramOperations.js:103-107 returns it without setExampleCache), after which switching diagram types permanently stops loading examples for the session.

**Recommendation:** Distinguish user edits from programmatic updates: have editorBridge only mark user edits for transactions with userEvent annotations (update.transactions.some(tr => tr.isUserEvent('input') || tr.isUserEvent('delete'))), or reset userHasEditedContent(false) after programmatic sets in openFile/handleFileInputChange/example loading. Also cache the fallback example string (or re-check emptiness) so type switching keeps working after a failed example fetch.

### [LOW] AI request failures are reported to the user twice
`demoSite/js/ai-assistant.js:657-664`

When retries are exhausted, makeAIRequest adds a system chat message with the error text (line 662) and then re-throws (line 663). The exception is caught by sendToAI's catch (lines 557-560), which adds a second system message `Error: <same message>`. Every final AI failure therefore produces two near-identical error bubbles in the chat.

**Recommendation:** Either drop the `throw error` at line 663 (the message has already been shown) or remove the duplicate addMessage in sendToAI's catch and let one layer own user-facing error reporting.

### [LOW] resetZoom retries forever at 50ms intervals when the diagram image never gets natural dimensions
`demoSite/js/modules/zoomPan.js:82-88`

resetZoom reschedules itself unconditionally every 50ms while `diagram.naturalWidth`/`naturalHeight` are falsy (lines 83-87). The #diagram img starts with no src (index.html:292) and stays dimensionless after a failed render (renderImageDiagram error paths never set a real image). Clicking the reset-zoom button (line 337), double-clicking the viewport (line 187), or config-ui's reset() (config-ui.js:332-335) in that state starts an unbounded setTimeout loop that runs for the lifetime of the page; each additional trigger stacks another infinite loop.

**Recommendation:** Bound the retry (e.g. a max retry count or total deadline), or cancel the pending retry timer when resetZoom is re-invoked and bail out immediately when the image is hidden or has no src.

### [LOW] history.replaceState invoked on every keystroke — throttled/throws in Safari and races via dynamic import
`demoSite/js/modules/eventBindings.js:43-49`

The code 'input' handler calls updateUrl() on every keystroke (debounceUpdateDiagram is debounced, updateUrl is not). updateUrl deflate-encodes the full document and calls history.replaceState inside an un-awaited dynamic-import .then (urlHandler.js:171-175) with no error handling. Safari enforces a hard limit of 100 replaceState calls per 30 seconds and throws SecurityError beyond it; the rejection is unhandled, and URL syncing silently stops while typing. The same per-keystroke updateUrl also runs the full pako deflate of the document on every input event, which is wasted work on large documents.

**Recommendation:** Debounce updateUrl (e.g. piggyback on the existing diagram debounce or a separate ~500ms timer) and add a .catch around the replaceState call.

## Backend & Script Bugs

### [HIGH] No restart policy on any service — stack stays down after crash or host reboot
`docker-compose.yml:1-75`

None of the seven services (core, mermaid, bpmn, excalidraw, diagramsnet, demosite, nginx) declares a `restart:` policy. If any container crashes (OOM in the Java core, nginx upstream-resolution failure, demosite Python exception at startup) or the host reboots, the service stays down until someone manually runs the setup script. This is a production deployment (deployed at /opt/kroki-server), so a reboot silently takes the whole site offline.

**Recommendation:** Add `restart: unless-stopped` (or `always`) to every service in docker-compose.yml.

*Verifier note: independently confirmed; severity adjusted to **medium**.*

### [MEDIUM] nginx depends_on omits demosite — startup race can kill nginx ('host not found in upstream')
`docker-compose.yml:61-64`

The generated nginx config (setup-kroki-server.sh:197,206,222,238,274) uses literal upstream hostnames `demosite` and `core` in proxy_pass, which nginx resolves when loading the config. `depends_on` lists only `core`, so compose may start nginx before the demosite container exists in Docker DNS; nginx then exits with 'host not found in upstream demosite' and, with no restart policy, never recovers. The demosite Dockerfile defines a HEALTHCHECK (demoSite/Dockerfile:38-39) but nothing consumes it.

**Recommendation:** Add `demosite` to nginx's depends_on (ideally `condition: service_healthy` to leverage the existing healthcheck for demosite and `service_started` for core), and add restart policies as a backstop.

### [MEDIUM] Streaming proxy leaks the upstream requests connection on client disconnect
`demoSite/server.py:470-483`

In the streaming branch of /api/ai-assist, `resp` (a `requests` response opened with stream=True) is never closed. The `generate()` generator catches `Exception`, but when the browser disconnects mid-stream Werkzeug calls generator.close(), raising `GeneratorExit` (a BaseException) at the yield point — it bypasses the except clause and `resp.close()` is never called, so the upstream socket to the AI proxy stays open (and the proxy keeps generating tokens) until garbage collection. Repeated cancelled streams accumulate leaked connections in a long-lived process.

**Recommendation:** Wrap the loop in try/finally and call `resp.close()` in the finally block (also covers the normal-completion path so the connection is returned to the pool deterministically).

### [MEDIUM] Client-controlled, unvalidated upstream timeout in /api/ai-assist
`demoSite/server.py:405`

`timeout = config.get('timeout', DEFAULT_AI_CONFIG['timeout'])` takes the timeout straight from the request body with no type or range validation, then passes it to `requests.post(..., timeout=timeout)` (lines 456, 491). A non-numeric value (e.g. "abc") raises ValueError inside requests, surfacing as a generic 500. A huge numeric value (e.g. 999999) lets a client pin a server thread on the single-process Flask dev server for arbitrarily long, defeating the 60s default and amplifying the rate-limited 10 req/min into long-lived held connections.

**Recommendation:** Coerce to float and clamp, e.g. `timeout = min(max(float(config.get('timeout', AI_TIMEOUT)), 1), 300)` inside a try/except that returns 400 on bad input.

### [MEDIUM] Flask development server (app.run) used as the production container entrypoint
`demoSite/server.py:615-620`

The container runs `python server.py` (demoSite/Dockerfile:48), which starts Werkzeug's built-in dev server (`app.run(host='0.0.0.0', threaded=True)`). Werkzeug explicitly warns it is not designed for production: no worker management, no request timeouts, thread-per-request with unbounded threads, weaker HTTP parsing, and a single process that dies entirely on an uncaught error in the serving loop. Combined with client-controlled timeouts (above) and SSE streaming, this is the weakest link for concurrency and stability.

**Recommendation:** Serve via a production WSGI server, e.g. `gunicorn --worker-class gthread -w 2 --threads 8 server:app` (or waitress) in the Dockerfile CMD; keep app.run only for local dev.

### [MEDIUM] --hostname CLI option is parsed but never used for certs, nginx config, or health checks
`setup-kroki-server.sh:384-386`

parse_args sets `HOSTNAME="$2"` for --hostname, but generate_certs uses `cert_cn="${DEFAULT_HOSTNAME}"` (line 92), create_nginx_config uses `server_name ${DEFAULT_HOSTNAME}` (line 190), and check_services curls `https://${DEFAULT_HOSTNAME}:${DEFAULT_HTTPS_PORT}` (line 294). DEFAULT_HOSTNAME is derived only from .env (lines 32-41) before parse_args runs, so the documented option (help text line 418) affects nothing but the final "Kroki is available at" message. Worse, in the no-.env branch HTTPS_PORT is never set, so that message (lines 453, 493) prints "https://<host>:" with an empty port, and bash's builtin $HOSTNAME leaks in as the displayed hostname.

**Recommendation:** After parse_args, override: `DEFAULT_HOSTNAME="${HOSTNAME:-$DEFAULT_HOSTNAME}"`, and use DEFAULT_HOSTNAME/DEFAULT_HTTPS_PORT consistently in the start/restart status messages (or set HTTPS_PORT in the else branch at line 36-40).

### [MEDIUM] DEMOSITE_CONTAINER_PORT defaulted only when .env is absent — empty port breaks generated nginx config
`setup-kroki-server.sh:39`

`DEMOSITE_CONTAINER_PORT="8006"` is set only in the else branch (no .env). When a .env exists but does not define DEMOSITE_CONTAINER_PORT (e.g. a .env created from an older .env.example, since the bootstrap at lines 20-23 only copies on first run), create_nginx_config emits `proxy_pass http://demosite:;` and `http://demosite:$uri` (lines 197, 206, 222, 238, 274). nginx refuses to load this config ("invalid port"), so the whole stack fails after `up -d` with only the generic check_services timeout as a symptom. docker-compose.yml handles this correctly with `${DEMOSITE_CONTAINER_PORT:-8006}` — the script does not.

**Recommendation:** Set the default unconditionally after the .env load: `DEMOSITE_CONTAINER_PORT="${DEMOSITE_CONTAINER_PORT:-8006}"` (outside the if/else).

### [MEDIUM] 'clean' command prunes ALL unused Docker volumes and networks system-wide
`setup-kroki-server.sh:474-476`

The clean command runs `docker volume prune -f` and `docker network prune -f` after `$DOCKER_COMPOSE down --rmi all`. These prune commands are not scoped to the compose project: they delete every dangling volume and every unused network on the host, including data belonging to unrelated projects. On a shared prod box this is destructive collateral damage triggered by a project-level cleanup command.

**Recommendation:** Use `$DOCKER_COMPOSE down --rmi all --volumes` (project-scoped) and drop the global prune commands, or at minimum filter by the compose project label (`docker volume prune --filter label=com.docker.compose.project=...`).

### [MEDIUM] SSE streaming through nginx /api/ proxy has no buffering control — token streaming can stall
`setup-kroki-server.sh:237-243`

The generated /api/ location has default `proxy_buffering on` and no read-timeout overrides, and server.py's streaming response (server.py:483) does not set `X-Accel-Buffering: no` or `Cache-Control: no-cache`. nginx's default proxy buffering is the classic cause of SSE deltas arriving in delayed bursts (or apparently hanging) instead of incrementally, defeating the purpose of `stream: true`. Also note the /api/ location lacks the 300s proxy_read_timeout given to the Kroki locations (lines 255-257), so a long AI generation with >60s between upstream bytes can be cut by nginx's 60s default read timeout even though the backend timeout is client-configurable.

**Recommendation:** In the /api/ location add `proxy_buffering off;` and `proxy_read_timeout 300;` (or have server.py set the `X-Accel-Buffering: no` header on the event-stream Response).

### [LOW] Generated SSE stream is not spec-conformant (single newline, blank lines dropped)
`demoSite/server.py:470-483`

`generate()` iterates `resp.iter_lines()` with `if line:` (dropping the blank lines that delimit SSE events) and re-emits each line with a single `\n` (lines 472-474); the mid-stream error frame at line 480 likewise ends with one `\n`. The result is a `text/event-stream` response in which no event is terminated by the required blank line — a standards-compliant consumer (EventSource, eventsource-parser) would never dispatch any event. The bundled frontend happens to tolerate it because readSSEStream() parses raw lines prefixed with 'data:' (demoSite/js/ai-assistant-api.js:147-160), but any other client of this API breaks. Mid-stream errors are also emitted under HTTP 200 with partial content already sent, which is unavoidable, but conformant framing matters for clients to even see the error frame.

**Recommendation:** Emit `line + '\n'` plus the delimiting blank line (i.e. `'\n\n'` after each data line), or pass through raw bytes with `resp.iter_content()` instead of reconstructing lines.

### [LOW] HTTP_PORT in .env silently controls the nginx→core internal port, breaking rendering if changed
`setup-kroki-server.sh:32, 250, 262`

DEFAULT_HTTP_PORT (`${HTTP_PORT:-8000}`) is interpolated into `proxy_pass http://core:${DEFAULT_HTTP_PORT};` for both Kroki locations. But the core container always listens on 8000 (docker-compose.yml exposes 8000, no KROKI_PORT override) and the port is never published to the host. .env.example:8-10 says 'Ensure that the ports are not in use by other services', inviting users to change HTTP_PORT — doing so makes nginx proxy to a port nothing listens on and all diagram rendering 502s, while the rest of the site works.

**Recommendation:** Hard-code `core:8000` in the generated nginx config (or also pass KROKI_PORT=$HTTP_PORT to the core service), and clarify .env.example that HTTP_PORT is the core's internal port, not a host port.

### [LOW] ECDSA-only ssl_ciphers breaks user-supplied RSA certificates over TLS 1.2
`setup-kroki-server.sh:184`

The generated config pins `ssl_ciphers 'ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-ECDSA-AES256-GCM-SHA384'`, which matches the script's self-signed ECDSA key (line 98). But the script also accepts arbitrary custom certs via --cert/--key (lines 75-86, 388-395); a customer-provided RSA certificate would make every TLS 1.2 handshake fail (no compatible cipher), with only TLS 1.3 clients connecting because ssl_ciphers does not govern TLS 1.3 suites — a confusing partial outage.

**Recommendation:** Include ECDHE-RSA GCM suites in ssl_ciphers, or detect the key type of custom certs and warn/adjust.

### [LOW] 1MB request-size limit trusts the Content-Length header only
`demoSite/server.py:389-390`

`if request.content_length and request.content_length > MAX_REQUEST_SIZE` is the only size guard on /api/ai-assist; a request with no/chunked Content-Length skips it and `request.get_json(force=True)` (line 394) reads the entire body. nginx's `client_max_body_size 10M` (setup-kroki-server.sh:174) is the real backstop, so up to 10MB bodies reach the 1MB-limited endpoint, and any direct (non-nginx) access has no cap at all.

**Recommendation:** Set `app.config['MAX_CONTENT_LENGTH'] = MAX_REQUEST_SIZE` so Werkzeug enforces the limit during body reads regardless of headers.

### [LOW] nginx image unpinned (implicit :latest) while all other images are pinned
`docker-compose.yml:62`

`image: nginx` floats to whatever :latest resolves to at pull time, while every other service pins a tag (yuzutech 0.30.1, ghcr core :goat, python:3.12-alpine3.19 in the Dockerfile). A future nginx major release can change defaults/behavior under the deployment without any repo change, making deploys non-reproducible.

**Recommendation:** Pin a tag, e.g. `image: nginx:1.27-alpine`.

### [LOW] Non-JSON body to /api/validate-model returns 500 instead of 4xx
`demoSite/server.py:322-326`

`data = request.get_json()` (no force/silent) raises UnsupportedMediaType (415) for a non-JSON Content-Type and BadRequest for malformed JSON; both are swallowed by the blanket `except Exception` (line 351) and converted to a 500 'Internal server error'. If get_json returns None (silent empty body), `data.get('model')` raises AttributeError, also surfacing as 500. Client errors are misreported as server errors, polluting error logs.

**Recommendation:** Use `data = request.get_json(silent=True) or {}` and return 400 for missing/invalid bodies, mirroring the pattern already used in ai_assist (lines 393-397).

### [LOW] parse_args: option with missing value exits silently under set -e
`setup-kroki-server.sh:384-395`

`./setup-kroki-server.sh start --hostname` (value forgotten) makes `shift 2` fail with $#=1; under `set -e` (line 2) the script exits nonzero with no error message and no command executed. The same applies to --cert and --key.

**Recommendation:** Validate `$2` exists before consuming it (`[ -n "${2:-}" ] || { echo "missing value for $1"; exit 1; }`) or use `shift; shift` guarded patterns.

### [LOW] build-kroki-core.sh: cached sparse clone is never fetched, so a newer KROKI_REF cannot be checked out
`build-kroki-core.sh:45-51`

The clone happens only when `$BUILD_DIR/server/pom.xml` is missing; on subsequent runs the script goes straight to `git -C "$BUILD_DIR" checkout -q "$KROKI_REF"`. If KROKI_REF is bumped to a commit made after the cached clone, checkout fails ("checkout <ref>") and re-running can never succeed because the existing pom.xml prevents a re-clone — the user must know to delete .kroki-src manually.

**Recommendation:** Run `git -C "$BUILD_DIR" fetch origin "$KROKI_REF" || git -C "$BUILD_DIR" fetch origin` before the checkout, or fall back to rm -rf + re-clone when checkout fails.

### [LOW] ALLOWED_ORIGINS depends on HOSTNAME env, which Docker overrides if absent from .env
`demoSite/server.py:51, 56-63`

server.py builds the exact-match origin allowlist from `os.environ.get('HOSTNAME', 'localhost')`. Inside the container, Docker injects HOSTNAME=<container-id> unless .env (loaded via env_file, docker-compose.yml:56-57) explicitly defines it. The shipped .env.example does define HOSTNAME=localhost, but if a deployment's .env omits or comments it out, the allowlist becomes `https://<container-id>:8443` plus localhost variants — every browser request to /api/* from the real site origin (non-localhost hostname) is rejected with 403 'Unauthorized origin', a hard-to-diagnose failure.

**Recommendation:** Fail fast or log loudly at startup when HOSTNAME looks like a container ID / is unset in .env, or derive the allowed origin from a dedicated variable (e.g. PUBLIC_ORIGIN) rather than the overloaded HOSTNAME.

## Architecture & Maintainability

### [HIGH] globals-bridge is unnecessary: every 'legacy' file is already an ES module and could import directly
`demoSite/js/modules/globals-bridge.js:1-46`

The bridge exists to serve 'non-module <script> files' (its own doc comment, lines 4-6), but index.html lines 47-57 load ALL ten top-level files with type="module", and they already use import statements (ai-assistant.js:1-2 imports aiResponseParser/aiMessages, config-ui.js:12 imports focusTrap, ai-assistant-api.js:10 imports aiStream, code-history.js:1 imports keyboard). The premise of the bridge is obsolete. Worse, 5 of its 9 exposed globals have ZERO consumers: window.appApi, window.AppError, window.ErrorCodes, window.ErrorStrategy, window.handleError (lines 28-33) are assigned and never read anywhere outside the bridge (verified by grep). The remaining consumers are trivial to convert: window.domUtils (2 call sites: ai-assistant-ui.js:137-138, eventBindings.js:206-207 — eventBindings is itself an ES module in js/modules/ that bizarrely reaches through window instead of importing './dom.js'), window.inputValidation (fileOperations.js:96, config.js:322), window.APP_CONSTANTS (ai-assistant-api.js:12-13, ai-assistant.js:37,44 — each with hardcoded fallback values 16000/0.7/50/60 that duplicate constants.js:186-198 and will drift), and window.encodeKrokiDiagram (ai-assistant.js:711). The bridge also imposes a fragile load-order contract (must be the first module script).

**Recommendation:** Highest-leverage refactor: replace each window.* read with a direct import (e.g. in ai-assistant-api.js: `import { AI_MAX_TOKENS, AI_TEMPERATURE } from './modules/constants.js'`, deleting the drift-prone fallbacks), then delete globals-bridge.js and its <script> tag. Start with the 5 dead exports (pure deletion, zero risk), then the 4 live ones (8 call sites total). This removes the legacy/module split entirely.

*Verifier note: independently confirmed; severity adjusted to **medium**.*

### [MEDIUM] ~190 lines of dead code in ConfigManager: getSchema(), getAll(), setAll() are never called; schema is stale
`demoSite/js/config.js:361-381, 527-696`

grep across js/ shows getSchema() (lines 527-696, 170 lines), getAll() (361-367) and setAll() (377-381) have no callers — the settings UI was instead hand-written as a 564-line HTML string in config-ui-templates.js with 38 data-config attributes, abandoning the schema-driven-UI design getSchema() was built for. Because it is dead, the schema has rotted: 'ai.promptTheme' (line 689) does not exist in DEFAULT_CONFIG (the real key is ai.userPromptTemplate, line 108), and the 'ai.model' options (lines 673-680) list bare model ids ('gpt-4o', 'claude-3-5-sonnet-20241022') that contradict the provider/model format the app actually uses (DEFAULT_CONFIG line 104: 'openai/gpt-4o').

**Recommendation:** Delete getSchema(), getAll(), and setAll() outright. The config UI's source of truth is config-ui-templates.js data-config attributes; keeping a second, divergent schema invites someone to trust the wrong one.

### [MEDIUM] Dual state stores for the same values: state.js mirrors ConfigManager with hand-written sync in two places
`demoSite/js/modules/state.js:61-90`

autoRefreshEnabled, DEBOUNCE_DELAY, AUTO_SAVE_DELAY, AUTO_RELOAD_DELAY (state.js:61-76) and zoomState.{minScale,maxScale,scaleStep} (state.js:82-90) duplicate values owned by ConfigManager ('autoRefresh', 'editor.debounceDelay', 'zoom.minScale', ...). configuration.js:50-93 copies config→state at startup and configuration.js:158-232 registers ~10 listeners to re-copy on every change. autoRefresh is the worst case: it lives in state.autoRefreshEnabled AND configManager 'autoRefresh', with bidirectional sync code in main.js:64-84 (handleAutoRefreshToggle writes both stores), main.js:131-139 (checkbox handler writes both), and configuration.js:131-149 (updateAutoRefreshUI syncs button + checkbox + open settings modal). Three UI widgets and two stores must be manually kept coherent; a missed write desynchronizes them silently. The constants fallbacks (state.js:66-76 from constants.js) form a third tier of defaults alongside DEFAULT_CONFIG in config.js (e.g. debounceDelay 1000 defined in both files).

**Recommendation:** Make ConfigManager the single owner of user-preference values: replace state.DEBOUNCE_DELAY / state.zoomState.minScale etc. with reads via a small getter (configManager.get) at point of use, and derive autoRefresh UI from one 'autoRefresh' change listener instead of three sync paths. state.js should keep only runtime state (timers, currentFile, zoom transform).

### [MEDIUM] callCustomAPI and callProxyAPI are ~80% copy-paste of each other
`demoSite/js/ai-assistant-api.js:24-131`

Both methods duplicate: AbortController + setTimeout((config.timeout||30)*1000) setup (26 vs 82), fetch with JSON body, the entire SSE-vs-JSON content-type branch including the identical 8-line streaming-element teardown (`streamingEl.closest('.ai-message')` removal, lines 51-61 vs 112-122), and the identical catch/finally error mapping (64-69 vs 125-130). They differ only in URL, headers (Authorization vs Origin), and body shape. Any fix to the streaming teardown or timeout handling must be made twice; the pattern already shows divergence (only callProxyAPI parses an error JSON body at 108-109).

**Recommendation:** Extract a private `_postChat(url, headers, body, config, abortController, callbacks)` that owns timeout, fetch, SSE/JSON branching, teardown, and error mapping; reduce the two public methods to ~10 lines each building url/headers/body.

### [MEDIUM] Kroki URL construction and GET-vs-POST decision logic duplicated between diagramRenderer and diagramApi
`demoSite/js/modules/diagramRenderer.js:69-84`

diagramApi.js already exports getBaseUrl() (19-24) and shouldUsePostForCurrentDiagram() (80-92), which read code/diagramType/outputFormat from the DOM, build the encoded URL, and apply the alwaysUsePost/urlLengthThreshold rule. diagramRenderer.js updateDiagram() (69-79) re-implements all of it inline: re-reads the same config keys with the same hardcoded fallbacks (false / 4096), rebuilds the base URL from window.location piece by piece (74-77), and recomputes `shouldUsePost = alwaysUsePost || url.length > urlLengthThreshold` (79). eventBindings.js correctly uses the shared shouldUsePostForCurrentDiagram (lines 45, 66), so there are now two decision implementations that can drift — e.g. the renderer's version appends diagramOptionsQuery() to the URL before the length check while diagramApi's version does not, so the two can already disagree near the threshold.

**Recommendation:** Export a single `buildDiagramRequest(code, type, format)` from diagramApi.js returning { url, shouldUsePost } and use it in both updateDiagram() and eventBindings; delete the inline reimplementation in diagramRenderer.js:69-79.

### [MEDIUM] AI model list maintained in three divergent places, two of them stale
`demoSite/js/config-ui-models.js:131-193`

Canonical source is server-side ai-models.json (gpt-5 era, ids in provider/model format like 'openai/gpt-4o') served via /api/available-models (server.py:296). But config-ui-models.js populateModelSelectFallback (131-193) hardcodes a 2024-era list using BARE ids ('gpt-4o', 'claude-3-5-sonnet-20241022', 'gemini-1.0-pro') that don't match the provider/model format DEFAULT_CONFIG and the proxy expect (config.js:104 'openai/gpt-4o'); selecting a fallback entry stores an id the proxy may not recognize. A third stale copy lives in the dead getSchema() 'ai.model' options (config.js:673-680). Each model-list update must currently touch three files and has demonstrably not been doing so.

**Recommendation:** Delete the getSchema copy (dead). Shrink the JS fallback to a minimal set sourced from the same provider/model-format ids as ai-models.json (or fetch-and-cache the last successful /api/available-models response in localStorage so the fallback is the previously seen real list).

### [MEDIUM] ai-assistant.js (953 lines) mixes six unrelated responsibilities despite the 'delegation' split
`demoSite/js/ai-assistant.js:14-951`

The file was partially split (ui/api/prompts companions exist) but the remaining class still contains: window drag-and-drop (152-201) and input resizing (207-254) — pure widget mechanics; chat/message history ring buffers (282-375); the retry/orchestration state machine makeAIRequest with recursive self-calls and exponential backoff (563-666); response parsing + a 40-line heuristic code extractor duplicating concerns of modules/aiResponseParser.js (_fallbackExtractCode, 754-793); DOM-scraping 'validation' that greps the page for `[class*="error"]` selectors and inspects img.naturalWidth (693-720) — an extremely fragile contract with diagramRenderer's markup; and a phrase-rewriting NLP helper makeRetryExplanationUserFriendly (807-834). It is also the single biggest consumer of cross-window coupling (window.AIAssistantUI, window.AIAssistantAPI, window.AIAssistantPrompts, window.codeHistory, window.configUI, window.configManager, window.encodeKrokiDiagram, document.getElementById('code')).

**Recommendation:** Three mechanical extractions with clear seams: (1) move drag/resize into ai-assistant-ui.js (it owns the DOM it manipulates); (2) move makeAIRequest's retry loop + parseAIResponse/_fallbackExtractCode into a testable module next to modules/aiResponseParser.js (currently the only tested part of this pipeline); (3) replace checkDiagramValidation's DOM scraping with an explicit signal — diagramRenderer.js already dispatches a 'diagramRendered' CustomEvent with success detail (diagramRenderer.js:222-229); await that event instead of querying error CSS classes.

### [MEDIUM] Hidden-textarea compatibility shim (Proxy + defineProperty) props up 27 getElementById('code') call sites
`demoSite/js/modules/editorBridge.js:388-483`

shimTextarea() overrides .value/.selectionStart/.selectionEnd via Object.defineProperty, monkey-patches setSelectionRange/focus, and wraps the element's .style in a Proxy that intercepts borderLeftColor and fontSize writes (442-475) to keep legacy DOM-style code working against CodeMirror 6. There are 27 `getElementById('code')` accesses across 12 files (diagramApi, diagramRenderer, fileOperations, fileStatus, urlHandler, fileMonitoring, code-history, eventBindings, drawioIntegration, ai-assistant, ...) all flowing through this shim. It works, but it is the most surprising code in the repo: property semantics differ subtly from a real textarea (selectionStart setter is a silent no-op, 409-411; value-set dispatches no input event while CM6 edits do), and any new textarea API a caller touches (selectionDirection, setRangeText) silently bypasses CM6. A clean editor API already exists right above it (window.editor, 336-375) but only 13 call sites use it.

**Recommendation:** Treat the shim as a transitional layer with a burn-down plan: migrate the 27 call sites to an imported editor module (export the same getValue/setValue/etc. functions from editorBridge.js instead of only window.editor), then delete shimTextarea() and the hidden textarea. Mechanical change, file by file; each migrated file also drops one window.* dependency.

### [MEDIUM] Modules in js/modules/ still depend on window.* globals, making the 'modular' layer untestable in isolation
`demoSite/js/modules/configuration.js:31, 51, 103, 146, 159`

The ES-module layer itself reaches back through window for its dependencies: configuration.js uses window.configManager throughout (31, 51, 103, 159) and window.configUI/window.diagramZoomPan (146, 200); diagramApi.js reads window.configManager 4x (31, 85-86, 104); diagramRenderer.js (69-70, 153), editorBridge.js (258, 299), eventBindings.js (window.editor 72, window.domUtils 206) do the same — 38 total window.configManager references across the codebase. The root cause is that ConfigManager is instantiated as a side effect of loading config.js onto window (config.js:702-704) instead of being an importable singleton, even though config.js already has `export { ConfigManager, DEFAULT_CONFIG }` (line 700). This is why only 6 leaf-utility test files exist (tests/: aiMessages, aiResponseParser, aiStream, configClone, diagramOptions, keyboard) — nothing that touches configManager can run under bun test without a window mock.

**Recommendation:** Create the singleton in config.js as `export const configManager = new ConfigManager()` (keep the window assignment temporarily for back-compat), then convert modules' window.configManager reads to imports. This one change removes the largest global edge (38 refs), eliminates every `window.configManager ? ... : fallback` ternary and its duplicated fallback constants, and makes configuration.js/diagramApi.js unit-testable.

### [LOW] Dead search state in state.js — search moved to CodeMirror 6 but the old state machine remains
`demoSite/js/modules/state.js:125-133, 262-264`

state.searchState (isVisible, currentQuery, matches, currentIndex, caseSensitive, lastSearchValue; lines 125-133) and updateSearchState() (262-264) have zero references outside state.js (verified by grep). Search is now fully delegated to CM6's built-in panel (modules/search.js:14-18 just calls window.editor.openSearch()). Relatedly there are three redundant entry points to open search: search.js showSearchBar(), eventBindings.js:225-226 defining window.showSearchBar (which nothing calls — fileOperations.js:345 dynamic-imports search.js directly), and eventBindings.js:226 calling window.editor.openSearch() inline.

**Recommendation:** Delete state.searchState and updateSearchState(); delete the window.showSearchBar global in eventBindings.js:225 and call the imported showSearchBar (or window.editor.openSearch) directly.

### [LOW] Dead configuration plumbing in AIAssistant: nonexistent configManager.on() and never-dispatched events
`demoSite/js/ai-assistant.js:868-887`

setupConfigurationListeners() (880-887) guards on `typeof this.configManager.on === 'function'` — ConfigManager has no .on() method (only addListener, config.js:474), so the branch silently never runs. It also listens for 'aiConfigChanged' (line 886) and loadConfiguration() listens for 'configSystemReady' (line 873); grep confirms neither event is dispatched anywhere in the codebase. The model indicator actually updates only via the indirect path configuration.js:272-283 → window.aiAssistant.applyConfiguration(). Anyone reading ai-assistant.js will reasonably (and wrongly) conclude these listeners are the update mechanism.

**Recommendation:** Delete the .on() branch and both phantom event listeners; replace with explicit configManager.addListener('ai.*'-paths, ...) registrations inside AIAssistant itself (or a comment pointing at configuration.js:272 as the single wiring point).

## Test Coverage Gaps

### [HIGH] CI never runs the unit test suite — 'bun test' is not invoked in any workflow
`.github/workflows/ci.yml:15-47`

The CI workflow has three jobs: ShellCheck on setup-kroki-server.sh, a docker-compose smoke test (curl for HTTP 200), and a demo-site image build. None of them run 'bun test' (or any JS/Python test). The 39 existing unit tests in demoSite/tests/ — which were written specifically to lock in regression fixes (config deep-clone bug, aiResponseParser brace-counting bug, GoAT dark-scheme option) — only run if a developer remembers to run them locally. A PR that reintroduces any of those fixed bugs would pass CI and ship. release.yml and build-kroki-core.yml also do not run tests.

**Recommendation:** Add a 'unit-test' job to ci.yml that runs before the docker jobs: uses oven-sh/setup-bun@v2, then 'cd demoSite && bun test tests/'. Make the 'test' and 'demo-site-container' jobs 'needs: unit-test' so the image cannot be built/pushed from a commit with failing tests. This is a ~10-line change and is the single highest-leverage fix in this dimension.

*Verifier note: independently confirmed; severity adjusted to **medium**.*

### [HIGH] server.py (620-line Flask backend) has zero tests, including the AI proxy, origin validation, and model allowlist
`demoSite/server.py:138-523`

The entire backend is untested. The riskiest untested logic, all of it security- or correctness-sensitive: (1) validate_origin (lines 359-370) — the exact-match allowlist that replaced a startswith() bypass ('https://localhost.evil.com'); nothing prevents that regression from coming back. (2) build_ai_payload (lines 138-161) — per-provider parameter rules (anthropic gets max_tokens and no temperature, openai/azure get max_completion_tokens); a wrong key silently breaks AI requests for a whole provider. (3) /api/ai-assist model-allowlist enforcement (lines 407-424) — the anti-model-injection check, plus the subtle fallthrough where model='' skips validation entirely and proxies the empty string upstream. (4) The streaming generate() (lines 470-483) — mid-stream upstream failure is converted into a terminal SSE error frame; untested, and it is the contract the frontend's interpretSSEData depends on. (5) fetch_models_from_proxy (lines 163-229) — grouping by provider prefix and NON_CHAT_MODEL_KEYWORDS filtering. All of these are deterministic and testable without a live AI provider. (Note: server.py is Flask, not stdlib http.server, so the standard Flask test_client applies.)

**Recommendation:** Create demoSite/tests/python/test_server.py using pytest + flask's app.test_client(), monkeypatching 'requests.post'. Priority order: (a) validate_origin table test (allowed exact origins, evil.com lookalikes, missing header); (b) build_ai_payload for anthropic/openai/azure/unknown providers; (c) POST /api/ai-assist with a disallowed model -> 400, missing messages -> 400, oversized content_length -> 413, model='' bypass path; (d) streaming path with a mocked iter_lines that raises mid-iteration, asserting the error SSE frame is emitted. Add 'pytest demoSite/tests/python' to the new CI unit-test job.

*Verifier note: independently confirmed; severity adjusted to **medium**.*

### [HIGH] AI streaming reader (readSSEStream) is untested — only the per-frame parser has tests
`demoSite/js/ai-assistant-api.js:140-179`

tests/aiStream.test.js covers interpretSSEData (single-frame classification) but the loop that feeds it — readSSEStream — has no tests. Untested edge cases that are classic SSE bugs: a 'data:' line split across two reader.read() chunks (buffer = lines.pop() logic, line 168-169); multi-byte UTF-8 characters split across chunk boundaries (relies on decoder.decode(value, {stream:true}) at line 167); the final flush of a buffered line with no trailing newline (lines 173-174); a provider error frame mid-stream after partial content (handleLine throws an isProviderError-tagged error at line 152, which the caller at line 126 must re-throw rather than wrap); and CRLF line endings. This function carries every streamed AI response in the product, and the module is structured as a plain object literal so the method is importable.

**Recommendation:** Add tests/readSSEStream.test.js. Construct a fake Response with body.getReader() returning scripted chunks (ReadableStream is available in Bun): (1) content split mid-frame across chunks reassembles correctly; (2) a multi-byte emoji split across chunks survives; (3) stream without trailing newline still delivers the last frame; (4) an {error:{message}} frame after partial content rejects with isProviderError=true; (5) [DONE] terminates with accumulated text. This requires extracting nothing — ai-assistant-api.js exports the aiAssistantAPI object (verify its export shape) or move readSSEStream into modules/aiStream.js next to interpretSSEData, which is the cleaner fix.

*Verifier note: independently confirmed; severity adjusted to **low**.*

### [HIGH] Kroki encoding and GET-vs-POST decision logic untested — core render path of the product
`demoSite/js/modules/diagramApi.js:80-92`

encodeKrokiDiagram (in modules/diagramOperations.js, pako deflate + base64url) and shouldUsePostForCurrentDiagram (diagramApi.js lines 80-92) have no tests. Every diagram render, shareable URL, and the POST fallback for large diagrams depends on them. shouldUsePostForCurrentDiagram mixes the pure decision (alwaysUsePost || url.length > threshold, with a 4096 default when configManager is absent) with document.getElementById reads, and encodeKrokiDiagram's correctness (deflate level, byte-to-string conversion via uint8ArrayToString, '+/'->'-_' substitution) is exactly the kind of thing that silently breaks for non-ASCII diagram text. Note also that 'pako' is only listed under the non-standard 'cdn-dependencies' key in package.json — it is not installable, so these modules currently cannot even be imported under bun test, which is likely why this path has no tests.

**Recommendation:** Add pako to devDependencies (bun add -d pako@2.1.0) so the module resolves under bun test. Then: (1) round-trip test encodeKrokiDiagram/decode against a known Kroki vector (e.g. 'digraph G {Hello->World}' has a published encoded form in Kroki docs) plus a non-ASCII string; (2) extract the pure decision 'shouldUsePost(urlLength, threshold, alwaysUsePost)' from shouldUsePostForCurrentDiagram and test the boundary (length == threshold vs threshold+1) and the no-configManager defaults.

*Verifier note: independently confirmed; severity adjusted to **medium**.*

### [MEDIUM] Only 5 of 31 modules tested; pure, trivially-testable logic in validation.js, utils.js, api.js, and fileOperations.js has zero coverage
`demoSite/js/modules`

Beyond the high-severity paths above, several already-pure functions are untested even though they need no DOM mocking: validation.js (validateFile, validateConfigValue, sanitizeString — config-injection and file-size guards), utils.js textEncode/uint8ArrayToString (feed the Kroki encoder; a UTF-8 handling bug here corrupts every encoded URL), api.js createTimeoutController (timeout/abort plumbing used by apiFetch), and modules/errors.js (user-facing error message mapping). detectDiagramType in fileOperations.js (lines 134-153) is testable with a one-line element stub like keyboard.test.js already uses, and it contains at least one suspicious mapping worth pinning under test: any filename containing '.py' switches the diagram type to 'structurizr' (Structurizr DSL is not Python), and the mermaid heuristic requires content to contain both 'graph' AND ('mermaid' or '.mmd' filename), so a plain 'graph TD' .txt file is detected as nothing. Untested behavior like this can't be distinguished from intended behavior.

**Recommendation:** Prioritized test plan after the four findings above: (1) validation.js — table tests for sanitizeString (HTML/length) and validateConfigValue against the schema; (2) utils.js — textEncode/uint8ArrayToString round-trip incl. surrogate pairs; (3) fileOperations.js — extract the type-detection decision into a pure 'detectType(content, filename) -> string|null' and table-test it (this will force a decision on the '.py' -> structurizr mapping); (4) api.js createTimeoutController with bun's fake timers. Defer DOM-heavy modules (zoomPan, fullscreen, eventBindings, theme, editorBridge) — they are lower value per effort and better covered by an eventual smoke test.

### [MEDIUM] Legacy top-level AI files (~2,300 lines) are the largest untested surface in the frontend
`demoSite/js/ai-assistant.js:1-953`

ai-assistant.js (953 lines), ai-assistant-api.js (291), ai-assistant-ui.js (267), ai-assistant-prompts.js (123), code-history.js (373), and config-ui*.js (~1,240) sit outside js/modules/ and have no tests. The existing test suite shows the project's pattern: bugs get fixed by extracting a pure module (aiMessages, aiStream, aiResponseParser) and testing it. The remaining orchestration in ai-assistant.js — the retry-on-render-failure loop that feeds {{failedCode}}/{{validationError}} into the retry prompt, request cancellation, and history persistence in code-history.js (undo/redo stack and localStorage serialization) — is where the next production bug will live, and none of it is reachable by the current tests.

**Recommendation:** Don't try to test these files wholesale. Continue the established extraction pattern opportunistically: next candidates are (1) prompt template substitution ({{diagramType}}/{{currentCode}}/{{userPrompt}} interpolation in ai-assistant-prompts.js — pure string logic, high blast radius if a placeholder is mistyped) and (2) the code-history.js stack operations (push/undo/redo/cap), which need only a localStorage stub identical to the one already used in configClone.test.js.

### [LOW] No test coverage signal: package.json has a working test script but no coverage reporting and the suite's existence is invisible to contributors
`demoSite/package.json:7-9`

The only script is "test": "bun test tests/", which works (39 pass, verified). There is no coverage flag, so the gap documented above (~5 of 31 modules) is not measurable or trackable, and nothing in the repo (CI badge, contributing doc) tells a contributor tests exist or must pass.

**Recommendation:** Add "test:coverage": "bun test --coverage tests/" to scripts and run it in the CI job (bun supports lcov output via --coverage-reporter=lcov for trend tracking). Even without enforcing thresholds initially, a visible coverage number prevents the suite from silently stagnating at the current 6 files.

## DevOps & Dependency Hygiene

### [HIGH] dependabot.yml is in the repo root, so Dependabot is completely inactive
`dependabot.yml:1-17`

GitHub only reads Dependabot configuration from .github/dependabot.yml. The file lives at the repository root (verified: /home/vpillai/temp/kroki-server/.github/ contains only CODEOWNERS.md, ISSUE_TEMPLATE, PULL_REQUEST_TEMPLATE.md, workflows). The config is otherwise syntactically valid (version 2, github-actions + docker ecosystems), but in its current location it does nothing — no dependency update PRs are ever generated, which explains the stale action versions and stale Python pins found elsewhere.

**Recommendation:** git mv dependabot.yml .github/dependabot.yml. Verify in the GitHub UI (Insights -> Dependency graph -> Dependabot) that the config is picked up.

*Verifier note: independently confirmed; severity adjusted to **medium**.*

### [HIGH] Python dependencies pinned to versions with multiple known CVEs
`demoSite/requirements.txt:1-6`

All six pins are ~2.5 years stale as of 2026-06 and several have published advisories: Werkzeug==3.0.1 (CVE-2024-34069 debugger RCE, CVE-2024-49766/49767 — fixed in 3.0.6), requests==2.31.0 (CVE-2024-35195 verify-bypass on Session, CVE-2024-47081 .netrc credential leak — fixed in 2.32.x), Flask-CORS==4.0.0 (CVE-2024-1681 log injection plus the 2024 path-matching advisories fixed in later releases), Flask==3.0.0. These are installed into the production demosite image by demoSite/Dockerfile (RUN pip install -r requirements.txt), and server.py imports and uses all of them (Flask, flask_cors, flask_limiter, werkzeug ProxyFix, requests, dotenv) — so this is live attack surface, not dead weight. Because Dependabot is inactive (root-located config, no pip entry), nothing will ever flag these.

**Recommendation:** Bump to current patched releases (Werkzeug >=3.0.6, requests >=2.32.4, Flask-CORS >=6.0, Flask >=3.1.x, Flask-Limiter latest), run the app smoke test, and enable pip Dependabot updates so pins do not rot again.

*Verifier note: independently confirmed; severity adjusted to **medium**.*

### [HIGH] CI never runs the JavaScript test suite (bun test, 39 tests)
`.github/workflows/ci.yml:14-46`

demoSite/package.json defines "test": "bun test tests/" and demoSite/tests/ contains 6 test files (aiMessages, aiResponseParser, aiStream, configClone, diagramOptions, keyboard — 39 passing tests), but ci.yml's jobs are only: shellcheck of setup-kroki-server.sh, a docker-compose smoke test, and a Docker image build. No workflow installs Bun or runs the unit tests, so regressions in the ~10k-line frontend merge silently. The shellcheck step also only scans setup-kroki-server.sh and skips build-kroki-core.sh.

**Recommendation:** Add a CI job using oven-sh/setup-bun that runs `bun test tests/` in demoSite (make it a prerequisite of the image-build job), and widen the ShellCheck scandir to include build-kroki-core.sh.

*Verifier note: independently confirmed; severity adjusted to **medium**.*

### [MEDIUM] Dependabot config has no 'pip' ecosystem entry for demoSite/requirements.txt
`dependabot.yml:3-17`

Even once moved to .github/, the config only covers github-actions (directory /) and docker (directory /demoSite). The Python backend's exact-pinned dependencies in demoSite/requirements.txt (Flask, Flask-CORS, Flask-Limiter, requests, Werkzeug, python-dotenv) are not monitored, so security updates for the actual server runtime will never be proposed.

**Recommendation:** Add a pip ecosystem entry with directory "/demoSite" and a weekly schedule. Optionally also add a docker entry for directory "/" (or the docker-compose ecosystem) to track the yuzutech/kroki-* companion image tags in docker-compose.yml.

### [MEDIUM] nginx image unpinned (implicit :latest) in docker-compose.yml
`docker-compose.yml:62`

`image: nginx` pulls whatever :latest is at deploy time, while every other service is pinned (yuzutech/kroki-*:0.30.1) or a controlled tag. nginx is the TLS-terminating, internet-facing entry point of the stack; an unpinned major upgrade (e.g. nginx 1.x -> a config-incompatible release) can break the deployment non-reproducibly, and different hosts/pulls get different binaries.

**Recommendation:** Pin to a specific version tag, e.g. `image: nginx:1.27-alpine`, and let (relocated) Dependabot/manual review handle bumps.

### [MEDIUM] No restart policies on any service — stack does not survive host reboot or crashes
`docker-compose.yml:1-76`

None of the seven services (core, mermaid, bpmn, excalidraw, diagramsnet, demosite, nginx) declare `restart:`. With the default `no` policy, a daemon restart, host reboot, or OOM-kill of any container leaves the production deployment (a long-running server at /opt/kroki-server per the deploy process) down until someone manually runs the setup script again.

**Recommendation:** Add `restart: unless-stopped` to every service in docker-compose.yml.

### [MEDIUM] No compose-level healthchecks or resource limits; nginx depends_on is start-order only
`docker-compose.yml:61-71`

Only the demosite image has a Dockerfile HEALTHCHECK; core, mermaid, bpmn, excalidraw, diagramsnet, and nginx have none, and compose defines no `healthcheck:` blocks. nginx's `depends_on: [core]` (line 63-64) is plain start-ordering, not `condition: service_healthy`, so nginx starts proxying before Kroki is ready (the CI workflow papers over this with `sleep 30`, ci.yml line 42). There are also no memory/cpu limits: the headless-Chromium-based renderers (mermaid, diagramsnet, excalidraw) are known memory hogs and a large diagram can OOM the whole host since nothing is bounded.

**Recommendation:** Add healthcheck blocks (Kroki core exposes /health), use `depends_on: { core: { condition: service_healthy } }` for nginx, and set `mem_limit`/`deploy.resources.limits` on the renderer companions.

### [MEDIUM] ShellCheck action pinned to mutable @master ref (supply-chain risk)
`.github/workflows/ci.yml:21`

`uses: ludeeus/action-shellcheck@master` executes whatever the third-party repo's master branch points at, on every push/PR, in a workflow whose top-level permissions include `packages: write` (ci.yml lines 10-12). A compromise of that repo executes attacker code with a token that can push images to this project's GHCR namespace.

**Recommendation:** Pin third-party actions to a full commit SHA (or at least a release tag), and scope `packages: write` to only the demo-site-container job instead of the whole workflow (lint/test do not need it).

### [MEDIUM] Workflows use deprecated/stale action major versions (checkout@v3 etc.)
`.github/workflows/ci.yml:ci.yml:18,29,52; release.yml:18,21,24,32,42,62`

ci.yml and release.yml use actions/checkout@v3, docker/setup-buildx-action@v2, docker/login-action@v2, docker/metadata-action@v4, docker/build-push-action@v4, and softprops/action-gh-release@v1. checkout@v3 runs on the deprecated Node 16 runtime that GitHub has been retiring (runner warnings now, hard failure when removed). Inconsistently, build-kroki-core.yml already uses @v4/@v3 of the same actions. Because Dependabot is inactive (root-located config), these will not self-heal.

**Recommendation:** Bump to current majors (checkout@v4/v5, setup-buildx@v3, login@v3, metadata@v5, build-push@v6, action-gh-release@v2) and let the relocated dependabot.yml github-actions entry keep them current.

### [MEDIUM] CI tags every main-branch image build as 'latest', clobbering release images
`.github/workflows/ci.yml:70-74`

The metadata-action tag list in ci.yml includes a bare `latest` entry with no condition, so every push to main publishes ghcr.io/<repo>/demosite:latest. release.yml (lines 35-39) also tags `latest` on version tags. Any commit to main therefore silently overwrites the :latest that the last release published, so deployments pulling :latest get untested tip-of-main instead of the released version, and there is no way to tell which they got.

**Recommendation:** Remove the unconditional `latest` from ci.yml (or use `type=raw,value=latest,enable={{is_default_branch}}` only if main-as-latest is intended and release.yml stops tagging latest). Reserve :latest for exactly one workflow.

### [MEDIUM] setup-kroki-server.sh overwrites the git-tracked nginx.conf on every start/restart
`setup-kroki-server.sh:7,157,443,487`

NGINX_CONF="${SCRIPT_DIR}/nginx.conf" (line 7) and create_nginx_config() (line 157, invoked from the start path at 443 and restart at 487) regenerate the same nginx.conf that is committed to the repo and bind-mounted by docker-compose.yml (line 69). The production deployment is a git checkout at /opt/kroki-server updated via git, so every `start`/`restart` dirties the working tree; a future upstream change to nginx.conf will then make `git pull` fail or require manual conflict resolution, and local generated content silently shadows the reviewed, committed config.

**Recommendation:** Generate the config to an untracked path (e.g. ./generated/nginx.conf, gitignored) and mount that, or stop generating it and treat the committed nginx.conf as the single source of truth with env vars templated via nginx's envsubst entrypoint.

### [LOW] HTTP_PORT is misdocumented — changing it breaks nginx->core proxying
`README.md:README.md:80; .env.example:11; setup-kroki-server.sh:32,250,262`

README (line 80) and .env.example describe HTTP_PORT=8000 as the "Kroki core server port" as if it were configurable. In reality the core container always listens on 8000 (docker-compose.yml lines 17-18 expose fixed 8000; KROKI_PORT is never set), while setup-kroki-server.sh templates the value into the generated nginx upstream (`proxy_pass http://core:${DEFAULT_HTTP_PORT}` at lines ~250/262). Setting HTTP_PORT to anything other than 8000 makes nginx proxy to a port nothing listens on, breaking all diagram rendering.

**Recommendation:** Either hardcode core:8000 in the generated config and drop HTTP_PORT from .env.example/README, or actually wire HTTP_PORT into the core service (KROKI_PORT env + expose) so the documented knob works.

### [LOW] build-kroki-core.yml weekly schedule does not 'track upstream main' as its comments claim
`.github/workflows/build-kroki-core.yml:23,43`

The cron entry is commented "weekly, Mondays 06:00 UTC — track upstream main", but on scheduled runs github.event.inputs is empty so KROKI_REF (line 43) always falls back to the pinned commit 1d20d1d6e5 (2026-04). The weekly job therefore rebuilds and re-pushes the identical source every Monday — burning ~30 min of arm64+amd64 runner time per week for a no-op — while never actually picking up upstream changes. Relatedly, build-kroki-core.sh's header comment (line 7) still says it produces "kroki-core:main-goat" while IMAGE_TAG (line 20) is ghcr.io/vppillai/kroki-core:goat.

**Recommendation:** Either resolve the ref to upstream main at run time (e.g. `git ls-remote ... refs/heads/main`) if tracking is intended, or remove the schedule and keep workflow_dispatch only; fix the stale comments in both files. Note also that re-pushing the mutable :goat tag makes core deployments non-reproducible — consider date- or sha-suffixed tags.

### [LOW] docker-compose.yml references locally-built kroki-demosite:latest with no build: fallback
`docker-compose.yml:50-51`

The demosite service uses `image: kroki-demosite:latest` with no `build:` section; the tag only exists if setup-kroki-server.sh's build_demo_site() (line 119) has been run. A plain `docker compose up` on a fresh clone fails with an image-not-found error for demosite, and CI publishes ghcr.io/<repo>/demosite images that the compose file never consumes — the registry artifacts and the deployment are disconnected. The mutable local :latest tag also means `compose up` can silently run a stale build after a git pull unless the setup script is re-run.

**Recommendation:** Add `build: ./demoSite` to the demosite service (compose will build when the image is missing and the setup script can still pre-build), or reference the published ghcr.io demosite image with a version tag, mirroring the core service's pull-or-build pattern.
