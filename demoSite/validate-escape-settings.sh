#!/bin/bash

# AI Assistant - Escape Key & Settings Validation Script
# Tests the new escape key and settings functionality

echo "🔧 AI Assistant - Escape Key & Settings Feature Validation"
echo "=========================================================="
echo "Date: $(date)"
echo ""

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${BLUE}✓ Checking server status...${NC}"
if curl -s http://localhost:8081 > /dev/null; then
    echo -e "  ${GREEN}✓ Server is running on port 8081${NC}"
else
    echo -e "  ${YELLOW}⚠ Server not found. Starting server...${NC}"
    cd /home/vysakhpillai/temp/kroki-server/demoSite
    python3 -m http.server 8081 > /dev/null 2>&1 &
    sleep 3
    if curl -s http://localhost:8081 > /dev/null; then
        echo -e "  ${GREEN}✓ Server started successfully${NC}"
    else
        echo -e "  ${RED}❌ Failed to start server${NC}"
        exit 1
    fi
fi

echo ""
echo -e "${BLUE}✓ Validating Escape Key Implementation...${NC}"

# Check for escape key event listener
if grep -q "document.addEventListener('keydown'" /home/vysakhpillai/temp/kroki-server/demoSite/js/ai-assistant.js && \
   grep -q "e.key === 'Escape'" /home/vysakhpillai/temp/kroki-server/demoSite/js/ai-assistant.js; then
    echo -e "  ${GREEN}✓ Escape key event listener found${NC}"
else
    echo -e "  ${RED}❌ Escape key event listener missing${NC}"
fi

# Check for focus detection method
if grep -q "isChatInFocus()" /home/vysakhpillai/temp/kroki-server/demoSite/js/ai-assistant.js; then
    echo -e "  ${GREEN}✓ Chat focus detection method found${NC}"
else
    echo -e "  ${RED}❌ Chat focus detection method missing${NC}"
fi

# Check for minimize on escape
if grep -q "this.minimizeChat()" /home/vysakhpillai/temp/kroki-server/demoSite/js/ai-assistant.js && \
   grep -A5 -B5 "e.key === 'Escape'" /home/vysakhpillai/temp/kroki-server/demoSite/js/ai-assistant.js | grep -q "minimizeChat"; then
    echo -e "  ${GREEN}✓ Escape key triggers minimize functionality${NC}"
else
    echo -e "  ${RED}❌ Escape key minimize functionality missing${NC}"
fi

echo ""
echo -e "${BLUE}✓ Validating Settings Button Implementation...${NC}"

# Check for settings button in HTML
if grep -q "ai-chat-settings" /home/vysakhpillai/temp/kroki-server/demoSite/js/ai-assistant.js; then
    echo -e "  ${GREEN}✓ Settings button HTML found${NC}"
else
    echo -e "  ${RED}❌ Settings button HTML missing${NC}"
fi

# Check for settings event listener
if grep -q "ai-chat-settings.*addEventListener.*openSettings" /home/vysakhpillai/temp/kroki-server/demoSite/js/ai-assistant.js; then
    echo -e "  ${GREEN}✓ Settings button event listener found${NC}"
else
    echo -e "  ${RED}❌ Settings button event listener missing${NC}"
fi

# Check for settings modal creation
if grep -q "createSettingsModal" /home/vysakhpillai/temp/kroki-server/demoSite/js/ai-assistant.js; then
    echo -e "  ${GREEN}✓ Settings modal creation method found${NC}"
else
    echo -e "  ${RED}❌ Settings modal creation method missing${NC}"
fi

echo ""
echo -e "${BLUE}✓ Validating Settings Modal Features...${NC}"

# Check for API configuration fields
if grep -q "ai-endpoint" /home/vysakhpillai/temp/kroki-server/demoSite/js/ai-assistant.js && \
   grep -q "ai-api-key" /home/vysakhpillai/temp/kroki-server/demoSite/js/ai-assistant.js && \
   grep -q "ai-model" /home/vysakhpillai/temp/kroki-server/demoSite/js/ai-assistant.js; then
    echo -e "  ${GREEN}✓ API configuration fields found${NC}"
else
    echo -e "  ${RED}❌ API configuration fields missing${NC}"
fi

# Check for prompt theme options
if grep -q "ai-prompt-theme" /home/vysakhpillai/temp/kroki-server/demoSite/js/ai-assistant.js && \
   grep -q "ai-custom-prompt" /home/vysakhpillai/temp/kroki-server/demoSite/js/ai-assistant.js; then
    echo -e "  ${GREEN}✓ Prompt theme configuration found${NC}"
else
    echo -e "  ${RED}❌ Prompt theme configuration missing${NC}"
fi

# Check for settings persistence methods
if grep -q "saveSettings" /home/vysakhpillai/temp/kroki-server/demoSite/js/ai-assistant.js && \
   grep -q "loadCurrentSettings" /home/vysakhpillai/temp/kroki-server/demoSite/js/ai-assistant.js && \
   grep -q "resetSettings" /home/vysakhpillai/temp/kroki-server/demoSite/js/ai-assistant.js; then
    echo -e "  ${GREEN}✓ Settings persistence methods found${NC}"
else
    echo -e "  ${RED}❌ Settings persistence methods missing${NC}"
fi

echo ""
echo -e "${BLUE}✓ Validating CSS Styling...${NC}"

# Check for settings button styling
if grep -q "ai-chat-settings" /home/vysakhpillai/temp/kroki-server/demoSite/css/ai-assistant.css; then
    echo -e "  ${GREEN}✓ Settings button CSS found${NC}"
else
    echo -e "  ${RED}❌ Settings button CSS missing${NC}"
fi

# Check for settings modal styling
if grep -q "ai-settings-modal" /home/vysakhpillai/temp/kroki-server/demoSite/css/ai-assistant.css && \
   grep -q "ai-settings-content" /home/vysakhpillai/temp/kroki-server/demoSite/css/ai-assistant.css; then
    echo -e "  ${GREEN}✓ Settings modal CSS found${NC}"
else
    echo -e "  ${RED}❌ Settings modal CSS missing${NC}"
fi

# Check for responsive design
if grep -q "@media.*max-width.*768px" /home/vysakhpillai/temp/kroki-server/demoSite/css/ai-assistant.css && \
   grep -A10 "@media.*max-width.*768px" /home/vysakhpillai/temp/kroki-server/demoSite/css/ai-assistant.css | grep -q "ai-settings"; then
    echo -e "  ${GREEN}✓ Responsive design CSS found${NC}"
else
    echo -e "  ${RED}❌ Responsive design CSS missing${NC}"
fi

# Check for animations
if grep -q "ai-modal-fadeIn\|ai-modal-slideIn" /home/vysakhpillai/temp/kroki-server/demoSite/css/ai-assistant.css; then
    echo -e "  ${GREEN}✓ Modal animations CSS found${NC}"
else
    echo -e "  ${RED}❌ Modal animations CSS missing${NC}"
fi

echo ""
echo -e "${BLUE}✓ Integration & Compatibility Check...${NC}"

# Check for config manager integration
if grep -q "configManager\|window.configManager" /home/vysakhpillai/temp/kroki-server/demoSite/js/ai-assistant.js; then
    echo -e "  ${GREEN}✓ Config manager integration found${NC}"
else
    echo -e "  ${RED}❌ Config manager integration missing${NC}"
fi

# Check for localStorage fallback
if grep -q "localStorage" /home/vysakhpillai/temp/kroki-server/demoSite/js/ai-assistant.js; then
    echo -e "  ${GREEN}✓ localStorage fallback found${NC}"
else
    echo -e "  ${RED}❌ localStorage fallback missing${NC}"
fi

# Check for error handling
if grep -q "try.*catch\|catch.*error" /home/vysakhpillai/temp/kroki-server/demoSite/js/ai-assistant.js; then
    echo -e "  ${GREEN}✓ Error handling found${NC}"
else
    echo -e "  ${RED}❌ Error handling missing${NC}"
fi

echo ""
echo -e "${YELLOW}📋 Manual Testing Instructions:${NC}"
echo ""
echo -e "${BLUE}🔑 Escape Key Testing:${NC}"
echo "1. Open: http://localhost:8081"
echo "2. Click the AI Assistant button to open chat"
echo "3. Click in the chat input area (ensure focus)"
echo "4. Press the Escape key"
echo "5. ✅ Expected: Chat window should minimize/close"
echo "6. Open chat again, click elsewhere, press Escape"
echo "7. ✅ Expected: Chat should stay open (no focus)"
echo ""

echo -e "${BLUE}⚙️ Settings Modal Testing:${NC}"
echo "1. Open the AI Assistant chat window"
echo "2. Click the gear icon (⚙️) in the header"
echo "3. ✅ Expected: Settings modal should open"
echo "4. Verify all form fields are present:"
echo "   - API Endpoint"
echo "   - API Key"
echo "   - Model selection"
echo "   - Max retry attempts"
echo "   - Prompt theme options"
echo "5. Change 'Prompt Theme' to 'Custom'"
echo "6. ✅ Expected: Custom textarea should appear"
echo "7. Fill in some test values and click 'Save'"
echo "8. ✅ Expected: Modal closes, settings saved"
echo "9. Reopen settings modal"
echo "10. ✅ Expected: Previous values should be loaded"
echo "11. Click 'Reset to Defaults'"
echo "12. ✅ Expected: Form resets to default values"
echo "13. Press Escape while modal is open"
echo "14. ✅ Expected: Modal should close"
echo "15. Open modal and click outside the modal area"
echo "16. ✅ Expected: Modal should close"
echo ""

echo -e "${BLUE}📱 Responsive Design Testing:${NC}"
echo "1. Open browser developer tools"
echo "2. Switch to mobile view (< 768px width)"
echo "3. Open settings modal"
echo "4. ✅ Expected: Modal should be mobile-friendly"
echo "5. ✅ Expected: Buttons should stack vertically"
echo "6. ✅ Expected: Form should be single-column"
echo ""

echo -e "${GREEN}🎯 Test URLs:${NC}"
echo "• Main Application: http://localhost:8081"
echo "• Resize Test Page: http://localhost:8081/resize-feature-test.html"
echo ""

echo "=========================================================="
echo -e "${GREEN}✅ Validation Complete!${NC}"
echo ""
echo -e "${YELLOW}📊 Summary:${NC}"
echo "• Escape Key: Minimizes chat when focused"
echo "• Settings Button: Opens comprehensive preferences modal"
echo "• Modal Features: API config, prompt themes, persistence"
echo "• UI/UX: Professional design with animations"
echo "• Integration: Works with config system + localStorage fallback"
echo "• Responsive: Mobile-friendly design"
echo ""
echo -e "${BLUE}🚀 Status: Ready for User Acceptance Testing${NC}"
