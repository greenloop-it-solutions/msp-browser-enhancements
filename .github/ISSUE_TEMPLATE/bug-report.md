---
name: Bug report
about: A userscript stopped working, or behaves incorrectly
title: '[bug] '
labels: bug
assignees: ''
---

> **Before you post:** redact organization IDs, tenant IDs, client names, ticket numbers,
> email addresses, internal hostnames, and any token visible in a URL or console line.
> Debug output and screenshots can contain real customer data — read them before pasting.

## Script

- **Name:**
- **Installed version:** <!-- Tampermonkey dashboard -> Installed userscripts -->
- **Version in the repository:** <!-- the @version in the raw file, if different -->

## Environment

- **Browser and version:**
- **Tampermonkey version:**
- **Operating system:**

## What happened

<!-- What the script did. -->

## What you expected

<!-- What it used to do, or should do. -->

## Page

- **URL pattern (redacted):** <!-- e.g. https://app.rewst.io/organizations/<redacted>/form/<redacted> -->

## Steps to reproduce

1.
2.
3.

## Debug output

<!--
Optional but very helpful:
1. Tampermonkey dashboard -> click the script -> set `debug: true` in CONFIG -> Save.
2. Reload the page, open the console (F12), and copy the lines prefixed with the script name.
3. REDACT anything identifying before pasting.
-->

```
```

## Checked already

- [ ] Tampermonkey is enabled and the script is enabled
- [ ] Developer mode is on (`chrome://extensions` / `edge://extensions`) — required on Chrome and Edge
- [ ] The page URL matches the script's `@match` patterns
- [ ] The script appears in the Tampermonkey toolbar popup on that page
- [ ] Hard refresh (`Ctrl+Shift+R`) did not fix it
- [ ] Installed version is the latest (**Check for userscript updates**)
- [ ] Read [docs/troubleshooting.md](../../docs/troubleshooting.md)

## Anything else

<!-- Did the target application change its UI recently? Did it work before a specific date? -->
