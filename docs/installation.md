# Installation

## 1. Install Tampermonkey

Install the [Tampermonkey](https://www.tampermonkey.net/) extension for your browser.

### Chrome and Edge require Developer mode

Under Manifest V3, Chromium browsers will not execute userscripts unless **Developer
mode** is enabled:

- **Chrome:** open `chrome://extensions`, toggle **Developer mode** on (top right).
- **Edge:** open `edge://extensions`, toggle **Developer mode** on (left sidebar).

Tampermonkey displays a warning on its dashboard when this step is missing. Firefox does
not require it.

## 2. Install a script

1. Open the [script catalog](../README.md#script-catalog).
2. Click the **Install** link for the script you want.
3. Tampermonkey opens an installation page showing the complete source and metadata.
4. **Review it before confirming:**
   - `@match` — the pages the script will run on.
   - `@grant` — the Tampermonkey privileges it requests. `none` is the safe default.
   - The script body itself.
5. Click **Install**.

Repeat for each script you want. Scripts are independent; installing one has no effect
on any other.

## 3. Verify it is running

1. Open a page the script matches.
2. The Tampermonkey toolbar icon shows a badge with the number of active scripts on the
   current page.
3. Click the icon to see which scripts are running and to toggle them.

If the badge shows nothing, see [troubleshooting.md](troubleshooting.md).

## 4. Configure a script

Every script keeps its tunable settings in a `CONFIG` object at the very top of the file:

```javascript
const CONFIG = {
    debug: false,

    features: {
        autoResizeTextareas: true,
        expandAutocompleteList: true
    },

    expandAutocompleteList: {
        maximumVisibleItems: 5
    }
};
```

To change a setting, edit the installed copy: Tampermonkey dashboard → **Installed
userscripts** → click the script name → edit → **Save**.

> **Local edits are overwritten when the script updates.** Tampermonkey replaces the
> whole file with the new version. If you find yourself re-applying the same tweak after
> every update, open an issue asking for it to become a repository default.

## Updates

Scripts declare `@updateURL` and `@downloadURL` pointing at the permanent raw URL on the
`main` branch, so the newest version always lives at the same address.

- Tampermonkey periodically checks the update URL and compares `@version` values. A
  higher remote version prompts an update.
- To check immediately: Tampermonkey dashboard → **Installed userscripts** →
  **Check for userscript updates**.
- The automatic interval is configurable under **Settings → Externals → Update
  interval** (switch **Config mode** to *Advanced* if you do not see it).
- A script whose `@version` did not increase will never be offered as an update, even if
  its code changed.

## Uninstalling

Tampermonkey dashboard → **Installed userscripts** → trash icon next to the script.

To disable temporarily instead, use the **Enabled** toggle in the same row, or the
per-page toggle in the toolbar popup.

## Installing everything at once

Each release publishes a Tampermonkey import package containing every userscript in this
repository.

1. Open the
   [latest release](https://github.com/greenloop-it-solutions/msp-browser-enhancements/releases/latest).
2. Download `msp-browser-enhancements-tampermonkey-import.txt` from the assets.
3. Open the Tampermonkey dashboard → **Utilities** tab.
4. Under **Import from file**, choose the downloaded file and click **Import**.
5. Tampermonkey lists every script in the package. **Review the matches and grants**, then
   confirm.

Each imported script keeps its own `@updateURL`, so it continues to update from GitHub
afterwards just like an individually installed script.

Before you import:

- **Importing replaces a script you already have installed**, including any local `CONFIG`
  edits. If you have tweaked a script, install the others individually instead.
- **No script storage travels with the package** — every entry ships with empty storage.
- **The format is versioned.** The package targets Tampermonkey backup format
  `version: "1"`. If a future Tampermonkey release changes it, the import may stop working;
  the per-script raw URLs in the catalog are the authoritative method and always work.

Releases are cut automatically when a commit to `main` changes any script's `@version`,
adds a script, or removes one. Documentation and tooling commits do not produce a release.

## Moving your setup to another browser or machine

The import package above installs the *repository's* current scripts. To carry your own
configuration — local edits and script storage included — use Tampermonkey's own export:

1. Source browser → Tampermonkey dashboard → **Utilities**.
2. Under **Zip**, click **Export**. Use **Export with local storage** if a script stores
   data you want to carry over.
3. Target browser → **Utilities** → **Import from file** → select the downloaded file.

Use the same major Tampermonkey version on both ends where possible. Whether a restored
script keeps updating depends on its `@updateURL` surviving the round trip; installing
from the raw GitHub URLs in the catalog is the only method that guarantees it.
