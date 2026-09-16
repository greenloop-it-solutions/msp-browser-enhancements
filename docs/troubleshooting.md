# Troubleshooting

## The script does not run at all

Work down this list in order.

1. **Is Tampermonkey enabled?** Check the toolbar icon. A greyed-out icon means the
   extension is disabled.
2. **Is Developer mode on?** Chrome and Edge silently refuse to execute userscripts
   without it. Open `chrome://extensions` / `edge://extensions` and enable
   **Developer mode**. This is the single most common cause.
3. **Is the script enabled?** Tampermonkey dashboard → **Installed userscripts** → check
   the **Enabled** column.
4. **Does the URL actually match?** Compare the address bar against the script's `@match`
   lines in the [catalog](../README.md#script-catalog). Matches here are deliberately
   narrow — `.../form/abc` matches, `.../forms` does not.
5. **Is the badge counting the script?** Click the Tampermonkey toolbar icon on the
   affected page. Scripts active on that page are listed. If the script is not listed,
   the problem is the match pattern, not the script's logic.
6. **Hard refresh.** `Ctrl+Shift+R`. Some `@run-at document-start` behavior only applies
   on a fresh load.

## It worked yesterday and stopped today

The target application almost certainly shipped a UI change and a selector no longer
matches. This is the normal failure mode for userscripts against third-party apps.

To confirm:

1. Set `debug: true` in the script's `CONFIG` (dashboard → script → edit → save).
2. Reload the page and open the browser console (`F12` → **Console**).
3. The script logs under its own `[Script Name]` prefix. Missing "found element" style
   messages point at the broken selector.
4. Right-click the element that should be affected → **Inspect**, and compare its
   attributes and classes against the `SELECTORS` object in the script.

Then open a [bug report](../.github/ISSUE_TEMPLATE/bug-report.md) including the script
name, its version, the browser, and what changed in the page. Do **not** paste
screenshots or console output containing customer data.

## One feature misbehaves but the rest are fine

Every script exposes per-feature toggles:

```javascript
const CONFIG = {
    features: {
        autoResizeTextareas: true,
        expandAutocompleteList: false    // disabled locally
    }
};
```

Set the offending feature to `false` in your installed copy while a fix is prepared.
Remember that the edit is lost on the next update.

## Tampermonkey never offers an update

- **Confirm the remote version is actually higher.** Open the script's raw URL from the
  catalog and read its `@version`. Compare it against the installed version in the
  dashboard. A code change without a version bump is not a release and will never be
  offered.
- **Force a check:** dashboard → **Installed userscripts** → **Check for userscript
  updates**.
- **Check the interval:** **Settings → Externals → Update interval**. Set **Config mode**
  to *Advanced* if the option is hidden. "Never" disables update checks entirely.
- **Check per-script updating:** dashboard → script → **Settings** tab → **Updates** →
  ensure checking is not disabled for that script.
- **Confirm the URL resolves.** Open the raw URL directly. A 404 means the file was
  renamed or moved, which breaks updates for everyone who installed the old path — report
  it.

## My local edits keep disappearing

Expected. An update replaces the entire script file. Persistent changes belong in the
repository — open a feature request so the setting becomes a `CONFIG` default.

## The script runs twice, or the page behaves erratically

- Check for a **duplicate installation**: the same script installed from two different
  URLs (for example an old gist plus this repository). Remove the stale copy.
- Check for **another extension** modifying the same page.
- If neither applies, this may be a missing duplicate-handler guard in the script. Report
  it with the page and the steps that trigger it.

## Collecting a useful diagnostic report

Include:

- Script name and installed `@version`.
- Browser and version.
- Tampermonkey version (dashboard → **Help**/about).
- The URL **pattern** that reproduces it — for example
  `https://app.rewst.io/organizations/<redacted>/form/<redacted>`.
- What you expected versus what happened.
- Relevant console output from `debug: true`.

**Redact before sharing:** organization IDs, tenant IDs, client names, ticket numbers,
email addresses, internal hostnames, and any token visible in a URL or console line.
Debug output can contain real page data — read it before pasting it.

## Getting help

Open an issue in the repository:

- [Bug report](../.github/ISSUE_TEMPLATE/bug-report.md)
- [Feature request](../.github/ISSUE_TEMPLATE/feature-request.md)
