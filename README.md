# MSP Browser Enhancements

Tampermonkey userscripts that add small, targeted quality-of-life improvements to the
web applications used day to day by an MSP.

Each userscript in this repository is **independently installable** and scoped to a
single application. Unrelated site customizations are never combined into one
"universal" userscript.

- **Repository:** `greenloop-it-solutions/msp-browser-enhancements`
- **Install branch:** `main`
- **Catalog:** see [Script catalog](#script-catalog) below

---

## Security and privacy warning

Userscripts run **inside your authenticated browser session** on the pages they match.
A userscript can read and modify everything on those pages, including customer data
that happens to be on screen.

Before installing anything from this repository — or anywhere else:

- Read the `@match` lines and confirm you want the script running on those pages.
- Read the `@grant` lines. `@grant none` means the script gets no special Tampermonkey
  privileges. Anything else (`GM_xmlhttpRequest`, `GM_setValue`, …) deserves a closer look.
- Read the script body. These are short, single-file scripts precisely so they can be
  reviewed in a few minutes.

Rules this repository holds itself to:

- **No secrets.** No API keys, tokens, credentials, session data, or authentication
  material is ever committed. A validator scans for them on every push.
- **No customer data.** No client names, client identifiers, ticket numbers,
  organization IDs, tenant IDs, or internal hostnames.
- **No broad matches.** Patterns such as `*://*/*` are rejected by validation.
- **No network exfiltration.** Scripts here modify the page you are already looking at.

---

## Prerequisites

1. A supported browser: Chrome, Edge, Firefox, or another Chromium-based browser.
2. The [Tampermonkey](https://www.tampermonkey.net/) browser extension.
3. For Chrome and Edge (Manifest V3), Tampermonkey requires **Developer mode** to be
   enabled on the extensions page before userscripts will run. Tampermonkey shows a
   warning banner when this is needed.
4. Access to the target application. These scripts enhance an interface you can already
   reach; they do not grant access to anything.

---

## Installing a script

1. Click the **Install** link for the script you want in the [catalog](#script-catalog).
2. Tampermonkey opens its installation screen showing the full source and metadata.
3. Review the `@match`, `@grant`, and code sections.
4. Click **Install**.

Each script is installed on its own. To install all of them in one step instead, use the
import package from the latest release — see [Bulk installation](#bulk-installation).

---

## Script catalog

<!-- BEGIN SCRIPT CATALOG -->

### Rewst

#### Rewst Form Enhancements

Auto-expands multiline text areas to fit their content and enlarges the virtualized autocomplete dropdown on Rewst form pages.

| | |
| --- | --- |
| **Version** | `1.1.0` |
| **Matches** | `https://app.rewst.io/organizations/*/form/*` |
| **Grants** | `none` |
| **Runs at** | `document-idle` |
| **Source** | [scripts/rewst/form-enhancements.user.js](https://github.com/greenloop-it-solutions/msp-browser-enhancements/blob/main/scripts/rewst/form-enhancements.user.js) |

**[Install Rewst Form Enhancements](https://raw.githubusercontent.com/greenloop-it-solutions/msp-browser-enhancements/main/scripts/rewst/form-enhancements.user.js)** — opens the Tampermonkey install prompt. Review the metadata block before confirming.

### Empath

#### Empath Video Unlock (scrub / skip / speed)

Re-enables seeking, scrubbing and keyboard control in the Empath LMS video player, and stops the player from auto-pausing when the window loses focus.

| | |
| --- | --- |
| **Version** | `1.1.0` |
| **Matches** | `https://app.empathmsp.com/*`<br>`https://*.empathmsp.com/*` |
| **Grants** | `none` |
| **Runs at** | `document-start` |
| **Source** | [scripts/empath/video-unlock.user.js](https://github.com/greenloop-it-solutions/msp-browser-enhancements/blob/main/scripts/empath/video-unlock.user.js) |

**[Install Empath Video Unlock (scrub / skip / speed)](https://raw.githubusercontent.com/greenloop-it-solutions/msp-browser-enhancements/main/scripts/empath/video-unlock.user.js)** — opens the Tampermonkey install prompt. Review the metadata block before confirming.

<!-- END SCRIPT CATALOG -->

> This catalog is generated from the userscript metadata blocks by
> `npm run catalog`. Do not edit the region between the catalog markers by hand.

---

## How updates work

Every script declares an `@updateURL` and a `@downloadURL` pointing at its permanent raw
URL on the `main` branch:

```
https://raw.githubusercontent.com/greenloop-it-solutions/msp-browser-enhancements/main/scripts/<application>/<script>.user.js
```

Because the URL is branch-based rather than commit-based, the newest version of a script
is always available at the same address.

What you need to know:

- Tampermonkey periodically fetches the update URL and compares the remote `@version`
  against the installed `@version`. A higher remote version prompts an update.
- **Committing code without incrementing `@version` is not a release.** Tampermonkey
  will not offer an update, and installed copies will keep running the old code.
  Every behavior change must come with a version bump.
- You can check immediately: open the Tampermonkey dashboard, go to the **Installed
  userscripts** tab, and choose **Check for userscript updates** (or use the "Last
  updated" column's update action).
- Update checking frequency is a Tampermonkey setting (**Settings → Externals →
  Update interval**). The default is periodic, not instant.
- Updates respect the same `@match` and `@grant` review you did at install time. If a
  new version widens its matches or adds grants, Tampermonkey shows you before applying.

Versions follow [Semantic Versioning](https://semver.org/) with three numeric
components:

| Increment | Used for |
| --- | --- |
| **PATCH** (`1.0.0` → `1.0.1`) | Bug fixes, selector updates, internal refactoring with no intended behavior change. |
| **MINOR** (`1.0.1` → `1.1.0`) | Backward-compatible features or new configurable behavior. |
| **MAJOR** (`1.1.0` → `2.0.0`) | Breaking behavior or installation changes. |

A published version is never reduced or reused.

---

## Bulk installation

Two supported ways to install, depending on what you want.

### Per script, from the catalog — the default

Click the **Install** link for each script you want in the [catalog](#script-catalog).
This is the right choice for most people: you see each script's source and permissions
before it installs, and each one wires up its own update URL.

### Everything at once, from the latest release

Each release publishes a **Tampermonkey import package** containing every userscript in
this repository.

**[Download the latest release](https://github.com/greenloop-it-solutions/msp-browser-enhancements/releases/latest)**

1. Download `msp-browser-enhancements-tampermonkey-import.txt` from the release assets.
2. Open the Tampermonkey dashboard.
3. Go to the **Utilities** tab.
4. Under **Import from file**, choose the downloaded file.
5. Click **Import**.
6. Tampermonkey lists every script in the package for confirmation. **Review the match
   patterns and grants**, then confirm.

The import is still shown to you and still requires confirmation — this is Tampermonkey's
own import screen, not a silent installer. This repository does not implement a remote
"batch installer"; installation always stays visible and user-controlled.

**Each imported script keeps its own `@updateURL`**, so scripts installed this way
continue to update from GitHub exactly as if you had installed them individually. The
package sets `file_url` and `check_for_updates` on every entry for this reason.

Things to know before importing:

- **Importing replaces a script you already have installed.** Any local edits you made to
  an installed copy — a changed `CONFIG` value, a disabled feature — are overwritten. If
  you have tweaked a script locally, install the others individually instead.
- **The package never carries script storage.** Every entry ships with empty storage, so
  nothing from anyone's browser profile travels with it.
- **The backup format is Tampermonkey's own and is versioned.** The package is built to
  format `version: "1"`. If a future Tampermonkey release changes that format, the import
  may stop working — the per-script raw URLs in the catalog always work and are the
  authoritative installation method.

### When a release is published

A release is cut automatically when a commit to `main` changes any script's `@version`,
adds a script, or removes one. The release tag is derived from a hash of every script
name and version, so documentation and tooling commits do not produce a release.

This is the same rule Tampermonkey itself applies: **a code change without a `@version`
bump is not a release.**

### Moving an existing setup between browsers

To carry your *current* configuration — including local edits and script storage — use
Tampermonkey's own export rather than this package:

1. Source browser → Tampermonkey dashboard → **Utilities** → **Export**.
2. Target browser → **Utilities** → **Import from file** → select that file.

Use the same major Tampermonkey version on both ends where possible.

---

## Troubleshooting

Full guide: [docs/troubleshooting.md](docs/troubleshooting.md).

The short version:

| Symptom | First thing to check |
| --- | --- |
| Script does nothing | Is Tampermonkey enabled, and does the current URL actually match the script's `@match`? |
| Script does nothing on Chrome/Edge | Is **Developer mode** enabled on `chrome://extensions`? Manifest V3 requires it. |
| Worked yesterday, not today | The application shipped a UI change and a selector broke. Open an issue with the page and what stopped working. |
| No update offered | The remote `@version` must be *higher* than the installed one. Use **Check for userscript updates** to force a check. |
| Feature misbehaves | Every script has a `CONFIG` block at the top with per-feature toggles. Turn the offending feature off locally while the fix lands. |
| Need diagnostics | Set `debug: true` in the script's `CONFIG` block and watch the browser console. |

---

## Contributing and development

See [docs/development.md](docs/development.md) for the full conventions, and
[CLAUDE.md](CLAUDE.md) for the rules applied by AI-assisted sessions in this repository.

Summary of the conventions:

- One userscript per file, `lowercase-kebab-case.user.js`, under
  `scripts/<application>/`.
- Exactly one metadata block per file, fields in the documented order.
- `@match` entries are explicit and narrowly scoped. Broad matches require explicit
  approval and are rejected by validation.
- `@grant none` unless a grant is genuinely required.
- All tunable values live in a `CONFIG` object at the top of the script. Important
  selectors live in a `SELECTORS` object. No magic numbers scattered through features.
- Features are self-contained modules registered in a `FEATURES` array.
- Diagnostics go through a `debugLog()` helper gated on `CONFIG.debug`. No unconditional
  `console.log` in committed scripts.
- Version bumps accompany every behavior change.

Local commands:

```bash
npm install          # no runtime dependencies; creates the lockfile CI uses
npm run validate     # validate all userscripts
npm run catalog      # regenerate the README script catalog
npm run check        # validate + verify the catalog is current (what CI runs)
npm run package      # build the Tampermonkey import package into dist/
```

`dist/` is generated and gitignored — release artifacts are never committed to the source
tree. The build is reproducible: the same scripts always produce a byte-identical package.

CI runs `npm run check` on pull requests and on pushes to `main`. It never creates
commits on your behalf — if the catalog is stale, the build fails and you regenerate and
commit it yourself.

---

## License

[MIT](LICENSE)
