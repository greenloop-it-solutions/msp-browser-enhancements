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

## Moving your setup to another browser or machine

Tampermonkey's own export/import is the documented way to do this:

1. Source browser → Tampermonkey dashboard → **Utilities**.
2. Under **Zip**, click **Export**. Use **Export with local storage** if a script stores
   data you want to carry over.
3. Target browser → **Utilities** → **Zip → Import** → select the downloaded file.

Caveats:

- The export format is Tampermonkey's own and varies between extension versions. Use the
  same major version on both ends where possible.
- Whether a restored script keeps updating depends on its `@updateURL` surviving the
  round trip. Installing from the raw GitHub URLs in the catalog is the only method that
  guarantees update metadata is correct.

This repository does **not** generate a synthetic Tampermonkey import package. Building
one would mean reproducing an undocumented internal format, and a mismatched package can
import scripts without their update metadata — leaving scripts that silently never update
again. See [Bulk installation](../README.md#bulk-installation).
