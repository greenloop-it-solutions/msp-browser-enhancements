// ==UserScript==
// @name         Empath Video Unlock (scrub / skip / speed)
// @namespace    https://github.com/greenloop-it-solutions/msp-browser-enhancements
// @version      2.0.0
// @description  Re-enables seeking, scrubbing and keyboard control in the Empath LMS video player, and stops the player from auto-pausing when the window loses focus.
// @author       GreenLoop IT Solutions
// @homepageURL  https://github.com/greenloop-it-solutions/msp-browser-enhancements
// @supportURL   https://github.com/greenloop-it-solutions/msp-browser-enhancements/issues
// @updateURL    https://raw.githubusercontent.com/greenloop-it-solutions/msp-browser-enhancements/main/scripts/empath/video-unlock.user.js
// @downloadURL  https://raw.githubusercontent.com/greenloop-it-solutions/msp-browser-enhancements/main/scripts/empath/video-unlock.user.js
// @match        https://app.empathmsp.com/*
// @match        https://*.empathmsp.com/*
// @run-at       document-start
// @grant        none
// ==/UserScript==

/*
 *  WHAT THIS DOES
 *  --------------
 *  1. Blocks the player's "snap back" logic. Many LMS players listen for a seek
 *     and immediately write currentTime back to the last watched position. This
 *     script intercepts writes to HTMLMediaElement.currentTime and drops any
 *     backwards jump that did not come from you.
 *  2. Turns the browser's own <video> controls back on and lifts any transparent
 *     overlay that is sitting on top of the scrub bar swallowing your clicks.
 *  3. Adds a floating control bar (seek slider, +/- 10s, speed) in case the site
 *     re-hides the native controls.
 *  4. Adds keyboard shortcuts.
 *  5. Keeps media playing when the window loses focus.
 *
 *  KEYBOARD
 *  --------
 *    ->  /  <-        seek +/- 5s          (hold Shift for 30s)
 *    L   /   J        seek +/- 10s
 *    K   or  Space    play / pause
 *    0 - 9            jump to 0% .. 90%
 *    ]   /   [        playback speed up / down
 *    \                reset speed to 1x
 *    Alt + S          show / hide the floating control bar
 *    Alt + C          toggle native <video> controls
 *    End              jump to the last 5 seconds
 *
 *  Shortcuts are ignored while you are typing in an input, textarea or any
 *  contenteditable field.
 *
 *  NOTE ON COMPLETION TRACKING
 *  ---------------------------
 *  Skipping ahead may mean the platform never records the lesson as fully
 *  watched. Empath usually marks completion on reaching the end, so use "End"
 *  (or drag to the last few seconds and let it play out) if you need the
 *  completion to register.
 */

(function () {
    'use strict';

    // =========================================================
    // CONFIGURATION
    // =========================================================

    const CONFIG = {
        debug: false,

        features: {
            blockPlayerRewind: true,
            keepPlayingInBackground: true,
            nativeControls: true,
            overlayUnblocker: true,
            floatingControlBar: true,
            keyboardShortcuts: true
        },

        blockPlayerRewind: {
            // A backwards jump smaller than this is ordinary playback drift
            // rather than the player snapping you back to a saved position.
            toleranceSec: 1.0,

            // How long after one of your own clicks or keypresses a seek is
            // still trusted as yours rather than the player's.
            userSeekGraceMs: 2000
        },

        keepPlayingInBackground: {
            // Suppress pause() while the window is not focused.
            //
            // This deliberately tests document.hasFocus() rather than
            // document.hidden. hasFocus() is false whenever the window is behind
            // another application, while hidden only becomes true once the tab
            // itself is switched away -- and, critically, hasFocus() is not
            // affected by maskVisibilityApi below, whereas document.hidden is.
            // Reading document.hidden here would make this guard permanently
            // false and silently do nothing.
            suppressPauseWhileUnfocused: true,

            // Stop the player's own visibilitychange/blur/pagehide handlers from
            // running while the document is hidden.
            swallowVisibilityEvents: true,

            // Report the document as always visible to anything that polls the
            // Page Visibility API directly.
            //
            // This is a document-wide override. Anything else on the page that
            // throttles work, defers requests, or records engagement while
            // backgrounded will also be told the tab is visible.
            maskVisibilityApi: true
        },

        overlayUnblocker: {
            // Re-probe once after the player has finished mounting its chrome.
            recheckDelayMs: 1500,

            // Probe points above the bottom edge of the video, where the scrub
            // bar and its click-eating overlay sit.
            scrubBarProbeOffsetsPx: [8, 20],

            videoZIndex: 2147483000
        },

        playback: {
            // "End" lands this far before the true end so the player still
            // registers playback reaching the finish.
            jumpToEndOffsetSec: 5,

            speedStep: 0.25,
            minimumSpeed: 0.25,
            maximumSpeed: 5
        },

        floatingControlBar: {
            barZIndex: 2147483647,

            // The bar has no event to listen to for elapsed time, so it polls.
            syncIntervalMs: 500,

            // Resolution of the seek slider.
            sliderSteps: 1000,

            skipButtonSec: 10,

            theme: {
                background: 'rgba(17,24,39,.94)',
                buttonBackground: '#2f3640',
                buttonHoverBackground: '#4b5563',
                text: '#fff',
                sliderAccent: '#22c55e'
            }
        },

        keyboardShortcuts: {
            arrowSeekSec: 5,
            shiftArrowSeekSec: 30,
            letterSeekSec: 10
        },

        videoDiscovery: {
            // The player swaps <video> elements during some lesson transitions
            // without a mutation the observer above can see, so a slow rescan
            // backstops it. Raising this risks missing a video entirely.
            rescanIntervalMs: 2000
        }
    };

    // =========================================================
    // SELECTORS
    // =========================================================

    const SELECTORS = {
        // Plain element selectors: this player exposes no data-* hooks and its
        // class names are generated, so the semantic tag is the stable choice.
        video: 'video',

        // Used only to walk into open shadow roots when hunting for videos.
        anyElement: '*',

        floatingControlBar: {
            containerId: 'empath-unlock-bar'
        },

        overlayUnblocker: {
            // Marker attribute set by this script on overlays it has neutralised.
            neutralisedFlag: 'empathUnlocked'
        }
    };

    // =========================================================
    // SHARED UTILITIES
    // =========================================================

    function debugLog(...args) {
        if (CONFIG.debug) {
            console.debug('%c[empath-unlock]', 'color:#0a0', ...args);
        }
    }

    const mediaPrototype = HTMLMediaElement.prototype;

    /**
     * Tracks whether a seek came from the person using the page. Writes to
     * currentTime inside the grace window are let through; anything else that
     * jumps backwards is treated as the player snapping back.
     */
    const userIntent = {
        trustedUntil: 0,

        mark() {
            this.trustedUntil = Date.now() + CONFIG.blockPlayerRewind.userSeekGraceMs;
        },

        isActive() {
            return Date.now() < this.trustedUntil;
        }
    };

    /** Finds videos anywhere in the document, including inside open shadow roots. */
    function findAllVideos(root = document) {
        const found = [];

        const walk = (node) => {
            if (!node) {
                return;
            }

            let videos = [];
            try {
                videos = node.querySelectorAll(SELECTORS.video);
            } catch {
                // Some shadow roots reject querySelectorAll; skip them.
            }
            found.push(...videos);

            let hosts = [];
            try {
                hosts = node.querySelectorAll(SELECTORS.anyElement);
            } catch {
                // As above.
            }
            for (const element of hosts) {
                if (element.shadowRoot) {
                    walk(element.shadowRoot);
                }
            }
        };

        walk(root);
        return found;
    }

    /** The video the controls act on: the last one touched, else the longest. */
    const videoRegistry = {
        attached: new WeakSet(),
        active: null,

        current() {
            if (this.active && this.active.isConnected) {
                return this.active;
            }

            const candidates = findAllVideos().filter((video) => video.isConnected);
            this.active =
                candidates.sort((left, right) => (right.duration || 0) - (left.duration || 0))[0] ||
                null;

            return this.active;
        },

        attach(video) {
            if (this.attached.has(video)) {
                return;
            }

            this.attached.add(video);
            this.active = video;
            debugLog('attached to video', video);

            for (const eventName of ['click', 'mousedown', 'pointerdown', 'keydown']) {
                video.addEventListener(eventName, () => userIntent.mark(), true);
            }

            video.addEventListener('seeking', () => {
                this.active = video;
            }, true);

            video.addEventListener('play', () => {
                this.active = video;
            }, true);

            for (const feature of FEATURES) {
                feature.handleVideoAttached?.(video);
            }
        },

        scan() {
            findAllVideos().forEach((video) => this.attach(video));
        }
    };

    /** Seek that is always honoured by the rewind guard. */
    function seekTo(video, seconds) {
        video.__seekTo(seconds);
    }

    function seekBy(deltaSeconds) {
        const video = videoRegistry.current();
        if (video) {
            seekTo(video, video.currentTime + deltaSeconds);
        }
    }

    function seekToFraction(fraction) {
        const video = videoRegistry.current();
        if (video && isFinite(video.duration)) {
            seekTo(video, video.duration * fraction);
        }
    }

    function jumpToEnd() {
        const video = videoRegistry.current();
        if (video && isFinite(video.duration)) {
            seekTo(video, Math.max(0, video.duration - CONFIG.playback.jumpToEndOffsetSec));
        }
    }

    function togglePlay() {
        const video = videoRegistry.current();
        if (!video) {
            return;
        }

        if (video.paused) {
            video.play();
        } else if (video.__userPause) {
            // Deliberate pause, which must get past the background guard.
            video.__userPause();
        } else {
            video.pause();
        }
    }

    function changeSpeed(delta) {
        const video = videoRegistry.current();
        if (!video) {
            return;
        }

        const { minimumSpeed, maximumSpeed } = CONFIG.playback;

        video.playbackRate = Math.min(
            maximumSpeed,
            Math.max(minimumSpeed, Math.round((video.playbackRate + delta) * 100) / 100)
        );

        floatingControlBar.sync();
    }

    function setSpeed(rate) {
        const video = videoRegistry.current();
        if (video) {
            video.playbackRate = rate;
            floatingControlBar.sync();
        }
    }

    function formatTime(totalSeconds) {
        if (!isFinite(totalSeconds)) {
            return '--:--';
        }

        const whole = Math.max(0, Math.floor(totalSeconds));
        const hours = Math.floor(whole / 3600);
        const minutes = Math.floor((whole % 3600) / 60);
        const seconds = whole % 60;

        const lead = hours ? `${hours}:${String(minutes).padStart(2, '0')}` : String(minutes);
        return `${lead}:${String(seconds).padStart(2, '0')}`;
    }

    // =========================================================
    // FEATURE: BLOCK PLAYER REWIND
    // =========================================================

    const blockPlayerRewind = {
        enabled: false,

        initialize() {
            this.enabled = true;

            const descriptor = Object.getOwnPropertyDescriptor(mediaPrototype, 'currentTime');

            if (!descriptor?.get || !descriptor?.set) {
                // Nothing to guard; still provide the helper the UI seeks through.
                mediaPrototype.__seekTo = function (seconds) {
                    userIntent.mark();
                    this.currentTime = seconds;
                };
                return;
            }

            Object.defineProperty(mediaPrototype, 'currentTime', {
                configurable: true,
                enumerable: descriptor.enumerable,
                get() {
                    return descriptor.get.call(this);
                },
                set(value) {
                    if (blockPlayerRewind.enabled && !userIntent.isActive()) {
                        const now = descriptor.get.call(this);

                        // Only backwards jumps issued by the page are dropped.
                        if (now > 1 && value < now - CONFIG.blockPlayerRewind.toleranceSec) {
                            debugLog('blocked page rewind', now.toFixed(1), '->', Number(value).toFixed(1));
                            return;
                        }
                    }

                    descriptor.set.call(this, value);
                }
            });

            // Used by this script's own UI so the guard never fights us.
            mediaPrototype.__seekTo = function (seconds) {
                userIntent.mark();
                try {
                    descriptor.set.call(this, Math.max(0, Math.min(seconds, this.duration || seconds)));
                } catch (error) {
                    debugLog('seek failed', error);
                }
            };

            const nativeFastSeek = mediaPrototype.fastSeek;

            if (nativeFastSeek) {
                mediaPrototype.fastSeek = function (seconds) {
                    if (
                        blockPlayerRewind.enabled &&
                        !userIntent.isActive() &&
                        seconds < this.currentTime - CONFIG.blockPlayerRewind.toleranceSec
                    ) {
                        return undefined;
                    }

                    return nativeFastSeek.call(this, seconds);
                };
            }
        }
    };

    /**
     * Always present, even when the rewind guard is disabled, so every other
     * feature can seek through one path.
     */
    function installFallbackSeek() {
        if (!mediaPrototype.__seekTo) {
            mediaPrototype.__seekTo = function (seconds) {
                userIntent.mark();
                this.currentTime = seconds;
            };
        }
    }

    // =========================================================
    // FEATURE: KEEP PLAYING IN BACKGROUND
    // =========================================================

    const keepPlayingInBackground = {
        initialize() {
            const settings = CONFIG.keepPlayingInBackground;
            const nativePause = mediaPrototype.pause;
            let deliberatePause = false;

            // Captured before maskVisibilityApi replaces the accessor further
            // down, so the swallow handler can still read the document's true
            // visibility. Reading the masked property instead would leave the
            // handler permanently looking at 'visible' and silently inert.
            const nativeVisibilityGetter = Object.getOwnPropertyDescriptor(
                Document.prototype,
                'visibilityState'
            )?.get;

            const realVisibilityState = () =>
                nativeVisibilityGetter
                    ? nativeVisibilityGetter.call(document)
                    : document.visibilityState;

            if (settings.suppressPauseWhileUnfocused) {
                mediaPrototype.pause = function () {
                    if (!deliberatePause && !document.hasFocus()) {
                        debugLog('suppressed focus-loss pause', this);
                        return undefined;
                    }

                    return nativePause.call(this);
                };

                mediaPrototype.__userPause = function () {
                    deliberatePause = true;
                    try {
                        nativePause.call(this);
                    } finally {
                        deliberatePause = false;
                    }
                };
            }

            if (settings.swallowVisibilityEvents) {
                const swallow = (event) => {
                    if (realVisibilityState() === 'hidden') {
                        event.stopImmediatePropagation();
                        debugLog('swallowed', event.type);
                    }
                };

                document.addEventListener('visibilitychange', swallow, true);
                window.addEventListener('blur', swallow, true);
                window.addEventListener('pagehide', swallow, true);
            }

            if (settings.maskVisibilityApi) {
                // Must come after the swallow handlers above: those read the real
                // visibilityState, and this replaces it for everyone afterwards.
                try {
                    Object.defineProperty(document, 'hidden', {
                        configurable: true,
                        get: () => false
                    });
                    Object.defineProperty(document, 'visibilityState', {
                        configurable: true,
                        get: () => 'visible'
                    });
                } catch (error) {
                    debugLog('could not mask visibility properties', error);
                }
            }
        }
    };

    // =========================================================
    // FEATURE: NATIVE VIDEO CONTROLS
    // =========================================================

    const nativeControls = {
        forced: true,

        handleVideoAttached(video) {
            if (!this.forced) {
                return;
            }

            video.controls = true;
            video.setAttribute('controls', '');
            video.removeAttribute('controlsList');
            video.disablePictureInPicture = false;

            // The player strips the attribute again on some re-renders.
            new MutationObserver(() => {
                if (this.forced && !video.controls) {
                    video.controls = true;
                }
            }).observe(video, {
                attributes: true,
                attributeFilter: ['controls', 'controlslist']
            });
        },

        toggle() {
            this.forced = !this.forced;

            const video = videoRegistry.current();
            if (video) {
                video.controls = this.forced;
            }

            debugLog('native controls forced:', this.forced);
        }
    };

    // =========================================================
    // FEATURE: NEUTRALISE CLICK-BLOCKING OVERLAYS
    // =========================================================

    const overlayUnblocker = {
        /**
         * An element that covers the video and is fully transparent is almost
         * certainly the click-eater sitting over the scrub bar. Probing by
         * coordinate is the only way to find it: it has no stable identity.
         */
        unblock(video) {
            const settings = CONFIG.overlayUnblocker;
            const box = video.getBoundingClientRect();

            if (!box.width || !box.height) {
                return;
            }

            const probes = [
                ...settings.scrubBarProbeOffsetsPx.map((offset) => [
                    box.left + box.width / 2,
                    box.bottom - offset
                ]),
                [box.left + box.width / 2, box.top + box.height / 2]
            ];

            for (const [x, y] of probes) {
                for (const element of document.elementsFromPoint(x, y)) {
                    if (element === video || element.contains(video)) {
                        break;
                    }
                    if (element.tagName === 'VIDEO') {
                        continue;
                    }

                    const styles = getComputedStyle(element);
                    const transparent =
                        styles.backgroundColor === 'rgba(0, 0, 0, 0)' ||
                        parseFloat(styles.opacity) === 0;

                    if (
                        transparent ||
                        element.dataset[SELECTORS.overlayUnblocker.neutralisedFlag] === '1'
                    ) {
                        element.dataset[SELECTORS.overlayUnblocker.neutralisedFlag] = '1';
                        element.style.setProperty('pointer-events', 'none', 'important');
                        debugLog('neutralised overlay', element);
                    }
                }
            }

            video.style.setProperty('pointer-events', 'auto', 'important');
            video.style.setProperty('z-index', String(settings.videoZIndex), 'important');

            if (getComputedStyle(video).position === 'static') {
                video.style.setProperty('position', 'relative', 'important');
            }
        },

        handleVideoAttached(video) {
            this.unblock(video);
            // Run again once the player has finished mounting its own chrome.
            setTimeout(() => this.unblock(video), CONFIG.overlayUnblocker.recheckDelayMs);
        }
    };

    // =========================================================
    // FEATURE: FLOATING CONTROL BAR
    // =========================================================

    const floatingControlBar = {
        container: null,
        slider: null,
        timeLabel: null,
        speedLabel: null,

        button(text, title, onClick) {
            const { theme } = CONFIG.floatingControlBar;
            const element = document.createElement('button');

            element.textContent = text;
            element.title = title;
            element.style.cssText =
                'all:unset;cursor:pointer;padding:2px 8px;border-radius:4px;' +
                `background:${theme.buttonBackground};color:${theme.text};` +
                'font:600 12px/1.4 system-ui,sans-serif;flex:0 0 auto;';

            element.addEventListener('mouseenter', () => {
                element.style.background = theme.buttonHoverBackground;
            });
            element.addEventListener('mouseleave', () => {
                element.style.background = theme.buttonBackground;
            });
            element.addEventListener('click', (event) => {
                event.preventDefault();
                event.stopPropagation();
                onClick();
            });

            return element;
        },

        build() {
            if (this.container || !CONFIG.features.floatingControlBar) {
                return;
            }

            const settings = CONFIG.floatingControlBar;
            const { theme } = settings;

            this.container = document.createElement('div');
            this.container.id = SELECTORS.floatingControlBar.containerId;
            this.container.style.cssText =
                'position:fixed;left:50%;bottom:16px;transform:translateX(-50%);' +
                `z-index:${settings.barZIndex};` +
                'display:flex;align-items:center;gap:8px;padding:8px 12px;border-radius:10px;' +
                `background:${theme.background};box-shadow:0 4px 18px rgba(0,0,0,.45);` +
                `color:${theme.text};font:12px/1.4 system-ui,sans-serif;` +
                'backdrop-filter:blur(4px);max-width:92vw;';

            const skip = settings.skipButtonSec;

            this.container.appendChild(
                this.button(`«${skip}`, `Back ${skip}s`, () => seekBy(-skip))
            );
            this.container.appendChild(this.button('▶/❚❚', 'Play / pause', togglePlay));
            this.container.appendChild(
                this.button(`${skip}»`, `Forward ${skip}s`, () => seekBy(skip))
            );

            this.slider = document.createElement('input');
            this.slider.type = 'range';
            this.slider.min = '0';
            this.slider.max = String(settings.sliderSteps);
            this.slider.value = '0';
            this.slider.style.cssText =
                `width:min(46vw,460px);accent-color:${theme.sliderAccent};cursor:pointer;flex:1 1 auto;`;

            const sliderSeek = () => {
                const video = videoRegistry.current();
                if (video && isFinite(video.duration)) {
                    seekTo(video, (this.slider.value / settings.sliderSteps) * video.duration);
                }
            };

            this.slider.addEventListener('input', sliderSeek);
            this.slider.addEventListener('change', sliderSeek);
            this.container.appendChild(this.slider);

            this.timeLabel = document.createElement('span');
            this.timeLabel.style.cssText =
                'font-variant-numeric:tabular-nums;white-space:nowrap;flex:0 0 auto;';
            this.timeLabel.textContent = '--:-- / --:--';
            this.container.appendChild(this.timeLabel);

            this.container.appendChild(
                this.button('−', 'Slower', () => changeSpeed(-CONFIG.playback.speedStep))
            );

            this.speedLabel = document.createElement('span');
            this.speedLabel.style.cssText = 'min-width:34px;text-align:center;flex:0 0 auto;';
            this.speedLabel.textContent = '1x';
            this.container.appendChild(this.speedLabel);

            this.container.appendChild(
                this.button('+', 'Faster', () => changeSpeed(CONFIG.playback.speedStep))
            );
            this.container.appendChild(
                this.button(
                    'End',
                    `Jump to the last ${CONFIG.playback.jumpToEndOffsetSec} seconds`,
                    jumpToEnd
                )
            );
            this.container.appendChild(
                this.button('✕', 'Hide this bar (Alt+S to bring it back)', () => {
                    this.container.style.display = 'none';
                })
            );

            document.body.appendChild(this.container);
            debugLog('built control bar');
        },

        sync() {
            const video = videoRegistry.current();

            if (!video || !this.container) {
                return;
            }

            const { sliderSteps } = CONFIG.floatingControlBar;

            if (
                document.activeElement !== this.slider &&
                isFinite(video.duration) &&
                video.duration > 0
            ) {
                this.slider.value = String(
                    Math.round((video.currentTime / video.duration) * sliderSteps)
                );
            }

            this.timeLabel.textContent = `${formatTime(video.currentTime)} / ${formatTime(video.duration)}`;
            this.speedLabel.textContent = `${Math.round(video.playbackRate * 100) / 100}x`;
        },

        toggleVisibility() {
            if (!this.container) {
                this.build();
                return;
            }

            this.container.style.display = this.container.style.display === 'none' ? 'flex' : 'none';
        },

        handleVideoAttached(video) {
            video.addEventListener('timeupdate', () => this.sync());
            video.addEventListener('loadedmetadata', () => this.sync());
            this.build();
        },

        handleDocumentReady() {
            // The bar shows elapsed time, which has no event of its own between
            // timeupdate ticks, so it is polled.
            setInterval(() => this.sync(), CONFIG.floatingControlBar.syncIntervalMs);
        }
    };

    // =========================================================
    // FEATURE: KEYBOARD SHORTCUTS
    // =========================================================

    const keyboardShortcuts = {
        isTyping(event) {
            const target = event.target;

            if (!target) {
                return false;
            }

            const tag = (target.tagName || '').toLowerCase();
            return (
                tag === 'input' ||
                tag === 'textarea' ||
                tag === 'select' ||
                target.isContentEditable
            );
        },

        handleAltShortcut(event) {
            if (event.code === 'KeyS') {
                floatingControlBar.toggleVisibility();
                event.preventDefault();
            }

            if (event.code === 'KeyC') {
                nativeControls.toggle();
                event.preventDefault();
            }
        },

        handleKeyDown(event) {
            if (this.isTyping(event) || event.ctrlKey || event.metaKey) {
                return;
            }

            if (event.altKey) {
                this.handleAltShortcut(event);
                return;
            }

            const settings = CONFIG.keyboardShortcuts;
            const arrowSeek = event.shiftKey ? settings.shiftArrowSeekSec : settings.arrowSeekSec;

            switch (event.code) {
                case 'ArrowRight':
                    seekBy(arrowSeek);
                    break;
                case 'ArrowLeft':
                    seekBy(-arrowSeek);
                    break;
                case 'KeyL':
                    seekBy(settings.letterSeekSec);
                    break;
                case 'KeyJ':
                    seekBy(-settings.letterSeekSec);
                    break;
                case 'KeyK':
                case 'Space':
                    togglePlay();
                    break;
                case 'End':
                    jumpToEnd();
                    break;
                case 'BracketRight':
                    changeSpeed(CONFIG.playback.speedStep);
                    break;
                case 'BracketLeft':
                    changeSpeed(-CONFIG.playback.speedStep);
                    break;
                case 'Backslash':
                    setSpeed(1);
                    break;
                default:
                    if (/^Digit[0-9]$/.test(event.code)) {
                        seekToFraction(Number(event.code.slice(5)) / 10);
                    } else {
                        return;
                    }
            }

            event.preventDefault();
            event.stopPropagation();
        },

        initialize() {
            document.addEventListener('keydown', (event) => this.handleKeyDown(event), true);
        }
    };

    // =========================================================
    // FEATURE REGISTRATION
    // =========================================================

    const ALL_FEATURES = {
        blockPlayerRewind,
        keepPlayingInBackground,
        nativeControls,
        overlayUnblocker,
        floatingControlBar,
        keyboardShortcuts
    };

    const FEATURES = Object.entries(ALL_FEATURES)
        .filter(([key]) => CONFIG.features[key])
        .map(([, feature]) => feature);

    // =========================================================
    // GLOBAL OBSERVERS
    // =========================================================

    function observePageChanges() {
        new MutationObserver(() => videoRegistry.scan()).observe(document.documentElement, {
            childList: true,
            subtree: true
        });

        setInterval(() => videoRegistry.scan(), CONFIG.videoDiscovery.rescanIntervalMs);
    }

    // =========================================================
    // INITIALIZATION
    // =========================================================

    function initialize() {
        // Prototype patches must be installed synchronously at document-start,
        // before the player's own code captures the originals.
        for (const feature of FEATURES) {
            feature.initialize?.();
        }

        installFallbackSeek();

        const start = () => {
            videoRegistry.scan();
            observePageChanges();

            for (const feature of FEATURES) {
                feature.handleDocumentReady?.();
            }

            debugLog('ready');
        };

        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', start, { once: true });
        } else {
            start();
        }
    }

    initialize();
})();
