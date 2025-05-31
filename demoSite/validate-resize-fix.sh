#!/bin/bash

# Resize Feature Validation Script
# Tests the immediate textarea resize behavior

echo "=== AI Assistant Resize Feature Validation ==="
echo "Date: $(date)"
echo ""

echo "✓ Checking for server running on port 8081..."
if curl -s http://localhost:8081 > /dev/null; then
    echo "  ✓ Server is running"
else
    echo "  ❌ Server not found. Starting server..."
    cd /home/vysakhpillai/temp/kroki-server/demoSite
    python3 -m http.server 8081 &
    sleep 2
    echo "  ✓ Server started"
fi

echo ""
echo "✓ Checking file modifications..."

# Check if resize functionality is implemented
if grep -q "textareaHeight.*Math.max.*Math.min.*textareaAvailableHeight" /home/vysakhpillai/temp/kroki-server/demoSite/js/ai-assistant.js; then
    echo "  ✓ Immediate textarea resize logic found in resize() method"
else
    echo "  ❌ Immediate textarea resize logic missing"
fi

if grep -q "containerHeight.*offsetHeight" /home/vysakhpillai/temp/kroki-server/demoSite/js/ai-assistant.js; then
    echo "  ✓ Container height detection found in autoResizeInput() method"
else
    echo "  ❌ Container height detection missing"
fi

if grep -q "maxAllowedHeight.*containerHeight.*wrapperPadding" /home/vysakhpillai/temp/kroki-server/demoSite/js/ai-assistant.js; then
    echo "  ✓ Dynamic height calculation found"
else
    echo "  ❌ Dynamic height calculation missing"
fi

echo ""
echo "✓ Checking CSS resize handle..."
if grep -q ".ai-chat-resize-handle" /home/vysakhpillai/temp/kroki-server/demoSite/css/ai-assistant.css; then
    echo "  ✓ Resize handle CSS found"
else
    echo "  ❌ Resize handle CSS missing"
fi

echo ""
echo "=== Test URLs ==="
echo "Main Application: http://localhost:8081"
echo "Resize Test Page: http://localhost:8081/resize-feature-test.html"
echo ""
echo "=== Manual Test Instructions ==="
echo "1. Open the AI Assistant chat window"
echo "2. Look for the blue resize handle at the top of the input area"
echo "3. Drag the handle up or down"
echo "4. ✓ EXPECTED: Textarea should immediately resize as you drag"
echo "5. ✓ EXPECTED: Textarea should NOT wait for content to be typed"
echo "6. Type some text to verify auto-resize still works within the new limits"
echo ""
echo "=== Validation Complete ==="
