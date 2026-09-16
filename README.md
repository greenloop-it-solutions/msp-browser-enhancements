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

Each script is installed on its own. There is no single link that installs everything —
see [Bulk installation](#bulk-installation) for why, and for the alternatives.

---

## Script catalog

<!-- BEGIN SCRIPT CATALOG -->

_No userscripts have been migrated into this repository yet._

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

**There is no supported way to install every script in this repository with one click,
and this repository will not implement one.** A "batch installer" that silently installs
scripts defeats the review step that makes userscripts safe. Installation stays visible
and user-controlled.

The practical alternatives:

### Recommended: install the scripts you want, individually

Most people need two or three scripts, not all of them. Installing from each raw URL is
the only method that wires up per-script `@updateURL` metadata correctly, so each script
keeps updating on its own afterwards.

### Moving an existing setup to another machine: Tampermonkey's own export/import

Tampermonkey can export your installed scripts and settings to a ZIP file and import
that file elsewhere. This is the documented, version-matched way to move a configuration
between browsers or machines:

1. On the source browser, open the Tampermonkey dashboard.
2. Go to **Utilities**.
3. Under **Zip**, choose **Export** (optionally "Export with local storage" if a script
   stores data you want to carry over). A `.zip` file downloads.
4. On the target browser, open **Utilities**, and under **Zip → Import** select that
   file and import it.

Caveats:

- The export format is Tampermonkey's own and **varies between extension versions**.
  Export and import with the same major Tampermonkey version where possible.
- This repository deliberately does **not** generate a synthetic import package. Doing so
  would mean reproducing an undocumented internal format, and a package built against the
  wrong extension version can import scripts without their update metadata — leaving you
  with scripts that silently never update again.
- An import package is not a substitute for per-script update URLs. Scripts installed
  from the raw GitHub URLs above keep themselves current; scripts restored from a ZIP
  only update if their original `@updateURL` survived the round trip.

If a documented, version-stable package format becomes available, a `npm run package`
generator may be added to produce it as a **release artifact only** — generated archives
are never committed to the source tree.

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
```

CI runs `npm run check` on pull requests and on pushes to `main`. It never creates
commits on your behalf — if the catalog is stale, the build fails and you regenerate and
commit it yourself.

---

## License

[MIT](LICENSE)
