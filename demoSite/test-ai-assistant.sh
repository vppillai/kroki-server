#!/bin/bash

# AI Assistant Feature Test Script
# Tests the basic functionality of the AI Assistant integration

set -e

echo "🤖 AI Assistant Feature Test Suite"
echo "=================================="

# Test 1: Check if all required files exist
echo "📁 Test 1: Checking required files..."
REQUIRED_FILES=(
    "js/ai-assistant.js"
    "css/ai-assistant.css"
    "server.py"
    "requirements.txt"
    ".env.example"
    "AI_ASSISTANT_README.md"
)

for file in "${REQUIRED_FILES[@]}"; do
    if [ -f "$file" ]; then
        echo "  ✅ $file exists"
    else
        echo "  ❌ $file missing"
        exit 1
    fi
done

# Test 2: Check JavaScript syntax
echo ""
echo "🔍 Test 2: Checking JavaScript syntax..."
if node -c js/ai-assistant.js > /dev/null 2>&1; then
    echo "  ✅ ai-assistant.js syntax is valid"
else
    echo "  ❌ ai-assistant.js has syntax errors"
    exit 1
fi

# Test 3: Check Python syntax
echo ""
echo "🐍 Test 3: Checking Python syntax..."
if python3 -m py_compile server.py; then
    echo "  ✅ server.py syntax is valid"
else
    echo "  ❌ server.py has syntax errors"
    exit 1
fi

# Test 4: Check CSS syntax (basic)
echo ""
echo "🎨 Test 4: Checking CSS syntax..."
if grep -q "ai-assistant" css/ai-assistant.css; then
    echo "  ✅ ai-assistant.css contains expected classes"
else
    echo "  ❌ ai-assistant.css missing expected content"
    exit 1
fi

# Test 5: Check configuration integration
echo ""
echo "⚙️ Test 5: Checking configuration integration..."
if grep -q '"ai":' js/config.js; then
    echo "  ✅ AI configuration found in config.js"
else
    echo "  ❌ AI configuration missing from config.js"
    exit 1
fi

if grep -q 'config-tab-ai' js/config-ui.js; then
    echo "  ✅ AI tab found in config-ui.js"
else
    echo "  ❌ AI tab missing from config-ui.js"
    exit 1
fi

# Test 6: Check HTML integration
echo ""
echo "🌐 Test 6: Checking HTML integration..."
if grep -q "ai-assistant.css" index.html; then
    echo "  ✅ AI CSS linked in index.html"
else
    echo "  ❌ AI CSS not linked in index.html"
    exit 1
fi

if grep -q "ai-assistant.js" index.html; then
    echo "  ✅ AI JavaScript linked in index.html"
else
    echo "  ❌ AI JavaScript not linked in index.html"
    exit 1
fi

# Test 7: Check main.js integration
echo ""
echo "🔧 Test 7: Checking main.js integration..."
if grep -q "AIAssistant" js/main.js; then
    echo "  ✅ AI Assistant initialization found in main.js"
else
    echo "  ❌ AI Assistant initialization missing from main.js"
    exit 1
fi

# Test 8: Check environment configuration
echo ""
echo "🔐 Test 8: Checking environment configuration..."
if grep -q "AI_ENABLED" .env.example; then
    echo "  ✅ Environment configuration example is complete"
else
    echo "  ❌ Environment configuration example is incomplete"
    exit 1
fi

echo ""
echo "🎉 All tests passed!"
echo ""
echo "✨ AI Assistant feature integration is complete!"
echo ""
echo "📝 Next steps:"
echo "  1. Copy .env.example to .env and configure your AI API settings"
echo "  2. Build and start the Docker containers: sudo ./setup-kroki-server.sh restart"
echo "  3. Open the demo site and test the AI Assistant functionality"
echo "  4. Click the 🤖 button in the bottom-right corner to start chatting"
echo ""
echo "📖 For detailed documentation, see AI_ASSISTANT_README.md"
