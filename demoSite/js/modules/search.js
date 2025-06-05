/**
 * Search Functionality Module
 * 
 * Provides text search capabilities within the code editor with
 * real-time highlighting, navigation, and case-sensitive options.
 * 
 * @module search
 * @author Vysakh Pillai
 */

import { state, updateSearchState } from './state.js';
import { escapeHtml } from './utils.js';

// ========================================
// SEARCH UI MANAGEMENT
// ========================================

/**
 * Show search bar and focus on search input
 * 
 * @function showSearchBar
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
 * 
 * @function hideSearchBar
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

// ========================================
// SEARCH OPERATIONS
// ========================================

/**
 * Perform search in code textarea and update results
 * 
 * @function performSearch
 * @param {string} query - Search query string
 * @public
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

// ========================================
// HIGHLIGHT MANAGEMENT
// ========================================

/**
 * Clear all search highlights and reset selection
 * 
 * @function clearSearchHighlights
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
 * 
 * @function highlightSearchResults
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
        if (state.searchState.currentIndex >= 0) {
            const currentMatch = state.searchState.matches[state.searchState.currentIndex];
            codeTextarea.setSelectionRange(currentMatch.index, currentMatch.index + currentMatch.length);
        }
    } catch (error) {
        console.error('Error highlighting search results:', error);
        clearSearchHighlights();
    }
}

// ========================================
// SEARCH NAVIGATION
// ========================================

/**
 * Scroll to the currently selected match
 * Ensures the current match is visible in the viewport
 * 
 * @function scrollToCurrentMatch
 * @public
 */
export function scrollToCurrentMatch() {
    const codeTextarea = document.getElementById('code');
    if (!codeTextarea || state.searchState.currentIndex === -1) return;

    const currentMatch = state.searchState.matches[state.searchState.currentIndex];
    const textBeforeMatch = codeTextarea.value.substring(0, currentMatch.index);
    const lines = textBeforeMatch.split('\n');
    const lineNumber = lines.length;
    const lineHeight = parseInt(window.getComputedStyle(codeTextarea).lineHeight);
    const paddingTop = parseInt(window.getComputedStyle(codeTextarea).paddingTop);

    // Calculate position to scroll to
    const scrollPosition = (lineNumber - 1) * lineHeight + paddingTop;
    const viewportHeight = codeTextarea.clientHeight;
    const currentScroll = codeTextarea.scrollTop;

    // If the match is not visible in the viewport, scroll to it
    if (scrollPosition < currentScroll || scrollPosition > currentScroll + viewportHeight - lineHeight) {
        codeTextarea.scrollTop = scrollPosition - (viewportHeight / 2) + lineHeight;
    }
}

/**
 * Navigate to the next search match
 * 
 * @function goToNextMatch
 * @public
 */
export function goToNextMatch() {
    if (state.searchState.matches.length === 0) return;

    const nextIndex = (state.searchState.currentIndex + 1) % state.searchState.matches.length;
    updateSearchState({ currentIndex: nextIndex });
    highlightSearchResults();
    scrollToCurrentMatch();
    updateSearchCount(nextIndex + 1, state.searchState.matches.length);
}

/**
 * Navigate to the previous search match
 * 
 * @function goToPreviousMatch
 * @public
 */
export function goToPreviousMatch() {
    if (state.searchState.matches.length === 0) return;

    const prevIndex = (state.searchState.currentIndex - 1 + state.searchState.matches.length) % state.searchState.matches.length;
    updateSearchState({ currentIndex: prevIndex });
    highlightSearchResults();
    scrollToCurrentMatch();
    updateSearchCount(prevIndex + 1, state.searchState.matches.length);
}

// ========================================
// SEARCH OPTIONS
// ========================================

/**
 * Toggle case sensitivity for search
 * 
 * @function toggleCaseSensitive
 * @public
 */
export function toggleCaseSensitive() {
    const caseSensitiveBtn = document.getElementById('search-case');
    if (!caseSensitiveBtn) return;

    const newState = !state.searchState.caseSensitive;
    updateSearchState({ caseSensitive: newState });
    caseSensitiveBtn.classList.toggle('active', newState);
    caseSensitiveBtn.title = newState ? 'Case sensitive' : 'Case insensitive';

    // Re-run search with new case sensitivity
    const searchInput = document.getElementById('search-input');
    if (searchInput && searchInput.value.trim()) {
        performSearch(searchInput.value);
    }
}

// ========================================
// UI UPDATES
// ========================================

/**
 * Update search count display
 * 
 * @function updateSearchCount
 * @param {number} current - Current match index (1-based)
 * @param {number} total - Total number of matches
 * @private
 */
function updateSearchCount(current, total) {
    const countDisplay = document.getElementById('search-count');
    if (!countDisplay) return;

    if (total === 0) {
        countDisplay.textContent = 'No matches';
    } else {
        countDisplay.textContent = `${current} of ${total}`;
    }
}

/**
 * Update search navigation buttons state
 * 
 * @function updateSearchButtons
 * @private
 */
function updateSearchButtons() {
    const prevBtn = document.getElementById('search-prev');
    const nextBtn = document.getElementById('search-next');

    if (!prevBtn || !nextBtn) return;

    const hasMatches = state.searchState.matches.length > 0;
    prevBtn.disabled = !hasMatches;
    nextBtn.disabled = !hasMatches;
}

// ========================================
// INITIALIZATION
// ========================================

/**
 * Initialize search functionality
 * Sets up event listeners and keyboard shortcuts
 * 
 * @function initializeSearchFunctionality
 * @public
 */
export function initializeSearchFunctionality() {
    const searchBar = document.getElementById('search-bar');
    const searchInput = document.getElementById('search-input');
    const closeBtn = document.getElementById('search-close');
    const prevBtn = document.getElementById('search-prev');
    const nextBtn = document.getElementById('search-next');
    const caseSensitiveBtn = document.getElementById('search-case');

    if (!searchBar || !searchInput || !closeBtn || !prevBtn || !nextBtn || !caseSensitiveBtn) {
        console.error('Search: Missing required elements');
        return;
    }

    // Set up search input handler
    searchInput.addEventListener('input', () => {
        performSearch(searchInput.value);
    });

    // Set up close button
    closeBtn.addEventListener('click', hideSearchBar);

    // Set up navigation buttons
    prevBtn.addEventListener('click', goToPreviousMatch);
    nextBtn.addEventListener('click', goToNextMatch);

    // Set up case sensitivity toggle
    caseSensitiveBtn.addEventListener('click', toggleCaseSensitive);

    // Set up keyboard shortcuts
    document.addEventListener('keydown', (e) => {
        // Handle escape key for search bar
        if (e.key === 'Escape' && state.searchState.isVisible) {
            e.preventDefault();
            hideSearchBar();
            return;
        }

        // Only handle other shortcuts when not typing in text areas
        if (e.target.tagName !== 'TEXTAREA' && e.target.tagName !== 'INPUT') {
            if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
                e.preventDefault();
                showSearchBar();
            }
        }
    });

    // Set up search navigation shortcuts
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

    // Set up scroll synchronization
    const codeTextarea = document.getElementById('code');
    const overlay = document.getElementById('search-highlight-overlay');

    if (codeTextarea && overlay) {
        /**
         * Synchronize scroll position between textarea and overlay
         * 
         * @function syncScroll
         * @private
         */
        function syncScroll() {
            overlay.scrollTop = codeTextarea.scrollTop;
            overlay.scrollLeft = codeTextarea.scrollLeft;
        }

        /**
         * Synchronize styles between textarea and overlay
         * 
         * @function syncStyles
         * @private
         */
        function syncStyles() {
            const styles = window.getComputedStyle(codeTextarea);
            overlay.style.fontFamily = styles.fontFamily;
            overlay.style.fontSize = styles.fontSize;
            overlay.style.lineHeight = styles.lineHeight;
            overlay.style.letterSpacing = styles.letterSpacing;
            overlay.style.wordSpacing = styles.wordSpacing;
            overlay.style.padding = styles.padding;
            overlay.style.margin = styles.margin;
            overlay.style.border = styles.border;
            overlay.style.boxSizing = styles.boxSizing;
        }

        // Initial style sync
        syncStyles();

        // Set up scroll sync
        codeTextarea.addEventListener('scroll', syncScroll);

        // Set up resize observer for style sync
        const resizeObserver = new ResizeObserver(() => {
            syncStyles();
            syncScroll();
        });

        resizeObserver.observe(codeTextarea);
    }
} 