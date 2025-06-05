/**
 * Search Functionality Module
 * 
 * Provides text search capabilities within the code editor with
 * real-time highlighting, navigation, and case-sensitive options.
 * 
 * @author Vysakh Pillai
 */

import { state, updateSearchState } from './state.js';
import { escapeHtml } from './utils.js';

/**
 * Show search bar and focus on search input
 * @public
 */
export function showSearchBar() {
    const searchBar = document.getElementById('search-bar');
    const searchInput = document.getElementById('search-input');

    if (!searchBar || !searchInput) {
        console.warn('Search bar elements not found');
        return;
    }

    updateSearchState({ isVisible: true });
    searchBar.style.display = 'flex';
    searchInput.focus();
    searchInput.select();

    // If there's already text in the input, search immediately
    if (searchInput.value.trim()) {
        performSearch(searchInput.value);
    }
}

/**
 * Hide search bar and clear highlights
 * @public
 */
export function hideSearchBar() {
    const searchBar = document.getElementById('search-bar');
    if (!searchBar) return;

    updateSearchState({ isVisible: false });
    searchBar.style.display = 'none';
    clearSearchHighlights();

    // Return focus to code textarea
    const codeTextarea = document.getElementById('code');
    if (codeTextarea) {
        codeTextarea.focus();
    }
}

/**
 * Perform search in code textarea and update results
 * @public
 * @param {string} query - Search query string
 */
export function performSearch(query) {
    const codeTextarea = document.getElementById('code');
    if (!codeTextarea || !query) {
        clearSearchHighlights();
        updateSearchCount(0, 0);
        return;
    }

    updateSearchState({ currentQuery: query });
    const text = codeTextarea.value;
    const flags = state.searchState.caseSensitive ? 'g' : 'gi';

    try {
        // Escape special regex characters in the query
        const escapedQuery = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const regex = new RegExp(escapedQuery, flags);
        const matches = [];
        let match;

        while ((match = regex.exec(text)) !== null) {
            matches.push({
                index: match.index,
                length: match[0].length,
                text: match[0]
            });
        }

        updateSearchState({ matches });

        if (matches.length > 0) {
            // If we don't have a current index or query changed, start from the beginning
            if (state.searchState.currentIndex === -1 || state.searchState.lastSearchValue !== query) {
                updateSearchState({ currentIndex: 0 });
            }

            // Ensure current index is within bounds
            if (state.searchState.currentIndex >= matches.length) {
                updateSearchState({ currentIndex: 0 });
            }

            highlightSearchResults();
            scrollToCurrentMatch();
        } else {
            updateSearchState({ currentIndex: -1 });
            clearSearchHighlights();
        }

        updateSearchState({ lastSearchValue: query });
        updateSearchCount(state.searchState.currentIndex + 1, matches.length);
        updateSearchButtons();

    } catch (error) {
        // Invalid regex, clear results
        clearSearchHighlights();
        updateSearchCount(0, 0);
        console.warn('Invalid search pattern:', error);
    }
}

/**
 * Clear all search highlights and reset selection
 * @public
 */
export function clearSearchHighlights() {
    // Clear any selection in the textarea
    const codeTextarea = document.getElementById('code');
    if (codeTextarea) {
        codeTextarea.setSelectionRange(0, 0);
    }

    // Clear the overlay
    const overlay = document.getElementById('search-highlight-overlay');
    if (overlay) {
        overlay.innerHTML = '';
    }
}

/**
 * Highlight search results with overlay spans
 * @public
 */
export function highlightSearchResults() {
    const codeTextarea = document.getElementById('code');
    const overlay = document.getElementById('search-highlight-overlay');

    if (!codeTextarea || !overlay) {
        console.warn('Search highlighting: Missing textarea or overlay element');
        return;
    }

    if (state.searchState.matches.length === 0) {
        clearSearchHighlights();
        return;
    }

    try {
        const text = codeTextarea.value;
        let highlightedHTML = '';
        let lastIndex = 0;

        // Process each match and create highlighted spans
        state.searchState.matches.forEach((match, index) => {
            // Add text before this match (escaped)
            const beforeMatch = text.substring(lastIndex, match.index);
            highlightedHTML += escapeHtml(beforeMatch);

            // Add the highlighted match
            const isCurrent = index === state.searchState.currentIndex;
            const matchText = text.substring(match.index, match.index + match.length);
            const highlightClass = isCurrent ? 'search-highlight current' : 'search-highlight';
            highlightedHTML += `<span class="${highlightClass}">${escapeHtml(matchText)}</span>`;

            lastIndex = match.index + match.length;
        });

        // Add remaining text after last match
        if (lastIndex < text.length) {
            highlightedHTML += escapeHtml(text.substring(lastIndex));
        }

        // Set the overlay content
        overlay.innerHTML = highlightedHTML;

        // Force exact style matching
        const textareaStyles = window.getComputedStyle(codeTextarea);
        overlay.style.fontFamily = textareaStyles.fontFamily;
        overlay.style.fontSize = textareaStyles.fontSize;
        overlay.style.lineHeight = textareaStyles.lineHeight;
        overlay.style.letterSpacing = textareaStyles.letterSpacing;
        overlay.style.wordSpacing = textareaStyles.wordSpacing;
        overlay.style.padding = textareaStyles.padding;
        overlay.style.margin = textareaStyles.margin;
        overlay.style.border = textareaStyles.border;
        overlay.style.boxSizing = textareaStyles.boxSizing;

        // Ensure exact scroll synchronization
        overlay.scrollTop = codeTextarea.scrollTop;
        overlay.scrollLeft = codeTextarea.scrollLeft;

        // Also set selection on current match for additional feedback
        if (state.searchState.currentIndex >= 0 && state.searchState.currentIndex < state.searchState.matches.length) {
            const currentMatch = state.searchState.matches[state.searchState.currentIndex];
            codeTextarea.setSelectionRange(currentMatch.index, currentMatch.index + currentMatch.length);
        }

    } catch (error) {
        console.error('Error in highlightSearchResults:', error);
        clearSearchHighlights();
    }
}

/**
 * Debug function for search highlighting (available in console)
 * @public
 */
export function debugSearchHighlighting() {
    const codeTextarea = document.getElementById('code');
    const overlay = document.getElementById('search-highlight-overlay');

    if (!codeTextarea || !overlay) {
        console.log('Debug: Missing elements');
        return;
    }

    const textareaRect = codeTextarea.getBoundingClientRect();
    const overlayRect = overlay.getBoundingClientRect();
    const textareaStyles = window.getComputedStyle(codeTextarea);
    const overlayStyles = window.getComputedStyle(overlay);

    console.log('=== Search Highlighting Debug ===');
    console.log('Textarea position:', textareaRect);
    console.log('Overlay position:', overlayRect);
    console.log('Position match:', {
        top: Math.abs(textareaRect.top - overlayRect.top) < 1,
        left: Math.abs(textareaRect.left - overlayRect.left) < 1,
        width: Math.abs(textareaRect.width - overlayRect.width) < 1,
        height: Math.abs(textareaRect.height - overlayRect.height) < 1
    });

    console.log('Font comparison:', {
        family: textareaStyles.fontFamily === overlayStyles.fontFamily,
        size: textareaStyles.fontSize === overlayStyles.fontSize,
        lineHeight: textareaStyles.lineHeight === overlayStyles.lineHeight,
        letterSpacing: textareaStyles.letterSpacing === overlayStyles.letterSpacing
    });

    console.log('Padding comparison:', {
        textarea: textareaStyles.padding,
        overlay: overlayStyles.padding,
        match: textareaStyles.padding === overlayStyles.padding
    });

    console.log('Current search state:', {
        query: state.searchState.currentQuery,
        matches: state.searchState.matches.length,
        currentIndex: state.searchState.currentIndex,
        isVisible: state.searchState.isVisible
    });

    if (state.searchState.matches.length > 0) {
        console.log('First match details:', state.searchState.matches[0]);
    }
}

/**
 * Scroll textarea to show current search match
 * @public
 */
export function scrollToCurrentMatch() {
    const codeTextarea = document.getElementById('code');
    if (!codeTextarea || state.searchState.currentIndex === -1 || state.searchState.matches.length === 0) {
        return;
    }

    const match = state.searchState.matches[state.searchState.currentIndex];

    // Calculate line number to scroll to
    const textBeforeMatch = codeTextarea.value.substring(0, match.index);
    const lineNumber = textBeforeMatch.split('\n').length - 1;

    // Scroll textarea to make the match visible
    const lineHeight = parseInt(getComputedStyle(codeTextarea).lineHeight) || 20;
    const scrollTop = lineNumber * lineHeight;

    // Scroll to center the match in the visible area
    const textareaHeight = codeTextarea.clientHeight;
    const targetScroll = Math.max(0, scrollTop - textareaHeight / 2);

    codeTextarea.scrollTop = targetScroll;

    // Sync line numbers scroll
    const lineNumbersDiv = document.getElementById('lineNumbers');
    if (lineNumbersDiv) {
        lineNumbersDiv.scrollTop = targetScroll;
    }

    // Sync overlay scroll
    const overlay = document.getElementById('search-highlight-overlay');
    if (overlay) {
        overlay.scrollTop = targetScroll;
        overlay.scrollLeft = codeTextarea.scrollLeft;
    }
}

/**
 * Navigate to next search match
 * @public
 */
export function goToNextMatch() {
    if (state.searchState.matches.length === 0) return;

    updateSearchState({
        currentIndex: (state.searchState.currentIndex + 1) % state.searchState.matches.length
    });
    highlightSearchResults(); // Update highlights to show new current match
    scrollToCurrentMatch();
    updateSearchCount(state.searchState.currentIndex + 1, state.searchState.matches.length);
}

/**
 * Navigate to previous search match
 * @public
 */
export function goToPreviousMatch() {
    if (state.searchState.matches.length === 0) return;

    updateSearchState({
        currentIndex: state.searchState.currentIndex <= 0
            ? state.searchState.matches.length - 1
            : state.searchState.currentIndex - 1
    });
    highlightSearchResults(); // Update highlights to show new current match
    scrollToCurrentMatch();
    updateSearchCount(state.searchState.currentIndex + 1, state.searchState.matches.length);
}

/**
 * Toggle case sensitivity for search
 * @public
 */
export function toggleCaseSensitive() {
    updateSearchState({ caseSensitive: !state.searchState.caseSensitive });
    const caseSensitiveBtn = document.getElementById('search-case');
    if (caseSensitiveBtn) {
        caseSensitiveBtn.classList.toggle('active', state.searchState.caseSensitive);
    }

    // Re-run search with new case sensitivity
    const searchInput = document.getElementById('search-input');
    if (searchInput && searchInput.value) {
        performSearch(searchInput.value);
    }
}

/**
 * Update search count display
 * @private
 * @param {number} current - Current match index (1-based)
 * @param {number} total - Total number of matches
 */
function updateSearchCount(current, total) {
    const searchCount = document.getElementById('search-count');
    if (searchCount) {
        if (total === 0) {
            searchCount.textContent = 'No results';
        } else {
            searchCount.textContent = `${current} of ${total}`;
        }
    }
}

/**
 * Update search navigation button states
 * @private
 */
function updateSearchButtons() {
    const prevBtn = document.getElementById('search-prev');
    const nextBtn = document.getElementById('search-next');
    const hasResults = state.searchState.matches.length > 0;

    if (prevBtn) {
        prevBtn.disabled = !hasResults;
    }

    if (nextBtn) {
        nextBtn.disabled = !hasResults;
    }
}

/**
 * Initialize search functionality with event listeners
 * @public
 */
export function initializeSearchFunctionality() {
    const searchInput = document.getElementById('search-input');
    const searchPrev = document.getElementById('search-prev');
    const searchNext = document.getElementById('search-next');
    const searchCase = document.getElementById('search-case');
    const searchClose = document.getElementById('search-close');

    if (!searchInput) {
        console.warn('Search input not found');
        return;
    }

    // Search input event handlers
    searchInput.addEventListener('input', (e) => {
        const query = e.target.value;
        if (query) {
            performSearch(query);
        } else {
            clearSearchHighlights();
            updateSearchCount(0, 0);
            updateSearchButtons();
        }
    });

    searchInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            if (e.shiftKey) {
                goToPreviousMatch();
            } else {
                goToNextMatch();
            }
        } else if (e.key === 'Escape') {
            e.preventDefault();
            hideSearchBar();
        }
    });

    // Navigation button handlers
    if (searchPrev) {
        searchPrev.addEventListener('click', goToPreviousMatch);
    }

    if (searchNext) {
        searchNext.addEventListener('click', goToNextMatch);
    }

    // Case sensitivity toggle
    if (searchCase) {
        searchCase.addEventListener('click', toggleCaseSensitive);
    }

    // Close button
    if (searchClose) {
        searchClose.addEventListener('click', hideSearchBar);
    }

    // Close search bar when clicking outside
    document.addEventListener('click', (e) => {
        const searchBar = document.getElementById('search-bar');
        if (state.searchState.isVisible && searchBar && !searchBar.contains(e.target)) {
            // Only close if not clicking on a search-related element
            const isSearchRelated = e.target.closest('.search-bar') !== null;
            if (!isSearchRelated) {
                hideSearchBar();
            }
        }
    });

    // Global escape key handler for search
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && state.searchState.isVisible) {
            e.preventDefault();
            hideSearchBar();
        }
    });

    // Sync scroll between textarea and highlight overlay
    const codeTextarea = document.getElementById('code');
    const overlay = document.getElementById('search-highlight-overlay');

    if (codeTextarea && overlay) {
        console.log('Search functionality: Initializing scroll synchronization');

        // Sync scroll position
        function syncScroll() {
            overlay.scrollTop = codeTextarea.scrollTop;
            overlay.scrollLeft = codeTextarea.scrollLeft;
        }

        codeTextarea.addEventListener('scroll', syncScroll);

        // Sync styles initially and on changes
        function syncStyles() {
            try {
                const textareaStyles = window.getComputedStyle(codeTextarea);
                overlay.style.fontFamily = textareaStyles.fontFamily;
                overlay.style.fontSize = textareaStyles.fontSize;
                overlay.style.lineHeight = textareaStyles.lineHeight;
                overlay.style.letterSpacing = textareaStyles.letterSpacing;
                overlay.style.wordSpacing = textareaStyles.wordSpacing;
                overlay.style.padding = textareaStyles.padding;
                overlay.style.margin = textareaStyles.margin;
                overlay.style.border = textareaStyles.border;
                overlay.style.boxSizing = textareaStyles.boxSizing;
                overlay.style.whiteSpace = textareaStyles.whiteSpace;
                overlay.style.wordWrap = textareaStyles.wordWrap;
                overlay.style.tabSize = textareaStyles.tabSize;
            } catch (error) {
                console.warn('Error syncing styles:', error);
            }
        }

        // Initial sync
        syncStyles();

        // Also sync on resize to ensure proper alignment
        const resizeObserver = new ResizeObserver(() => {
            if (state.searchState.matches.length > 0) {
                // Re-sync styles and re-render highlights after resize
                syncStyles();
                setTimeout(() => {
                    highlightSearchResults();
                }, 10);
            }
        });

        resizeObserver.observe(codeTextarea);

        // Periodic style sync to handle dynamic changes
        setInterval(syncStyles, 2000);

        console.log('Search functionality: Initialization complete');
    } else {
        console.warn('Search functionality: Missing textarea or overlay elements');
    }
}

// Make debug function globally available
window.debugSearchHighlighting = debugSearchHighlighting; 