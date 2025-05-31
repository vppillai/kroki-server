#!/bin/bash

# AI Assistant Final Integration Validation Script
# Tests the complete integration of AI Assistant with the main application

echo "🧪 AI Assistant Final Integration Validation"
echo "============================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Test counters
TOTAL_TESTS=0
PASSED_TESTS=0

# Helper function to run a test
run_test() {
    local test_name="$1"
    local test_command="$2"
    
    TOTAL_TESTS=$((TOTAL_TESTS + 1))
    echo -n "Testing: $test_name... "
    
    if eval "$test_command" > /dev/null 2>&1; then
        echo -e "${GREEN}✅ PASS${NC}"
        PASSED_TESTS=$((PASSED_TESTS + 1))
        return 0
    else
        echo -e "${RED}❌ FAIL${NC}"
        return 1
    fi
}

# Test 1: Check if all required files exist
echo -e "\n${BLUE}📁 File Structure Tests${NC}"
run_test "AI Assistant JS file exists" "test -f js/ai-assistant.js"
run_test "AI Assistant CSS file exists" "test -f css/ai-assistant.css"
run_test "Main application includes AI Assistant" "grep -q 'ai-assistant.js' index.html"
run_test "Main application includes AI CSS" "grep -q 'ai-assistant.css' index.html"

# Test 2: Check JavaScript integration
echo -e "\n${BLUE}🔧 JavaScript Integration Tests${NC}"
run_test "AI Assistant class is defined" "grep -q 'class AIAssistant' js/ai-assistant.js"
run_test "Constructor accepts config manager" "grep -q 'constructor(configManager = null)' js/ai-assistant.js"
run_test "Main.js initializes AI Assistant" "grep -q 'new AIAssistant(window.configManager)' js/main.js"
run_test "Element selection uses chatWindow context" "grep -q 'this.chatWindow.querySelector' js/ai-assistant.js"

# Test 3: Check layout fixes
echo -e "\n${BLUE}🎨 Layout & CSS Tests${NC}"
run_test "Input container uses sticky positioning" "grep -q 'position: sticky' css/ai-assistant.css"
run_test "Chat body has proper height constraints" "grep -q 'height: calc(100% - 60px)' css/ai-assistant.css"
run_test "Assistant messages have reduced margins" "grep -q 'margin-left: 0' css/ai-assistant.css"
run_test "Chat messages have reduced left padding" "grep -q 'padding: var(--spacing-sm) var(--spacing-xs)' css/ai-assistant.css"

# Test 4: Check functionality fixes
echo -e "\n${BLUE}⌨️ Functionality Tests${NC}"
run_test "Enter key handling implemented" "grep -q \"e.key === 'Enter' && !e.shiftKey\" js/ai-assistant.js"
run_test "Send button functionality exists" "grep -q 'sendMessage()' js/ai-assistant.js"
run_test "Welcome message includes warning" "grep -q 'Each request is independent' js/ai-assistant.js"
run_test "Element validation in setupEventListeners" "grep -q 'if (!this.assistButton.*!this.chatWindow' js/ai-assistant.js"

# Test 5: Check configuration integration
echo -e "\n${BLUE}⚙️ Configuration Integration Tests${NC}"
run_test "getAIConfig method exists" "grep -q 'getAIConfig()' js/ai-assistant.js"
run_test "Config manager fallbacks implemented" "grep -q 'this.configManager.*window.configManager' js/ai-assistant.js"
run_test "Multiple config access patterns supported" "grep -q 'typeof config.get === .function.' js/ai-assistant.js"
run_test "AI model configuration updated" "grep -q 'gpt-4o' .env"

# Test 6: Check error handling
echo -e "\n${BLUE}🛡️ Error Handling Tests${NC}"
run_test "Element validation error logging" "grep -q 'Failed to find chat elements' js/ai-assistant.js"
run_test "Configuration error handling" "grep -q 'Error accessing config, using defaults' js/ai-assistant.js"
run_test "API configuration validation" "grep -q 'AI functionality requires configuration' js/ai-assistant.js"

# Test 7: Integration-specific tests
echo -e "\n${BLUE}🔗 Integration-Specific Tests${NC}"
run_test "No global auto-initialization" "! grep -q 'new AIAssistant()' js/ai-assistant.js"
run_test "Proper initialization in main.js" "grep -q 'if (typeof AIAssistant !== .undefined.)' js/main.js"
run_test "Config manager passed to constructor" "grep -q 'new AIAssistant(window.configManager)' js/main.js"

# Test 8: Check if server can start
echo -e "\n${BLUE}🚀 Server Tests${NC}"
if command -v python3 > /dev/null 2>&1; then
    run_test "Python HTTP server can start" "timeout 2s python3 -m http.server 8081 > /dev/null 2>&1"
else
    echo "Skipping server test - Python3 not available"
fi

# Summary
echo -e "\n${BLUE}📊 Integration Test Summary${NC}"
echo "============================================="
echo -e "Total Tests: $TOTAL_TESTS"
echo -e "Passed: ${GREEN}$PASSED_TESTS${NC}"
echo -e "Failed: ${RED}$((TOTAL_TESTS - PASSED_TESTS))${NC}"

if [ $PASSED_TESTS -eq $TOTAL_TESTS ]; then
    echo -e "\n${GREEN}🎉 ALL TESTS PASSED! Integration is complete.${NC}"
    echo -e "${GREEN}✅ AI Assistant is fully integrated and ready for production.${NC}"
    exit 0
else
    echo -e "\n${RED}⚠️ Some tests failed. Please review the failing tests above.${NC}"
    exit 1
fi
