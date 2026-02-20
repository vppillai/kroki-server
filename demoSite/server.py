#!/usr/bin/env python3
"""
Kroki Demo Site Server with AI Assistant API Proxy
Provides static file serving and AI API proxy functionality
"""

import os
import json
import logging
import requests
import time
from flask import Flask, request, jsonify, send_from_directory, send_file, Response, stream_with_context
from flask_cors import CORS
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address
from datetime import datetime

# Load environment variables from .env file
try:
    from dotenv import load_dotenv
    import os
    
    # Try to load from parent directory first (top-level .env), then current directory
    parent_env = os.path.join(os.path.dirname(os.path.dirname(__file__)), '.env')
    current_env = os.path.join(os.path.dirname(__file__), '.env')
    
    if os.path.exists(parent_env):
        load_dotenv(parent_env)
        print(f"Loaded environment from: {parent_env}")
    elif os.path.exists(current_env):
        load_dotenv(current_env)
        print(f"Loaded environment from: {current_env}")
    else:
        print("No .env file found, using system environment variables")
        
except ImportError:
    # dotenv not available, will use system environment variables
    print("dotenv not available, using system environment variables")
    pass

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = Flask(__name__)
CORS(app)
limiter = Limiter(get_remote_address, app=app, default_limits=[])

# Configuration
PORT = int(os.environ.get('PORT', 8006))
HTTPS_PORT = int(os.environ.get('HTTPS_PORT', 8443))
HOSTNAME = os.environ.get('HOSTNAME', 'localhost')
STATIC_ROOT = os.environ.get('STATIC_ROOT', '/app')
AI_TIMEOUT = 30  # Default timeout for AI API requests
AI_MAX_TOKENS = 16000  # Token limit for AI responses
MAX_REQUEST_SIZE = 1024 * 1024  # 1MB limit for AI requests
KROKI_MAX_BODY_SIZE = int(os.environ.get('KROKI_MAX_BODY_SIZE', 1048576))  # Kroki backend body limit

# AI Configuration (Always uses proxy - LiteLLM, OpenRouter, etc.)
AI_PROXY_URL = os.environ.get("AI_PROXY_URL", "https://openrouter.ai/api/v1")
AI_PROXY_API_KEY = os.environ.get('AI_PROXY_API_KEY', '')
AI_PROXY_NAME = os.environ.get('AI_PROXY_NAME', 'AI Proxy')

# Default AI configuration - can be overridden by environment variables
DEFAULT_AI_CONFIG = {
    'proxy_url': AI_PROXY_URL,
    'api_key': AI_PROXY_API_KEY,
    'model': os.environ.get('AI_MODEL', 'openai/gpt-4o'),
    'timeout': int(os.environ.get('AI_TIMEOUT', AI_TIMEOUT)),
    'enabled': os.environ.get('AI_ENABLED', 'true').lower() == 'true'
}

# Load available models from JSON configuration file
def load_available_models():
    """Load AI models from external JSON configuration file"""
    models_file = os.path.join(os.path.dirname(__file__), 'ai-models.json')
    try:
        with open(models_file, 'r') as f:
            models = json.load(f)
            logger.info(f"Successfully loaded {len(models)} provider categories from ai-models.json")
            return models
    except Exception as e:
        logger.warning(f"Could not load ai-models.json: {e}. Using fallback models.")
        # Fallback models in case file is missing
        return {
            'openai': {
                'gpt-4o': {'name': 'GPT-4o', 'provider': 'OpenAI', 'context': '128k', 'cost': 'high'},
                'gpt-4o-mini': {'name': 'GPT-4o Mini', 'provider': 'OpenAI', 'context': '128k', 'cost': 'low'},
                'gpt-3.5-turbo': {'name': 'GPT-3.5 Turbo', 'provider': 'OpenAI', 'context': '16k', 'cost': 'low'}
            }
        }

# Known non-chat model keywords to filter out
NON_CHAT_MODEL_KEYWORDS = ['embedding', 'embed', 'tts', 'whisper', 'dall-e', 'moderation']

def fetch_models_from_proxy():
    """Fetch available models from the LiteLLM proxy /models endpoint at startup.

    Returns a dict grouped by provider prefix in the same shape as ai-models.json,
    or None if the proxy is unreachable.
    """
    if not AI_PROXY_URL or not AI_PROXY_API_KEY:
        logger.warning("AI_PROXY_URL or AI_PROXY_API_KEY not configured, skipping proxy model fetch")
        return None

    models_url = AI_PROXY_URL.rstrip('/') + '/models'
    headers = {
        'Authorization': f'Bearer {AI_PROXY_API_KEY}',
        'Content-Type': 'application/json'
    }

    try:
        logger.info(f"Fetching model list from proxy: {models_url}")
        response = requests.get(models_url, headers=headers, timeout=10)
        response.raise_for_status()

        model_list = response.json().get('data', [])
        if not model_list:
            logger.warning("Proxy returned empty model list")
            return None

        grouped = {}
        skipped = []

        for entry in model_list:
            model_id = entry.get('id', '')
            if not model_id:
                continue

            # Filter out non-chat models
            if any(kw in model_id.lower() for kw in NON_CHAT_MODEL_KEYWORDS):
                skipped.append(model_id)
                continue

            provider = model_id.split('/')[0] if '/' in model_id else 'other'
            if provider not in grouped:
                grouped[provider] = {}

            grouped[provider][model_id] = {
                'name': model_id,
                'provider': provider
            }

        if skipped:
            logger.info(f"Filtered out {len(skipped)} non-chat models: {skipped}")

        total = sum(len(m) for m in grouped.values())
        logger.info(f"Fetched {total} chat models from proxy across {len(grouped)} providers")
        return grouped if grouped else None

    except requests.exceptions.Timeout:
        logger.warning("Timeout fetching models from proxy (10s)")
        return None
    except requests.exceptions.ConnectionError:
        logger.warning(f"Could not connect to proxy at {models_url}")
        return None
    except requests.exceptions.HTTPError as e:
        logger.warning(f"HTTP error fetching models from proxy: {e}")
        return None
    except Exception as e:
        logger.warning(f"Unexpected error fetching models from proxy: {e}")
        return None

# ANSI escape codes for bold red terminal output
BOLD_RED = '\033[1;31m'
RESET = '\033[0m'

# Try proxy first, fall back to static JSON
_proxy_models = fetch_models_from_proxy()
if _proxy_models:
    AVAILABLE_MODELS = _proxy_models
    logger.info("Using model list from LLM proxy")
else:
    AVAILABLE_MODELS = load_available_models()
    print(f"{BOLD_RED}WARNING: Failed to fetch models from LLM proxy. Using static fallback (ai-models.json).{RESET}")
    logger.warning("Failed to fetch models from LLM proxy. Using static fallback (ai-models.json).")

# Default prompt templates - configurable via environment
DEFAULT_SYSTEM_PROMPT = os.environ.get('AI_SYSTEM_PROMPT', '''You are an expert diagram assistant for the Kroki diagram server. You help users create, modify, and troubleshoot diagrams.

Your role is to:
1. Generate correct diagram code in the specified format
2. Modify existing code based on user requests  
3. Fix syntax errors and improve diagram structure
4. Provide helpful explanations when needed

Always ensure your code follows proper syntax for the diagram type and is compatible with Kroki.''')

DEFAULT_USER_PROMPT = os.environ.get('AI_USER_PROMPT', '''Please help me with this diagram request: {{userPrompt}}

Current diagram type: {{diagramType}}
Current code: {{currentCode}}

Please provide the updated or new diagram code in a code block, along with a brief explanation of the changes.''')

DEFAULT_RETRY_PROMPT = os.environ.get('AI_RETRY_PROMPT', '''The previous diagram code failed validation. 
Original request: {{userPrompt}}
Diagram type: {{diagramType}}
Original code: {{currentCode}}
Failed code: {{failedCode}}
Validation error: {{validationError}}

Please fix the code and provide a corrected version. Respond with ONLY a JSON object with 'diagramCode' and 'explanation' fields.''')

@app.route('/api/ai-prompts', methods=['GET'])
def get_ai_prompts():
    """Get default AI prompt templates"""
    try:
        if not validate_origin(request):
            return jsonify({'error': 'Unauthorized origin'}), 403
        
        return jsonify({
            'system': DEFAULT_SYSTEM_PROMPT,
            'user': DEFAULT_USER_PROMPT,
            'retry': DEFAULT_RETRY_PROMPT
        })
    
    except Exception as e:
        logger.error(f"Error getting AI prompts: {str(e)}")
        return jsonify({'error': 'Internal server error'}), 500

@app.route('/api/available-models', methods=['GET'])
def get_available_models():
    """Get list of available AI models with metadata"""
    try:
        if not validate_origin(request):
            return jsonify({'error': 'Unauthorized origin'}), 403
        
        # Return all models from JSON file (no filtering)
        return jsonify({
            'models': AVAILABLE_MODELS,
            'proxy_url': AI_PROXY_URL,
            'proxy_name': AI_PROXY_NAME,
            'default_model': DEFAULT_AI_CONFIG['model']
        })
    
    except Exception as e:
        logger.error(f"Error getting available models: {str(e)}")
        return jsonify({'error': 'Internal server error'}), 500

@app.route('/api/validate-model', methods=['POST'])
def validate_model():
    """Validate if a specific model is available"""
    try:
        if not validate_origin(request):
            return jsonify({'error': 'Unauthorized origin'}), 403
        
        data = request.get_json()
        model_name = data.get('model')
        
        if not model_name:
            return jsonify({'error': 'Model name is required'}), 400
        
        # Build a flat list of all allowed models from the JSON configuration
        allowed_models = {}
        for provider_models in AVAILABLE_MODELS.values():
            allowed_models.update(provider_models)
        
        # Check if the requested model is in our allowed list
        if model_name not in allowed_models:
            logger.warning(f"Model validation failed for '{model_name}' - not in allowed models list. Request from: {request.remote_addr}")
            return jsonify({
                'valid': False,
                'error': f'Model "{model_name}" is not supported. Please select from available models.'
            }), 400
        
        model_info = allowed_models[model_name]
        logger.info(f"Model validation successful for '{model_name}'")
        
        # Return model as valid since it's in the JSON (no proxy validation)
        return jsonify({
            'valid': True,
            'model_info': model_info,
            'note': 'Model found in configuration - validation at deployment time'
        })
    
    except Exception as e:
        logger.error(f"Error validating model: {str(e)}")
        return jsonify({'error': 'Internal server error'}), 500

# Removed proxy validation functions - models are curated at deployment time via JSON

# Removed complex validation endpoint - frontend will handle validation via diagram rendering

def validate_origin(request):
    """Validate request origin for security"""
    origin = request.headers.get('Origin', '')
    referer = request.headers.get('Referer', '')
    allowed_origins = [
        f"https://{HOSTNAME}:{HTTPS_PORT}",
        f"https://{HOSTNAME}",
        "https://localhost",
        "https://127.0.0.1",
    ]
    if origin and not any(origin.startswith(allowed) for allowed in allowed_origins):
        logger.warning(f"Rejected request from origin: {origin}. Allowed origins: {allowed_origins}")
        return False
    return True

@app.errorhandler(429)
def ratelimit_handler(e):
    return jsonify({'error': 'Rate limit exceeded. Please wait before sending another request.'}), 429

@app.route('/api/ai-assist', methods=['POST'])
@limiter.limit("10/minute")
def ai_assist():
    """AI Assistant API proxy endpoint"""
    try:
        # Security checks
        if not validate_origin(request):
            return jsonify({'error': 'Unauthorized origin'}), 403
        
        if not DEFAULT_AI_CONFIG['enabled']:
            return jsonify({'error': 'AI Assistant is disabled'}), 503
        
        # Check request size
        if request.content_length and request.content_length > MAX_REQUEST_SIZE:
            return jsonify({'error': 'Request too large'}), 413
        
        # Parse request data
        try:
            data = request.get_json(force=True)
        except Exception as e:
            logger.error(f"Invalid JSON in request: {e}")
            return jsonify({'error': 'Invalid JSON'}), 400
        
        if not data or 'messages' not in data:
            return jsonify({'error': 'Missing messages in request'}), 400
        
        # Extract configuration from request or use defaults
        config = data.get('config', {})
        model = data.get('model', DEFAULT_AI_CONFIG['model'])  # Get model from top-level, not from config
        timeout = config.get('timeout', DEFAULT_AI_CONFIG['timeout'])
        
        # Validate model against allowed models from JSON to prevent model injection
        if model:
            # Build a flat list of all allowed models from the JSON configuration
            allowed_models = []
            for provider_models in AVAILABLE_MODELS.values():
                allowed_models.extend(provider_models.keys())
            
            # Check if the requested model is in our allowed list
            if model not in allowed_models:
                logger.warning(f"Model injection attempt detected: '{model}' not in allowed models list. Request from: {request.remote_addr}")
                return jsonify({'error': f'Model "{model}" is not supported. Please select from available models.'}), 400
            
            logger.info(f"Validated model '{model}' against allowed models list")
        else:
            # If no model provided, use default (which should also be validated)
            if DEFAULT_AI_CONFIG['model'] not in [model_id for provider_models in AVAILABLE_MODELS.values() for model_id in provider_models.keys()]:
                logger.error(f"Default model '{DEFAULT_AI_CONFIG['model']}' is not in allowed models list")
                return jsonify({'error': 'Server configuration error: default model not supported'}), 500
        
        # Use backend proxy by default, allow user config override
        use_custom_api = config.get('use_custom_api', False)
        
        if use_custom_api and config.get('endpoint') and config.get('api_key'):
            # Use user-provided direct API configuration
            endpoint = config.get('endpoint')
            api_key = config.get('api_key')
            logger.info(f"Using user-configured direct API: {endpoint}")
        else:
            # Use backend proxy (default, recommended)
            endpoint = f"{AI_PROXY_URL}/chat/completions"
            api_key = AI_PROXY_API_KEY
            
            if not api_key:
                return jsonify({'error': 'Backend proxy API key not configured'}), 400
            
            logger.info(f"Using backend proxy: {endpoint}")
        
        headers = {
            'Content-Type': 'application/json',
            'Authorization': f'Bearer {api_key}'
        }
        
        # Prepare payload for AI API
        # Newer OpenAI/Azure models require max_completion_tokens instead of max_tokens
        max_tokens_value = data.get('max_tokens', AI_MAX_TOKENS)
        token_param = 'max_completion_tokens' if model.startswith(('azure/', 'openai/')) else 'max_tokens'
        ai_payload = {
            'model': model,
            'messages': data['messages'],
            token_param: max_tokens_value,
            'temperature': data.get('temperature', 0.7)
        }
        
        logger.info(f"Proxying AI request to {endpoint} with model {model}")

        # Handle streaming responses
        if data.get('stream'):
            ai_payload['stream'] = True
            start_time = time.time()
            resp = requests.post(
                endpoint,
                headers=headers,
                json=ai_payload,
                stream=True,
                timeout=timeout
            )

            if resp.status_code != 200:
                error_msg = f"AI API error: {resp.status_code}"
                try:
                    error_data = resp.json()
                    if 'error' in error_data:
                        error_msg = error_data['error'].get('message', error_msg)
                except:
                    error_msg = resp.text or error_msg
                logger.error(f"AI API streaming error: {error_msg}")
                return jsonify({'error': error_msg}), resp.status_code

            def generate():
                for line in resp.iter_lines():
                    if line:
                        yield line.decode('utf-8') + '\n'
                logger.info(f"AI API streaming completed in {time.time() - start_time:.2f}s")

            return Response(stream_with_context(generate()), content_type='text/event-stream')

        # Non-streaming response
        start_time = time.time()
        response = requests.post(
            endpoint,
            headers=headers,
            json=ai_payload,
            timeout=timeout
        )

        response_time = time.time() - start_time
        logger.info(f"AI API response received in {response_time:.2f}s, status: {response.status_code}")

        # Handle response
        if response.status_code == 200:
            ai_response = response.json()
            return jsonify(ai_response)
        else:
            error_msg = f"AI API error: {response.status_code}"
            try:
                error_data = response.json()
                if 'error' in error_data:
                    error_msg = error_data['error'].get('message', error_msg)
            except:
                error_msg = response.text or error_msg

            logger.error(f"AI API error: {error_msg}")
            return jsonify({'error': error_msg}), response.status_code
    
    except requests.exceptions.Timeout:
        logger.error("AI API request timeout")
        return jsonify({'error': 'Request timeout'}), 504
    
    except requests.exceptions.ConnectionError:
        logger.error("Failed to connect to AI API")
        return jsonify({'error': 'Failed to connect to AI service'}), 503
    
    except Exception as e:
        logger.error(f"Unexpected error in AI assist: {e}")
        return jsonify({'error': 'Internal server error'}), 500

@app.route('/api/config', methods=['GET'])
def get_config():
    """Get server AI and Draw.io configuration (without sensitive data)"""
    config = {
        'ai': {
            'enabled': DEFAULT_AI_CONFIG['enabled'],
            'has_api_key': bool(DEFAULT_AI_CONFIG['api_key']),
            'model': DEFAULT_AI_CONFIG['model'],
            'timeout': DEFAULT_AI_CONFIG['timeout']
        },
        'drawio': {
            'server_url': os.environ.get('DRAWIO_SERVER_URL', 'https://embed.diagrams.net/')
        },
        'kroki': {
            'maxBodySize': KROKI_MAX_BODY_SIZE
        }
    }
    return jsonify(config)

@app.route('/api/health', methods=['GET'])
def health_check():
    """Health check endpoint"""
    return jsonify({
        'status': 'healthy',
        'timestamp': datetime.utcnow().isoformat(),
        'ai_enabled': DEFAULT_AI_CONFIG['enabled']
    })

@app.route('/api/version', methods=['GET'])
def get_version():
    """Get version and system information"""
    try:
        if not validate_origin(request):
            return jsonify({'error': 'Unauthorized origin'}), 403
        
        return jsonify({
            'version': os.environ.get('VERSION', '1.0.0'),
            'name': 'DocCode - The Kroki Server Frontend',
            'description': 'A comprehensive interactive frontend for Kroki diagram rendering server with AI assistance',
            'build_date': os.environ.get('BUILD_DATE', '2025-06-19'),
            'author': os.environ.get('AUTHOR_NAME', 'Vysakh Pillai'),
            'features': [
                'Interactive diagram editor',
                'AI-powered diagram assistance',
                'Multiple output formats (SVG, PNG, PDF)',
                'Real-time preview',
                'File operations with auto-reload',
                'POST API support for large diagrams',
                'Comprehensive settings management'
            ],
            'server_info': {
                'hostname': HOSTNAME,
                'port': PORT,
                'https_port': HTTPS_PORT,
                'ai_enabled': DEFAULT_AI_CONFIG['enabled'],
                'ai_model': DEFAULT_AI_CONFIG['model'] if DEFAULT_AI_CONFIG['enabled'] else None
            }
        })
    except Exception as e:
        logger.error(f"Error getting version info: {str(e)}")
        return jsonify({'error': 'Internal server error'}), 500

# Static file routes
@app.route('/')
def index():
    """Serve the main index.html file"""
    return send_file(os.path.join(STATIC_ROOT, 'index.html'))

@app.route('/favicon.ico')
def favicon():
    """Serve favicon"""
    return send_file(os.path.join(STATIC_ROOT, 'favicon.ico'))

@app.route('/<path:filename>')
def static_files(filename):
    """Serve static files"""
    try:
        return send_from_directory(STATIC_ROOT, filename)
    except FileNotFoundError:
        logger.warning(f"File not found: {filename}")
        return "File not found", 404

if __name__ == '__main__':
    logger.info(f"Starting Kroki Demo Site Server on port {PORT}")
    logger.info(f"Static files served from: {STATIC_ROOT}")
    logger.info(f"AI Assistant enabled: {DEFAULT_AI_CONFIG['enabled']}")
    model_count = sum(len(models) for models in AVAILABLE_MODELS.values())
    logger.info(f"Available AI models: {model_count} across {len(AVAILABLE_MODELS)} providers")

    # Run the Flask app
    app.run(
        host='0.0.0.0',
        port=PORT,
        debug=False,
        threaded=True
    )
