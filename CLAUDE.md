# CLAUDE.md

Project conventions for Claude Code sessions working in this repository.

This repository stores **Tampermonkey userscripts** that enhance third-party web
applications. The scripts are small, already working, and hard to test automatically —
they only prove themselves against the live site. Treat every existing script as
load-bearing.

---

## Repository identity

- **Owner / repository:** `greenloop-it-solutions/msp-browser-enhancements`
- **Install branch:** `main`
- Raw URL form used for `@updateURL` and `@downloadURL`:

  ```
  https://raw.githubusercontent.com/greenloop-it-solutions/msp-browser-enhancements/main/scripts/<application>/<script>.user.js
  ```

  Never a commit-pinned URL — future versions must stay reachable at the same address.
  These values are also stored in `package.json` under `userscripts`, which is the single
  source of truth the tooling reads.

---

## Working agreement

1. **Work one step at a time.** Do not run ahead of the user.
2. **Ask one focused question at a time**, then wait for the answer before proceeding.
3. **Never hand the user a long list of things to gather or decide at once.**
4. **During migration, ask for exactly one existing script at a time.**
5. **After processing a script, summarize what changed before requesting the next one.**
6. **Never invent, recreate, or infer a userscript the user has not supplied.** If a
   script is referenced but not provided, ask for it.
7. **Ask before restructuring a working script** in any way that could change behavior.

---

## Behavior preservation

These scripts were tuned against real, often quirky, application DOMs. Assume any
oddity is deliberate until proven otherwise.

- **Do not remove working behavior merely to improve style.**
- **Preserve existing selectors, timing workarounds, observers, polling loops, and event
  wiring** unless there is a demonstrated reason to change them.
- If a workaround looks strange, **document why it exists** rather than deleting it.
- **Do not silently apply behavior changes.** Any behavior change must be called out
  explicitly in the migration or change summary and approved.
- **Clearly identify any behavior that cannot be verified locally**, and ask the user to
  test it against the live site before the change is treated as complete.

---

## Script file conventions

Every independently installable userscript must:

- Use the `.user.js` extension.
- Use a `lowercase-kebab-case` filename.
- Live under `scripts/<application>/`.
- Contain **exactly one** userscript metadata block.
- Be installable directly from its raw GitHub URL.
- Carry its own independent version number.
- Declare explicit, narrowly scoped `@match` entries.
- Use `@grant none` unless a grant is genuinely required.
- Include `@run-at` when execution timing matters.
- Include `@homepageURL`, `@supportURL`, `@updateURL`, and `@downloadURL`.
- Never contain secrets or private authentication material.
- **Never use a broad match such as `*://*/*`** without explicit user approval.

Metadata field order:

```javascript
// ==UserScript==
// @name
// @namespace
// @version
// @description
// @author
// @homepageURL
// @supportURL
// @updateURL
// @downloadURL
// @match
// @exclude
// @run-at
// @grant
// ==/UserScript==
```

Omit fields that genuinely do not apply, except `@name`, `@namespace`, `@version`,
`@description`, `@match`, and `@grant`, which are always required here.

`@updateURL` and `@downloadURL` must be identical and must match the file's actual
repository path. The validator enforces this.

---

## Versioning

Semantic Versioning, always three numeric components (`1.0.0`, not `1.0` or `1.0.0.1`).

| Increment | When |
| --- | --- |
| PATCH | Bug fixes, selector updates, internal refactoring with no intended behavior change. |
| MINOR | Backward-compatible features or new configurable behavior. |
| MAJOR | Breaking behavior or installation changes. |

When modifying an existing published script:

1. Determine its current version.
2. Recommend the appropriate increment.
3. Explain the reason.
4. Apply it unless the user says otherwise.
5. **Never reduce or reuse a previously published version.**

Committing code without bumping `@version` is not a release — Tampermonkey will not
offer the update. Say so if a change is being made without a bump.

---

## Script structure

Use this shape where it applies. It is a convention, **not** a requirement to add empty
functions — include only the lifecycle methods a feature actually uses.

```javascript
(function () {
    'use strict';

    // =========================================================
    // CONFIGURATION
    // =========================================================

    const CONFIG = {
        debug: false,

        features: {
            featureName: true
        },

        featureName: {
            settingName: 'value'
        }
    };

    // =========================================================
    // SELECTORS
    // =========================================================

    const SELECTORS = {
        featureName: {
            control: '.selector'
        }
    };

    // =========================================================
    // SHARED UTILITIES
    // =========================================================

    function debugLog(...args) {
        if (CONFIG.debug) {
            console.debug('[Userscript Name]', ...args);
        }
    }

    // =========================================================
    // FEATURE: DESCRIPTIVE FEATURE NAME
    // =========================================================

    const featureName = {
        initialize() {
            // Initialize the feature.
        },

        handleAddedNode(node) {
            // Process dynamically inserted DOM content if needed.
        },

        handleWindowResize() {
            // Recalculate layout if needed.
        }
    };

    // =========================================================
    // FEATURE REGISTRATION
    // =========================================================

    const FEATURES = [
        featureName
    ];

    // =========================================================
    // GLOBAL OBSERVERS
    // =========================================================

    function observePageChanges() {
        const observer = new MutationObserver((mutations) => {
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

    // =========================================================
    // INITIALIZATION
    // =========================================================

    function initialize() {
        for (const feature of FEATURES) {
            feature.initialize?.();
        }

        observePageChanges();
    }

    initialize();
})();
```

---

## Configuration conventions

All user-adjustable behavior belongs in `CONFIG` at the top of the script — feature
toggles, limits, intervals, colors, exclusions, debug logging.

**Do not scatter configurable numeric literals through feature implementations.**

Use descriptive names that carry their units:

- `pollIntervalMs`
- `minimumHeightPx`
- `maximumVisibleItems`
- `dropdownPaddingPx`

Never `timeout`, `size`, or `value`.

---

## Selector conventions

Important or shared selectors belong in `SELECTORS`.

Prefer, in order:

1. `data-*` automation identifiers.
2. Stable element IDs.
3. ARIA roles and attributes.
4. Semantic attributes such as `name`.
5. Stable framework class names.
6. Generated CSS class names — last resort only.

Avoid selectors that rely solely on generated classes such as `css-19cnjtd`. When a
framework class such as `.MuiAutocomplete-listbox` is required, **add a comment
explaining why it is considered sufficiently stable**.

---

## Feature conventions

Each feature is self-contained under a clearly labeled header and should:

- Have a single responsibility.
- Avoid touching unrelated page components.
- Guard against duplicate event-handler attachment (mark processed nodes).
- Clean up intervals and observers when the watched node is removed.
- Support dynamically rendered React components where necessary.
- Avoid continuous polling unless DOM events or observers genuinely cannot detect the
  change — and **document the workaround** when polling is required.
- Use `requestAnimationFrame` for DOM measurements when appropriate.
- Avoid scanning every element in the DOM unnecessarily.
- Fail safely when expected elements are absent.

**React-controlled inputs:** do not overwrite `input.value` directly unless the script
deliberately dispatches the events React requires to observe the change.

---

## Logging

```javascript
const CONFIG = {
    debug: false
};

function debugLog(...args) {
    if (CONFIG.debug) {
        console.debug('[Userscript Name]', ...args);
    }
}
```

No unconditional diagnostic `console.*` calls in committed scripts. The validator
rejects them. If one is genuinely necessary, annotate that line with
`/* allow-console */` and explain why.

---

## Security and privacy

**Never commit** secrets, credentials, session data, client information, access tokens,
private URLs, or any sensitive value.

Before any push to a public repository, scan the whole repository for:

company names that should not be public · client names · client identifiers · ticket
numbers · internal hostnames and paths · email addresses · API keys · tokens ·
credentials · internal documentation links · organization IDs · tenant IDs · Rewst
organization IDs · ConnectWise identifiers · debug output containing real data.

Present findings to the user and **wait for their decision**.

---

## Tooling

```bash
npm run validate     # validate every .user.js file; nonzero exit on failure
npm run catalog      # regenerate the README script catalog from metadata
npm run check        # validate + confirm the catalog is current (what CI runs)
```

**Run `npm run check` before finishing any task that touches a script or the README.**

The README region between `<!-- BEGIN SCRIPT CATALOG -->` and
`<!-- END SCRIPT CATALOG -->` is generated. Never edit it by hand.

CI (`.github/workflows/validate-userscripts.yml`) runs on pull requests and pushes to
`main`. It must never create automatic commits.

---

## Existing script intake workflow

When the user supplies an existing userscript, work through this in order:

1. Save an untouched copy under `.migration/` (gitignored) for comparison.
2. Identify the target application.
3. Identify the pages and paths it should match.
4. Inspect the metadata header.
5. Identify every feature in the script.
6. Identify hard-coded values that belong in `CONFIG`.
7. Identify unstable selectors.
8. Identify polling, observer, and event-listener behavior.
9. Identify permissions and grants actually required.
10. Check for sensitive information.
11. Recommend a destination filename and directory.
12. Refactor into the repository convention.
13. **Preserve working behavior.**
14. Add or correct update metadata.
15. Assign or increment the version.
16. Regenerate the README catalog.
17. Add validation coverage if the script needs a check that does not exist yet.
18. Run `npm run check`.
19. Show a concise migration summary.
20. Ask the user to test the behavior that cannot be validated without the live site.
21. **Wait for the test result** before treating the migration as complete.
22. **Commit only after the user approves.**
23. Then ask for the next script.

The migration summary must include: destination path · script name · previous version ·
new version · match patterns · grants · features identified · configuration values
exposed · selectors changed · behavioral changes (if any) · items requiring live testing.

---

## Git workflow

- `main` holds stable scripts.
- Use a feature branch for migrations and significant changes.
- Focused commits. **Never mix unrelated script migrations into one commit.**
- Commit message style:
  - `feat(rewst): add form enhancements userscript`
  - `fix(rewst): resize virtualized autocomplete list`
  - `docs: add userscript installation catalog`
  - `chore: add userscript validation workflow`

Before every commit:

1. Show the files changed.
2. Run validation.
3. Summarize the changes.
4. **Ask for approval.**

**Never push, publish, or make the repository public without explicit approval.**
Before running any destructive Git operation, explain the exact operation and get
approval first.

---

## Known script-specific behavior

### Rewst form enhancements

Validated behaviors that must be preserved:

1. Applies only to `https://app.rewst.io/organizations/*/form/*`.
2. Auto-resizes visible multiline MUI textareas to fit their content.
3. Ignores MUI's hidden measurement textarea, identified by
   `textarea[aria-hidden="true"]`.
4. Detects programmatic value changes that do not emit ordinary `input` events.
5. Expands Rewst's virtualized MUI autocomplete result list.
6. The autocomplete popup is rendered dynamically as `.MuiAutocomplete-popper`.
7. The actual fixed-height scrolling element is `.MuiAutocomplete-listbox`.
8. The listbox is sized to the **lesser** of the number of rendered options and a
   configurable maximum visible option count.
9. Option rows have **varying heights** — sum the actual rendered option heights rather
   than assuming a fixed row height.
10. Keep a configurable `maximumVisibleItems: 5`.
11. Keep a small configurable bottom padding to prevent clipping.
12. **Do not** resize only the popper, paper, or inner `ul`. Testing established that the
    inline height on `.MuiAutocomplete-listbox` is the actual constraint.
