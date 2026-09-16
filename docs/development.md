# Development

Conventions for adding to and maintaining the userscripts in this repository.
[CLAUDE.md](../CLAUDE.md) holds the same rules in the form used by AI-assisted sessions.

## Layout

```
scripts/<application>/<script-name>.user.js
```

- `<application>` is a lowercase kebab-case directory, one per target application
  (`rewst`, `empath`, `connectwise`, `it-glue`, `microsoft-365`, `other`).
- Directories are created when a script needs them. Empty directories are not committed.
- New application directories should also be added to `userscripts.applications` in
  `package.json`, which supplies the display name used in the README catalog.

**One application per script.** Unrelated site customizations are never combined into a
single "universal" userscript — that would force an over-broad `@match` and make review
and versioning meaningless.

## Requirements for every script

| Requirement | Notes |
| --- | --- |
| `.user.js` extension | Enforced by the validator. |
| `lowercase-kebab-case` filename | Enforced by the validator. |
| Exactly one metadata block | Enforced by the validator. |
| Independent `@version` | Three numeric components. |
| Narrow `@match` entries | Broad patterns such as `*://*/*` are rejected. |
| `@grant none` unless a grant is genuinely needed | Each additional grant widens the script's privileges. |
| `@run-at` when timing matters | Omit when the default is fine. |
| `@updateURL` and `@downloadURL` | Identical, and matching the file's real repository path. |
| No secrets, no customer data | Scanned on every validation run. |

## Metadata block

Fields in this order:

```javascript
// ==UserScript==
// @name         Rewst Form Enhancements
// @namespace    https://github.com/greenloop-it-solutions/msp-browser-enhancements
// @version      1.0.0
// @description  Short, factual description of what the script does.
// @author       GreenLoop IT Solutions
// @homepageURL  https://github.com/greenloop-it-solutions/msp-browser-enhancements
// @supportURL   https://github.com/greenloop-it-solutions/msp-browser-enhancements/issues
// @updateURL    https://raw.githubusercontent.com/greenloop-it-solutions/msp-browser-enhancements/main/scripts/rewst/form-enhancements.user.js
// @downloadURL  https://raw.githubusercontent.com/greenloop-it-solutions/msp-browser-enhancements/main/scripts/rewst/form-enhancements.user.js
// @match        https://app.rewst.io/organizations/*/form/*
// @run-at       document-idle
// @grant        none
// ==/UserScript==
```

Required regardless: `@name`, `@namespace`, `@version`, `@description`, `@match`,
`@grant`. Omit other fields only when they genuinely do not apply.

`@updateURL` and `@downloadURL` always point at the **`main` branch raw URL**, never a
commit SHA — a pinned URL would freeze the script at one version forever.

## Versioning

| Increment | When |
| --- | --- |
| PATCH `1.0.0` → `1.0.1` | Bug fixes, selector updates, refactoring with no intended behavior change. |
| MINOR `1.0.1` → `1.1.0` | Backward-compatible features or new configurable behavior. |
| MAJOR `1.1.0` → `2.0.0` | Breaking behavior or installation changes. |

Never reduce or reuse a published version. **A code change without a version bump is not
a release** — Tampermonkey compares `@version` and will not offer the update.

## Script structure

```javascript
(function () {
    'use strict';

    // =========================================================
    // CONFIGURATION
    // =========================================================

    const CONFIG = { /* ... */ };

    // =========================================================
    // SELECTORS
    // =========================================================

    const SELECTORS = { /* ... */ };

    // =========================================================
    // SHARED UTILITIES
    // =========================================================

    function debugLog(...args) { /* ... */ }

    // =========================================================
    // FEATURE: DESCRIPTIVE FEATURE NAME
    // =========================================================

    const featureName = {
        initialize() { },
        handleAddedNode(node) { },
        handleWindowResize() { }
    };

    // =========================================================
    // FEATURE REGISTRATION
    // =========================================================

    const FEATURES = [featureName];

    // =========================================================
    // GLOBAL OBSERVERS / INITIALIZATION
    // =========================================================

    // ...
})();
```

This is a convention, not a mandate to write empty functions. Include only the lifecycle
methods a feature actually uses; the dispatcher calls them optionally
(`feature.handleAddedNode?.(node)`).

### Configuration

Everything adjustable goes in `CONFIG` at the top — feature toggles, limits, intervals,
colors, page exclusions, `debug`.

Names carry their units:

- ✅ `pollIntervalMs`, `minimumHeightPx`, `maximumVisibleItems`, `dropdownPaddingPx`
- ❌ `timeout`, `size`, `value`, `max`

**No configurable numeric literals buried inside feature code.** If a reviewer would
plausibly want to change a number, it belongs in `CONFIG`.

### Selectors

Shared or important selectors go in `SELECTORS`. Prefer, in order:

1. `data-*` automation identifiers
2. Stable element IDs
3. ARIA roles and attributes
4. Semantic attributes such as `name`
5. Stable framework class names
6. Generated CSS class names — last resort only

Never depend solely on a generated class such as `css-19cnjtd`; those change on every
build of the target app. When a framework class is genuinely required, comment on why it
is stable:

```javascript
const SELECTORS = {
    expandAutocompleteList: {
        // MUI component class, part of Material UI's public API and stable across
        // minor releases, unlike the generated css-* classes beside it.
        listbox: '.MuiAutocomplete-listbox'
    }
};
```

### Features

Each feature is self-contained under a labeled header and must:

- Have a single responsibility.
- Avoid touching unrelated page components.
- Guard against duplicate handler attachment — mark processed nodes, for example with a
  `dataset` flag.
- Clean up intervals and observers when the watched node is removed.
- Handle dynamically rendered React content.
- Avoid continuous polling unless events and observers genuinely cannot detect the
  change — and document why when polling is unavoidable.
- Use `requestAnimationFrame` for DOM measurements when appropriate.
- Avoid scanning the whole DOM unnecessarily.
- Fail safely when expected elements are missing.

### React-controlled inputs

Setting `input.value` directly does not notify React. If a script must write into a
controlled input, it has to use the native setter and dispatch the events the app
listens for:

```javascript
const setter = Object.getOwnPropertyDescriptor(
    window.HTMLTextAreaElement.prototype,
    'value'
).set;

setter.call(textarea, nextValue);
textarea.dispatchEvent(new Event('input', { bubbles: true }));
```

Do this only when the script intends to change the application's state. Reading and
measuring never requires it.

### Logging

```javascript
const CONFIG = { debug: false };

function debugLog(...args) {
    if (CONFIG.debug) {
        console.debug('[Rewst Form Enhancements]', ...args);
    }
}
```

No unconditional `console.*` calls in committed scripts — the validator rejects them. If
one is truly necessary, annotate that line with `/* allow-console */` and explain why.

## Tooling

```bash
npm install          # no runtime dependencies; creates the lockfile CI uses
npm run validate     # validate every .user.js file
npm run catalog      # regenerate the README script catalog
npm run catalog:check
npm run check        # validate + catalog:check — what CI runs
npm run package      # build the Tampermonkey import package into dist/
```

`dist/` is gitignored; generated archives are never committed. `npm run package` is
reproducible — the same set of scripts always produces a byte-identical file.

Run `npm run check` before opening a pull request.

### What the validator checks

File naming and placement · exactly one metadata block · required fields present and
non-empty · unique `@name` across the repository · three-part `@version` · at least one
`@match` · `@grant` present and `none` not mixed with others · `@updateURL` and
`@downloadURL` present, identical, and matching the file's real path · duplicate singular
metadata fields · broad or unrecognizable match patterns · unreplaced placeholders such
as `OWNER` or `YOURORG` · unconditional `console.*` and `debugger` statements ·
credential and token patterns · JavaScript syntax errors.

Errors exit nonzero; warnings do not.

### The README catalog is generated

The region between `<!-- BEGIN SCRIPT CATALOG -->` and `<!-- END SCRIPT CATALOG -->` in
`README.md` is produced by `npm run catalog` from the metadata blocks. Never hand-edit
it. CI fails if it is stale — regenerate and commit it yourself; the workflow never
creates commits.

### The import package and releases

`tools/build-import-package.mjs` writes a Tampermonkey import package in the format
Tampermonkey's own **Utilities → Export** produces: JSON with base64-encoded sources,
backup format `version: "1"`. Every field mirrors one that appears in a genuine export.

Each entry sets `file_url` to the script's raw URL and `check_for_updates: true`, so
imported scripts keep updating from GitHub. Script storage is always written empty —
real storage from a browser profile can hold tokens and customer data and must never
be published.

`.github/workflows/release-import-package.yml` publishes the package as a release. The
release tag is `pkg-<hash>`, where the hash covers every script name and version, so:

- Changing any `@version`, adding a script, or removing one produces a new tag and a new
  release.
- A docs or tooling commit produces a tag that already exists, and the workflow skips it.

If a future Tampermonkey release changes the backup format, confirm the new shape against
a fresh export before bumping `BACKUP_FORMAT_VERSION`.

## Adding a new script

1. Create `scripts/<application>/<script-name>.user.js`.
2. Add the metadata block, starting at `@version 1.0.0`.
3. Implement it using the structure above.
4. Add the application to `userscripts.applications` in `package.json` if it is new.
5. `npm run catalog`
6. `npm run check`
7. Commit the script and the regenerated README together.

## Changing an existing script

1. Note the current `@version`.
2. Make the change.
3. Bump `@version` by the appropriate increment.
4. `npm run check`
5. Test against the live application — most behavior here cannot be verified locally.
6. Call out any behavior change explicitly in the commit message and pull request.

**Do not remove working behavior to improve style.** Preserve existing selectors, timing
workarounds, and observers unless there is a demonstrated reason to change them. Odd code
in these scripts is usually a workaround for a quirk of the target application; document
it rather than deleting it.

## Git workflow

- `main` holds stable scripts.
- Feature branch per migration or significant change.
- Focused commits — never mix unrelated script migrations.
- Commit message style:
  - `feat(rewst): add form enhancements userscript`
  - `fix(rewst): resize virtualized autocomplete list`
  - `docs: add userscript installation catalog`
  - `chore: add userscript validation workflow`

## Security

Never commit secrets, credentials, session data, client information, access tokens,
private URLs, or other sensitive values.

Before any push to a public repository, review the whole tree for: company names that
should not be public, client names and identifiers, ticket numbers, internal hostnames
and paths, email addresses, API keys, tokens, credentials, internal documentation links,
organization IDs, tenant IDs, Rewst organization IDs, ConnectWise identifiers, and debug
output containing real data.

The validator catches common token shapes, but it is a backstop — not a substitute for
reading the diff.
