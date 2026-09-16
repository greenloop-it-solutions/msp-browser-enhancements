// ==UserScript==
// @name         Rewst Form Enhancements
// @namespace    https://github.com/greenloop-it-solutions/msp-browser-enhancements
// @version      2.0.0
// @description  Auto-expands multiline text areas to fit their content and enlarges the virtualized autocomplete dropdown on Rewst form pages.
// @author       GreenLoop IT Solutions
// @homepageURL  https://github.com/greenloop-it-solutions/msp-browser-enhancements
// @supportURL   https://github.com/greenloop-it-solutions/msp-browser-enhancements/issues
// @updateURL    https://raw.githubusercontent.com/greenloop-it-solutions/msp-browser-enhancements/main/scripts/rewst/form-enhancements.user.js
// @downloadURL  https://raw.githubusercontent.com/greenloop-it-solutions/msp-browser-enhancements/main/scripts/rewst/form-enhancements.user.js
// @match        https://app.rewst.io/organizations/*/form/*
// @run-at       document-idle
// @grant        none
// ==/UserScript==

(function () {
    'use strict';

    // =========================================================
    // CONFIGURATION
    // =========================================================

    const CONFIG = {
        debug: false,

        features: {
            autoResizeTextareas: true,
            expandAutocompleteList: true
        },

        autoResizeTextareas: {
            // Floor for the grown height, so short fields still get usable room.
            minimumHeightPx: 100,

            // Rewst writes into some text areas programmatically, which does not
            // emit an input event. Polling the value is the only reliable way to
            // notice those changes; see the note on the poll timer below.
            pollIntervalMs: 250
        },

        expandAutocompleteList: {
            // Cap on how many option rows are shown before the list scrolls.
            maximumVisibleItems: 5,

            // Small allowance so the last visible row is not clipped.
            bottomPaddingPx: 16
        }
    };

    // =========================================================
    // SELECTORS
    // =========================================================

    const SELECTORS = {
        autoResizeTextareas: {
            // MUI renders a second, hidden text area purely to measure content.
            // It must be left alone -- resizing it corrupts MUI's own sizing.
            candidates: 'textarea:not([aria-hidden="true"])',

            // Marker attribute set by this script, used to find the text areas
            // it already owns.
            attached: 'textarea[data-gl-textarea-attached]',

            // MUI component class, not a generated css-* class. These are part of
            // Material UI's documented class API and are stable across releases.
            // The wrapper carries a fixed height that clips a grown text area.
            inputRoot: '.MuiInputBase-root'
        },

        expandAutocompleteList: {
            // MUI component class (see the note above). Rewst mounts the
            // autocomplete popup dynamically, so this is only ever matched
            // against nodes added after page load.
            popper: '.MuiAutocomplete-popper',

            // Bare class name of the same element, for classList checks on a node
            // that is itself the popup rather than a container holding one.
            popperClass: 'MuiAutocomplete-popper',

            // The element that actually carries the inline height constraint.
            // Testing established that resizing the popper, the paper, or the
            // inner ul has no effect; the inline height on the listbox is the
            // real constraint.
            listbox: '.MuiAutocomplete-listbox',

            // ARIA role, preferred over any class name for the option rows.
            option: 'li[role="option"]'
        }
    };

    // =========================================================
    // SHARED UTILITIES
    // =========================================================

    function debugLog(...args) {
        if (CONFIG.debug) {
            console.debug('[Rewst Form Enhancements]', ...args);
        }
    }

    /** Coalesce repeated calls into one run on the next animation frame. */
    function debounceFrame(callback) {
        return () => requestAnimationFrame(callback);
    }

    // =========================================================
    // FEATURE: AUTO-EXPAND MULTILINE TEXT AREAS
    // =========================================================

    const autoResizeTextareas = {
        /**
         * Collapse to 1px first so scrollHeight reports the content height rather
         * than the current height, then grow to fit.
         */
        resize(textarea) {
            if (!textarea || !textarea.isConnected) {
                return;
            }

            textarea.style.height = '1px';

            const desiredHeight = Math.max(
                CONFIG.autoResizeTextareas.minimumHeightPx,
                textarea.scrollHeight
            );

            textarea.style.height = `${desiredHeight}px`;
            textarea.style.overflowY = 'hidden';

            const root = textarea.closest(SELECTORS.autoResizeTextareas.inputRoot);

            if (root) {
                root.style.height = 'auto';
                root.style.alignItems = 'flex-start';
            }
        },

        attach(textarea) {
            if (
                textarea.dataset.glTextareaAttached ||
                textarea.getAttribute('aria-hidden') === 'true'
            ) {
                return;
            }

            textarea.dataset.glTextareaAttached = 'true';

            const resize = debounceFrame(() => this.resize(textarea));

            resize();

            for (const eventName of ['input', 'change', 'keyup', 'paste', 'cut']) {
                textarea.addEventListener(eventName, resize);
            }

            // Polling workaround: Rewst sets some text area values programmatically,
            // which fires none of the events above. Comparing the value on a timer is
            // the only reliable way to catch those writes.
            //
            // Known limitation: this timer is intentionally never cleared, matching
            // the behavior of the original script. A text area removed from the page
            // leaves its timer running as a no-op. See the repository issue tracker.
            let lastValue = textarea.value;

            setInterval(() => {
                if (!textarea.isConnected) {
                    return;
                }

                if (textarea.value !== lastValue) {
                    lastValue = textarea.value;
                    debugLog('programmatic value change detected', textarea);
                    resize();
                }
            }, CONFIG.autoResizeTextareas.pollIntervalMs);

            debugLog('attached to text area', textarea);
        },

        attachAll() {
            document
                .querySelectorAll(SELECTORS.autoResizeTextareas.candidates)
                .forEach((textarea) => this.attach(textarea));
        },

        initialize() {
            this.attachAll();
        },

        /**
         * Rescan the whole document on every mutation batch rather than inspecting
         * only the added nodes. This is deliberate: it also picks up text areas that
         * become visible by losing aria-hidden, which a per-node check would miss.
         * The data-gl-textarea-attached guard keeps repeat scans cheap.
         */
        handleMutations() {
            this.attachAll();
        },

        handleWindowResize() {
            document
                .querySelectorAll(SELECTORS.autoResizeTextareas.attached)
                .forEach((textarea) => this.resize(textarea));
        }
    };

    // =========================================================
    // FEATURE: EXPAND VIRTUALIZED AUTOCOMPLETE LIST
    // =========================================================

    const expandAutocompleteList = {
        /**
         * Size the listbox to the lesser of the rendered option count and the
         * configured maximum. Option rows can have different heights, so the
         * rendered height of each row is summed rather than assuming a fixed
         * row height.
         */
        resize(popper) {
            const listbox = popper.querySelector(SELECTORS.expandAutocompleteList.listbox);

            if (!listbox) {
                return;
            }

            const items = Array.from(
                listbox.querySelectorAll(SELECTORS.expandAutocompleteList.option)
            );

            if (!items.length) {
                return;
            }

            const visibleCount = Math.min(
                items.length,
                CONFIG.expandAutocompleteList.maximumVisibleItems
            );

            let requiredHeight = CONFIG.expandAutocompleteList.bottomPaddingPx;

            for (let index = 0; index < visibleCount; index += 1) {
                requiredHeight += items[index].getBoundingClientRect().height;
            }

            // The inline height MUI applies wins without !important.
            listbox.style.setProperty('height', `${requiredHeight}px`, 'important');
            listbox.style.setProperty('max-height', `${requiredHeight}px`, 'important');
            listbox.style.setProperty('overflow-y', 'auto', 'important');

            debugLog('resized listbox', { visibleCount, requiredHeight });
        },

        /** Measure after the browser has laid the freshly mounted popup out. */
        scheduleResize(popper) {
            requestAnimationFrame(() => this.resize(popper));
        },

        handleAddedNode(node) {
            if (!(node instanceof HTMLElement)) {
                return;
            }

            const { popper, popperClass } = SELECTORS.expandAutocompleteList;

            if (node.classList?.contains(popperClass)) {
                this.scheduleResize(node);
            }

            node.querySelectorAll?.(popper).forEach((element) => {
                this.scheduleResize(element);
            });
        },

        handleWindowResize() {
            document
                .querySelectorAll(SELECTORS.expandAutocompleteList.popper)
                .forEach((popper) => this.resize(popper));
        }
    };

    // =========================================================
    // FEATURE REGISTRATION
    // =========================================================

    const ALL_FEATURES = {
        autoResizeTextareas,
        expandAutocompleteList
    };

    const FEATURES = Object.entries(ALL_FEATURES)
        .filter(([key]) => CONFIG.features[key])
        .map(([, feature]) => feature);

    // =========================================================
    // GLOBAL OBSERVERS
    // =========================================================

    function observePageChanges() {
        const observer = new MutationObserver((mutations) => {
            for (const feature of FEATURES) {
                feature.handleMutations?.(mutations);
            }

            for (const mutation of mutations) {
                for (const node of mutation.addedNodes) {
                    for (const feature of FEATURES) {
                        feature.handleAddedNode?.(node);
                    }
                }
            }
        });

        observer.observe(document.body, {
            childList: true,
            subtree: true
        });
    }

    function observeWindowResize() {
        window.addEventListener('resize', () => {
            for (const feature of FEATURES) {
                feature.handleWindowResize?.();
            }
        });
    }

    // =========================================================
    // INITIALIZATION
    // =========================================================

    function initialize() {
        debugLog('initializing', FEATURES.length, 'feature(s)');

        for (const feature of FEATURES) {
            feature.initialize?.();
        }

        observePageChanges();
        observeWindowResize();
    }

    initialize();
})();
