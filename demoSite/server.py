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
from flask import Flask, request, jsonify, send_from_directory, send_file
from flask_cors import CORS
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

# Configuration
PORT = int(os.environ.get('PORT', 8006))
HTTPS_PORT = int(os.environ.get('HTTPS_PORT', 8443))
HOSTNAME = os.environ.get('HOSTNAME', 'localhost')
STATIC_ROOT = os.environ.get('STATIC_ROOT', '/app')
AI_TIMEOUT = 30  # Default timeout for AI API requests
MAX_REQUEST_SIZE = 1024 * 1024  # 1MB limit for AI requests

# Default AI configuration - can be overridden by environment variables
DEFAULT_AI_CONFIG = {
    'endpoint': os.environ.get('AI_ENDPOINT', 'https://api.openai.com/v1/chat/completions'),
    'api_key': os.environ.get('AI_API_KEY', ''),
    'model': os.environ.get('AI_MODEL', 'gpt-4o'),
    'timeout': int(os.environ.get('AI_TIMEOUT', AI_TIMEOUT)),
    'enabled': os.environ.get('AI_ENABLED', 'true').lower() == 'true'
}

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

@app.route('/api/ai-assist', methods=['POST'])
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
        endpoint = config.get('endpoint', DEFAULT_AI_CONFIG['endpoint'])
        api_key = config.get('api_key', DEFAULT_AI_CONFIG['api_key'])
        model = config.get('model', DEFAULT_AI_CONFIG['model'])
        timeout = config.get('timeout', DEFAULT_AI_CONFIG['timeout'])
        
        if not api_key:
            return jsonify({'error': 'API key not configured'}), 400
        
        if not endpoint:
            return jsonify({'error': 'AI endpoint not configured'}), 400
        
        # Prepare headers for AI API request
        headers = {
            'Content-Type': 'application/json',
            'Authorization': f'Bearer {api_key}'
        }
        
        # Prepare payload for AI API
        ai_payload = {
            'model': model,
            'messages': data['messages'],
            'max_tokens': data.get('max_tokens', 2000),
            'temperature': data.get('temperature', 0.7)
        }
        
        # Add any additional parameters
        if 'stream' in data:
            ai_payload['stream'] = data['stream']
        
        logger.info(f"Proxying AI request to {endpoint} with model {model}")
        
        # Make request to AI API
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
    """Get server AI configuration (without sensitive data)"""
    config = {
        'ai': {
            'enabled': DEFAULT_AI_CONFIG['enabled'],
            'has_api_key': bool(DEFAULT_AI_CONFIG['api_key']),
            'model': DEFAULT_AI_CONFIG['model'],
            'timeout': DEFAULT_AI_CONFIG['timeout']
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
    
    # Run the Flask app
    app.run(
        host='0.0.0.0',
        port=PORT,
        debug=False,
        threaded=True
    )
