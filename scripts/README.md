# Scripts

Each userscript lives at:

```
scripts/<application>/<script-name>.user.js
```

- `<application>` is a lowercase kebab-case directory, one per target application.
- Filenames are lowercase kebab-case and end in `.user.js`.
- One application per script. Unrelated site customizations are never combined into a
  single "universal" userscript.
- New application directories must also be added to `userscripts.applications` in
  `package.json`, which supplies the display name used in the README catalog.

Application directories are created when a script needs one, so this tree only contains
applications that are actually covered.

See [docs/development.md](../docs/development.md) for the full conventions and
[README.md](../README.md#script-catalog) for the installation catalog.
